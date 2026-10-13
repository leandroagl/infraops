import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('app_notifications')
export class AppNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  type: string;

  @Column({ type: 'jsonb', default: {} })
  payload: Record<string, unknown>;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
