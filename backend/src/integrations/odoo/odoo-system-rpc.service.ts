import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildOdooClient, rpcCall } from './odoo-rpc.helpers';

@Injectable()
export class OdooSystemRpcService {
  private readonly logger = new Logger(OdooSystemRpcService.name);
  private uid: number | null = null;

  constructor(private readonly configService: ConfigService) {}

  async authenticate(): Promise<number> {
    const db       = this.configService.getOrThrow<string>('ODOO_DB');
    const username = this.configService.getOrThrow<string>('ODOO_USERNAME');
    const apiKey   = this.configService.getOrThrow<string>('ODOO_API_KEY');
    const client   = buildOdooClient(this.configService, '/xmlrpc/2/common');
    let uid: number;
    try {
      uid = await rpcCall<number>(client, 'authenticate', [db, username, apiKey, {}]);
    } catch (err) {
      this.logger.error(`Odoo auth failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException(`Odoo auth failed: ${(err as Error).message}`);
    }
    if (!uid) {
      this.logger.error('Odoo auth: uid no recibido (credenciales incorrectas?)');
      throw new ServiceUnavailableException('Odoo auth: uid no recibido');
    }
    this.uid = uid;
    return uid;
  }

  async callKw<T>(model: string, method: string, args: unknown[], kwargs: Record<string, unknown>): Promise<T> {
    if (this.uid === null) this.uid = await this.authenticate();
    const db     = this.configService.getOrThrow<string>('ODOO_DB');
    const apiKey = this.configService.getOrThrow<string>('ODOO_API_KEY');
    const client = buildOdooClient(this.configService, '/xmlrpc/2/object');
    try {
      return await rpcCall<T>(client, 'execute_kw', [db, this.uid, apiKey, model, method, args, kwargs]);
    } catch (err) {
      this.logger.error(`Odoo RPC ${model}.${method}: ${(err as Error).message}`);
      throw new ServiceUnavailableException(`Odoo RPC ${model}.${method}: ${(err as Error).message}`);
    }
  }
}
