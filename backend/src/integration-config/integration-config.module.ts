import * as https from 'https';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { OdooConfig } from './entities/odoo-config.entity';
import { InfraDocConfig } from './entities/infradoc-config.entity';
import { VmwareConfig } from './entities/vmware-config.entity';
import { VeeamConfig } from './entities/veeam-config.entity';
import { JetbackupConfig } from './entities/jetbackup-config.entity';
import { AcronisConfig } from './entities/acronis-config.entity';
import { UnifiConfig } from './entities/unifi-config.entity';
import { IntegrationConfigService } from './integration-config.service';
import { IntegrationConfigController } from './integration-config.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([OdooConfig, InfraDocConfig, VmwareConfig, VeeamConfig, JetbackupConfig, AcronisConfig, UnifiConfig]),
    HttpModule.register({ httpsAgent: new https.Agent({ rejectUnauthorized: false }) }),
  ],
  providers: [IntegrationConfigService],
  controllers: [IntegrationConfigController],
  exports: [IntegrationConfigService],
})
export class IntegrationConfigModule {}
