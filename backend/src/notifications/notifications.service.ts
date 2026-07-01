import * as https from 'https';
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ExpirationItemDto, ExpirationType } from './dto/expiration-item.dto';

interface RawClient     { client_id: string; client_name: string; }
interface RawAsset      { asset_id: string; asset_name: string; asset_warranty_expire: string | null; asset_client_id: string; }
interface RawCert       { certificate_id: string; certificate_name: string; certificate_expire: string | null; certificate_client_id: string; }
interface RawDomain     { domain_id: string; domain_name: string; domain_expire: string | null; domain_client_id: string; }
interface RawSoftware   { software_id: string; software_name: string; software_expire: string | null; software_client_id: string; }

interface InfradocResponse<T> { success: string; data: T[]; }

@Injectable()
export class NotificationsService {
  constructor(private readonly httpService: HttpService) {}

  async getExpirations(days?: number): Promise<ExpirationItemDto[]> {
    const baseUrl = process.env.INFRADOC_URL;
    const apiKey  = process.env.INFRADOC_API_KEY;
    if (!baseUrl || !apiKey) {
      throw new Error('INFRADOC_URL and INFRADOC_API_KEY deben estar configurados');
    }

    const agent = new https.Agent({ rejectUnauthorized: false });
    const get = <T>(module: string) =>
      firstValueFrom(
        this.httpService.get<InfradocResponse<T>>(
          `${baseUrl}/api/v1/${module}/read.php`,
          { httpsAgent: agent, params: { api_key: apiKey, limit: 9999 } },
        ),
      );

    const [clientsRes, assetsRes, certsRes, domainsRes, softwareRes] = await Promise.all([
      get<RawClient>('clients'),
      get<RawAsset>('assets'),
      get<RawCert>('certificates'),
      get<RawDomain>('domains'),
      get<RawSoftware>('software'),
    ]);

    const clientMap = new Map<string, string>();
    for (const c of (clientsRes.data.data ?? [])) {
      clientMap.set(String(c.client_id), c.client_name);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const items: ExpirationItemDto[] = [];

    for (const r of this.safe(assetsRes.data)) {
      if (!r.asset_warranty_expire || !r.asset_client_id) continue;
      items.push(this.toItem('asset_warranty', r.asset_client_id, r.asset_name, r.asset_warranty_expire, clientMap, today));
    }
    for (const r of this.safe(certsRes.data)) {
      if (!r.certificate_expire || !r.certificate_client_id) continue;
      items.push(this.toItem('certificate', r.certificate_client_id, r.certificate_name, r.certificate_expire, clientMap, today));
    }
    for (const r of this.safe(domainsRes.data)) {
      if (!r.domain_expire || !r.domain_client_id) continue;
      items.push(this.toItem('domain', r.domain_client_id, r.domain_name, r.domain_expire, clientMap, today));
    }
    for (const r of this.safe(softwareRes.data)) {
      if (!r.software_expire || !r.software_client_id) continue;
      items.push(this.toItem('software', r.software_client_id, r.software_name, r.software_expire, clientMap, today));
    }

    return this.filterAndSort(items, days);
  }

  private safe<T>(res: InfradocResponse<T>): T[] {
    return res.success === 'True' && Array.isArray(res.data) ? res.data : [];
  }

  private toItem(
    type: ExpirationType,
    rawClientId: string,
    name: string,
    expireDate: string,
    clientMap: Map<string, string>,
    today: Date,
  ): ExpirationItemDto {
    const clientId = Number(rawClientId);
    const expire = new Date(expireDate);
    expire.setHours(0, 0, 0, 0);
    const daysUntil = Math.round((expire.getTime() - today.getTime()) / 86_400_000);
    return {
      type,
      clientId,
      clientName: clientMap.get(String(clientId)) ?? `Cliente ${clientId}`,
      itemName: name,
      expireDate,
      daysUntil,
    };
  }

  private filterAndSort(items: ExpirationItemDto[], days?: number): ExpirationItemDto[] {
    const filtered = days !== undefined
      ? items.filter(i => i.daysUntil < 0 || i.daysUntil <= days)
      : items;
    return filtered.sort((a, b) => a.expireDate.localeCompare(b.expireDate));
  }
}
