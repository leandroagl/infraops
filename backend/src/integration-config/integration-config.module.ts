import * as https from 'https';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { OdooConfig } from './entities/odoo-config.entity';
import { InfraDocConfig } from './entities/infradoc-config.entity';
import { VmwareConfig } from './entities/vmware-config.entity';
import { IntegrationConfigService } from './integration-config.service';
import { IntegrationConfigController } from './integration-config.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([OdooConfig, InfraDocConfig, VmwareConfig]),
    HttpModule.register({ httpsAgent: new https.Agent({ rejectUnauthorized: false }) }),
  ],
  providers: [IntegrationConfigService],
  controllers: [IntegrationConfigController],
  exports: [IntegrationConfigService],
})
export class IntegrationConfigModule {}
