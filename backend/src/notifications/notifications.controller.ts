import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExpirationTicketsService } from './expiration-tickets.service';
import { ExpirationItemDto } from './dto/expiration-item.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly expirationTicketsService: ExpirationTicketsService) {}

  @Get('expirations')
  getExpirations(@Query('days') days?: string): Promise<ExpirationItemDto[]> {
    const parsed = days !== undefined ? parseInt(days, 10) : undefined;
    const parsedDays = parsed !== undefined && isNaN(parsed) ? undefined : parsed;
    return this.expirationTicketsService.getExpirationsWithTickets(parsedDays);
  }
}
