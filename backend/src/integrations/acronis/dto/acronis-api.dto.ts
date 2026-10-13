// backend/src/integrations/acronis/dto/acronis-api.dto.ts

export interface AcronisConnection {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
}

export interface AcronisRef {
  id: string;
  type?: string;
  name?: string;
}

export interface AcronisTask {
  // Los ids reales (~1.7e18) superan Number.MAX_SAFE_INTEGER: para pedir /activities usar `idString`.
  id: number;
  idString?: string;
  policy?: AcronisRef;
  resource?: AcronisRef;
  tenant?: { id: string; name?: string; locator?: string };
  result?: { code?: string };
  completedAt?: string;
  context?: { HasChildren?: boolean };
}

export interface AcronisActivity {
  resource?: AcronisRef;
  result?: { code?: string };
}

export interface AcronisPage<T> {
  items?: T[];
  paging?: { cursors?: { after?: string } };
}

export type AcronisSeverity = 'ok' | 'warning' | 'error';

export interface AcronisThresholds {
  staleWarningHours: number;
  staleErrorHours: number;
}

export interface AcronisResourceStatus {
  resourceId: string;
  name: string;
  type: string;
  severity: AcronisSeverity;
  hoursSinceOk: number;
  latestCode: string;
  latestAt: string | null;
}

export interface AcronisPlanStatus {
  policyId: string;
  policyName: string;
  tenantId: string;
  tenantName: string;
  // Fecha de la corrida más reciente entre todos los recursos del plan.
  lastRunAt: string | null;
  resources: AcronisResourceStatus[];
}

export interface AcronisPlanSummary {
  policyId: string;
  policyName: string;
  tenantId: string;
  tenantName: string;
  resourceTypes: string[];
  resourceCount: number;
}

export interface AcronisPlanDiscovery {
  plans: AcronisPlanSummary[];
  // true si el barrido se cortó por tope de páginas: pueden faltar planes con corridas más viejas.
  partial: boolean;
}
