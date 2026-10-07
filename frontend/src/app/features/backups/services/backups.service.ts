import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  ClientBackup,
  VeeamClientConfig,
  CreateVeeamConfigRequest,
  UpdateVeeamConfigRequest,
  TestConnectionResult,
} from '../models/backup.models';

@Injectable({ providedIn: 'root' })
export class BackupsService {
  private readonly base = '/api/backups';

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<ClientBackup[]> {
    return this.http.get<ClientBackup[]>(this.base);
  }

  getOne(clientId: string): Observable<ClientBackup> {
    return this.http.get<ClientBackup>(`${this.base}/${clientId}`);
  }

  listConfigs(): Observable<VeeamClientConfig[]> {
    return this.http.get<VeeamClientConfig[]>(`${this.base}/configs`);
  }

  createConfig(dto: CreateVeeamConfigRequest): Observable<VeeamClientConfig> {
    return this.http.post<VeeamClientConfig>(`${this.base}/configs`, dto);
  }

  updateConfig(id: string, dto: UpdateVeeamConfigRequest): Observable<VeeamClientConfig> {
    return this.http.patch<VeeamClientConfig>(`${this.base}/configs/${id}`, dto);
  }

  deleteConfig(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/configs/${id}`);
  }

  testConnection(id: string): Observable<TestConnectionResult> {
    return this.http.post<TestConnectionResult>(`${this.base}/configs/${id}/test`, {});
  }
}
