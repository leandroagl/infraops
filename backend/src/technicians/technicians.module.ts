import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsersModule } from '../users/users.module';
import { Technician } from './technician.entity';
import { TechniciansController } from './technicians.controller';
import { TechniciansService } from './technicians.service';

@Module({
  imports: [TypeOrmModule.forFeature([Technician]), UsersModule],
  controllers: [TechniciansController],
  providers: [TechniciansService, JwtAuthGuard, RolesGuard],
  exports: [TechniciansService],
})
export class TechniciansModule {}
