import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('acronis_config')
export class AcronisConfig {
  @PrimaryColumn({ type: 'int', default: 1 })
  id: number = 1;

  @Column({ name: 'base_url', type: 'varchar', nullable: true })
  baseUrl: string | null = null;

  // Cifrados (AES-256-GCM): tanto el client_id como el secret son sensibles.
  @Column({ name: 'client_id', type: 'varchar', nullable: true })
  clientId: string | null = null;

  @Column({ name: 'client_secret', type: 'varchar', nullable: true })
  clientSecret: string | null = null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'updated_by', type: 'varchar', nullable: true })
  updatedBy: string | null = null;
}
