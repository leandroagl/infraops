import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { buildOdooClient, rpcCall } from './odoo-rpc.helpers';
import { IntegrationConfigService } from '../../integration-config/integration-config.service';

@Injectable()
export class OdooSystemRpcService {
  private readonly logger = new Logger(OdooSystemRpcService.name);
  private uid: number | null = null;
  private lastSeenVersion = -1;

  constructor(private readonly integrationConfigService: IntegrationConfigService) {}

  invalidateCache(): void { this.uid = null; }

  async authenticate(): Promise<number> {
    const cfg = await this.integrationConfigService.getOdooConfigDecrypted();
    const client = buildOdooClient(cfg.url, '/xmlrpc/2/common');
    let uid: number;
    try {
      uid = await rpcCall<number>(client, 'authenticate', [cfg.db, cfg.username, cfg.apiKey, {}]);
    } catch (err) {
      this.logger.error(`Odoo auth failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException(`Odoo auth failed: ${(err as Error).message}`);
    }
    if (!uid) {
      this.logger.error('Odoo auth: uid no recibido');
      throw new ServiceUnavailableException('Odoo auth: uid no recibido');
    }
    this.uid = uid;
    this.lastSeenVersion = this.integrationConfigService.getOdooVersion();
    return uid;
  }

  async callKw<T>(model: string, method: string, args: unknown[], kwargs: Record<string, unknown>): Promise<T> {
    const currentVersion = this.integrationConfigService.getOdooVersion();
    if (this.uid === null || currentVersion !== this.lastSeenVersion) {
      this.uid = await this.authenticate();
    }
    const cfg = await this.integrationConfigService.getOdooConfigDecrypted();
    const client = buildOdooClient(cfg.url, '/xmlrpc/2/object');
    try {
      return await rpcCall<T>(client, 'execute_kw', [cfg.db, this.uid, cfg.apiKey, model, method, args, kwargs]);
    } catch (err) {
      this.logger.error(`Odoo RPC ${model}.${method}: ${(err as Error).message}`);
      throw new ServiceUnavailableException(`Odoo RPC ${model}.${method}: ${(err as Error).message}`);
    }
  }
}
