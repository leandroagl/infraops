import { BadGatewayException, BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { VeeamClientConfig } from './entities/veeam-client-config.entity';
import { VeeamDailySnapshot } from './entities/veeam-daily-snapshot.entity';
import { JetbackupJobConfig } from './entities/jetbackup-job-config.entity';
import { VeeamService } from '../integrations/veeam/veeam.service';
import { JetbackupService } from '../integrations/jetbackup/jetbackup.service';
import { IntegrationConfigService } from '../integration-config/integration-config.service';
import type { BackupJobStatus } from '../integrations/veeam/dto/veeam-api.dto';
import type { BackupProvider } from './backup-provider';
import type { BackupJobStatusDto, JobResult } from './dto/backup-status.dto';
import type {
  CreateVeeamConfigDto,
  UpdateVeeamConfigDto,
  VeeamClientConfigResponseDto,
  TestConnectionResultDto,
} from './dto/veeam-config.dto';
import type {
  AvailableJetbackupJobDto,
  CreateJetbackupConfigsDto,
  JetbackupJobConfigResponseDto,
  UpdateJetbackupConfigDto,
} from './dto/jetbackup-config.dto';
import type { ClientBackupStatusDto, ClientStatus } from './dto/backup-status.dto';

export type BackupConfigResponseDto = VeeamClientConfigResponseDto | JetbackupJobConfigResponseDto;

// Todo lo configurado para un cliente: un servidor Veeam (opcional) y N jobs de JetBackup.
interface ClientSources {
  clientId: string;
  clientName: string;
  veeam: VeeamClientConfig | null;
  jetbackup: JetbackupJobConfig[];
}

@Injectable()
export class BackupsService {
  private readonly logger = new Logger(BackupsService.name);

  constructor(
    @InjectRepository(VeeamClientConfig) private readonly configRepo: Repository<VeeamClientConfig>,
    @InjectRepository(VeeamDailySnapshot) private readonly snapshotRepo: Repository<VeeamDailySnapshot>,
    @InjectRepository(JetbackupJobConfig) private readonly jetbackupRepo: Repository<JetbackupJobConfig>,
    private readonly veeamService: VeeamService,
    private readonly jetbackupService: JetbackupService,
    private readonly integrationConfigSvc: IntegrationConfigService,
  ) {}

  private toResponseDto(c: VeeamClientConfig): VeeamClientConfigResponseDto {
    return {
      provider: 'VEEAM',
      id: c.id,
      clientId: c.clientId,
      clientName: c.clientName,
      host: c.host,
      port: c.port,
      isEnabled: c.isEnabled,
      lastConnectedAt: c.lastConnectedAt?.toISOString() ?? null,
    };
  }

  private toJetbackupResponseDto(c: JetbackupJobConfig): JetbackupJobConfigResponseDto {
    return {
      provider: 'JETBACKUP',
      id: c.id,
      clientId: c.clientId,
      clientName: c.clientName,
      jobId: c.jobId,
      jobName: c.jobName,
      isEnabled: c.isEnabled,
    };
  }

  private deriveClientStatus(jobs: Pick<BackupJobStatus, 'lastResult'>[]): ClientStatus {
    if (!jobs.some(j => j.lastResult !== null)) return 'no_data';
    if (jobs.some(j => j.lastResult === 'Failed')) return 'crit';
    if (jobs.some(j => j.lastResult === 'Warning')) return 'warn';
    return 'ok';
  }

  private buildStatus(
    clientId: string, clientName: string, jobs: BackupJobStatusDto[],
    extra: { lastReadAt: string; hasRunningJob: boolean; isSnapshot?: boolean },
  ): ClientBackupStatusDto {
    return {
      clientId,
      clientName,
      status: this.deriveClientStatus(jobs),
      totalJobs: jobs.length,
      okCount: jobs.filter(j => j.lastResult === 'Success').length,
      warnCount: jobs.filter(j => j.lastResult === 'Warning').length,
      critCount: jobs.filter(j => j.lastResult === 'Failed').length,
      hasRunningJob: extra.hasRunningJob,
      lastReadAt: extra.lastReadAt,
      jobs,
      ...(extra.isSnapshot ? { isSnapshot: true } : {}),
    };
  }

  private groupSources(veeams: VeeamClientConfig[], jets: JetbackupJobConfig[]): ClientSources[] {
    const byClient = new Map<string, ClientSources>();
    const entry = (clientId: string, clientName: string): ClientSources => {
      let s = byClient.get(clientId);
      if (!s) {
        s = { clientId, clientName, veeam: null, jetbackup: [] };
        byClient.set(clientId, s);
      }
      return s;
    };
    for (const v of veeams) entry(v.clientId, v.clientName).veeam = v;
    for (const j of jets) entry(j.clientId, j.clientName).jetbackup.push(j);
    return [...byClient.values()];
  }

  private async loadAllSources(): Promise<ClientSources[]> {
    const [veeams, jets] = await Promise.all([this.configRepo.find(), this.jetbackupRepo.find()]);
    return this.groupSources(veeams, jets);
  }

  private hasEnabledSource(s: ClientSources): boolean {
    return Boolean(s.veeam?.isEnabled) || s.jetbackup.some(j => j.isEnabled);
  }

  private persistSnapshot(clientId: string, provider: BackupProvider, jobs: BackupJobStatus[]): void {
    this.saveSnapshot(clientId, provider, jobs).catch(err =>
      this.logger.warn(`No se pudo guardar el snapshot (${provider}, clientId=${clientId}): ${(err as Error).message}`),
    );
  }

  private async fetchVeeamJobs(config: VeeamClientConfig): Promise<BackupJobStatusDto[]> {
    const { username, password } = await this.integrationConfigSvc.getVeeamConfigDecrypted();
    const jobs = await this.veeamService.getJobStatuses(config.host, config.port, username, password);
    this.persistSnapshot(config.clientId, 'VEEAM', jobs);
    return jobs.map(j => ({ ...j, provider: 'VEEAM' as const }));
  }

  private async fetchJetbackupJobs(configs: JetbackupJobConfig[]): Promise<BackupJobStatusDto[]> {
    const conn = await this.integrationConfigSvc.getJetbackupConfigDecrypted();
    const jobs = await this.jetbackupService.getJobStatuses(
      conn, configs.map(c => ({ jobId: c.jobId, jobName: c.jobName })),
    );
    this.persistSnapshot(configs[0].clientId, 'JETBACKUP', jobs);
    return jobs.map(j => ({ ...j, provider: 'JETBACKUP' as const }));
  }

  // Si falla cualquier proveedor se propaga el error: el cliente figura como desconectado
  // en lugar de mostrar un estado "ok" parcial que oculte el ambiente caído.
  private async statusFor(s: ClientSources): Promise<ClientBackupStatusDto> {
    const tasks: Promise<BackupJobStatusDto[]>[] = [];
    if (s.veeam?.isEnabled) tasks.push(this.fetchVeeamJobs(s.veeam));
    const enabledJets = s.jetbackup.filter(j => j.isEnabled);
    if (enabledJets.length) tasks.push(this.fetchJetbackupJobs(enabledJets));
    const jobs = (await Promise.all(tasks)).flat();
    return this.buildStatus(s.clientId, s.clientName, jobs, {
      lastReadAt: new Date().toISOString(),
      hasRunningJob: jobs.some(j => j.isRunning),
    });
  }

  async getClientStatus(clientId: string): Promise<ClientBackupStatusDto> {
    const [veeam, jets] = await Promise.all([
      this.configRepo.findOne({ where: { clientId } }),
      this.jetbackupRepo.find({ where: { clientId } }),
    ]);
    if (!veeam && !jets.length) throw new NotFoundException('Config not found');
    const [sources] = this.groupSources(veeam ? [veeam] : [], jets);
    if (!this.hasEnabledSource(sources)) return this.disconnectedDto(sources.clientId, sources.clientName);
    return this.statusFor(sources);
  }

  private snapshotToDto(s: ClientSources, snaps: VeeamDailySnapshot[]): ClientBackupStatusDto {
    const now = Date.now();
    const jobs: BackupJobStatusDto[] = snaps.map(snap => {
      const hoursAgo = snap.lastRunAt
        ? Math.round(((now - snap.lastRunAt.getTime()) / 3600000) * 10) / 10
        : snap.hoursAgo;
      return {
        provider: snap.provider ?? 'VEEAM',
        jobId: snap.jobId,
        jobName: snap.jobName,
        jobType: snap.jobType,
        isRunning: false,
        lastResult: snap.result as JobResult | null,
        lastMessage: snap.message,
        lastRunAt: snap.lastRunAt?.toISOString() ?? null,
        hoursAgo,
        isStale: hoursAgo !== null && hoursAgo > 30,
      };
    });
    return this.buildStatus(s.clientId, s.clientName, jobs, {
      lastReadAt: snaps[0].snapshotDate, hasRunningJob: false, isSnapshot: true,
    });
  }

  async getLastSnapshot(): Promise<ClientBackupStatusDto[]> {
    const sources = await this.loadAllSources();
    if (!sources.length) return [];
    return Promise.all(
      sources.map(async s => {
        if (!this.hasEnabledSource(s)) return this.disconnectedDto(s.clientId, s.clientName);
        const latest = await this.snapshotRepo.findOne({
          where: { clientId: s.clientId },
          order: { snapshotDate: 'DESC' },
        });
        if (!latest) return this.disconnectedDto(s.clientId, s.clientName);
        const all = await this.snapshotRepo.find({
          where: { clientId: s.clientId, snapshotDate: latest.snapshotDate },
        });
        // Ignora snapshots de jobs/servidores que ya se quitaron o deshabilitaron de la config.
        const activeJetJobs = new Set(s.jetbackup.filter(j => j.isEnabled).map(j => j.jobId));
        const snaps = all.filter(snap =>
          (snap.provider ?? 'VEEAM') === 'VEEAM' ? Boolean(s.veeam?.isEnabled) : activeJetJobs.has(snap.jobId),
        );
        if (!snaps.length) return this.disconnectedDto(s.clientId, s.clientName);
        return this.snapshotToDto(s, snaps);
      }),
    );
  }

  private disconnectedDto(clientId: string, clientName: string): ClientBackupStatusDto {
    return {
      clientId,
      clientName,
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
    const sources = await this.loadAllSources();
    return Promise.all(
      sources.map(async s => {
        if (!this.hasEnabledSource(s)) return this.disconnectedDto(s.clientId, s.clientName);
        try {
          return await this.statusFor(s);
        } catch {
          return this.disconnectedDto(s.clientId, s.clientName);
        }
      }),
    );
  }

  async saveSnapshot(clientId: string, provider: BackupProvider, jobs: BackupJobStatus[]): Promise<void> {
    if (!jobs.length) return;
    const date = new Date().toISOString().split('T')[0];
    const rows = jobs.map(j => ({
      clientId,
      provider,
      jobId: j.jobId,
      jobName: j.jobName,
      jobType: j.jobType,
      result: j.lastResult,
      message: j.lastMessage,
      lastRunAt: j.lastRunAt ? new Date(j.lastRunAt) : null,
      hoursAgo: j.hoursAgo,
      snapshotDate: date,
    }));
    await this.snapshotRepo.upsert(rows, ['clientId', 'provider', 'jobId', 'snapshotDate']);
  }

  async listConfigs(): Promise<BackupConfigResponseDto[]> {
    const [veeams, jets] = await Promise.all([this.configRepo.find(), this.jetbackupRepo.find()]);
    return [
      ...veeams.map(c => this.toResponseDto(c)),
      ...jets.map(c => this.toJetbackupResponseDto(c)),
    ];
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

  // ── JetBackup ──

  async listJetbackupJobs(): Promise<AvailableJetbackupJobDto[]> {
    const conn = await this.integrationConfigSvc.getJetbackupConfigDecrypted();
    if (!conn.url || !conn.apiKey) {
      throw new BadRequestException('JetBackup no está configurado. Completá la URL y el token en Admin → Integraciones.');
    }
    let jobs;
    try {
      jobs = await this.jetbackupService.listJobs(conn);
    } catch (err) {
      throw new BadGatewayException((err as Error).message);
    }
    const configured = new Map((await this.jetbackupRepo.find()).map(c => [c.jobId, c]));
    return jobs.map(j => ({
      jobId: j.jobId,
      name: j.name,
      disabled: j.disabled,
      configured: configured.has(j.jobId),
      configuredClientName: configured.get(j.jobId)?.clientName ?? null,
    }));
  }

  async createJetbackupConfigs(dto: CreateJetbackupConfigsDto): Promise<JetbackupJobConfigResponseDto[]> {
    const taken = await this.jetbackupRepo.find({ where: { jobId: In(dto.jobs.map(j => j.jobId)) } });
    if (taken.length) {
      throw new ConflictException(`Ya configurado: ${taken.map(t => `${t.jobName} (${t.clientName})`).join(', ')}`);
    }
    const entities = dto.jobs.map(j =>
      this.jetbackupRepo.create({
        clientId: dto.clientId,
        clientName: dto.clientName,
        jobId: j.jobId,
        jobName: j.jobName,
        isEnabled: dto.isEnabled,
      }),
    );
    const saved = await this.jetbackupRepo.save(entities);
    return saved.map(c => this.toJetbackupResponseDto(c));
  }

  async updateJetbackupConfig(id: string, dto: UpdateJetbackupConfigDto): Promise<JetbackupJobConfigResponseDto> {
    const config = await this.jetbackupRepo.findOne({ where: { id } });
    if (!config) throw new NotFoundException();
    if (dto.isEnabled !== undefined) config.isEnabled = dto.isEnabled;
    config.updatedAt = new Date();
    return this.toJetbackupResponseDto(await this.jetbackupRepo.save(config));
  }

  async deleteJetbackupConfig(id: string): Promise<void> {
    await this.jetbackupRepo.delete(id);
  }
}
