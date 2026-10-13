import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VeeamClientConfig } from './entities/veeam-client-config.entity';
import { VeeamService } from '../integrations/veeam/veeam.service';
import { BackupsService } from './backups.service';
import { IntegrationConfigService } from '../integration-config/integration-config.service';

@Injectable()
export class BackupsCron {
  private readonly logger = new Logger(BackupsCron.name);

  constructor(
    @InjectRepository(VeeamClientConfig) private readonly configRepo: Repository<VeeamClientConfig>,
    private readonly veeamService: VeeamService,
    private readonly backupsService: BackupsService,
    private readonly integrationConfigSvc: IntegrationConfigService,
  ) {}

  @Cron('0 7 * * *')
  async runDailySnapshot(): Promise<void> {
    const configs = await this.configRepo.find({ where: { isEnabled: true } });
    this.logger.log(`Snapshot diario: ${configs.length} clientes`);

    const { username, password } = await this.integrationConfigSvc.getVeeamConfigDecrypted();

    for (const config of configs) {
      try {
        const jobs = await this.veeamService.getJobStatuses(config.host, config.port, username, password);
        await this.backupsService.saveSnapshot(config.clientId, jobs);
        this.logger.log(`Snapshot OK: clientId=${config.clientId} (${jobs.length} jobs)`);
      } catch (err) {
        this.logger.error(`Snapshot FAIL: clientId=${config.clientId} — ${(err as Error).message}`);
      }
    }
  }
}
