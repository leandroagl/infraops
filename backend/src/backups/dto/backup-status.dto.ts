export type JobResult = 'Success' | 'Warning' | 'Failed';
export type ClientStatus = 'ok' | 'warn' | 'crit' | 'no_data';

export class BackupJobStatusDto {
  jobId: string;
  jobName: string;
  jobType: string;
  isRunning: boolean;
  lastResult: JobResult | null;
  lastMessage: string | null;
  lastRunAt: string | null;
  hoursAgo: number | null;
  isStale: boolean;
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
}
