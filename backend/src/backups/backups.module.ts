import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackupsController } from './backups.controller';
import { BackupsService } from './backups.service';
import { BackupsCron } from './backups.cron';
import { VeeamClientConfig } from './entities/veeam-client-config.entity';
import { VeeamDailySnapshot } from './entities/veeam-daily-snapshot.entity';
import { CredentialVaultEntry } from './entities/credential-vault-entry.entity';
import { CredentialVaultService } from './credential-vault.service';
import { CredentialVaultController } from './credential-vault.controller';
import { VeeamModule } from '../integrations/veeam/veeam.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VeeamClientConfig, VeeamDailySnapshot, CredentialVaultEntry]),
    VeeamModule,
  ],
  controllers: [BackupsController, CredentialVaultController],
  providers: [BackupsService, BackupsCron, CredentialVaultService],
  exports: [BackupsService],
})
export class BackupsModule {}
