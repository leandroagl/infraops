import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ClientsModule } from '../clients/clients.module';
import { TechniciansModule } from '../technicians/technicians.module';
import { Task } from './task.entity';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task]),
    ClientsModule,
    TechniciansModule,
  ],
  controllers: [TasksController],
  providers: [TasksService, JwtAuthGuard, RolesGuard],
  exports: [TasksService],
})
export class TasksModule {}