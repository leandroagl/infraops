import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { UnifiInternetIssue } from './unifi-wan-issues';
import type { UnifiApiDevice, UnifiApiDeviceGroup, UnifiApiDevicesResponse, UnifiApiHost, UnifiApiListResponse, UnifiApiSite } from './dto/unifi-api.dto';

@Injectable()
export class UnifiService {
  private readonly BASE = 'https://api.ui.com';

  constructor(private readonly httpService: HttpService) {}

  private headers(apiKey: string) {
    return { 'X-API-KEY': apiKey, Accept: 'application/json' };
  }

  private buildSiteName(s: UnifiApiSite, hostNames: Map<string, string>): string {
    const desc = s.meta.desc;
    if (desc !== 'Default') return desc;
    const hostName = hostNames.get(s.hostId);
    if (hostName) return hostName;
    const ip = s.statistics?.wans?.WAN?.externalIp;
    const isp = s.statistics?.ispInfo?.name;
    if (ip) return isp ? `Default — ${ip} (${isp})` : `Default — ${ip}`;
    return desc;
  }

  async getAvailableSites(apiKey: string): Promise<{ siteId: string; siteName: string }[]> {
    const [sitesRes, hostsRes] = await Promise.all([
      firstValueFrom(this.httpService.get<UnifiApiListResponse<UnifiApiSite>>(
        `${this.BASE}/ea/sites`, { headers: this.headers(apiKey), timeout: 15000 },
      )),
      firstValueFrom(this.httpService.get<UnifiApiListResponse<UnifiApiHost>>(
        `${this.BASE}/ea/hosts`, { headers: this.headers(apiKey), timeout: 15000 },
      )).catch(() => null),
    ]);
    const hostNames = new Map<string, string>();
    for (const h of hostsRes?.data?.data ?? []) {
      const name = h.reportedState?.name ?? h.reportedState?.hardware?.name;
      if (h.id && name) hostNames.set(h.id, name);
    }
    return (sitesRes.data.data ?? []).map(s => ({
      siteId: s.siteId,
      siteName: this.buildSiteName(s, hostNames),
    }));
  }

  async getSiteHostMap(apiKey: string): Promise<Map<string, string>> {
    const res = await firstValueFrom(
      this.httpService.get<UnifiApiListResponse<UnifiApiSite>>(
        `${this.BASE}/ea/sites`, { headers: this.headers(apiKey), timeout: 15000 },
      ),
    );
    const map = new Map<string, string>();
    for (const site of res.data.data ?? []) {
      map.set(site.siteId, site.hostId);
    }
    return map;
  }

  // Solo incluye sites con internetIssues no vacío (la estructura de statistics puede variar por versión)
  async getSiteInternetIssues(apiKey: string): Promise<Map<string, UnifiInternetIssue[]>> {
    const res = await firstValueFrom(
      this.httpService.get<UnifiApiListResponse<UnifiApiSite>>(
        `${this.BASE}/ea/sites`, { headers: this.headers(apiKey), timeout: 15000 },
      ),
    );
    const map = new Map<string, UnifiInternetIssue[]>();
    for (const site of res.data.data ?? []) {
      const issues = site.statistics?.internetIssues;
      if (Array.isArray(issues) && issues.length > 0) map.set(site.siteId, issues);
    }
    return map;
  }

  async getAllDevices(apiKey: string): Promise<Map<string, { devices: UnifiApiDevice[]; updatedAt: string }>> {
    const res = await firstValueFrom(
      this.httpService.get<UnifiApiDevicesResponse>(
        `${this.BASE}/ea/devices`, { headers: this.headers(apiKey), timeout: 15000 },
      ),
    );
    const map = new Map<string, { devices: UnifiApiDevice[]; updatedAt: string }>();
    for (const group of res.data.data ?? []) {
      map.set(group.hostId, { devices: group.devices, updatedAt: group.updatedAt });
    }
    return map;
  }

  async getRawPath(apiKey: string, path: string, params?: Record<string, string>): Promise<unknown> {
    try {
      const res = await firstValueFrom(
        this.httpService.get(`${this.BASE}${path}`, {
          headers: this.headers(apiKey),
          params,
          timeout: 15000,
        }),
      );
      return res.data;
    } catch (err: unknown) {
      const e = err as { response?: { status: number; data: unknown } };
      return { error: true, status: e.response?.status, data: e.response?.data };
    }
  }
}
