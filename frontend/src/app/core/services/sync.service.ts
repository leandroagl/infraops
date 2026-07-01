import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ClientSyncResult {
  created: number;
  updated: number;
  archived: number;
  unchanged: number;
  syncedAt: string;
}

export interface OdooSyncResult {
  matched: number;
  unmatched: string[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  syncClients(): Observable<ClientSyncResult> {
    return this.http.post<ClientSyncResult>(`${this.base}/clients/sync`, {});
  }

  syncOdooPartners(): Observable<OdooSyncResult> {
    return this.http.post<OdooSyncResult>(`${this.base}/admin/odoo/sync/partners`, {});
  }
}
