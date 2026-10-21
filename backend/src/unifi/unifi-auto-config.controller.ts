import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user-role.enum';
import { UnifiAutoConfigService } from './unifi-auto-config.service';
import { PatchUnifiAutoConfigDto } from './dto/unifi-auto-config.dto';

@Controller('unifi/auto-config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UnifiAutoConfigController {
  constructor(private readonly svc: UnifiAutoConfigService) {}

  @Get()
  get() {
    return this.svc.get();
  }

  @Patch()
  patch(@Body() dto: PatchUnifiAutoConfigDto) {
    return this.svc.patch(dto);
  }
}
