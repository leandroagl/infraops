import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { ExpirationItemDto } from './dto/expiration-item.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('expirations')
  getExpirations(@Query('days') days?: string): Promise<ExpirationItemDto[]> {
    const parsed = days !== undefined ? parseInt(days, 10) : undefined;
    const parsedDays = parsed !== undefined && isNaN(parsed) ? undefined : parsed;
    return this.notificationsService.getExpirations(parsedDays);
  }
}
