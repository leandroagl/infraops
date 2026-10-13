import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VeeamClientConfig } from './entities/veeam-client-config.entity';
import { JetbackupJobConfig } from './entities/jetbackup-job-config.entity';
import { VeeamService } from '../integrations/veeam/veeam.service';
import { JetbackupService } from '../integrations/jetbackup/jetbackup.service';
import { BackupsService } from './backups.service';
import { IntegrationConfigService } from '../integration-config/integration-config.service';

@Injectable()
export class BackupsCron {
  private readonly logger = new Logger(BackupsCron.name);

  constructor(
    @InjectRepository(VeeamClientConfig) private readonly configRepo: Repository<VeeamClientConfig>,
    @InjectRepository(JetbackupJobConfig) private readonly jetbackupRepo: Repository<JetbackupJobConfig>,
    private readonly veeamService: VeeamService,
    private readonly jetbackupService: JetbackupService,
    private readonly backupsService: BackupsService,
    private readonly integrationConfigSvc: IntegrationConfigService,
  ) {}

  @Cron('0 7 * * *')
  async runDailySnapshot(): Promise<void> {
    await this.snapshotVeeam();
    await this.snapshotJetbackup();
  }

  private async snapshotVeeam(): Promise<void> {
    const configs = await this.configRepo.find({ where: { isEnabled: true } });
    this.logger.log(`Snapshot diario Veeam: ${configs.length} clientes`);
    if (!configs.length) return;

    const { username, password } = await this.integrationConfigSvc.getVeeamConfigDecrypted();

    for (const config of configs) {
      try {
        const jobs = await this.veeamService.getJobStatuses(config.host, config.port, username, password);
        await this.backupsService.saveSnapshot(config.clientId, 'VEEAM', jobs);
        this.logger.log(`Snapshot Veeam OK: clientId=${config.clientId} (${jobs.length} jobs)`);
      } catch (err) {
        this.logger.error(`Snapshot Veeam FAIL: clientId=${config.clientId} — ${(err as Error).message}`);
      }
    }
  }

  private async snapshotJetbackup(): Promise<void> {
    const configs = await this.jetbackupRepo.find({ where: { isEnabled: true } });
    this.logger.log(`Snapshot diario JetBackup: ${configs.length} jobs`);
    if (!configs.length) return;

    const byClient = new Map<string, JetbackupJobConfig[]>();
    for (const c of configs) byClient.set(c.clientId, [...(byClient.get(c.clientId) ?? []), c]);

    try {
      const conn = await this.integrationConfigSvc.getJetbackupConfigDecrypted();
      for (const [clientId, jobs] of byClient) {
        try {
          const statuses = await this.jetbackupService.getJobStatuses(
            conn, jobs.map(j => ({ jobId: j.jobId, jobName: j.jobName })),
          );
          await this.backupsService.saveSnapshot(clientId, 'JETBACKUP', statuses);
          this.logger.log(`Snapshot JetBackup OK: clientId=${clientId} (${statuses.length} jobs)`);
        } catch (err) {
          this.logger.error(`Snapshot JetBackup FAIL: clientId=${clientId} — ${(err as Error).message}`);
        }
      }
    } catch (err) {
      this.logger.error(`Snapshot JetBackup FAIL: no se pudo leer la config — ${(err as Error).message}`);
    }
  }
}
