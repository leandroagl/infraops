import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Client } from '../clients/client.entity';
import { Technician } from '../technicians/technician.entity';
import { TaskStatus } from './task-status.enum';
import { TaskType } from './task-type.enum';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'client_id', type: 'uuid' })
  clientId: string;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ name: 'technician_id', type: 'uuid' })
  technicianId: string;

  @ManyToOne(() => Technician)
  @JoinColumn({ name: 'technician_id' })
  technician: Technician;

  @Column({ type: 'enum', enum: TaskType })
  type: TaskType;

  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.PENDING })
  status: TaskStatus;

  @Column({ type: 'date' })
  scheduledDate: string;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  completedDate: Date | null;

  @Column({ name: 'odoo_ticket_id', type: 'int', nullable: true, default: null })
  odooTicketId: number | null;

  @CreateDateColumn()
  createdAt: Date;
}