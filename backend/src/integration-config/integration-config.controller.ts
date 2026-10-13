import { Body, Controller, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/user-role.enum';
import type { JwtPayload } from '../auth/auth.types';
import { IntegrationConfigService } from './integration-config.service';
import { PatchOdooConfigDto, OdooConfigResponseDto } from './dto/odoo-config.dto';
import { PatchInfraDocConfigDto, InfraDocConfigResponseDto } from './dto/infradoc-config.dto';
import { PatchVmwareConfigDto, VmwareConfigResponseDto } from './dto/vmware-config.dto';
import { PatchVeeamIntegrationConfigDto, VeeamIntegrationConfigResponseDto } from './dto/veeam-integration-config.dto';
import { PatchJetbackupIntegrationConfigDto, JetbackupIntegrationConfigResponseDto } from './dto/jetbackup-integration-config.dto';

@Controller('integration-config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class IntegrationConfigController {
  constructor(private readonly svc: IntegrationConfigService) {}

  @Get('odoo/public')
  @Roles()
  getOdooPublic(): Promise<{ ticketsBaseUrl: string }> { return this.svc.getOdooPublic(); }

  @Get('odoo')
  getOdoo(): Promise<OdooConfigResponseDto> { return this.svc.getOdoo(); }

  @Patch('odoo')
  patchOdoo(@Body() dto: PatchOdooConfigDto, @CurrentUser() u: JwtPayload): Promise<OdooConfigResponseDto> {
    return this.svc.patchOdoo(dto, u.email);
  }

  @Post('odoo/test')
  @HttpCode(200)
  testOdoo(): Promise<{ ok: boolean; message: string }> { return this.svc.testOdoo(); }

  @Get('infradoc')
  getInfraDoc(): Promise<InfraDocConfigResponseDto> { return this.svc.getInfraDoc(); }

  @Patch('infradoc')
  patchInfraDoc(@Body() dto: PatchInfraDocConfigDto, @CurrentUser() u: JwtPayload): Promise<InfraDocConfigResponseDto> {
    return this.svc.patchInfraDoc(dto, u.email);
  }

  @Post('infradoc/test')
  @HttpCode(200)
  testInfraDoc(): Promise<{ ok: boolean; message: string }> { return this.svc.testInfraDoc(); }

  @Get('vmware')
  getVmware(): Promise<VmwareConfigResponseDto> { return this.svc.getVmware(); }

  @Patch('vmware')
  patchVmware(@Body() dto: PatchVmwareConfigDto, @CurrentUser() u: JwtPayload): Promise<VmwareConfigResponseDto> {
    return this.svc.patchVmware(dto, u.email);
  }

  @Post('vmware/test')
  @HttpCode(200)
  testVmware(): Promise<{ ok: boolean; message: string }> { return this.svc.testVmware(); }

  @Get('veeam')
  getVeeam(): Promise<VeeamIntegrationConfigResponseDto> { return this.svc.getVeeam(); }

  @Patch('veeam')
  patchVeeam(@Body() dto: PatchVeeamIntegrationConfigDto, @CurrentUser() u: JwtPayload): Promise<VeeamIntegrationConfigResponseDto> {
    return this.svc.patchVeeam(dto, u.email);
  }

  @Post('veeam/test')
  @HttpCode(200)
  testVeeam(): Promise<{ ok: boolean; message: string }> { return this.svc.testVeeam(); }

  @Get('jetbackup')
  getJetbackup(): Promise<JetbackupIntegrationConfigResponseDto> { return this.svc.getJetbackup(); }

  @Patch('jetbackup')
  patchJetbackup(@Body() dto: PatchJetbackupIntegrationConfigDto, @CurrentUser() u: JwtPayload): Promise<JetbackupIntegrationConfigResponseDto> {
    return this.svc.patchJetbackup(dto, u.email);
  }

  @Post('jetbackup/test')
  @HttpCode(200)
  testJetbackup(): Promise<{ ok: boolean; message: string }> { return this.svc.testJetbackup(); }
}
