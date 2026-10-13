import { TaskType } from './task.models';

export type DeviationOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
export type DeviationSignalValueType = 'number' | 'boolean';

export interface AvailableDeviationSignal {
  taskType: TaskType;
  key: string;
  label: string;
  valueType: DeviationSignalValueType;
}

export interface DeviationRuleDto {
  id: string;
  taskType: TaskType;
  signalKey: string;
  operator: DeviationOperator;
  thresholdNumber: number | null;
  thresholdBoolean: boolean | null;
  enabled: boolean;
  helpdeskTeamId: number | null;
  tagIds: number[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeviationRulePayload {
  taskType: TaskType;
  signalKey: string;
  operator: DeviationOperator;
  thresholdNumber?: number;
  thresholdBoolean?: boolean;
  enabled?: boolean;
  helpdeskTeamId?: number | null;
  tagIds?: number[];
}

export interface UpdateDeviationRulePayload {
  operator?: DeviationOperator;
  thresholdNumber?: number | null;
  thresholdBoolean?: boolean | null;
  enabled?: boolean;
  helpdeskTeamId?: number | null;
  tagIds?: number[];
}
