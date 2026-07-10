import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OdooUserRpcModule } from '../integrations/odoo/odoo-user-rpc.module';
import { User } from './user.entity';
import { UsersController } from './users.controller';
import { UsersMeController } from './users-me.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), ConfigModule, OdooUserRpcModule],
  controllers: [UsersController, UsersMeController],
  providers: [UsersService, JwtAuthGuard, RolesGuard],
  exports: [TypeOrmModule],
})
export class UsersModule {}
