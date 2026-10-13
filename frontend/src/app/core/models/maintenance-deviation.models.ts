import { TaskType } from './task.models';
import { DeviationOperator } from './deviation-rule.models';

export type MaintenanceDeviationStatus = 'PENDING' | 'CONFIRMED' | 'DISMISSED';

export interface MaintenanceDeviationDto {
  id: string;
  logId: string;
  taskId: string;
  ruleId: string | null;
  taskType: TaskType;
  signalKey: string;
  operator: DeviationOperator;
  thresholdNumber: number | null;
  thresholdBoolean: boolean | null;
  detectedValueNumber: number | null;
  detectedValueBoolean: boolean | null;
  helpdeskTeamId: number | null;
  tagIds: number[];
  status: MaintenanceDeviationStatus;
  detectedAt: string;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
  odooTicketId: number | null;
}
