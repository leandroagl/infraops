import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { UnifiApiAlert, UnifiApiListResponse, UnifiAlert } from './dto/unifi-api.dto';

const VALID_SEVERITIES = new Set(['critical', 'high', 'medium', 'low']);

@Injectable()
export class UnifiService {
  private readonly BASE = 'https://api.ui.com';

  constructor(private readonly httpService: HttpService) {}

  private headers(apiKey: string) {
    return { 'X-API-KEY': apiKey, Accept: 'application/json' };
  }

  private normalizeSeverity(s: string): 'critical' | 'high' | 'medium' | 'low' {
    return VALID_SEVERITIES.has(s) ? (s as 'critical' | 'high' | 'medium' | 'low') : 'low';
  }

  async getSiteAlerts(siteId: string, apiKey: string): Promise<UnifiAlert[]> {
    const res = await firstValueFrom(
      this.httpService.get<UnifiApiListResponse<UnifiApiAlert>>(
        `${this.BASE}/ea/alerts`,
        { headers: this.headers(apiKey), params: { siteId }, timeout: 15000 },
      ),
    );
    return (res.data.data ?? [])
      .filter(a => a.closedAt === null)
      .map(a => ({
        alertId: a.id,
        siteId: a.siteId,
        type: a.type,
        severity: this.normalizeSeverity(a.severity),
        message: a.payload?.message ?? a.type,
        createdAt: a.createdAt,
      }));
  }
}
