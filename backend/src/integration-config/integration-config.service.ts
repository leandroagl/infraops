import { Injectable } from '@nestjs/common';
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
        updatedAt: null,
        updatedBy: null,
      };
    }
    return { url: row.url ?? '', db: row.db ?? '', username: row.username ?? '',
      apiKey: MASK, helpdeskTeamId: row.helpdeskTeamId ?? 0,
      updatedAt: row.updatedAt, updatedBy: row.updatedBy };
  }

  async patchOdoo(dto: PatchOdooConfigDto, updatedBy: string): Promise<OdooConfigResponseDto> {
    const existing = (await this.odooRepo.findOne({ where: { id: 1 } })) ?? new OdooConfig();
    existing.id = 1;
    if (dto.url !== undefined)            existing.url            = dto.url;
    if (dto.db !== undefined)             existing.db             = dto.db;
    if (dto.username !== undefined)       existing.username       = dto.username;
    if (dto.helpdeskTeamId !== undefined) existing.helpdeskTeamId = dto.helpdeskTeamId;
    if (dto.apiKey !== undefined && !isMasked(dto.apiKey) && dto.apiKey !== '') {
      existing.apiKey = encrypt(dto.apiKey, this.encryptKey);
    }
    existing.updatedBy = updatedBy;
    await this.odooRepo.save(existing);
    this.incrementOdooVersion();
    return this.getOdoo();
  }

  async getOdooConfigDecrypted(): Promise<{ url: string; db: string; username: string; apiKey: string; helpdeskTeamId: number }> {
    const row = await this.odooRepo.findOne({ where: { id: 1 } });
    if (!row) {
      return {
        url:            this.configService.get('ODOO_URL', ''),
        db:             this.configService.get('ODOO_DB', ''),
        username:       this.configService.get('ODOO_USERNAME', ''),
        apiKey:         this.configService.get('ODOO_API_KEY', ''),
        helpdeskTeamId: parseInt(this.configService.get('ODOO_HELPDESK_TEAM_ID', '0'), 10),
      };
    }
    return {
      url:            row.url      ?? '',
      db:             row.db       ?? '',
      username:       row.username ?? '',
      apiKey:         row.apiKey   ? decrypt(row.apiKey, this.encryptKey) : '',
      helpdeskTeamId: row.helpdeskTeamId ?? 0,
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
    if (dto.url !== undefined) existing.url = dto.url;
    if (dto.apiKey !== undefined && !isMasked(dto.apiKey) && dto.apiKey !== '') {
      existing.apiKey = encrypt(dto.apiKey, this.encryptKey);
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
    if (dto.username !== undefined) existing.username = dto.username;
    if (dto.password !== undefined && !isMasked(dto.password) && dto.password !== '') {
      existing.password = encrypt(dto.password, this.encryptKey);
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
