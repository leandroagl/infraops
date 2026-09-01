import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('vmware_config')
export class VmwareConfig {
  @PrimaryColumn({ type: 'int', default: 1 })
  id: number = 1;

  @Column({ type: 'varchar', nullable: true })
  username: string | null = null;

  @Column({ type: 'varchar', nullable: true })
  password: string | null = null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'updated_by', type: 'varchar', nullable: true })
  updatedBy: string | null = null;
}
