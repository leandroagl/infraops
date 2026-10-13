import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ExpirationDetail, ExpirationItem, ExpirationTypeConfigEntry,
  UrgentBacklogPreview, UrgentBacklogResult,
} from '../models/notification.models';

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly base = `${environment.apiUrl}/notifications`;

  constructor(private http: HttpClient) {}

  getExpirations(days?: number): Observable<ExpirationItem[]> {
    const params = days !== undefined
      ? new HttpParams().set('days', String(days))
      : new HttpParams();
    return this.http.get<ExpirationItem[]>(`${this.base}/expirations`, { params });
  }

  getExpirationByTaskId(taskId: string): Observable<ExpirationDetail | null> {
    return this.http.get<ExpirationDetail | null>(`${this.base}/expiration-tickets/by-task/${taskId}`);
  }

  patchTypeConfig(type: string, entry: ExpirationTypeConfigEntry): Observable<unknown> {
    return this.http.patch(`${this.base}/config/${type}`, entry);
  }

  getUrgentBacklogPreview(minDays: number, maxDays: number): Observable<UrgentBacklogPreview> {
    const params = new HttpParams().set('minDays', String(minDays)).set('maxDays', String(maxDays));
    return this.http.get<UrgentBacklogPreview>(`${this.base}/config/urgent-preview`, { params });
  }

  createUrgentBacklogTickets(minDays: number, maxDays: number): Observable<UrgentBacklogResult> {
    const params = new HttpParams().set('minDays', String(minDays)).set('maxDays', String(maxDays));
    return this.http.post<UrgentBacklogResult>(`${this.base}/config/urgent-tickets`, null, { params });
  }
}
