// backend/src/integrations/jetbackup/jetbackup.service.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { BackupJobStatus } from '../veeam/dto/veeam-api.dto';
import type {
  JetbackupConnection, JetbackupApiResponse, JetbackupJob, JetbackupLog, JetbackupLogItem,
  JetbackupJobSummary, JetbackupJobRef,
} from './dto/jetbackup-api.dto';

// En JetBackup el job de "JetBackup Config" (type 3) respalda la configuración del
// propio JetBackup, no datos de clientes. No es un job de backup monitoreable.
const CONFIG_JOB_TYPE = 3;
// type 1 en listLogs = ejecución de un job de backup de cuentas.
const BACKUP_LOG_TYPE = 1;
// status del log: 1 = completado. Cualquier otro valor se trata como fallo hasta
// tener documentado el significado del resto.
const LOG_STATUS_OK = 1;
// status de un ítem de log: 100 = "Backup completed successfully".
const ITEM_STATUS_OK = 100;

@Injectable()
export class JetbackupService {
  private readonly STALE_HOURS = 30;

  constructor(private readonly httpService: HttpService) {}

  private endpoint(conn: JetbackupConnection): string {
    return `${conn.url.trim().replace(/\/+$/, '')}/cgi/addons/jetbackup5/api.cgi`;
  }

  private async call<T>(
    conn: JetbackupConnection, fn: string, params: Record<string, string | number> = {},
  ): Promise<T> {
    const body = new URLSearchParams({ function: fn });
    for (const [k, v] of Object.entries(params)) body.set(k, String(v));
    const res = await firstValueFrom(
      this.httpService.post<JetbackupApiResponse<T>>(this.endpoint(conn), body, {
        headers: { Authorization: `whm ${conn.username}:${conn.apiKey}` },
        timeout: 30000,
      }),
    );
    if (res.data?.success !== 1) throw new Error(res.data?.message || `JetBackup rechazó ${fn}`);
    return res.data.data;
  }

  private hoursAgo(isoStr: string | null): number | null {
    if (!isoStr) return null;
    return (Date.now() - new Date(isoStr).getTime()) / 3600000;
  }

  async listJobs(conn: JetbackupConnection): Promise<JetbackupJobSummary[]> {
    const data = await this.call<{ jobs?: JetbackupJob[] }>(conn, 'listBackupJobs');
    return (data?.jobs ?? [])
      .filter(j => j.type !== CONFIG_JOB_TYPE)
      .map(j => ({ jobId: j._id, name: j.name, disabled: Boolean(j.disabled) }));
  }

  private async lastLog(conn: JetbackupConnection, jobId: string): Promise<JetbackupLog | null> {
    const data = await this.call<{ logs?: JetbackupLog[] }>(conn, 'listLogs', {
      'find[info.ID]': jobId,
      'find[type]': BACKUP_LOG_TYPE,
      'sort[start_time]': -1,
      limit: 1,
    });
    return data?.logs?.[0] ?? null;
  }

  // El mensaje es informativo: si falla su lectura no se pierde el resultado del log.
  private async logMessage(conn: JetbackupConnection, logId: string): Promise<string | null> {
    try {
      const data = await this.call<{ items?: JetbackupLogItem[] }>(conn, 'listLogItems', { log_id: logId });
      const items = data?.items ?? [];
      const problems = items.filter(i => i.status !== ITEM_STATUS_OK && i.message).map(i => i.message);
      if (problems.length) return problems.join('; ');
      return items.find(i => i.message)?.message ?? null;
    } catch {
      return null;
    }
  }

  private async buildJobStatus(
    conn: JetbackupConnection, ref: JetbackupJobRef, job: JetbackupJob | undefined,
  ): Promise<BackupJobStatus> {
    const base = { jobId: ref.jobId, jobName: ref.jobName, jobType: 'JetBackup' };
    if (!job) {
      return {
        ...base, isRunning: false, lastResult: 'Failed',
        lastMessage: 'El job ya no existe en JetBackup', lastRunAt: null, hoursAgo: null, isStale: false,
      };
    }
    const isRunning = Boolean(job.running);
    const log = await this.lastLog(conn, ref.jobId);
    if (!log) {
      return { ...base, isRunning, lastResult: null, lastMessage: null, lastRunAt: null, hoursAgo: null, isStale: false };
    }
    const refTime = log.end_time ?? log.start_time;
    const hours = this.hoursAgo(refTime);
    return {
      ...base,
      isRunning,
      lastResult: log.status === LOG_STATUS_OK ? 'Success' : 'Failed',
      lastMessage: await this.logMessage(conn, log._id),
      lastRunAt: refTime,
      hoursAgo: hours !== null ? Math.round(hours * 10) / 10 : null,
      isStale: hours !== null && !isRunning && hours > this.STALE_HOURS,
    };
  }

  async getJobStatuses(conn: JetbackupConnection, refs: JetbackupJobRef[]): Promise<BackupJobStatus[]> {
    if (!refs.length) return [];
    const data = await this.call<{ jobs?: JetbackupJob[] }>(conn, 'listBackupJobs');
    const byId = new Map((data?.jobs ?? []).map(j => [j._id, j]));
    return Promise.all(refs.map(ref => this.buildJobStatus(conn, ref, byId.get(ref.jobId))));
  }
}
