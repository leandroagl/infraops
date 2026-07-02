import * as https from 'https';
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ClientsModule } from '../../clients/clients.module';
import { InfradocAssetsService } from './infradoc-assets.service';
import { InfrastructureController } from './infrastructure.controller';
import { InfrastructureService } from './infrastructure.service';

@Module({
  imports: [
    HttpModule.register({
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    }),
    ClientsModule,
  ],
  controllers: [InfrastructureController],
  providers: [InfrastructureService, InfradocAssetsService],
  exports: [InfrastructureService],
})
export class InfradocIntegrationModule {}
