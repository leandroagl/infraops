export type TaskType =
  | 'SERVER_MAINTENANCE'
  | 'QNAP_MAINTENANCE'
  | 'VEEAM_BACKUP'
  | 'TERMINAL_MAINTENANCE'
  | 'SITE_VISIT'
  | 'AV_CONTROL'
  | 'UPS_CONTROL'
  | 'ENDPOINT_INVENTORY';

export type TaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'ESCALATED'
  | 'NOT_DONE';

export interface Task {
  id: string;
  clientId: string;
  technicianId: string;
  type: TaskType;
  status: TaskStatus;
  scheduledDate: string;
  completedDate: string | null;
  odooTicketId: number | null;
  createdAt: string;
  client?: { id: string; name: string };
  technician?: { id: string; user: { id: string; name: string; email: string } };
}

export interface UpdateTaskStatusPayload {
  status: TaskStatus;
  timeSpentMinutes?: number;
}
