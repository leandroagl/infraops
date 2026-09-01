import { Module } from '@nestjs/common';
import { IntegrationConfigModule } from '../../integration-config/integration-config.module';
import { VmwareService } from './vmware.service';
import { VmwareController } from './vmware.controller';

@Module({
  imports: [IntegrationConfigModule],
  controllers: [VmwareController],
  providers: [VmwareService],
  exports: [VmwareService],
})
export class VmwareIntegrationModule {}
