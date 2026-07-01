import { Module } from '@nestjs/common';
import { VmwareController } from './vmware.controller';
import { VmwareService } from './vmware.service';

@Module({
  controllers: [VmwareController],
  providers: [VmwareService],
})
export class VmwareIntegrationModule {}
