import { Module } from '@nestjs/common';
import { ClientsModule } from '../../clients/clients.module';
import { UsersModule } from '../../users/users.module';
import { TechniciansModule } from '../../technicians/technicians.module';
import { OdooSystemRpcService } from './odoo-system-rpc.service';
import { OdooService } from './odoo.service';
import { OdooController } from './odoo.controller';
import { SubscriptionHoursController } from './subscription-hours.controller';

@Module({
  imports: [ClientsModule, UsersModule, TechniciansModule],
  controllers: [OdooController, SubscriptionHoursController],
  providers: [OdooSystemRpcService, OdooService],
  exports: [OdooService],
})
export class OdooIntegrationModule {}
