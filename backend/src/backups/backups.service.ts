import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { VeeamClientConfig } from './entities/veeam-client-config.entity';
import { VeeamDailySnapshot } from './entities/veeam-daily-snapshot.entity';
import { VeeamService } from '../integrations/veeam/veeam.service';
import { CredentialVaultService } from './credential-vault.service';
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
    private readonly vaultService: CredentialVaultService,
  ) {}

  private get encryptKey(): string {
    const key = this.configService.get<string>('INTEGRATIONS_ENCRYPT_KEY', '');
    if (!key) throw new Error('INTEGRATIONS_ENCRYPT_KEY is not configured');
    return key;
  }

  private async resolvePassword(config: VeeamClientConfig): Promise<string> {
    if (config.credentialVaultEntryId) {
      return this.vaultService.getDecryptedPassword(config.credentialVaultEntryId);
    }
    return decrypt(config.encryptedPassword, this.encryptKey);
  }

  private toResponseDto(c: VeeamClientConfig): VeeamClientConfigResponseDto {
    return {
      id: c.id,
      clientId: c.clientId,
      clientName: c.clientName,
      host: c.host,
      port: c.port,
      username: c.username,
      isEnabled: c.isEnabled,
      lastConnectedAt: c.lastConnectedAt?.toISOString() ?? null,
      credentialVaultEntryId: c.credentialVaultEntryId,
    };
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
    const password = await this.resolvePassword(config);
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
    return configs.map(c => this.toResponseDto(c));
  }

  async createConfig(dto: CreateVeeamConfigDto): Promise<VeeamClientConfigResponseDto> {
    if (!dto.credentialVaultId && !dto.password) {
      throw new BadRequestException('Se requiere credentialVaultId o password');
    }
    const data: Partial<VeeamClientConfig> = {
      clientId: dto.clientId,
      clientName: dto.clientName,
      host: dto.host,
      port: dto.port,
      username: dto.username,
      isEnabled: dto.isEnabled,
      encryptedPassword: '',
      credentialVaultEntryId: null,
    };
    if (dto.credentialVaultId) {
      data.credentialVaultEntryId = dto.credentialVaultId;
    } else if (dto.password) {
      data.encryptedPassword = encrypt(dto.password, this.encryptKey);
    }
    const entity = this.configRepo.create(data);
    const saved = await this.configRepo.save(entity);
    return this.toResponseDto(saved);
  }

  async updateConfig(id: string, dto: UpdateVeeamConfigDto): Promise<VeeamClientConfigResponseDto> {
    const config = await this.configRepo.findOne({ where: { id } });
    if (!config) throw new NotFoundException();
    if (dto.clientName !== undefined) config.clientName = dto.clientName;
    if (dto.host !== undefined) config.host = dto.host;
    if (dto.port !== undefined) config.port = dto.port;
    if (dto.username !== undefined) config.username = dto.username;
    if (dto.password !== undefined) {
      config.encryptedPassword = encrypt(dto.password, this.encryptKey);
      config.credentialVaultEntryId = null;
    } else if (dto.credentialVaultId !== undefined) {
      config.credentialVaultEntryId = dto.credentialVaultId;
      config.encryptedPassword = '';
    }
    if (dto.isEnabled !== undefined) config.isEnabled = dto.isEnabled;
    config.updatedAt = new Date();
    const saved = await this.configRepo.save(config);
    return this.toResponseDto(saved);
  }

  async deleteConfig(id: string): Promise<void> {
    await this.configRepo.delete(id);
  }

  async testConnection(id: string): Promise<TestConnectionResultDto> {
    const config = await this.configRepo.findOne({ where: { id } });
    if (!config) throw new NotFoundException();
    const password = await this.resolvePassword(config);
    return this.veeamService.testConnection(config.host, config.port, config.username, password);
  }
}
