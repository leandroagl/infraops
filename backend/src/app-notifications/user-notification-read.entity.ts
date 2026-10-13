import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('user_notification_reads')
@Unique(['userId', 'notificationId'])
export class UserNotificationRead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  notificationId: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  readAt: Date;
}
