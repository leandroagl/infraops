import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { VeeamClientConfig } from './entities/veeam-client-config.entity';
import { VeeamService } from '../integrations/veeam/veeam.service';
import { BackupsService } from './backups.service';
import { decrypt } from '../integration-config/crypto.util';

@Injectable()
export class BackupsCron {
  private readonly logger = new Logger(BackupsCron.name);

  constructor(
    @InjectRepository(VeeamClientConfig) private readonly configRepo: Repository<VeeamClientConfig>,
    private readonly veeamService: VeeamService,
    private readonly backupsService: BackupsService,
    private readonly configService: ConfigService,
  ) {}

  private get encryptKey(): string {
    return this.configService.get<string>('INTEGRATIONS_ENCRYPT_KEY', '');
  }

  @Cron('0 7 * * *')
  async runDailySnapshot(): Promise<void> {
    const configs = await this.configRepo.find({ where: { isEnabled: true } });
    this.logger.log(`Snapshot diario: ${configs.length} clientes`);

    for (const config of configs) {
      try {
        const password = decrypt(config.encryptedPassword, this.encryptKey);
        const jobs = await this.veeamService.getJobStatuses(config.host, config.port, config.username, password);
        await this.backupsService.saveSnapshot(config.clientId, jobs);
        this.logger.log(`Snapshot OK: clientId=${config.clientId} (${jobs.length} jobs)`);
      } catch (err) {
        this.logger.error(`Snapshot FAIL: clientId=${config.clientId} — ${(err as Error).message}`);
      }
    }
  }
}
