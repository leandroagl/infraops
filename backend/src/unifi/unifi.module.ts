import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnifiSiteConfig } from './entities/unifi-site-config.entity';
import { UnifiTicket } from './entities/unifi-ticket.entity';
import { UnifiAutoConfig } from './entities/unifi-auto-config.entity';
import { UnifiSitesService } from './unifi-sites.service';
import { UnifiSitesController } from './unifi-sites.controller';
import { UnifiAlertsService } from './unifi-alerts.service';
import { UnifiAlertsController } from './unifi-alerts.controller';
import { UnifiAutoConfigService } from './unifi-auto-config.service';
import { UnifiAutoConfigController } from './unifi-auto-config.controller';
import { UnifiCronService } from './unifi-cron.service';
import { UnifiModule as UnifiIntegrationModule } from '../integrations/unifi/unifi.module';
import { IntegrationConfigModule } from '../integration-config/integration-config.module';
import { OdooIntegrationModule } from '../integrations/odoo/odoo-integration.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UnifiSiteConfig, UnifiTicket, UnifiAutoConfig]),
    UnifiIntegrationModule,
    IntegrationConfigModule,
    OdooIntegrationModule,
  ],
  controllers: [UnifiSitesController, UnifiAlertsController, UnifiAutoConfigController],
  providers: [UnifiSitesService, UnifiAlertsService, UnifiAutoConfigService, UnifiCronService],
})
export class UnifiModule {}
