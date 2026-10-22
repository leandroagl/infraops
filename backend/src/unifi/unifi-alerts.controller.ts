import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
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

  // TODO: eliminar — endpoints temporales de diagnóstico
  @Get('debug/path')
  @Roles(UserRole.ADMIN)
  debugPath(@Query('path') path: string, @Query() query: Record<string, string>) {
    const { path: _, ...params } = query;
    return this.svc.getRawPath(path, Object.keys(params).length ? params : undefined);
  }

  @Get('debug/resolution')
  @Roles(UserRole.ADMIN)
  debugResolution() {
    return this.svc.debugAlertResolution();
  }

  @Get('debug/local')
  @Roles(UserRole.ADMIN)
  debugLocal() {
    return this.svc.debugLocalResolution();
  }

  @Get('debug/local-raw')
  @Roles(UserRole.ADMIN)
  debugLocalRaw(@Query('path') path: string) {
    return this.svc.getRawLocalPath(path ?? '/v1/sites');
  }
}
