export interface UnifiInternetIssue {
  index: number; // bucket de 5 min desde epoch (inicio de la racha)
  count?: number; // cantidad de buckets de la racha; si falta, es 1
  wanDowntime?: boolean;
  wan2FailoverActive?: boolean;
  highLatency?: boolean;
  latencyAvgMs?: number;
  latencyMaxMs?: number;
  notReported?: boolean;
}

export interface WanIssue {
  type: 'wan_down' | 'wan_failover';
  startIndex: number;
  lastSeen: string; // ISO, fin de la racha
}

const BUCKET_MS = 5 * 60 * 1000;
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// internetIssues es un historial de rachas (puede incluir entradas de semanas atrás):
// solo se alertan caídas/failover cuya racha terminó dentro de maxAgeMs.
export function extractWanIssues(
  issues: UnifiInternetIssue[] | null | undefined,
  nowMs: number,
  maxAgeMs = DEFAULT_MAX_AGE_MS,
): WanIssue[] {
  const result: WanIssue[] = [];

  for (const issue of issues ?? []) {
    if (typeof issue?.index !== 'number') continue;

    const type = issue.wanDowntime ? 'wan_down' : issue.wan2FailoverActive ? 'wan_failover' : null;
    if (!type) continue;

    const endMs = (issue.index + (issue.count ?? 1)) * BUCKET_MS;
    if (nowMs - endMs > maxAgeMs) continue;

    result.push({ type, startIndex: issue.index, lastSeen: new Date(endMs).toISOString() });
  }

  return result;
}
