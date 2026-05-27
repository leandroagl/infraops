import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  infradocId: number;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  abbreviation: string | null;

  @Column({ type: 'varchar', nullable: true })
  type: string | null;

  @Column({ type: 'varchar', nullable: true })
  website: string | null;

  @Column({ type: 'varchar', nullable: true })
  referral: string | null;

  @Column({
    type: 'numeric',
    nullable: true,
    transformer: {
      to: (v: number | null) => v,
      from: (v: string | null) => (v !== null ? parseFloat(v) : null),
    },
  })
  rate: number | null;

  @Column({ type: 'varchar', nullable: true })
  currencyCode: string | null;

  @Column({ type: 'int', nullable: true })
  netTerms: number | null;

  @Column({ type: 'varchar', nullable: true })
  taxIdNumber: string | null;

  @Column({ default: false })
  isLead: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  lastSyncedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}