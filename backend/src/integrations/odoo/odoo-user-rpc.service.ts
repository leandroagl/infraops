import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildOdooClient, rpcCall } from './odoo-rpc.helpers';

export interface OdooUserCredentials {
  email: string;
  apiKey: string;
}

@Injectable()
export class OdooUserRpcService {
  constructor(private readonly configService: ConfigService) {}

  private async authenticate(creds: OdooUserCredentials): Promise<number> {
    const db     = this.configService.getOrThrow<string>('ODOO_DB');
    const client = buildOdooClient(this.configService, '/xmlrpc/2/common');
    let uid: number;
    try {
      uid = await rpcCall<number>(client, 'authenticate', [db, creds.email, creds.apiKey, {}]);
    } catch (err) {
      throw new ServiceUnavailableException(`Odoo no disponible: ${(err as Error).message}`);
    }
    if (!uid) throw new BadRequestException('Credenciales Odoo inválidas');
    return uid;
  }

  async validateCredentials(email: string, apiKey: string): Promise<void> {
    await this.authenticate({ email, apiKey });
  }

  async callKw<T>(
    creds: OdooUserCredentials,
    model: string,
    method: string,
    args: unknown[],
    kwargs: Record<string, unknown>,
  ): Promise<T> {
    const uid    = await this.authenticate(creds);
    const db     = this.configService.getOrThrow<string>('ODOO_DB');
    const client = buildOdooClient(this.configService, '/xmlrpc/2/object');
    try {
      return await rpcCall<T>(client, 'execute_kw', [db, uid, creds.apiKey, model, method, args, kwargs]);
    } catch (err) {
      throw new ServiceUnavailableException(`Odoo RPC ${model}.${method}: ${(err as Error).message}`);
    }
  }
}
