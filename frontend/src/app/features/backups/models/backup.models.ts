export type BackupJobResult = 'Success' | 'Warning' | 'Failed';
export type ClientBackupStatus = 'ok' | 'warn' | 'crit' | 'no_data' | 'disconnected';

export type BackupProvider = 'VEEAM' | 'JETBACKUP' | 'ACRONIS';

// Detalle por recurso dentro de un job (Acronis: un plan cubre varias VMs o buzones).
export interface BackupItemStatus {
  itemId: string;
  name: string;
  type: string;
  result: BackupJobResult;
  hoursSinceOk: number;
  lastCode: string;
  lastRunAt: string | null;
}

// Recursos agrupados (M365) en conteos más los nombres de los peores.
export interface BackupAggregate {
  total: number;
  okCount: number;
  warnCount: number;
  critCount: number;
  worst: string[];
}

export interface BackupJobStatus {
  provider: BackupProvider;
  jobId: string;
  jobName: string;
  jobType: string;
  isRunning: boolean;
  lastResult: BackupJobResult | null;
  lastMessage: string | null;
  lastRunAt: string | null;
  hoursAgo: number | null;
  isStale: boolean;
  items?: BackupItemStatus[];
  aggregate?: BackupAggregate | null;
}

export interface ClientBackup {
  clientId: string;
  clientName: string;
  status: ClientBackupStatus;
  totalJobs: number;
  okCount: number;
  warnCount: number;
  critCount: number;
  hasRunningJob: boolean;
  lastReadAt: string;
  jobs: BackupJobStatus[];
  isSnapshot?: boolean;
}

export interface VeeamClientConfig {
  provider: 'VEEAM';
  id: string;
  clientId: string;
  clientName: string;
  host: string;
  port: number;
  isEnabled: boolean;
  lastConnectedAt: string | null;
}

export interface CreateVeeamConfigRequest {
  clientId: string;
  clientName: string;
  host: string;
  port: number;
  isEnabled: boolean;
}

export interface UpdateVeeamConfigRequest {
  clientName?: string;
  host?: string;
  port?: number;
  isEnabled?: boolean;
}

// Una fila por job de JetBackup asignado a un cliente.
export interface JetbackupJobConfig {
  provider: 'JETBACKUP';
  id: string;
  clientId: string;
  clientName: string;
  jobId: string;
  jobName: string;
  isEnabled: boolean;
}

// Una fila por plan de Acronis asignado a un cliente.
export interface AcronisPlanConfig {
  provider: 'ACRONIS';
  id: string;
  clientId: string;
  clientName: string;
  policyId: string;
  policyName: string;
  tenantName: string;
  isEnabled: boolean;
}

export type BackupConfig = VeeamClientConfig | JetbackupJobConfig | AcronisPlanConfig;

// Job disponible en el WHM; `configured` indica si ya está asignado a algún cliente.
export interface AvailableJetbackupJob {
  jobId: string;
  name: string;
  disabled: boolean;
  configured: boolean;
  configuredClientName: string | null;
}

export interface CreateJetbackupConfigsRequest {
  clientId: string;
  clientName: string;
  isEnabled: boolean;
  jobs: { jobId: string; jobName: string }[];
}

export interface UpdateJetbackupConfigRequest {
  isEnabled?: boolean;
}

// Plan disponible en Acronis; `configured` indica si ya está asignado a algún cliente.
export interface AvailableAcronisPlan {
  policyId: string;
  policyName: string;
  tenantName: string;
  resourceTypes: string[];
  resourceCount: number;
  configured: boolean;
  configuredClientName: string | null;
}

// `partial`: el barrido de Acronis quedó truncado y pueden faltar planes sin corridas recientes.
export interface AvailableAcronisPlans {
  plans: AvailableAcronisPlan[];
  partial: boolean;
}

export interface CreateAcronisConfigsRequest {
  clientId: string;
  clientName: string;
  isEnabled: boolean;
  plans: { policyId: string; policyName: string; tenantName?: string }[];
}

export interface UpdateAcronisConfigRequest {
  isEnabled?: boolean;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  jobCount?: number;
}
