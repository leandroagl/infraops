import * as https from 'https';
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ExpirationTicketsService } from './expiration-tickets.service';
import { ExpirationTicket } from './expiration-ticket.entity';
import { OdooIntegrationModule } from '../integrations/odoo/odoo-integration.module';
import { IntegrationConfigModule } from '../integration-config/integration-config.module';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports: [
    HttpModule.register({
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    }),
    TypeOrmModule.forFeature([ExpirationTicket]),
    OdooIntegrationModule,
    IntegrationConfigModule,
    ClientsModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, ExpirationTicketsService],
})
export class NotificationsModule {}
