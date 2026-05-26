import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Task } from '../tasks/task.entity';
import { User } from '../users/user.entity';
import { MaintenanceLog } from './maintenance-log.entity';
import { MaintenanceLogsController } from './maintenance-logs.controller';
import { MaintenanceLogsService } from './maintenance-logs.service';

@Module({
  imports: [TypeOrmModule.forFeature([MaintenanceLog, Task, User])],
  controllers: [MaintenanceLogsController],
  providers: [MaintenanceLogsService, JwtAuthGuard, RolesGuard],
})
export class MaintenanceLogsModule {}