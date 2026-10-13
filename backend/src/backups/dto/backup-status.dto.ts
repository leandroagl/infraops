import type { BackupProvider } from '../backup-provider';
import type { BackupAggregate, BackupItemStatus } from '../../integrations/veeam/dto/veeam-api.dto';

export type JobResult = 'Success' | 'Warning' | 'Failed';
export type ClientStatus = 'ok' | 'warn' | 'crit' | 'no_data' | 'disconnected';

export class BackupJobStatusDto {
  provider: BackupProvider;
  jobId: string;
  jobName: string;
  jobType: string;
  isRunning: boolean;
  lastResult: JobResult | null;
  lastMessage: string | null;
  lastRunAt: string | null;
  hoursAgo: number | null;
  isStale: boolean;
  items?: BackupItemStatus[];
  aggregate?: BackupAggregate | null;
}

export class ClientBackupStatusDto {
  clientId: string;
  clientName: string;
  status: ClientStatus;
  totalJobs: number;
  okCount: number;
  warnCount: number;
  critCount: number;
  hasRunningJob: boolean;
  lastReadAt: string;
  jobs: BackupJobStatusDto[];
  isSnapshot?: boolean;
}
