// backend/src/integrations/veeam/dto/veeam-api.dto.ts

export interface VeeamJob {
  id: string;
  name: string;
  type: string;
  isDisabled: boolean;
}

export interface VeeamSessionResult {
  result: 'Success' | 'Warning' | 'Failed';
  message: string;
  isCanceled: boolean;
}

export interface VeeamSession {
  id: string;
  // La API 1.0 (VBR 11) devuelve jobId null; el nombre de la sesión es el del job.
  jobId: string | null;
  name: string;
  sessionType: string;
  state: string;
  creationTime: string;
  endTime: string | null;
  progressPercent: number;
  result: VeeamSessionResult | null;
}

export interface VeeamApiResponse<T> {
  data: T[];
}

export interface BackupJobStatus {
  jobId: string;
  jobName: string;
  jobType: string;
  isRunning: boolean;
  lastResult: 'Success' | 'Warning' | 'Failed' | null;
  lastMessage: string | null;
  lastRunAt: string | null;
  hoursAgo: number | null;
  isStale: boolean;
}
