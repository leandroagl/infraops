import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('jetbackup_config')
export class JetbackupConfig {
  @PrimaryColumn({ type: 'int', default: 1 })
  id: number = 1;

  @Column({ type: 'varchar', nullable: true })
  url: string | null = null;

  @Column({ type: 'varchar', default: 'root' })
  username: string = 'root';

  @Column({ name: 'api_key', type: 'varchar', nullable: true })
  apiKey: string | null = null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'updated_by', type: 'varchar', nullable: true })
  updatedBy: string | null = null;
}
