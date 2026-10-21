import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface OdooConfigDto {
  url: string; db: string; username: string; apiKey: string;
  helpdeskTeamId: number;
  expirationsHelpdeskTeamId: number;
  expirationsTicketDaysAhead: number;
  expirationsTagIds: number[];
  expirationsTypeConfigs: Record<string, {
    enabled: boolean;
    helpdeskTeamId: number | null;
    daysAhead: number;
    tagIds: number[];
  }> | null;
  stageInProgressName: string; stageNotDoneName: string; stageDoneName: string;
  updatedAt: Date | null; updatedBy: string | null;
}
export interface InfraDocConfigDto {
  url: string; apiKey: string; updatedAt: Date | null; updatedBy: string | null;
}
export interface VmwareConfigDto {
  username: string; password: string; updatedAt: Date | null; updatedBy: string | null;
}
export interface VeeamIntegrationConfigDto {
  username: string; password: string; updatedAt: Date | null; updatedBy: string | null;
}
export interface JetbackupIntegrationConfigDto {
  url: string; username: string; apiKey: string; updatedAt: Date | null; updatedBy: string | null;
}
export interface AcronisIntegrationConfigDto {
  baseUrl: string; clientId: string; clientSecret: string; updatedAt: Date | null; updatedBy: string | null;
}
export interface UnifiIntegrationConfigDto {
  apiKey: string; updatedAt: Date | null; updatedBy: string | null;
}
export interface TestConnectionResult { ok: boolean; message: string; }
export interface HelpdeskTeamDto { id: number; name: string; }
export interface HelpdeskTagDto { id: number; name: string; }
export interface HelpdeskSlaDto { id: number; name: string; time_hours: number; }

@Injectable({ providedIn: 'root' })
export class IntegrationConfigService {
  private readonly base = `${environment.apiUrl}/integration-config`;
  private readonly odooBase = `${environment.apiUrl}/admin/odoo`;
  constructor(private readonly http: HttpClient) {}

  getOdoo(): Observable<OdooConfigDto>                              { return this.http.get<OdooConfigDto>(`${this.base}/odoo`); }
  patchOdoo(dto: Partial<OdooConfigDto>): Observable<OdooConfigDto> { return this.http.patch<OdooConfigDto>(`${this.base}/odoo`, dto); }
  testOdoo(): Observable<TestConnectionResult>                       { return this.http.post<TestConnectionResult>(`${this.base}/odoo/test`, {}); }
  getHelpdeskTeams(): Observable<HelpdeskTeamDto[]>                  { return this.http.get<HelpdeskTeamDto[]>(`${this.odooBase}/helpdesk-teams`); }
  getHelpdeskTags(): Observable<HelpdeskTagDto[]>                    { return this.http.get<HelpdeskTagDto[]>(`${this.odooBase}/helpdesk-tags`); }
  getHelpdeskSlas(teamId: number): Observable<HelpdeskSlaDto[]>      { return this.http.get<HelpdeskSlaDto[]>(`${this.odooBase}/helpdesk-slas`, { params: { teamId } }); }

  getInfraDoc(): Observable<InfraDocConfigDto>                              { return this.http.get<InfraDocConfigDto>(`${this.base}/infradoc`); }
  patchInfraDoc(dto: Partial<InfraDocConfigDto>): Observable<InfraDocConfigDto> { return this.http.patch<InfraDocConfigDto>(`${this.base}/infradoc`, dto); }
  testInfraDoc(): Observable<TestConnectionResult>                              { return this.http.post<TestConnectionResult>(`${this.base}/infradoc/test`, {}); }

  getVmware(): Observable<VmwareConfigDto>                              { return this.http.get<VmwareConfigDto>(`${this.base}/vmware`); }
  patchVmware(dto: Partial<VmwareConfigDto>): Observable<VmwareConfigDto> { return this.http.patch<VmwareConfigDto>(`${this.base}/vmware`, dto); }
  testVmware(): Observable<TestConnectionResult>                          { return this.http.post<TestConnectionResult>(`${this.base}/vmware/test`, {}); }

  getVeeam(): Observable<VeeamIntegrationConfigDto>                                    { return this.http.get<VeeamIntegrationConfigDto>(`${this.base}/veeam`); }
  patchVeeam(dto: Partial<VeeamIntegrationConfigDto>): Observable<VeeamIntegrationConfigDto> { return this.http.patch<VeeamIntegrationConfigDto>(`${this.base}/veeam`, dto); }
  testVeeam(): Observable<TestConnectionResult>                                          { return this.http.post<TestConnectionResult>(`${this.base}/veeam/test`, {}); }

  getJetbackup(): Observable<JetbackupIntegrationConfigDto>                                          { return this.http.get<JetbackupIntegrationConfigDto>(`${this.base}/jetbackup`); }
  patchJetbackup(dto: Partial<JetbackupIntegrationConfigDto>): Observable<JetbackupIntegrationConfigDto> { return this.http.patch<JetbackupIntegrationConfigDto>(`${this.base}/jetbackup`, dto); }
  testJetbackup(): Observable<TestConnectionResult>                                                  { return this.http.post<TestConnectionResult>(`${this.base}/jetbackup/test`, {}); }

  getAcronis(): Observable<AcronisIntegrationConfigDto>                                        { return this.http.get<AcronisIntegrationConfigDto>(`${this.base}/acronis`); }
  patchAcronis(dto: Partial<AcronisIntegrationConfigDto>): Observable<AcronisIntegrationConfigDto> { return this.http.patch<AcronisIntegrationConfigDto>(`${this.base}/acronis`, dto); }
  testAcronis(): Observable<TestConnectionResult>                                              { return this.http.post<TestConnectionResult>(`${this.base}/acronis/test`, {}); }

  getUnifi(): Observable<UnifiIntegrationConfigDto>                                          { return this.http.get<UnifiIntegrationConfigDto>(`${this.base}/unifi`); }
  patchUnifi(dto: Partial<UnifiIntegrationConfigDto>): Observable<UnifiIntegrationConfigDto> { return this.http.patch<UnifiIntegrationConfigDto>(`${this.base}/unifi`, dto); }
  testUnifi(): Observable<TestConnectionResult>                                               { return this.http.post<TestConnectionResult>(`${this.base}/unifi/test`, {}); }
}
