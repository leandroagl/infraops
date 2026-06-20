import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { UsersModule } from './users/users.module';
import { TechniciansModule } from './technicians/technicians.module';
import { TasksModule } from './tasks/tasks.module';
import { MaintenanceLogsModule } from './maintenance-logs/maintenance-logs.module';
import { InfradocIntegrationModule } from './integrations/infradoc/infradoc-integration.module';
import { OdooIntegrationModule } from './integrations/odoo/odoo-integration.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_NAME ?? 'infraops',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/migrations/*{.ts,.js}'],
      synchronize: false,
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    ClientsModule,
    TechniciansModule,
    TasksModule,
    MaintenanceLogsModule,
    InfradocIntegrationModule,
    OdooIntegrationModule,
  ],
})
export class AppModule {}
