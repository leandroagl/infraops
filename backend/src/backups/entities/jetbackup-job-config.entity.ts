import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Una fila por job de JetBackup asignado a un cliente (un cliente puede tener varios).
@Entity('jetbackup_job_configs')
export class JetbackupJobConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'client_id' })
  clientId: string;

  @Column({ type: 'varchar', name: 'client_name', default: '' })
  clientName: string;

  @Column({ type: 'varchar', name: 'job_id', unique: true })
  jobId: string;

  @Column({ type: 'varchar', name: 'job_name' })
  jobName: string;

  @Column({ type: 'boolean', name: 'is_enabled', default: true })
  isEnabled: boolean;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'now()' })
  updatedAt: Date;
}
