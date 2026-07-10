import * as xmlrpc from 'xmlrpc';
import { ConfigService } from '@nestjs/config';

export function buildOdooClient(configService: ConfigService, path: string): xmlrpc.Client {
  const baseUrl = configService.getOrThrow<string>('ODOO_URL');
  const parsed  = new URL(baseUrl);
  const opts    = {
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : undefined,
    path,
  };
  return parsed.protocol === 'https:'
    ? xmlrpc.createSecureClient(opts)
    : xmlrpc.createClient(opts);
}

export function rpcCall<T>(client: xmlrpc.Client, method: string, params: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    client.methodCall(method, params as any[], (err: any, value: unknown) => {
      if (err) reject(err);
      else resolve(value as T);
    });
  });
}
