import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum RotationFrequency {
  EVERY_GENERATION      = 'EVERY_GENERATION',
  EVERY_TWO_GENERATIONS = 'EVERY_TWO_GENERATIONS',
}

@Entity('rotation_config')
export class RotationConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'is_active', default: false })
  isActive: boolean;

  @Column({
    type: 'enum',
    enum: RotationFrequency,
    default: RotationFrequency.EVERY_GENERATION,
  })
  frequency: RotationFrequency;

  @Column({ name: 'generations_since_last_rotation', type: 'int', default: 0 })
  generationsSinceLastRotation: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
