import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  ClientBackup,
  BackupConfig,
  VeeamClientConfig,
  JetbackupJobConfig,
  AvailableJetbackupJob,
  AcronisPlanConfig,
  AvailableAcronisPlans,
  CreateAcronisConfigsRequest,
  UpdateAcronisConfigRequest,
  CreateVeeamConfigRequest,
  UpdateVeeamConfigRequest,
  CreateJetbackupConfigsRequest,
  UpdateJetbackupConfigRequest,
  TestConnectionResult,
} from '../models/backup.models';

@Injectable({ providedIn: 'root' })
export class BackupsService {
  private readonly base = '/api/backups';

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<ClientBackup[]> {
    return this.http.get<ClientBackup[]>(this.base);
  }

  getSnapshot(): Observable<ClientBackup[]> {
    return this.http.get<ClientBackup[]>(`${this.base}/snapshot`);
  }

  getOne(clientId: string): Observable<ClientBackup> {
    return this.http.get<ClientBackup>(`${this.base}/${clientId}`);
  }

  listConfigs(): Observable<BackupConfig[]> {
    return this.http.get<BackupConfig[]>(`${this.base}/configs`);
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

  listJetbackupJobs(): Observable<AvailableJetbackupJob[]> {
    return this.http.get<AvailableJetbackupJob[]>(`${this.base}/jetbackup/jobs`);
  }

  createJetbackupConfigs(dto: CreateJetbackupConfigsRequest): Observable<JetbackupJobConfig[]> {
    return this.http.post<JetbackupJobConfig[]>(`${this.base}/configs/jetbackup`, dto);
  }

  updateJetbackupConfig(id: string, dto: UpdateJetbackupConfigRequest): Observable<JetbackupJobConfig> {
    return this.http.patch<JetbackupJobConfig>(`${this.base}/configs/jetbackup/${id}`, dto);
  }

  deleteJetbackupConfig(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/configs/jetbackup/${id}`);
  }

  listAcronisPlans(): Observable<AvailableAcronisPlans> {
    return this.http.get<AvailableAcronisPlans>(`${this.base}/acronis/plans`);
  }

  createAcronisConfigs(dto: CreateAcronisConfigsRequest): Observable<AcronisPlanConfig[]> {
    return this.http.post<AcronisPlanConfig[]>(`${this.base}/configs/acronis`, dto);
  }

  updateAcronisConfig(id: string, dto: UpdateAcronisConfigRequest): Observable<AcronisPlanConfig> {
    return this.http.patch<AcronisPlanConfig>(`${this.base}/configs/acronis/${id}`, dto);
  }

  deleteAcronisConfig(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/configs/acronis/${id}`);
  }
}
