// backend/src/integrations/acronis/acronis.evaluation.ts
// Lógica pura (sin HTTP) que convierte tasks/activities de Acronis en estado por recurso.
import type {
  AcronisActivity, AcronisResourceStatus, AcronisSeverity, AcronisTask, AcronisThresholds,
} from './dto/acronis-api.dto';

// Hay más de un policy.type de backup real. Un policy+resource a secas NO alcanza:
// antimalware y vulnerability assessment también los traen y no son backup.
const BACKUP_POLICY_TYPES = new Set(['backup', 'policy.protection.total']);
// Tipos M365: un plan puede cubrir cientos, se muestran agregados. El resto se muestra por recurso.
const AGGREGATED_RESOURCE_TYPES = new Set(['MAILBOX', 'TEAM', 'SITE']);
const COMPLETED_CODES = new Set(['ok', 'warning']);
const MAX_WORST = 5;

const ISO_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:?\d{2})?$/;

// Acronis devuelve nanosegundos ("...57.720031579Z"): se recortan a milisegundos.
export function parseAcronisTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = ISO_RE.exec(value);
  if (!m) return null;
  const [, date, time, frac = '0', tz = 'Z'] = m;
  const ms = frac.slice(0, 3).padEnd(3, '0');
  const zone = tz === 'Z' ? 'Z' : `${tz.slice(0, 3)}:${tz.replace(':', '').slice(3, 5)}`;
  const parsed = new Date(`${date}T${time}.${ms}${zone}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isBackupTask(t: AcronisTask): boolean {
  return Boolean(t.policy && t.resource && t.policy.type && BACKUP_POLICY_TYPES.has(t.policy.type));
}

export function isAggregatedType(resourceType: string): boolean {
  return AGGREGATED_RESOURCE_TYPES.has(resourceType);
}

export interface PlanGroup {
  policyId: string;
  policyName: string;
  tenantId: string;
  tenantName: string;
  tasks: AcronisTask[];
}

// Los planes se identifican por policy.id: los nombres colisionan entre clientes.
export function groupByPlan(tasks: AcronisTask[]): Map<string, PlanGroup> {
  const plans = new Map<string, PlanGroup>();
  for (const t of tasks) {
    const policyId = t.policy?.id;
    if (!policyId) continue;
    let g = plans.get(policyId);
    if (!g) {
      g = { policyId, policyName: t.policy?.name ?? '?', tenantId: t.tenant?.id ?? '', tenantName: t.tenant?.name ?? '?', tasks: [] };
      plans.set(policyId, g);
    }
    g.tasks.push(t);
  }
  return plans;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;
const hoursSince = (d: Date): number => (Date.now() - d.getTime()) / 3600000;

function classify(
  hardFail: boolean, hasWarning: boolean, hours: number | null, th: AcronisThresholds,
): { severity: AcronisSeverity; effectiveHours: number } {
  // Fallo duro o antigüedad desconocida: se usa staleError+1 como centinela.
  const effectiveHours = hardFail || hours === null ? th.staleErrorHours + 1 : hours;
  let severity: AcronisSeverity = 'ok';
  if (hardFail || effectiveHours > th.staleErrorHours) severity = 'error';
  else if (hasWarning || effectiveHours > th.staleWarningHours) severity = 'warning';
  return { severity, effectiveHours: round1(effectiveHours) };
}

// `tasks`: los de UN plan, en orden desc(id) (más reciente primero).
// Un "warning" cuenta como corrida completada para la antigüedad (los datos sí se respaldaron)
// pero igual se marca como problema.
export function evaluateResources(tasks: AcronisTask[], th: AcronisThresholds): AcronisResourceStatus[] {
  const byResource = new Map<string, {
    name: string; type: string; latestCode: string | null; latestAt: Date | null; lastOkAt: Date | null;
  }>();
  for (const t of tasks) {
    const r = t.resource;
    if (!r) continue;
    let e = byResource.get(r.id);
    if (!e) {
      e = { name: r.name || '?', type: r.type || '?', latestCode: null, latestAt: null, lastOkAt: null };
      byResource.set(r.id, e);
    }
    const code = t.result?.code ?? '?';
    const at = parseAcronisTimestamp(t.completedAt);
    if (e.latestCode === null) { e.latestCode = code; e.latestAt = at; }
    if (COMPLETED_CODES.has(code) && e.lastOkAt === null) e.lastOkAt = at;
  }

  const out: AcronisResourceStatus[] = [];
  for (const [resourceId, e] of byResource) {
    const hardFail = !COMPLETED_CODES.has(e.latestCode ?? '?');
    const { severity, effectiveHours } = classify(
      hardFail, e.latestCode === 'warning', e.lastOkAt ? hoursSince(e.lastOkAt) : null, th,
    );
    out.push({
      resourceId, name: e.name, type: e.type, severity, hoursSinceOk: effectiveHours,
      latestCode: e.latestCode ?? '?', latestAt: e.latestAt?.toISOString() ?? null,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// Tasks "wrapper" (HasChildren): el resource del task raíz es el agente compartido, no la VM real.
// Cada actividad hija trae la VM real; se agrupa por ahí excluyendo la del agente raíz.
// Solo se ve la corrida más reciente: no se sabe hace cuánto falla una VM puntual.
export function evaluateActivityResources(
  activities: AcronisActivity[], rootResourceId: string, completedAt: Date | null, th: AcronisThresholds,
): AcronisResourceStatus[] {
  const byResource = new Map<string, { name: string; type: string; codes: string[] }>();
  for (const a of activities) {
    const r = a.resource;
    if (!r?.id || r.id === rootResourceId) continue;
    let e = byResource.get(r.id);
    if (!e) {
      e = { name: r.name || '?', type: r.type || '?', codes: [] };
      byResource.set(r.id, e);
    }
    e.codes.push(a.result?.code ?? 'ok');
  }

  const hours = completedAt ? hoursSince(completedAt) : null;
  const out: AcronisResourceStatus[] = [];
  for (const [resourceId, e] of byResource) {
    const hardFail = e.codes.some(c => !COMPLETED_CODES.has(c));
    const { severity, effectiveHours } = classify(hardFail, e.codes.includes('warning'), hours, th);
    out.push({
      resourceId, name: e.name, type: e.type, severity, hoursSinceOk: effectiveHours,
      latestCode: e.codes.find(c => c !== 'ok') ?? 'ok', latestAt: completedAt?.toISOString() ?? null,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

const SEVERITY_RANK: Record<AcronisSeverity, number> = { ok: 0, warning: 1, error: 2 };

// Conteos para los recursos agregados (M365) y nombres de los peores.
export function summarizeResources(resources: AcronisResourceStatus[]): {
  ok: number; warn: number; crit: number; worst: string[];
} {
  const problems = resources
    .filter(r => r.severity !== 'ok')
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.hoursSinceOk - a.hoursSinceOk);
  return {
    ok: resources.filter(r => r.severity === 'ok').length,
    warn: resources.filter(r => r.severity === 'warning').length,
    crit: resources.filter(r => r.severity === 'error').length,
    worst: problems.slice(0, MAX_WORST).map(r => r.name),
  };
}
