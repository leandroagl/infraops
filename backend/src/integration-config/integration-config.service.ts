import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { OdooConfig } from './entities/odoo-config.entity';
import { InfraDocConfig } from './entities/infradoc-config.entity';
import { VmwareConfig } from './entities/vmware-config.entity';
import { PatchOdooConfigDto, OdooConfigResponseDto } from './dto/odoo-config.dto';
import { PatchInfraDocConfigDto, InfraDocConfigResponseDto } from './dto/infradoc-config.dto';
import { PatchVmwareConfigDto, VmwareConfigResponseDto } from './dto/vmware-config.dto';
import { encrypt, decrypt, isMasked, MASK } from './crypto.util';
import { buildOdooClient, rpcCall } from '../integrations/odoo/odoo-rpc.helpers';

@Injectable()
export class IntegrationConfigService {
  private odooVersion = 0;

  constructor(
    @InjectRepository(OdooConfig)     private readonly odooRepo:     Repository<OdooConfig>,
    @InjectRepository(InfraDocConfig) private readonly infradocRepo: Repository<InfraDocConfig>,
    @InjectRepository(VmwareConfig)   private readonly vmwareRepo:   Repository<VmwareConfig>,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  private get encryptKey(): string {
    return this.configService.get<string>('INTEGRATIONS_ENCRYPT_KEY', '');
  }

  private safeEncrypt(plaintext: string): string {
    try {
      return encrypt(plaintext, this.encryptKey);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }

  // ── Version tracking (permite a OdooSystemRpcService invalidar uid cache) ──
  getOdooVersion(): number { return this.odooVersion; }
  incrementOdooVersion(): void { this.odooVersion++; }

  // ── ODOO ──

  async getOdoo(): Promise<OdooConfigResponseDto> {
    const row = await this.odooRepo.findOne({ where: { id: 1 } });
    if (!row) {
      return {
        url: this.configService.get('ODOO_URL', ''),
        db: this.configService.get('ODOO_DB', ''),
        username: this.configService.get('ODOO_USERNAME', ''),
        apiKey: MASK,
        helpdeskTeamId: parseInt(this.configService.get('ODOO_HELPDESK_TEAM_ID', '0'), 10),
        expirationsHelpdeskTeamId: parseInt(this.configService.get('ODOO_EXPIRATIONS_HELPDESK_TEAM_ID', '0'), 10),
        expirationsTicketDaysAhead: 30,
        expirationsTagIds: [],
        expirationsTypeConfigs: null,
        stageInProgressName: '',
        stageNotDoneName: '',
        stageDoneName: '',
        updatedAt: null,
        updatedBy: null,
      };
    }
    return {
      url: row.url ?? '', db: row.db ?? '', username: row.username ?? '',
      apiKey: MASK, helpdeskTeamId: row.helpdeskTeamId ?? 0,
      expirationsHelpdeskTeamId: row.expirationsHelpdeskTeamId ?? 0,
      expirationsTicketDaysAhead: row.expirationsTicketDaysAhead ?? 30,
      expirationsTagIds: row.expirationsTagIds ?? [],
      expirationsTypeConfigs: row.expirationsTypeConfigs ?? null,
      stageInProgressName: row.stageInProgressName ?? '',
      stageNotDoneName: row.stageNotDoneName ?? '',
      stageDoneName: row.stageDoneName ?? '',
      updatedAt: row.updatedAt, updatedBy: row.updatedBy,
    };
  }

  async patchOdoo(dto: PatchOdooConfigDto, updatedBy: string): Promise<OdooConfigResponseDto> {
    const existing = (await this.odooRepo.findOne({ where: { id: 1 } })) ?? new OdooConfig();
    existing.id = 1;
    if (dto.url !== undefined)            existing.url            = dto.url.trim();
    if (dto.db !== undefined)             existing.db             = dto.db.trim();
    if (dto.username !== undefined)       existing.username       = dto.username.trim();
    if (dto.helpdeskTeamId !== undefined)     existing.helpdeskTeamId     = dto.helpdeskTeamId;
    if (dto.expirationsHelpdeskTeamId !== undefined) existing.expirationsHelpdeskTeamId = dto.expirationsHelpdeskTeamId;
    if (dto.expirationsTicketDaysAhead !== undefined) existing.expirationsTicketDaysAhead = dto.expirationsTicketDaysAhead;
    if (dto.expirationsTagIds !== undefined) existing.expirationsTagIds = dto.expirationsTagIds;
    if (dto.expirationsTypeConfigs !== undefined) {
      this.validateExpirationTypeConfigs(dto.expirationsTypeConfigs);
      existing.expirationsTypeConfigs = dto.expirationsTypeConfigs as Record<string, {
        enabled: boolean; helpdeskTeamId: number | null; daysAhead: number; tagIds: number[];
      }>;
    }
    if (dto.stageInProgressName !== undefined) existing.stageInProgressName = dto.stageInProgressName;
    if (dto.stageNotDoneName !== undefined)    existing.stageNotDoneName    = dto.stageNotDoneName;
    if (dto.stageDoneName !== undefined)       existing.stageDoneName       = dto.stageDoneName;
    if (dto.apiKey !== undefined && !isMasked(dto.apiKey) && dto.apiKey.trim() !== '') {
      existing.apiKey = this.safeEncrypt(dto.apiKey.trim());
    }
    if (!existing.apiKey) {
      const envKey = this.configService.get<string>('ODOO_API_KEY', '');
      if (envKey) existing.apiKey = this.safeEncrypt(envKey);
    }
    existing.updatedBy = updatedBy;
    await this.odooRepo.save(existing);
    this.incrementOdooVersion();
    return this.getOdoo();
  }

  // class-validator no valida cada valor de un Record<string, T> de forma nativa
  // (ver comentario en el DTO) — se valida la forma acá antes de persistir.
  private validateExpirationTypeConfigs(
    configs: Record<string, { enabled: boolean; helpdeskTeamId: number | null; daysAhead: number; tagIds: number[] }>,
  ): void {
    for (const [key, entry] of Object.entries(configs)) {
      if (typeof entry.enabled !== 'boolean') {
        throw new BadRequestException(`expirationsTypeConfigs.${key}.enabled debe ser un valor booleano`);
      }
      if (!Number.isInteger(entry.daysAhead) || entry.daysAhead < 1) {
        throw new BadRequestException(`expirationsTypeConfigs.${key}.daysAhead debe ser un entero mayor o igual a 1`);
      }
      if (entry.helpdeskTeamId !== null && (!Number.isInteger(entry.helpdeskTeamId) || entry.helpdeskTeamId < 1)) {
        throw new BadRequestException(`expirationsTypeConfigs.${key}.helpdeskTeamId debe ser null o un entero mayor o igual a 1`);
      }
      if (!Array.isArray(entry.tagIds) || !entry.tagIds.every((t) => Number.isInteger(t))) {
        throw new BadRequestException(`expirationsTypeConfigs.${key}.tagIds debe ser un array de enteros`);
      }
    }
  }

  async getOdooConfigDecrypted(): Promise<{
    url: string; db: string; username: string; apiKey: string; helpdeskTeamId: number;
    expirationsHelpdeskTeamId: number; expirationsTicketDaysAhead: number; expirationsTagIds: number[];
    expirationsTypeConfigs: Record<string, { enabled: boolean; helpdeskTeamId: number | null; daysAhead: number; tagIds: number[]; }> | null;
    stageInProgressName: string; stageNotDoneName: string; stageDoneName: string;
  }> {
    const row = await this.odooRepo.findOne({ where: { id: 1 } });
    if (!row) {
      return {
        url:            this.configService.get('ODOO_URL', ''),
        db:             this.configService.get('ODOO_DB', ''),
        username:       this.configService.get('ODOO_USERNAME', ''),
        apiKey:         this.configService.get('ODOO_API_KEY', ''),
        helpdeskTeamId: parseInt(this.configService.get('ODOO_HELPDESK_TEAM_ID', '0'), 10),
        expirationsHelpdeskTeamId: parseInt(this.configService.get('ODOO_EXPIRATIONS_HELPDESK_TEAM_ID', '0'), 10),
        expirationsTicketDaysAhead: 30,
        expirationsTagIds: [],
        expirationsTypeConfigs: null,
        stageInProgressName: 'En curso',
        stageNotDoneName:    'No realizadas',
        stageDoneName:       'Hecho',
      };
    }
    return {
      url:            row.url      ?? '',
      db:             row.db       ?? '',
      username:       row.username ?? '',
      apiKey:         row.apiKey   ? decrypt(row.apiKey, this.encryptKey) : '',
      helpdeskTeamId: row.helpdeskTeamId ?? 0,
      expirationsHelpdeskTeamId: row.expirationsHelpdeskTeamId ?? 0,
      expirationsTicketDaysAhead: row.expirationsTicketDaysAhead ?? 30,
      expirationsTagIds: row.expirationsTagIds ?? [],
      expirationsTypeConfigs: row.expirationsTypeConfigs ?? null,
      stageInProgressName: row.stageInProgressName || 'En curso',
      stageNotDoneName:    row.stageNotDoneName    || 'No realizadas',
      stageDoneName:       row.stageDoneName        || 'Hecho',
    };
  }

  async testOdoo(): Promise<{ ok: boolean; message: string }> {
    try {
      const cfg = await this.getOdooConfigDecrypted();
      const client = buildOdooClient(cfg.url, '/xmlrpc/2/common');
      const uid = await rpcCall<number>(client, 'authenticate', [cfg.db, cfg.username, cfg.apiKey, {}]);
      if (!uid) return { ok: false, message: 'Autenticación fallida: credenciales incorrectas' };
      return { ok: true, message: 'Conexión exitosa' };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }

  // ── INFRADOC ──

  async getInfraDoc(): Promise<InfraDocConfigResponseDto> {
    const row = await this.infradocRepo.findOne({ where: { id: 1 } });
    if (!row) return { url: this.configService.get('INFRADOC_URL', ''), apiKey: MASK, updatedAt: null, updatedBy: null };
    return { url: row.url ?? '', apiKey: MASK, updatedAt: row.updatedAt, updatedBy: row.updatedBy };
  }

  async patchInfraDoc(dto: PatchInfraDocConfigDto, updatedBy: string): Promise<InfraDocConfigResponseDto> {
    const existing = (await this.infradocRepo.findOne({ where: { id: 1 } })) ?? new InfraDocConfig();
    existing.id = 1;
    if (dto.url !== undefined) existing.url = dto.url.trim();
    if (dto.apiKey !== undefined && !isMasked(dto.apiKey) && dto.apiKey.trim() !== '') {
      existing.apiKey = this.safeEncrypt(dto.apiKey.trim());
    }
    if (!existing.apiKey) {
      const envKey = this.configService.get<string>('INFRADOC_API_KEY', '');
      if (envKey) existing.apiKey = this.safeEncrypt(envKey);
    }
    existing.updatedBy = updatedBy;
    await this.infradocRepo.save(existing);
    return this.getInfraDoc();
  }

  async getInfraDocConfigDecrypted(): Promise<{ url: string; apiKey: string }> {
    const row = await this.infradocRepo.findOne({ where: { id: 1 } });
    if (!row) return { url: this.configService.get('INFRADOC_URL', ''), apiKey: this.configService.get('INFRADOC_API_KEY', '') };
    return { url: row.url ?? '', apiKey: row.apiKey ? decrypt(row.apiKey, this.encryptKey) : '' };
  }

  async testInfraDoc(): Promise<{ ok: boolean; message: string }> {
    try {
      const cfg = await this.getInfraDocConfigDecrypted();
      await firstValueFrom(
        this.httpService.get(`${cfg.url}/api/v1/assets/read.php`, { params: { api_key: cfg.apiKey, client_id: 0, limit: 1 } }),
      );
      return { ok: true, message: 'Conexión exitosa' };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }

  // ── VMWARE ──

  async getVmware(): Promise<VmwareConfigResponseDto> {
    const row = await this.vmwareRepo.findOne({ where: { id: 1 } });
    if (!row) return { username: this.configService.get('VMWARE_USER', ''), password: MASK, updatedAt: null, updatedBy: null };
    return { username: row.username ?? '', password: MASK, updatedAt: row.updatedAt, updatedBy: row.updatedBy };
  }

  async patchVmware(dto: PatchVmwareConfigDto, updatedBy: string): Promise<VmwareConfigResponseDto> {
    const existing = (await this.vmwareRepo.findOne({ where: { id: 1 } })) ?? new VmwareConfig();
    existing.id = 1;
    if (dto.username !== undefined) existing.username = dto.username.trim();
    if (dto.password !== undefined && !isMasked(dto.password) && dto.password.trim() !== '') {
      existing.password = this.safeEncrypt(dto.password.trim());
    }
    if (!existing.password) {
      const envPass = this.configService.get<string>('VMWARE_PASS', '');
      if (envPass) existing.password = this.safeEncrypt(envPass);
    }
    existing.updatedBy = updatedBy;
    await this.vmwareRepo.save(existing);
    return this.getVmware();
  }

  async getVmwareConfigDecrypted(): Promise<{ username: string; password: string }> {
    const row = await this.vmwareRepo.findOne({ where: { id: 1 } });
    if (!row) return { username: this.configService.get('VMWARE_USER', ''), password: this.configService.get('VMWARE_PASS', '') };
    return { username: row.username ?? '', password: row.password ? decrypt(row.password, this.encryptKey) : '' };
  }

  async testVmware(): Promise<{ ok: boolean; message: string }> {
    return { ok: true, message: 'Credenciales guardadas. Se verificarán en el próximo health check de ESXi.' };
  }
}
