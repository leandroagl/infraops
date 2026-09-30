import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { TaskType } from '../tasks/task-type.enum';
import { DeviationOperator } from './deviation-operator.enum';

const numericTransformer = {
  to: (v: number | null) => v,
  from: (v: string | null) => (v === null ? null : parseFloat(v)),
};

@Entity('deviation_rules')
@Unique('UQ_deviation_rules_task_signal', ['taskType', 'signalKey'])
export class DeviationRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @Column({ default: true })
  enabled: boolean;

  @Column({ name: 'helpdesk_team_id', type: 'int', nullable: true, default: null })
  helpdeskTeamId: number | null;

  @Column({ name: 'tag_ids', type: 'int', array: true, default: [] })
  tagIds: number[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
