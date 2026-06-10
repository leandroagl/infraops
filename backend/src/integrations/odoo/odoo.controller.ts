import { Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/user-role.enum';
import { OdooService } from './odoo.service';
import { OdooSyncResult } from './dto/odoo-sync-result.dto';
import { OdooSyncStatusDto } from './dto/odoo-sync-status.dto';

@Controller('admin/odoo')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OdooController {
  constructor(private readonly odooService: OdooService) {}

  @Post('sync/partners')
  @HttpCode(200)
  @Roles(UserRole.ADMIN)
  syncPartners(): Promise<OdooSyncResult> {
    return this.odooService.syncPartners();
  }

  @Post('sync/users')
  @HttpCode(200)
  @Roles(UserRole.ADMIN)
  syncUsers(): Promise<OdooSyncResult> {
    return this.odooService.syncUsers();
  }

  @Get('sync/status')
  @Roles(UserRole.ADMIN)
  getSyncStatus(): Promise<OdooSyncStatusDto> {
    return this.odooService.getSyncStatus();
  }
}
