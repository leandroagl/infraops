import { Module } from '@nestjs/common';
import { OdooUserRpcService } from './odoo-user-rpc.service';

@Module({
  providers: [OdooUserRpcService],
  exports: [OdooUserRpcService],
})
export class OdooUserRpcModule {}
