import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('odoo_config')
export class OdooConfig {
  @PrimaryColumn({ type: 'int', default: 1 })
  id: number = 1;

  @Column({ type: 'varchar', nullable: true })
  url: string | null = null;

  @Column({ type: 'varchar', nullable: true })
  db: string | null = null;

  @Column({ type: 'varchar', nullable: true })
  username: string | null = null;

  @Column({ name: 'api_key', type: 'varchar', nullable: true })
  apiKey: string | null = null;

  @Column({ name: 'helpdesk_team_id', type: 'int', nullable: true })
  helpdeskTeamId: number | null = null;

  @Column({ name: 'stage_in_progress_name', type: 'varchar', nullable: true })
  stageInProgressName: string | null = null;

  @Column({ name: 'stage_not_done_name', type: 'varchar', nullable: true })
  stageNotDoneName: string | null = null;

  @Column({ name: 'stage_done_name', type: 'varchar', nullable: true })
  stageDoneName: string | null = null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'updated_by', type: 'varchar', nullable: true })
  updatedBy: string | null = null;
}
