import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { TaskType } from '../tasks/task-type.enum';

@Entity('task_type_config')
export class TaskTypeConfig {
  @PrimaryColumn({ type: 'enum', enum: TaskType, name: 'task_type' })
  taskType: TaskType;

  @Column({ name: 'default_time_minutes', type: 'int', nullable: true, default: null })
  defaultTimeMinutes: number | null;

  @Column({ name: 'odoo_tag_ids', type: 'int', array: true, default: [] })
  odooTagIds: number[];

  @Column({ name: 'odoo_tag_names', type: 'text', array: true, default: [] })
  odooTagNames: string[];

  @Column({ name: 'ticket_description', type: 'text', nullable: true, default: null })
  ticketDescription: string | null;

  @Column({ name: 'timesheet_description', type: 'text', nullable: true, default: null })
  timesheetDescription: string | null;

  // Populated by service, not persisted
  defaultTicketDescription?: string;
  defaultTimesheetDescription?: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
