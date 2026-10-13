import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/user-role.enum';
import type { JwtPayload } from '../auth/auth.types';
import { ExpirationTicketsService } from './expiration-tickets.service';
import { ExpirationTypeConfigEntryDto } from '../integration-config/dto/odoo-config.dto';
import { OdooConfigResponseDto } from '../integration-config/dto/odoo-config.dto';
import { UrgentBacklogPreviewDto, UrgentBacklogResultDto } from './dto/expiration-item.dto';

@Controller('notifications/config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class NotificationsConfigController {
  constructor(private readonly expirationTicketsService: ExpirationTicketsService) {}

  @Patch(':type')
  patch(
    @Param('type') type: string,
    @Body() dto: ExpirationTypeConfigEntryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<OdooConfigResponseDto> {
    return this.expirationTicketsService.saveTypeConfig(type, dto, user.email);
  }

  @Get('urgent-preview')
  urgentPreview(
    @Query('minDays') minDays?: string,
    @Query('maxDays') maxDays?: string,
  ): Promise<UrgentBacklogPreviewDto> {
    return this.expirationTicketsService.getUrgentBacklogPreview(
      this.parseDays(minDays, 0), this.parseDays(maxDays, 17),
    );
  }

  @Post('urgent-tickets')
  createUrgentTickets(
    @Query('minDays') minDays?: string,
    @Query('maxDays') maxDays?: string,
  ): Promise<UrgentBacklogResultDto> {
    return this.expirationTicketsService.createUrgentBacklogTickets(
      this.parseDays(minDays, 0), this.parseDays(maxDays, 17),
    );
  }

  private parseDays(value: string | undefined, fallback: number): number {
    const parsed = value !== undefined ? parseInt(value, 10) : NaN;
    return isNaN(parsed) ? fallback : parsed;
  }
}
