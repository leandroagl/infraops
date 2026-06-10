import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OdooRpcService {
  private uid: number | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async authenticate(): Promise<number> {
    const url = this.configService.getOrThrow<string>('ODOO_URL');
    const db = this.configService.getOrThrow<string>('ODOO_DB');
    const username = this.configService.getOrThrow<string>('ODOO_USERNAME');
    const apiKey = this.configService.getOrThrow<string>('ODOO_API_KEY');

    const response = await firstValueFrom(
      this.httpService.post(`${url}/web/dataset/call_kw`, {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'res.users',
          method: 'authenticate',
          args: [db, username, apiKey, {}],
          kwargs: {},
        },
      }),
    );

    if (response.data.error || !response.data.result) {
      throw new ServiceUnavailableException(
        `Odoo authentication failed: ${response.data.error?.message ?? 'uid no recibido'}`,
      );
    }

    this.uid = response.data.result as number;
    return this.uid;
  }

  async callKw<T>(
    model: string,
    method: string,
    args: unknown[],
    kwargs: Record<string, unknown>,
  ): Promise<T> {
    if (!this.uid) {
      this.uid = await this.authenticate();
    }

    const url = this.configService.getOrThrow<string>('ODOO_URL');
    const db = this.configService.getOrThrow<string>('ODOO_DB');
    const apiKey = this.configService.getOrThrow<string>('ODOO_API_KEY');

    const response = await firstValueFrom(
      this.httpService.post(`${url}/web/dataset/call_kw`, {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model,
          method,
          args,
          kwargs: { ...kwargs, uid: this.uid, password: apiKey, db },
        },
      }),
    );

    if (response.data.error) {
      throw new ServiceUnavailableException(
        `Odoo RPC error en ${model}.${method}: ${response.data.error.message ?? 'desconocido'}`,
      );
    }

    return response.data.result as T;
  }
}
