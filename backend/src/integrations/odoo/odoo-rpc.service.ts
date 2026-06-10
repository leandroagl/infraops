import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as xmlrpc from 'xmlrpc';

@Injectable()
export class OdooRpcService {
  private uid: number | null = null;

  constructor(private readonly configService: ConfigService) {}

  private buildClient(path: string): xmlrpc.Client {
    const baseUrl = this.configService.getOrThrow<string>('ODOO_URL');
    const parsed = new URL(baseUrl);
    const opts: Parameters<typeof xmlrpc.createClient>[0] = {
      host: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port, 10) : undefined,
      path,
    };
    return parsed.protocol === 'https:'
      ? xmlrpc.createSecureClient(opts)
      : xmlrpc.createClient(opts);
  }

  private call<T>(client: xmlrpc.Client, method: string, params: unknown[]): Promise<T> {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client.methodCall(method, params as any[], (err: any, value: unknown) => {
        if (err) reject(err);
        else resolve(value as T);
      });
    });
  }

  async authenticate(): Promise<number> {
    const db = this.configService.getOrThrow<string>('ODOO_DB');
    const username = this.configService.getOrThrow<string>('ODOO_USERNAME');
    const apiKey = this.configService.getOrThrow<string>('ODOO_API_KEY');

    const client = this.buildClient('/xmlrpc/2/common');
    let uid: number;

    try {
      uid = await this.call<number>(client, 'authenticate', [db, username, apiKey, {}]);
    } catch (err) {
      throw new ServiceUnavailableException(
        `Odoo authentication failed: ${(err as Error).message}`,
      );
    }

    if (!uid) {
      throw new ServiceUnavailableException('Odoo authentication failed: uid no recibido');
    }

    this.uid = uid;
    return this.uid;
  }

  async callKw<T>(
    model: string,
    method: string,
    args: unknown[],
    kwargs: Record<string, unknown>,
  ): Promise<T> {
    if (this.uid === null) {
      this.uid = await this.authenticate();
    }

    const db = this.configService.getOrThrow<string>('ODOO_DB');
    const apiKey = this.configService.getOrThrow<string>('ODOO_API_KEY');

    const client = this.buildClient('/xmlrpc/2/object');
    try {
      return await this.call<T>(client, 'execute_kw', [
        db, this.uid, apiKey, model, method, args, kwargs,
      ]);
    } catch (err) {
      throw new ServiceUnavailableException(
        `Odoo RPC error en ${model}.${method}: ${(err as Error).message}`,
      );
    }
  }
}
