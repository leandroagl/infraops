import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { BackupsService } from './backups.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user-role.enum';
import { CreateVeeamConfigDto, UpdateVeeamConfigDto } from './dto/veeam-config.dto';
import { CreateJetbackupConfigsDto, UpdateJetbackupConfigDto } from './dto/jetbackup-config.dto';
import { CreateAcronisConfigsDto, UpdateAcronisConfigDto } from './dto/acronis-config.dto';

@Controller('backups')
@UseGuards(JwtAuthGuard)
export class BackupsController {
  constructor(private readonly svc: BackupsService) {}

  @Get()
  getAll() {
    return this.svc.getAllClientStatuses();
  }

  // IMPORTANT: literal-path routes must be registered BEFORE @Get(':clientId')
  @Get('snapshot')
  getSnapshot() {
    return this.svc.getLastSnapshot();
  }

  @Get('configs')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  listConfigs() {
    return this.svc.listConfigs();
  }

  @Get('jetbackup/jobs')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  listJetbackupJobs() {
    return this.svc.listJetbackupJobs();
  }

  @Post('configs/jetbackup')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  createJetbackupConfigs(@Body() dto: CreateJetbackupConfigsDto) {
    return this.svc.createJetbackupConfigs(dto);
  }

  @Patch('configs/jetbackup/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  updateJetbackupConfig(@Param('id') id: string, @Body() dto: UpdateJetbackupConfigDto) {
    return this.svc.updateJetbackupConfig(id, dto);
  }

  @Delete('configs/jetbackup/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  deleteJetbackupConfig(@Param('id') id: string) {
    return this.svc.deleteJetbackupConfig(id);
  }

  @Get('acronis/plans')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  listAcronisPlans() {
    return this.svc.listAcronisPlans();
  }

  @Post('configs/acronis')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  createAcronisConfigs(@Body() dto: CreateAcronisConfigsDto) {
    return this.svc.createAcronisConfigs(dto);
  }

  @Patch('configs/acronis/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  updateAcronisConfig(@Param('id') id: string, @Body() dto: UpdateAcronisConfigDto) {
    return this.svc.updateAcronisConfig(id, dto);
  }

  @Delete('configs/acronis/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  deleteAcronisConfig(@Param('id') id: string) {
    return this.svc.deleteAcronisConfig(id);
  }

  @Get(':clientId')
  getOne(@Param('clientId') clientId: string) {
    return this.svc.getClientStatus(clientId);
  }

  @Post('configs')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  createConfig(@Body() dto: CreateVeeamConfigDto) {
    return this.svc.createConfig(dto);
  }

  @Patch('configs/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  updateConfig(@Param('id') id: string, @Body() dto: UpdateVeeamConfigDto) {
    return this.svc.updateConfig(id, dto);
  }

  @Delete('configs/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  deleteConfig(@Param('id') id: string) {
    return this.svc.deleteConfig(id);
  }

  @Post('configs/:id/test')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  testConnection(@Param('id') id: string) {
    return this.svc.testConnection(id);
  }
}
