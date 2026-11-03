import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('unifi_config')
export class UnifiConfig {
  @PrimaryColumn({ type: 'int', default: 1 })
  id: number = 1;

  @Column({ name: 'api_key', type: 'varchar', nullable: true })
  apiKey: string | null = null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'updated_by', type: 'varchar', nullable: true })
  updatedBy: string | null = null;
}
