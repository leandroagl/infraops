import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { VeeamClientConfig } from './entities/veeam-client-config.entity';
import { VeeamDailySnapshot } from './entities/veeam-daily-snapshot.entity';
import { VeeamService } from '../integrations/veeam/veeam.service';
import { encrypt, decrypt } from '../integration-config/crypto.util';
import type { BackupJobStatus } from '../integrations/veeam/dto/veeam-api.dto';
import type {
  CreateVeeamConfigDto,
  UpdateVeeamConfigDto,
  VeeamClientConfigResponseDto,
  TestConnectionResultDto,
} from './dto/veeam-config.dto';
import type { ClientBackupStatusDto, ClientStatus } from './dto/backup-status.dto';

@Injectable()
export class BackupsService {
  constructor(
    @InjectRepository(VeeamClientConfig) private readonly configRepo: Repository<VeeamClientConfig>,
    @InjectRepository(VeeamDailySnapshot) private readonly snapshotRepo: Repository<VeeamDailySnapshot>,
    private readonly veeamService: VeeamService,
    private readonly configService: ConfigService,
  ) {}

  private get encryptKey(): string {
    return this.configService.get<string>('INTEGRATIONS_ENCRYPT_KEY', '');
  }

  private deriveClientStatus(jobs: BackupJobStatus[]): ClientStatus {
    if (!jobs.length) return 'no_data';
    if (jobs.some(j => j.lastResult === 'Failed')) return 'crit';
    if (jobs.some(j => j.lastResult === 'Warning')) return 'warn';
    return 'ok';
  }

  async getClientStatus(clientId: string): Promise<ClientBackupStatusDto> {
    const config = await this.configRepo.findOne({ where: { clientId } });
    if (!config) throw new NotFoundException('Config not found');
    const password = decrypt(config.encryptedPassword, this.encryptKey);
    const jobs = await this.veeamService.getJobStatuses(config.host, config.port, config.username, password);
    const status = this.deriveClientStatus(jobs);
    return {
      clientId: config.clientId,
      clientName: config.clientName,
      status,
      totalJobs: jobs.length,
      okCount: jobs.filter(j => j.lastResult === 'Success').length,
      warnCount: jobs.filter(j => j.lastResult === 'Warning').length,
      critCount: jobs.filter(j => j.lastResult === 'Failed').length,
      hasRunningJob: jobs.some(j => j.isRunning),
      lastReadAt: new Date().toISOString(),
      jobs,
    };
  }

  async getAllClientStatuses(): Promise<ClientBackupStatusDto[]> {
    const configs = await this.configRepo.find({ where: { isEnabled: true } });
    const results = await Promise.allSettled(
      configs.map(c => this.getClientStatus(c.clientId)),
    );
    return results
      .filter((r): r is PromiseFulfilledResult<ClientBackupStatusDto> => r.status === 'fulfilled')
      .map(r => r.value);
  }

  async saveSnapshot(clientId: string, jobs: BackupJobStatus[]): Promise<void> {
    const date = new Date().toISOString().split('T')[0];
    const rows = jobs.map(j => ({
      clientId,
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
  }

  async listConfigs(): Promise<VeeamClientConfigResponseDto[]> {
    const configs = await this.configRepo.find();
    return configs.map(c => ({
      id: c.id,
      clientId: c.clientId,
      clientName: c.clientName,
      host: c.host,
      port: c.port,
      username: c.username,
      isEnabled: c.isEnabled,
      lastConnectedAt: c.lastConnectedAt?.toISOString() ?? null,
    }));
  }

  async createConfig(dto: CreateVeeamConfigDto): Promise<VeeamClientConfigResponseDto> {
    const data = {
      clientId: dto.clientId,
      clientName: dto.clientName,
      host: dto.host,
      port: dto.port,
      username: dto.username,
      encryptedPassword: encrypt(dto.password, this.encryptKey),
      isEnabled: dto.isEnabled,
    };
    const entity = this.configRepo.create(data);
    const saved = await this.configRepo.save(entity);
    return {
      id: saved.id,
      clientId: saved.clientId,
      clientName: saved.clientName,
      host: saved.host,
      port: saved.port,
      username: saved.username,
      isEnabled: saved.isEnabled,
      lastConnectedAt: null,
    };
  }

  async updateConfig(id: string, dto: UpdateVeeamConfigDto): Promise<VeeamClientConfigResponseDto> {
    const config = await this.configRepo.findOne({ where: { id } });
    if (!config) throw new NotFoundException();
    if (dto.host !== undefined) config.host = dto.host;
    if (dto.port !== undefined) config.port = dto.port;
    if (dto.username !== undefined) config.username = dto.username;
    if (dto.password !== undefined) config.encryptedPassword = encrypt(dto.password, this.encryptKey);
    if (dto.isEnabled !== undefined) config.isEnabled = dto.isEnabled;
    config.updatedAt = new Date();
    const saved = await this.configRepo.save(config);
    return {
      id: saved.id,
      clientId: saved.clientId,
      clientName: saved.clientName,
      host: saved.host,
      port: saved.port,
      username: saved.username,
      isEnabled: saved.isEnabled,
      lastConnectedAt: saved.lastConnectedAt?.toISOString() ?? null,
    };
  }

  async deleteConfig(id: string): Promise<void> {
    await this.configRepo.delete(id);
  }

  async testConnection(id: string): Promise<TestConnectionResultDto> {
    const config = await this.configRepo.findOne({ where: { id } });
    if (!config) throw new NotFoundException();
    const password = decrypt(config.encryptedPassword, this.encryptKey);
    return this.veeamService.testConnection(config.host, config.port, config.username, password);
  }
}
