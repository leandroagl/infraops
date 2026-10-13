// backend/src/integrations/acronis/acronis.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AcronisService } from './acronis.service';

@Module({
  imports: [HttpModule],
  providers: [AcronisService],
  exports: [AcronisService],
})
export class AcronisModule {}
