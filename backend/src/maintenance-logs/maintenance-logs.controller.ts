import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/auth.types';
import { UserRole } from '../users/user-role.enum';
import { CreateLogDto } from './dto/create-log.dto';
import { UpdateLogDto } from './dto/update-log.dto';
import { MaintenanceLog } from './maintenance-log.entity';
import { MaintenanceLogsService } from './maintenance-logs.service';

@Controller('tasks/:taskId/log')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaintenanceLogsController {
  constructor(
    private readonly maintenanceLogsService: MaintenanceLogsService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.TL, UserRole.TECHNICIAN)
  create(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateLogDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<MaintenanceLog> {
    return this.maintenanceLogsService.create(taskId, dto, user.sub);
  }

  @Get()
  findByTaskId(
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ): Promise<MaintenanceLog> {
    return this.maintenanceLogsService.findByTaskId(taskId);
  }

  @Patch()
  @Roles(UserRole.ADMIN, UserRole.TL, UserRole.TECHNICIAN)
  update(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateLogDto,
  ): Promise<MaintenanceLog> {
    return this.maintenanceLogsService.update(taskId, dto);
  }
}
