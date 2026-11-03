import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('unifi_local_config')
export class UnifiLocalConfig {
  @PrimaryColumn({ type: 'int', default: 1 })
  id: number = 1;

  @Column({ name: 'url', type: 'varchar', nullable: true })
  url: string | null = null;

  @Column({ name: 'api_key', type: 'varchar', nullable: true })
  apiKey: string | null = null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'updated_by', type: 'varchar', nullable: true })
  updatedBy: string | null = null;
}
