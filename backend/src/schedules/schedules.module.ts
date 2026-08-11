import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TasksModule } from '../tasks/tasks.module';
import { TechniciansModule } from '../technicians/technicians.module';
import { ClientSchedule } from './client-schedule.entity';
import { RotationConfig } from './rotation-config.entity';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClientSchedule, RotationConfig]),
    TasksModule,
    TechniciansModule,
  ],
  controllers: [SchedulesController],
  providers: [SchedulesService, JwtAuthGuard, RolesGuard],
  exports: [SchedulesService],
})
export class SchedulesModule {}
