import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Technician } from '../technicians/technician.entity';
import { UserRole } from './user-role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: '' })
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Column({ default: true })
  mustChangePassword: boolean;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  lastLogoutAt: Date | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({
    name: 'technician_id',
    type: 'uuid',
    nullable: true,
    default: null,
  })
  technicianId: string | null;

  @OneToOne(() => Technician, (technician) => technician.user)
  @JoinColumn({ name: 'technician_id' })
  technician: Technician | null;

  @Column({ name: 'odoo_user_id', type: 'int', nullable: true, default: null })
  odooUserId: number | null;

  @Column({
    name: 'odoo_synced_at',
    type: 'timestamptz',
    nullable: true,
    default: null,
  })
  odooSyncedAt: Date | null;

  @Column({
    name: 'odoo_employee_id',
    type: 'int',
    nullable: true,
    default: null,
  })
  odooEmployeeId: number | null;

  @Column({ name: 'odoo_api_email', type: 'varchar', nullable: true, default: null })
  odooApiEmail: string | null;

  @Column({ name: 'odoo_api_key_enc', type: 'varchar', nullable: true, default: null })
  odooApiKeyEnc: string | null;

  @Column({ name: 'odoo_key_valid', default: false })
  odooKeyValid: boolean;

  @Column({
    name: 'odoo_key_validated_at',
    type: 'timestamptz',
    nullable: true,
    default: null,
  })
  odooKeyValidatedAt: Date | null;

  @Column({ name: 'odoo_exempt', default: false })
  odooExempt: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
