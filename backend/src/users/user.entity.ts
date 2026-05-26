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

  @Column({ name: 'technician_id', type: 'uuid', nullable: true, default: null })
  technicianId: string | null;

  @OneToOne(() => Technician)
  @JoinColumn({ name: 'technician_id' })
  technician: Technician | null;

  @CreateDateColumn()
  createdAt: Date;
}
