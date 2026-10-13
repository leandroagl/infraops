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

export interface VeeamClientConfig {
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

export interface TestConnectionResult {
  success: boolean;
  message: string;
  jobCount?: number;
}
