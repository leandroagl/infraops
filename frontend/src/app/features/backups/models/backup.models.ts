export type BackupJobResult = 'Success' | 'Warning' | 'Failed';
export type ClientBackupStatus = 'ok' | 'warn' | 'crit' | 'no_data' | 'disconnected';

export interface BackupJobStatus {
  jobId: string;
  jobName: string;
  jobType: string;
  isRunning: boolean;
  lastResult: BackupJobResult | null;
  lastMessage: string | null;
  lastRunAt: string | null;
  hoursAgo: number | null;
  isStale: boolean;
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

export type BackupProvider = 'VEEAM' | 'JETBACKUP';

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

export type BackupConfig = VeeamClientConfig | JetbackupJobConfig;

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

export interface TestConnectionResult {
  success: boolean;
  message: string;
  jobCount?: number;
}
