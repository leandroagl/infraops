import { Module } from '@nestjs/common';
import { ClientsModule } from '../../clients/clients.module';
import { UsersModule } from '../../users/users.module';
import { TechniciansModule } from '../../technicians/technicians.module';
import { TaskConfigModule } from '../../task-config/task-config.module';
import { IntegrationConfigModule } from '../../integration-config/integration-config.module';
import { OdooSystemRpcService } from './odoo-system-rpc.service';
import { OdooService } from './odoo.service';
import { OdooController } from './odoo.controller';
import { SubscriptionHoursController } from './subscription-hours.controller';
import { ClientServicesController } from './client-services.controller';

@Module({
  imports: [ClientsModule, UsersModule, TechniciansModule, TaskConfigModule, IntegrationConfigModule],
  controllers: [OdooController, SubscriptionHoursController, ClientServicesController],
  providers: [OdooSystemRpcService, OdooService],
  exports: [OdooService],
})
export class OdooIntegrationModule {}
