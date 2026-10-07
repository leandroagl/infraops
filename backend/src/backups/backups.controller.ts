import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { BackupsService } from './backups.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user-role.enum';
import type { CreateVeeamConfigDto, UpdateVeeamConfigDto } from './dto/veeam-config.dto';

@Controller('backups')
@UseGuards(JwtAuthGuard)
export class BackupsController {
  constructor(private readonly svc: BackupsService) {}

  @Get()
  getAll() {
    return this.svc.getAllClientStatuses();
  }

  // IMPORTANT: @Get('configs') must be registered BEFORE @Get(':clientId')
  // to prevent NestJS from matching the literal "configs" as a :clientId param.
  @Get('configs')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  listConfigs() {
    return this.svc.listConfigs();
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
