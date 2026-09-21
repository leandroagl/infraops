import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/user-role.enum';
import type { JwtPayload } from '../auth/auth.types';
import { ExpirationTicketsService } from './expiration-tickets.service';
import { PatchExpirationTypeConfigsDto } from './dto/patch-expiration-type-configs.dto';
import { OdooConfigResponseDto } from '../integration-config/dto/odoo-config.dto';

@Controller('notifications/config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class NotificationsConfigController {
  constructor(private readonly expirationTicketsService: ExpirationTicketsService) {}

  @Patch()
  patch(
    @Body() dto: PatchExpirationTypeConfigsDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<OdooConfigResponseDto> {
    return this.expirationTicketsService.saveTypeConfigs(dto.expirationsTypeConfigs, user.email);
  }
}
