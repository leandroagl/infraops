import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('technicians')
export class Technician {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (user) => user.technician)
  user: User;

  @Column({ type: 'int', nullable: true, default: null })
  odooUserId: number | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  odooSyncedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
