import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user-role.enum';
import { UpsertClientScheduleDto } from './dto/upsert-client-schedule.dto';
import { SaveRotationConfigDto } from './dto/save-rotation-config.dto';
import { GenerateMonthDto } from './dto/generate-month.dto';
import { ClientSchedule } from './client-schedule.entity';
import { RotationConfig } from './rotation-config.entity';
import { SchedulesService } from './schedules.service';

@Controller('schedules')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TL)
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  findAll(): Promise<ClientSchedule[]> {
    return this.schedulesService.findAll();
  }

  @Get('rotation')
  getRotationConfig(): Promise<RotationConfig> {
    return this.schedulesService.getRotationConfig();
  }

  @Put('rotation')
  saveRotationConfig(@Body() dto: SaveRotationConfigDto): Promise<RotationConfig> {
    return this.schedulesService.saveRotationConfig(dto);
  }

  @Get('rotation/preview')
  previewRotation() {
    return this.schedulesService.previewRotation();
  }

  @Get('preview')
  getMonthlyPreview(
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.schedulesService.getMonthlyPreview(parseInt(year, 10), parseInt(month, 10));
  }

  @Post('generate')
  generateMonth(@Body() dto: GenerateMonthDto) {
    return this.schedulesService.generateMonth(dto.year, dto.month);
  }

  @Put(':clientId')
  upsert(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() dto: UpsertClientScheduleDto,
  ): Promise<ClientSchedule> {
    return this.schedulesService.upsert(clientId, dto);
  }
}
