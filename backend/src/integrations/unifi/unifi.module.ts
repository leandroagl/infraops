import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { UnifiService } from './unifi.service';

@Module({
  imports: [HttpModule],
  providers: [UnifiService],
  exports: [UnifiService],
})
export class UnifiModule {}
