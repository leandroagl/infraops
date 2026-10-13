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

// Detalle por recurso dentro de un job (hoy solo lo usa Acronis: un plan cubre varias VMs/buzones).
export interface BackupItemStatus {
  itemId: string;
  name: string;
  type: string;
  result: 'Success' | 'Warning' | 'Failed';
  hoursSinceOk: number;
  lastCode: string;
  lastRunAt: string | null;
}

// Recursos agrupados (M365: cientos de buzones) en conteos + nombres de los peores.
export interface BackupAggregate {
  total: number;
  okCount: number;
  warnCount: number;
  critCount: number;
  worst: string[];
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
  items?: BackupItemStatus[];
  aggregate?: BackupAggregate | null;
}
