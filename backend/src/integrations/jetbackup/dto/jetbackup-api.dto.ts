// backend/src/integrations/jetbackup/dto/jetbackup-api.dto.ts

export interface JetbackupConnection {
  url: string;
  username: string;
  apiKey: string;
}

export interface JetbackupApiResponse<T> {
  success: number;
  message: string;
  data: T;
}

export interface JetbackupJob {
  _id: string;
  name: string;
  type: number;
  disabled?: number | boolean | null;
  running?: number | boolean | string | null;
}

export interface JetbackupLog {
  _id: string;
  start_time: string;
  end_time: string | null;
  status: number;
  type: number;
}

export interface JetbackupLogItem {
  status: number;
  message: string;
}

export interface JetbackupJobSummary {
  jobId: string;
  name: string;
  disabled: boolean;
}

export interface JetbackupJobRef {
  jobId: string;
  jobName: string;
}
