import * as https from 'https';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { Client } from './client.entity';
import { ClientSubscriptionHourSnapshot } from './client-subscription-hour-snapshot.entity';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { InfradocService } from './infradoc/infradoc.service';
import { IntegrationConfigModule } from '../integration-config/integration-config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Client, ClientSubscriptionHourSnapshot]),
    IntegrationConfigModule,
    HttpModule.register({
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    }),
  ],
  controllers: [ClientsController],
  providers: [ClientsService, InfradocService],
  exports: [ClientsService, TypeOrmModule],
})
export class ClientsModule {}
