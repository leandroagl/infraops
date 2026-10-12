import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VeeamClientConfig } from './entities/veeam-client-config.entity';
import { VeeamDailySnapshot } from './entities/veeam-daily-snapshot.entity';
import { VeeamService } from '../integrations/veeam/veeam.service';
import { IntegrationConfigService } from '../integration-config/integration-config.service';
import type { BackupJobStatus } from '../integrations/veeam/dto/veeam-api.dto';
import type { BackupJobStatusDto, JobResult } from './dto/backup-status.dto';
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
    private readonly integrationConfigSvc: IntegrationConfigService,
  ) {}

  private toResponseDto(c: VeeamClientConfig): VeeamClientConfigResponseDto {
    return {
      id: c.id,
      clientId: c.clientId,
      clientName: c.clientName,
      host: c.host,
      port: c.port,
      isEnabled: c.isEnabled,
      lastConnectedAt: c.lastConnectedAt?.toISOString() ?? null,
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
    const { username, password } = await this.integrationConfigSvc.getVeeamConfigDecrypted();
    const jobs = await this.veeamService.getJobStatuses(config.host, config.port, username, password);
    const status = this.deriveClientStatus(jobs);
    void this.saveSnapshot(clientId, jobs);
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

  private snapshotToDto(config: VeeamClientConfig, snaps: VeeamDailySnapshot[]): ClientBackupStatusDto {
    const now = Date.now();
    const jobs: BackupJobStatusDto[] = snaps.map(s => {
      const hoursAgo = s.lastRunAt
        ? Math.round(((now - s.lastRunAt.getTime()) / 3600000) * 10) / 10
        : s.hoursAgo;
      return {
        jobId: s.jobId,
        jobName: s.jobName,
        jobType: s.jobType,
        isRunning: false,
        lastResult: s.result as JobResult | null,
        lastMessage: s.message,
        lastRunAt: s.lastRunAt?.toISOString() ?? null,
        hoursAgo,
        isStale: hoursAgo !== null && hoursAgo > 30,
      };
    });
    const status = this.deriveClientStatus(jobs);
    return {
      clientId: config.clientId,
      clientName: config.clientName,
      status,
      totalJobs: jobs.length,
      okCount: jobs.filter(j => j.lastResult === 'Success').length,
      warnCount: jobs.filter(j => j.lastResult === 'Warning').length,
      critCount: jobs.filter(j => j.lastResult === 'Failed').length,
      hasRunningJob: false,
      lastReadAt: snaps[0].snapshotDate,
      jobs,
      isSnapshot: true,
    };
  }

  async getLastSnapshot(): Promise<ClientBackupStatusDto[]> {
    const configs = await this.configRepo.find();
    if (!configs.length) return [];
    return Promise.all(
      configs.map(async config => {
        if (!config.isEnabled) return this.disconnectedDto(config);
        const latest = await this.snapshotRepo.findOne({
          where: { clientId: config.clientId },
          order: { snapshotDate: 'DESC' },
        });
        if (!latest) return this.disconnectedDto(config);
        const snaps = await this.snapshotRepo.find({
          where: { clientId: config.clientId, snapshotDate: latest.snapshotDate },
        });
        return this.snapshotToDto(config, snaps);
      }),
    );
  }

  private disconnectedDto(config: VeeamClientConfig): ClientBackupStatusDto {
    return {
      clientId: config.clientId,
      clientName: config.clientName,
      status: 'disconnected',
      totalJobs: 0,
      okCount: 0,
      warnCount: 0,
      critCount: 0,
      hasRunningJob: false,
      lastReadAt: new Date().toISOString(),
      jobs: [],
    };
  }

  async getAllClientStatuses(): Promise<ClientBackupStatusDto[]> {
    const configs = await this.configRepo.find();
    return Promise.all(
      configs.map(async c => {
        if (!c.isEnabled) return this.disconnectedDto(c);
        try {
          return await this.getClientStatus(c.clientId);
        } catch {
          return this.disconnectedDto(c);
        }
      }),
    );
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
    const entity = this.configRepo.create({
      clientId: dto.clientId,
      clientName: dto.clientName,
      host: dto.host,
      port: dto.port,
      isEnabled: dto.isEnabled,
    });
    const saved = await this.configRepo.save(entity);
    return this.toResponseDto(saved);
  }

  async updateConfig(id: string, dto: UpdateVeeamConfigDto): Promise<VeeamClientConfigResponseDto> {
    const config = await this.configRepo.findOne({ where: { id } });
    if (!config) throw new NotFoundException();
    if (dto.clientName !== undefined) config.clientName = dto.clientName;
    if (dto.host !== undefined) config.host = dto.host;
    if (dto.port !== undefined) config.port = dto.port;
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
    const { username, password } = await this.integrationConfigSvc.getVeeamConfigDecrypted();
    return this.veeamService.testConnection(config.host, config.port, username, password);
  }
}
