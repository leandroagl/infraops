import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackupsController } from './backups.controller';
import { BackupsService } from './backups.service';
import { BackupsCron } from './backups.cron';
import { VeeamClientConfig } from './entities/veeam-client-config.entity';
import { VeeamDailySnapshot } from './entities/veeam-daily-snapshot.entity';
import { JetbackupJobConfig } from './entities/jetbackup-job-config.entity';
import { AcronisPlanConfig } from './entities/acronis-plan-config.entity';
import { VeeamModule } from '../integrations/veeam/veeam.module';
import { JetbackupModule } from '../integrations/jetbackup/jetbackup.module';
import { AcronisModule } from '../integrations/acronis/acronis.module';
import { IntegrationConfigModule } from '../integration-config/integration-config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VeeamClientConfig, VeeamDailySnapshot, JetbackupJobConfig, AcronisPlanConfig]),
    VeeamModule,
    JetbackupModule,
    AcronisModule,
    IntegrationConfigModule,
  ],
  controllers: [BackupsController],
  providers: [BackupsService, BackupsCron],
  exports: [BackupsService],
})
export class BackupsModule {}
