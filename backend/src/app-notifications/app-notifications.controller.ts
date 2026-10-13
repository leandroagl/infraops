import { Controller, Get, HttpCode, HttpStatus, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.types';
import { AppNotificationsService } from './app-notifications.service';
import { AppNotification } from './app-notification.entity';

@Controller('app-notifications')
@UseGuards(JwtAuthGuard)
export class AppNotificationsController {
  constructor(private readonly service: AppNotificationsService) {}

  @Get()
  getUnread(@CurrentUser() user: JwtPayload): Promise<AppNotification[]> {
    return this.service.getUnreadForUser(user.sub);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAllAsRead(@CurrentUser() user: JwtPayload): Promise<void> {
    return this.service.markAllAsRead(user.sub);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.service.markAsRead(user.sub, id);
  }
}
