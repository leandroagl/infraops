export type TaskType =
  | 'SERVER_HOST_MAINTENANCE'
  | 'WINDOWS_DOMAIN_MAINTENANCE'
  | 'QNAP_MAINTENANCE'
  | 'VEEAM_BACKUP'
  | 'ROUTER_MAINTENANCE'
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

export interface TaskGroup {
  clientId: string;
  clientName: string;
  tasks: Task[];
}

export interface CycleStats {
  assigned: number;
  inprogress: number;
  pending: number;
  done: number;
}

export interface TaskTypeConfigDto {
  taskType: TaskType;
  defaultTimeMinutes: number | null;
  odooTagIds: number[];
  odooTagNames: string[];
  ticketDescription: string | null;
  defaultTicketDescription?: string;
  timesheetDescription: string | null;
  defaultTimesheetDescription?: string;
  updatedAt: string;
}

export interface OdooHelpdeskTagDto {
  id: number;
  name: string;
}

export interface UpdateTaskConfigPayload {
  defaultTimeMinutes?: number;
  odooTagIds?: number[];
  odooTagNames?: string[];
  ticketDescription?: string;
  timesheetDescription?: string;
}
