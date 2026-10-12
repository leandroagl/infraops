import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppNotification } from './app-notification.entity';
import { UserNotificationRead } from './user-notification-read.entity';
import { AppNotificationsService } from './app-notifications.service';
import { AppNotificationsController } from './app-notifications.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AppNotification, UserNotificationRead])],
  controllers: [AppNotificationsController],
  providers: [AppNotificationsService],
  exports: [AppNotificationsService],
})
export class AppNotificationsModule {}
