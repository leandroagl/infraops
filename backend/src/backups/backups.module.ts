import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackupsController } from './backups.controller';
import { BackupsService } from './backups.service';
import { BackupsCron } from './backups.cron';
import { VeeamClientConfig } from './entities/veeam-client-config.entity';
import { VeeamDailySnapshot } from './entities/veeam-daily-snapshot.entity';
import { VeeamModule } from '../integrations/veeam/veeam.module';
import { IntegrationConfigModule } from '../integration-config/integration-config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VeeamClientConfig, VeeamDailySnapshot]),
    VeeamModule,
    IntegrationConfigModule,
  ],
  controllers: [BackupsController],
  providers: [BackupsService, BackupsCron],
  exports: [BackupsService],
})
export class BackupsModule {}
