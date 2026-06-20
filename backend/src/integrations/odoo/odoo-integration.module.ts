import { Module } from '@nestjs/common';
import { ClientsModule } from '../../clients/clients.module';
import { UsersModule } from '../../users/users.module';
import { TechniciansModule } from '../../technicians/technicians.module';
import { OdooRpcService } from './odoo-rpc.service';
import { OdooService } from './odoo.service';
import { OdooController } from './odoo.controller';

@Module({
  imports: [ClientsModule, UsersModule, TechniciansModule],
  controllers: [OdooController],
  providers: [OdooRpcService, OdooService],
  exports: [OdooService],
})
export class OdooIntegrationModule {}
