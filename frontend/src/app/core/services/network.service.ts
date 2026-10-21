import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { NetworkAlert, UnifiSiteConfig, UnifiAutoConfig, CreateUnifiSiteRequest, UpdateUnifiSiteRequest } from '../models/network.models';

@Injectable({ providedIn: 'root' })
export class NetworkService {
  private readonly base = `${environment.apiUrl}/unifi`;

  constructor(private readonly http: HttpClient) {}

  getAlerts(): Observable<NetworkAlert[]> { return this.http.get<NetworkAlert[]>(`${this.base}/alerts`); }
  createTicket(alertId: string, body: { helpdeskTeamId: number; tagIds: number[]; clientId: string; siteId: string }): Observable<{ odooTicketId: number }> {
    return this.http.post<{ odooTicketId: number }>(`${this.base}/alerts/${alertId}/ticket`, body);
  }

  getSites(): Observable<UnifiSiteConfig[]>                                                  { return this.http.get<UnifiSiteConfig[]>(`${this.base}/sites`); }
  createSite(dto: CreateUnifiSiteRequest): Observable<UnifiSiteConfig>                      { return this.http.post<UnifiSiteConfig>(`${this.base}/sites`, dto); }
  updateSite(id: string, dto: UpdateUnifiSiteRequest): Observable<UnifiSiteConfig>          { return this.http.patch<UnifiSiteConfig>(`${this.base}/sites/${id}`, dto); }
  deleteSite(id: string): Observable<void>                                                   { return this.http.delete<void>(`${this.base}/sites/${id}`); }

  getAutoConfig(): Observable<UnifiAutoConfig>                                               { return this.http.get<UnifiAutoConfig>(`${this.base}/auto-config`); }
  patchAutoConfig(dto: Partial<UnifiAutoConfig>): Observable<UnifiAutoConfig>               { return this.http.patch<UnifiAutoConfig>(`${this.base}/auto-config`, dto); }
}
