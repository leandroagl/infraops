import {
  Column, CreateDateColumn, Entity, JoinColumn,
  ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn, Unique,
} from 'typeorm';
import { Client } from '../clients/client.entity';
import { Technician } from '../technicians/technician.entity';
import { ScheduleGroup } from './schedule-group.enum';

@Entity('client_schedules')
@Unique(['clientId'])
export class ClientSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'client_id', type: 'uuid' })
  clientId: string;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ name: 'schedule_group', type: 'enum', enum: ScheduleGroup, nullable: true, default: null })
  scheduleGroup: ScheduleGroup | null;

  @Column({ name: 'technician_id', type: 'uuid', nullable: true, default: null })
  technicianId: string | null;

  @ManyToOne(() => Technician, { nullable: true })
  @JoinColumn({ name: 'technician_id' })
  technician: Technician | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
