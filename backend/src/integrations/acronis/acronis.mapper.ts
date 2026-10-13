// backend/src/integrations/acronis/acronis.mapper.ts
// Traduce el estado de un plan de Acronis al modelo genérico de job de InfraOps.
import type { BackupAggregate, BackupItemStatus, BackupJobStatus } from '../veeam/dto/veeam-api.dto';
import type { AcronisPlanStatus, AcronisResourceStatus, AcronisSeverity, AcronisThresholds } from './dto/acronis-api.dto';
import { isAggregatedType, summarizeResources } from './acronis.evaluation';

type JobResult = 'Success' | 'Warning' | 'Failed';
const RESULT: Record<AcronisSeverity, JobResult> = { ok: 'Success', warning: 'Warning', error: 'Failed' };
const RANK: Record<JobResult, number> = { Success: 0, Warning: 1, Failed: 2 };
const MAX_LISTED = 5;

function toItem(r: AcronisResourceStatus): BackupItemStatus {
  return {
    itemId: r.resourceId, name: r.name, type: r.type, result: RESULT[r.severity],
    hoursSinceOk: r.hoursSinceOk, lastCode: r.latestCode, lastRunAt: r.latestAt,
  };
}

function toAggregate(resources: AcronisResourceStatus[]): BackupAggregate | null {
  if (!resources.length) return null;
  const s = summarizeResources(resources);
  return { total: resources.length, okCount: s.ok, warnCount: s.warn, critCount: s.crit, worst: s.worst };
}

function summarizeProblems(resources: AcronisResourceStatus[]): string | null {
  const problems = resources
    .filter(r => r.severity !== 'ok')
    .sort((a, b) => (a.severity === b.severity ? b.hoursSinceOk - a.hoursSinceOk : a.severity === 'error' ? -1 : 1));
  if (!problems.length) return null;
  const listed = problems.slice(0, MAX_LISTED).map(r => r.name).join(', ');
  const extra = problems.length - MAX_LISTED;
  return `${problems.length} de ${resources.length} recurso(s) con problema: ${listed}${extra > 0 ? ` y ${extra} más` : ''}`;
}

export function toBackupJobStatus(plan: AcronisPlanStatus, th: AcronisThresholds): BackupJobStatus {
  const worst = plan.resources.reduce<JobResult>(
    (acc, r) => (RANK[RESULT[r.severity]] > RANK[acc] ? RESULT[r.severity] : acc), 'Success',
  );
  const hours = plan.lastRunAt ? (Date.now() - new Date(plan.lastRunAt).getTime()) / 3600000 : null;
  const individual = plan.resources.filter(r => !isAggregatedType(r.type));
  const aggregated = plan.resources.filter(r => isAggregatedType(r.type));
  return {
    jobId: plan.policyId,
    jobName: plan.policyName,
    jobType: 'Acronis',
    isRunning: false,
    lastResult: worst,
    lastMessage: summarizeProblems(plan.resources),
    lastRunAt: plan.lastRunAt,
    hoursAgo: hours !== null ? Math.round(hours * 10) / 10 : null,
    // Desactualizado = hay un recurso cuyo último resultado fue exitoso pero hace demasiado (no un fallo duro).
    isStale: plan.resources.some(r => r.latestCode === 'ok' || r.latestCode === 'warning'
      ? r.hoursSinceOk > th.staleWarningHours : false),
    items: individual.map(toItem),
    aggregate: toAggregate(aggregated),
  };
}
