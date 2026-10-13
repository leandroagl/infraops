import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import type { BackupProvider } from '../backup-provider';
import type { BackupAggregate, BackupItemStatus } from '../../integrations/veeam/dto/veeam-api.dto';

// Guarda snapshots de ambos proveedores (el nombre de la tabla es histórico, de cuando solo había Veeam).
@Entity('veeam_daily_snapshots')
@Unique('uq_veeam_snapshot', ['clientId', 'provider', 'jobId', 'snapshotDate'])
export class VeeamDailySnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'client_id' })
  clientId: string;

  @Column({ type: 'varchar', default: 'VEEAM' })
  provider: BackupProvider;

  @Column({ type: 'varchar', name: 'job_id' })
  jobId: string;

  @Column({ type: 'varchar', name: 'job_name' })
  jobName: string;

  @Column({ type: 'varchar', name: 'job_type' })
  jobType: string;

  @Column({ type: 'varchar', nullable: true })
  result: string | null;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ type: 'timestamptz', name: 'last_run_at', nullable: true })
  lastRunAt: Date | null;

  @Column({ type: 'float', name: 'hours_ago', nullable: true })
  hoursAgo: number | null;

  // Desglose por recurso (Acronis). Null para Veeam y JetBackup.
  @Column({ type: 'jsonb', nullable: true })
  details: { items: BackupItemStatus[]; aggregate: BackupAggregate | null } | null;

  @Column({ type: 'date', name: 'snapshot_date' })
  snapshotDate: string;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;
}
