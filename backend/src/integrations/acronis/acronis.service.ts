// backend/src/integrations/acronis/acronis.service.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type {
  AcronisActivity, AcronisConnection, AcronisPage, AcronisPlanDiscovery, AcronisPlanStatus,
  AcronisPlanSummary, AcronisTask, AcronisThresholds,
} from './dto/acronis-api.dto';
import type { BackupJobStatus } from '../veeam/dto/veeam-api.dto';
import {
  evaluateActivityResources, evaluateResources, groupByPlan, isBackupTask, parseAcronisTimestamp,
} from './acronis.evaluation';
import { toBackupJobStatus } from './acronis.mapper';

export const DEFAULT_THRESHOLDS: AcronisThresholds = { staleWarningHours: 26, staleErrorHours: 48 };

const TASKS_PATH = '/api/task_manager/v2/tasks';
const ACTIVITIES_PATH = '/api/task_manager/v2/activities';
const TASKS_LIMIT = 500;
const TASKS_MAX_PAGES = 20;
const ACTIVITIES_LIMIT = 200;
const ACTIVITIES_MAX_PAGES = 3;
const TOKEN_MARGIN_MS = 60_000;
const TOKEN_FALLBACK_TTL_MS = 5 * 60_000;
const PLAN_CACHE_TTL_MS = 5 * 60_000;

// Un plan configurado sin ninguna corrida de backup en Acronis (borrado, nunca corrió o sin recursos).
export class AcronisNoTasksError extends Error {}

export interface AcronisPlanRef { policyId: string; policyName: string }

interface HttpError { message?: string; response?: { status?: number } }

@Injectable()
export class AcronisService {
  private readonly tokens = new Map<string, { token: string; expiresAt: number }>();
  private readonly planCache = new Map<string, { at: number; promise: Promise<AcronisPlanStatus> }>();

  constructor(private readonly http: HttpService) {}

  private base(conn: AcronisConnection): string {
    return conn.baseUrl.trim().replace(/\/+$/, '');
  }

  private tokenKey(conn: AcronisConnection): string {
    return `${this.base(conn)}|${conn.clientId}`;
  }

  private assertConfigured(conn: AcronisConnection): void {
    if (!conn.baseUrl || !conn.clientId || !conn.clientSecret) {
      throw new Error('Acronis no está configurado. Completá la URL, el Client ID y el Client secret en Admin → Integraciones.');
    }
  }

  private async getToken(conn: AcronisConnection): Promise<string> {
    const key = this.tokenKey(conn);
    const cached = this.tokens.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.token;

    const basic = Buffer.from(`${conn.clientId}:${conn.clientSecret}`).toString('base64');
    let data: { access_token?: string; expires_on?: number };
    try {
      const res = await firstValueFrom(
        this.http.post(`${this.base(conn)}/api/2/idp/token`, new URLSearchParams({ grant_type: 'client_credentials' }), {
          headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
          timeout: 30000,
        }),
      );
      data = res.data ?? {};
    } catch (err) {
      const e = err as HttpError;
      throw new Error(e.response?.status
        ? `Acronis rechazó la autenticación (HTTP ${e.response.status})`
        : `No se pudo conectar a Acronis: ${e.message ?? 'error desconocido'}`);
    }
    if (!data.access_token) throw new Error('La respuesta de autenticación de Acronis no trae access_token');

    const expiresAt = data.expires_on ? data.expires_on * 1000 - TOKEN_MARGIN_MS : Date.now() + TOKEN_FALLBACK_TTL_MS;
    this.tokens.set(key, { token: data.access_token, expiresAt });
    return data.access_token;
  }

  private async get<T>(conn: AcronisConnection, path: string, params: Record<string, string>, retry = true): Promise<T> {
    const token = await this.getToken(conn);
    try {
      const res = await firstValueFrom(
        this.http.get<T>(`${this.base(conn)}${path}`, {
          params, timeout: 30000, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        }),
      );
      return res.data;
    } catch (err) {
      const e = err as HttpError;
      if (e.response?.status === 401 && retry) {
        this.tokens.delete(this.tokenKey(conn));
        return this.get<T>(conn, path, params, false);
      }
      throw new Error(e.response?.status
        ? `Acronis respondió HTTP ${e.response.status} en ${path}`
        : `No se pudo conectar a Acronis (${path}): ${e.message ?? 'error desconocido'}`);
    }
  }

  // Con `after` presente el request solo puede llevar limit + after (el cursor ya codifica
  // filtro y orden; cualquier otro parámetro da HTTP 400). La primera página lleva todos los filtros.
  private async paginate<T>(
    conn: AcronisConnection, path: string, firstParams: Record<string, string>, limit: number, maxPages: number,
  ): Promise<{ items: T[]; truncated: boolean }> {
    const items: T[] = [];
    let after: string | undefined;
    for (let i = 0; i < maxPages; i++) {
      const params = after ? { limit: String(limit), after } : firstParams;
      const data = await this.get<AcronisPage<T>>(conn, path, params);
      items.push(...(data?.items ?? []));
      after = data?.paging?.cursors?.after;
      if (!after) return { items, truncated: false };
    }
    return { items, truncated: true };
  }

  // Descubrimiento de planes (para asignarlos a clientes en Admin). Tolera resultado parcial.
  async listPlans(conn: AcronisConnection): Promise<AcronisPlanDiscovery> {
    this.assertConfigured(conn);
    const { items, truncated } = await this.paginate<AcronisTask>(
      conn, TASKS_PATH, { limit: String(TASKS_LIMIT), order: 'desc(id)', state: 'completed' }, TASKS_LIMIT, TASKS_MAX_PAGES,
    );
    const plans: AcronisPlanSummary[] = [...groupByPlan(items.filter(isBackupTask)).values()].map(g => ({
      policyId: g.policyId, policyName: g.policyName, tenantId: g.tenantId, tenantName: g.tenantName,
      resourceTypes: [...new Set(g.tasks.map(t => t.resource?.type || '?'))].sort(),
      resourceCount: new Set(g.tasks.map(t => t.resource?.id)).size,
    }));
    plans.sort((a, b) => a.tenantName.localeCompare(b.tenantName) || a.policyName.localeCompare(b.policyName));
    return { plans, partial: truncated };
  }

  // Un job genérico por plan configurado. Un plan sin corridas es un problema (Failed), no un "ok".
  // Cualquier otro error se propaga: el cliente figura como desconectado en vez de mostrar un estado parcial.
  async getJobStatuses(
    conn: AcronisConnection, refs: AcronisPlanRef[], th: AcronisThresholds = DEFAULT_THRESHOLDS,
  ): Promise<BackupJobStatus[]> {
    if (!refs.length) return [];
    return Promise.all(refs.map(async ref => {
      try {
        return toBackupJobStatus(await this.getPlanStatus(conn, ref.policyId, th), th);
      } catch (err) {
        if (!(err instanceof AcronisNoTasksError)) throw err;
        return {
          jobId: ref.policyId, jobName: ref.policyName, jobType: 'Acronis', isRunning: false, lastResult: 'Failed' as const,
          lastMessage: 'Acronis no registra corridas de backup para este plan', lastRunAt: null, hoursAgo: null, isStale: false,
        };
      }
    }));
  }

  // Estado de UN plan. Se consulta por policyId (historial profundo): un barrido global solo
  // cubriría pocas horas y no vería backups que dejaron de correr hace semanas.
  getPlanStatus(
    conn: AcronisConnection, policyId: string, th: AcronisThresholds = DEFAULT_THRESHOLDS,
  ): Promise<AcronisPlanStatus> {
    this.assertConfigured(conn);
    const key = `${this.base(conn)}|${policyId}`;
    const cached = this.planCache.get(key);
    if (cached && Date.now() - cached.at < PLAN_CACHE_TTL_MS) return cached.promise;

    const promise = this.fetchPlanStatus(conn, policyId, th);
    this.planCache.set(key, { at: Date.now(), promise });
    // Los fallos no se cachean.
    promise.catch(() => { if (this.planCache.get(key)?.promise === promise) this.planCache.delete(key); });
    return promise;
  }

  private async fetchPlanStatus(conn: AcronisConnection, policyId: string, th: AcronisThresholds): Promise<AcronisPlanStatus> {
    const { items, truncated } = await this.paginate<AcronisTask>(
      conn, TASKS_PATH,
      { limit: String(TASKS_LIMIT), order: 'desc(id)', state: 'completed', policyId }, TASKS_LIMIT, TASKS_MAX_PAGES,
    );
    if (truncated) {
      throw new Error(`La respuesta de /tasks quedó truncada tras ${TASKS_MAX_PAGES} páginas para el plan ${policyId}`);
    }
    const tasks = items.filter(isBackupTask);
    if (!tasks.length) throw new AcronisNoTasksError(`No se encontraron tasks de backup para el plan ${policyId}`);

    const latest = tasks[0];
    let resources;
    if (latest.context?.HasChildren) {
      // Los ids reales superan Number.MAX_SAFE_INTEGER: se usa idString.
      const taskId = latest.idString ?? String(latest.id);
      const acts = await this.paginate<AcronisActivity>(
        conn, ACTIVITIES_PATH, { limit: String(ACTIVITIES_LIMIT), order: 'asc(id)', taskId }, ACTIVITIES_LIMIT, ACTIVITIES_MAX_PAGES,
      );
      if (acts.truncated) throw new Error(`La respuesta de /activities quedó truncada para el task ${taskId}`);
      resources = evaluateActivityResources(
        acts.items, latest.resource?.id ?? '', parseAcronisTimestamp(latest.completedAt), th,
      );
    } else {
      resources = evaluateResources(tasks, th);
    }
    if (!resources.length) throw new AcronisNoTasksError(`El plan ${policyId} no tiene recursos evaluables`);

    const lastRunAt = resources.map(r => r.latestAt).filter((d): d is string => Boolean(d)).sort().pop() ?? null;
    return {
      policyId, policyName: latest.policy?.name ?? '?', tenantId: latest.tenant?.id ?? '',
      tenantName: latest.tenant?.name ?? '?', lastRunAt, resources,
    };
  }
}
