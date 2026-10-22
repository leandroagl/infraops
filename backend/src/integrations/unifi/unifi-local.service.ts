import * as https from 'https';
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type {
  UnifiLocalDevice,
  UnifiLegacyDevicesResponse,
  UnifiLocalSite,
  UnifiLocalSitesResponse,
} from './dto/unifi-api.dto';

const SITES_PATH = '/proxy/network/integration/v1/sites';
const DEVICES_PATH = (shortName: string) => `/proxy/network/api/s/${shortName}/stat/device`;

@Injectable()
export class UnifiLocalService {
  private readonly httpsAgent = new https.Agent({ rejectUnauthorized: false });

  constructor(private readonly httpService: HttpService) {}

  private baseOptions(apiKey: string) {
    return {
      headers: { 'X-API-KEY': apiKey, Accept: 'application/json' },
      httpsAgent: this.httpsAgent,
      timeout: 15000,
    };
  }

  async getRawPath(url: string, apiKey: string, path: string): Promise<unknown> {
    try {
      const res = await firstValueFrom(
        this.httpService.get(`${url}${path}`, this.baseOptions(apiKey)),
      );
      return res.data;
    } catch (err: unknown) {
      const e = err as { response?: { status: number; data: unknown } };
      return { error: true, status: e.response?.status, data: e.response?.data };
    }
  }

  async getLocalSites(url: string, apiKey: string): Promise<UnifiLocalSite[]> {
    const res = await firstValueFrom(
      this.httpService.get<UnifiLocalSitesResponse>(`${url}${SITES_PATH}`, {
        ...this.baseOptions(apiKey),
        params: { limit: '200' },
      }),
    );
    return res.data.data ?? [];
  }

  // Retorna el internalReference (shortName) del site — se usa en el path de devices
  async findLocalSiteByName(url: string, apiKey: string, siteName: string): Promise<string | null> {
    const sites = await this.getLocalSites(url, apiKey);
    const normalized = siteName.toLowerCase();
    const match = sites.find(s => s.name.toLowerCase() === normalized);
    return match?.internalReference ?? null;
  }

  // shortName = internalReference del site (ej: "l3p2idk1")
  async getSiteDevices(url: string, apiKey: string, shortName: string): Promise<UnifiLocalDevice[]> {
    const res = await firstValueFrom(
      this.httpService.get<UnifiLegacyDevicesResponse>(
        `${url}${DEVICES_PATH(shortName)}`,
        this.baseOptions(apiKey),
      ),
    );
    return (res.data.data ?? []).filter(d => d.state === 0);
  }
}
