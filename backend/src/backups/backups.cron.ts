import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { VeeamClientConfig } from './entities/veeam-client-config.entity';
import { VeeamDailySnapshot } from './entities/veeam-daily-snapshot.entity';
import { VeeamService } from '../integrations/veeam/veeam.service';
import { decrypt } from '../integration-config/crypto.util';

@Injectable()
export class BackupsCron {
  private readonly logger = new Logger(BackupsCron.name);

  constructor(
    @InjectRepository(VeeamClientConfig) private readonly configRepo: Repository<VeeamClientConfig>,
    @InjectRepository(VeeamDailySnapshot) private readonly snapshotRepo: Repository<VeeamDailySnapshot>,
    private readonly veeamService: VeeamService,
    private readonly configService: ConfigService,
  ) {}

  private get encryptKey(): string {
    return this.configService.get<string>('INTEGRATIONS_ENCRYPT_KEY', '');
  }

  @Cron('0 7 * * *')
  async runDailySnapshot(): Promise<void> {
    const configs = await this.configRepo.find({ where: { isEnabled: true } });
    this.logger.log(`Snapshot diario: ${configs.length} clientes`);
    const date = new Date().toISOString().split('T')[0];

    for (const config of configs) {
      try {
        const password = decrypt(config.encryptedPassword, this.encryptKey);
        const jobs = await this.veeamService.getJobStatuses(config.host, config.port, config.username, password);
        const rows = jobs.map(j => ({
          clientId: config.clientId,
          jobId: j.jobId,
          jobName: j.jobName,
          jobType: j.jobType,
          result: j.lastResult,
          message: j.lastMessage,
          lastRunAt: j.lastRunAt ? new Date(j.lastRunAt) : null,
          hoursAgo: j.hoursAgo,
          snapshotDate: date,
        }));
        await this.snapshotRepo.upsert(rows, ['clientId', 'jobId', 'snapshotDate']);
        this.logger.log(`Snapshot OK: clientId=${config.clientId} (${jobs.length} jobs)`);
      } catch (err) {
        this.logger.error(`Snapshot FAIL: clientId=${config.clientId} — ${(err as Error).message}`);
      }
    }
  }
}
