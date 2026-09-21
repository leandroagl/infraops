import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ExpirationItem, ExpirationTypeConfigEntry } from '../models/notification.models';

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

  patchConfig(expirationsTypeConfigs: Record<string, ExpirationTypeConfigEntry>): Observable<unknown> {
    return this.http.patch(`${this.base}/config`, { expirationsTypeConfigs });
  }
}
