import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/auth.types';
import { UserRole } from '../users/user-role.enum';
import { UpdateDeviationStatusDto } from './dto/update-deviation-status.dto';
import { MaintenanceDeviation } from './maintenance-deviation.entity';
import { MaintenanceDeviationsService } from './maintenance-deviations.service';

@Controller('maintenance-deviations')
@UseGuards(JwtAuthGuard)
export class MaintenanceDeviationsController {
  constructor(private readonly maintenanceDeviationsService: MaintenanceDeviationsService) {}

  @Get()
  async findByTaskIds(@Query('taskIds') taskIds?: string): Promise<MaintenanceDeviation[]> {
    if (!taskIds) throw new BadRequestException('taskIds es requerido');
    const ids = taskIds.split(',').map(id => id.trim()).filter(Boolean);
    return this.maintenanceDeviationsService.findByTaskIds(ids);
  }

  @Get('by-task/:taskId')
  findByTaskId(
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ): Promise<MaintenanceDeviation[]> {
    return this.maintenanceDeviationsService.findByTaskId(taskId);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.TL, UserRole.TECHNICIAN)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeviationStatusDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<MaintenanceDeviation> {
    return this.maintenanceDeviationsService.updateStatus(id, dto.status, user.sub);
  }
}
