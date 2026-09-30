import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { TaskType } from '../tasks/task-type.enum';
import { DeviationOperator } from '../deviation-rules/deviation-operator.enum';
import { MaintenanceDeviationStatus } from './maintenance-deviation-status.enum';

const numericTransformer = {
  to: (v: number | null) => v,
  from: (v: string | null) => (v === null ? null : parseFloat(v)),
};

@Entity('maintenance_deviations')
@Unique('UQ_maintenance_deviations_log_signal', ['logId', 'signalKey'])
export class MaintenanceDeviation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'log_id', type: 'uuid' })
  logId: string;

  @Column({ name: 'task_id', type: 'uuid' })
  taskId: string;

  @Column({ name: 'rule_id', type: 'uuid', nullable: true, default: null })
  ruleId: string | null;

  @Column({ type: 'enum', enum: TaskType, name: 'task_type' })
  taskType: TaskType;

  @Column({ name: 'signal_key' })
  signalKey: string;

  @Column({ type: 'enum', enum: DeviationOperator })
  operator: DeviationOperator;

  @Column({
    name: 'threshold_number',
    type: 'numeric',
    nullable: true,
    default: null,
    transformer: numericTransformer,
  })
  thresholdNumber: number | null;

  @Column({ name: 'threshold_boolean', type: 'boolean', nullable: true, default: null })
  thresholdBoolean: boolean | null;

  @Column({
    name: 'detected_value_number',
    type: 'numeric',
    nullable: true,
    default: null,
    transformer: numericTransformer,
  })
  detectedValueNumber: number | null;

  @Column({ name: 'detected_value_boolean', type: 'boolean', nullable: true, default: null })
  detectedValueBoolean: boolean | null;

  @Column({
    type: 'enum',
    enum: MaintenanceDeviationStatus,
    default: MaintenanceDeviationStatus.PENDING,
  })
  status: MaintenanceDeviationStatus;

  @CreateDateColumn({ name: 'detected_at', type: 'timestamptz' })
  detectedAt: Date;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true, default: null })
  resolvedAt: Date | null;

  @Column({ name: 'resolved_by_user_id', type: 'uuid', nullable: true, default: null })
  resolvedByUserId: string | null;

  @Column({ name: 'odoo_ticket_id', type: 'int', nullable: true, default: null })
  odooTicketId: number | null;
}
