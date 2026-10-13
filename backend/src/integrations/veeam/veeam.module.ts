// backend/src/integrations/veeam/veeam.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { VeeamService } from './veeam.service';

@Module({
  imports: [HttpModule],
  providers: [VeeamService],
  exports: [VeeamService],
})
export class VeeamModule {}
