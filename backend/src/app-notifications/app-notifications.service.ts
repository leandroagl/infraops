import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppNotification } from './app-notification.entity';
import { UserNotificationRead } from './user-notification-read.entity';

@Injectable()
export class AppNotificationsService {
  constructor(
    @InjectRepository(AppNotification)
    private readonly notifRepo: Repository<AppNotification>,
    @InjectRepository(UserNotificationRead)
    private readonly readRepo: Repository<UserNotificationRead>,
  ) {}

  async create(type: string, payload: Record<string, unknown>): Promise<AppNotification> {
    return this.notifRepo.save({ type, payload });
  }

  async getUnreadForUser(userId: string): Promise<AppNotification[]> {
    return this.notifRepo
      .createQueryBuilder('n')
      .leftJoin(
        UserNotificationRead,
        'unr',
        'unr."notificationId" = n.id AND unr."userId" = :userId',
        { userId },
      )
      .where('unr.id IS NULL')
      .orderBy('n."createdAt"', 'DESC')
      .getMany();
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const exists = await this.notifRepo.findOne({ where: { id: notificationId } });
    if (!exists) throw new NotFoundException(`Notification ${notificationId} not found`);
    await this.readRepo
      .createQueryBuilder()
      .insert()
      .into(UserNotificationRead)
      .values({ userId, notificationId })
      .orIgnore()
      .execute();
  }

  async markAllAsRead(userId: string): Promise<void> {
    const unread = await this.getUnreadForUser(userId);
    if (unread.length === 0) return;
    await this.readRepo
      .createQueryBuilder()
      .insert()
      .into(UserNotificationRead)
      .values(unread.map(n => ({ userId, notificationId: n.id })))
      .orIgnore()
      .execute();
  }
}
