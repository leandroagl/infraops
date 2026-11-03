import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { UnifiService } from './unifi.service';
import { UnifiLocalService } from './unifi-local.service';

@Module({
  imports: [HttpModule],
  providers: [UnifiService, UnifiLocalService],
  exports: [UnifiService, UnifiLocalService],
})
export class UnifiModule {}
