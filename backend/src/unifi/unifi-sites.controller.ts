import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user-role.enum';
import { UnifiSitesService } from './unifi-sites.service';
import { CreateUnifiSiteConfigDto, CreateUnifiSiteConfigsBulkDto, UpdateUnifiSiteConfigDto } from './dto/unifi-site-config.dto';

@Controller('unifi/sites')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UnifiSitesController {
  constructor(private readonly svc: UnifiSitesService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TL)
  findAll() {
    return this.svc.findAll();
  }

  @Get('available')
  @Roles(UserRole.ADMIN)
  getAvailableSites() {
    return this.svc.getAvailableSites();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateUnifiSiteConfigDto) {
    return this.svc.create(dto);
  }

  @Post('bulk')
  @Roles(UserRole.ADMIN)
  createBulk(@Body() dto: CreateUnifiSiteConfigsBulkDto) {
    return this.svc.createBulk(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateUnifiSiteConfigDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
