import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ClientsModule } from '../../clients/clients.module';
import { UsersModule } from '../../users/users.module';
import { OdooRpcService } from './odoo-rpc.service';
import { OdooService } from './odoo.service';
import { OdooController } from './odoo.controller';

@Module({
  imports: [
    HttpModule,
    ClientsModule,
    UsersModule,
  ],
  controllers: [OdooController],
  providers: [OdooRpcService, OdooService],
  exports: [OdooService],
})
export class OdooIntegrationModule {}
