import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user-role.enum';
import { UnifiAlertsService } from './unifi-alerts.service';
import { CreateTicketDto } from './dto/create-ticket.dto';

@Controller('unifi/alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UnifiAlertsController {
  constructor(private readonly svc: UnifiAlertsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TL, UserRole.COORDINATOR)
  getAlerts() {
    return this.svc.getAlerts();
  }

  @Post(':alertId/ticket')
  @Roles(UserRole.ADMIN, UserRole.TL)
  @HttpCode(200)
  createTicket(@Param('alertId') alertId: string, @Body() dto: CreateTicketDto) {
    return this.svc.createManualTicket(alertId, dto.siteId, dto.clientId, dto.helpdeskTeamId, dto.tagIds ?? []);
  }
}
