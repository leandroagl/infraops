import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface OdooConfigDto {
  url: string; db: string; username: string; apiKey: string;
  helpdeskTeamId: number;
  stageInProgressName: string; stageNotDoneName: string; stageDoneName: string;
  updatedAt: Date | null; updatedBy: string | null;
}
export interface InfraDocConfigDto {
  url: string; apiKey: string; updatedAt: Date | null; updatedBy: string | null;
}
export interface VmwareConfigDto {
  username: string; password: string; updatedAt: Date | null; updatedBy: string | null;
}
export interface TestConnectionResult { ok: boolean; message: string; }

@Injectable({ providedIn: 'root' })
export class IntegrationConfigService {
  private readonly base = `${environment.apiUrl}/integration-config`;
  constructor(private readonly http: HttpClient) {}

  getOdoo(): Observable<OdooConfigDto>                              { return this.http.get<OdooConfigDto>(`${this.base}/odoo`); }
  patchOdoo(dto: Partial<OdooConfigDto>): Observable<OdooConfigDto> { return this.http.patch<OdooConfigDto>(`${this.base}/odoo`, dto); }
  testOdoo(): Observable<TestConnectionResult>                       { return this.http.post<TestConnectionResult>(`${this.base}/odoo/test`, {}); }

  getInfraDoc(): Observable<InfraDocConfigDto>                              { return this.http.get<InfraDocConfigDto>(`${this.base}/infradoc`); }
  patchInfraDoc(dto: Partial<InfraDocConfigDto>): Observable<InfraDocConfigDto> { return this.http.patch<InfraDocConfigDto>(`${this.base}/infradoc`, dto); }
  testInfraDoc(): Observable<TestConnectionResult>                              { return this.http.post<TestConnectionResult>(`${this.base}/infradoc/test`, {}); }

  getVmware(): Observable<VmwareConfigDto>                              { return this.http.get<VmwareConfigDto>(`${this.base}/vmware`); }
  patchVmware(dto: Partial<VmwareConfigDto>): Observable<VmwareConfigDto> { return this.http.patch<VmwareConfigDto>(`${this.base}/vmware`, dto); }
  testVmware(): Observable<TestConnectionResult>                          { return this.http.post<TestConnectionResult>(`${this.base}/vmware/test`, {}); }
}
