import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface MeResponse {
  id: string;
  name: string;
  email: string;
  role: string;
  technicianId: string | null;
  odooKeyValid: boolean;
  odooKeyValidatedAt: string | null;
  odooApiEmail: string | null;
  odooExempt: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  constructor(private http: HttpClient) {}

  getMe(): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${environment.apiUrl}/users/me`);
  }

  updateOdooCredentials(odooApiEmail: string, odooApiKey: string): Observable<void> {
    return this.http.put<void>(`${environment.apiUrl}/users/me/odoo-credentials`, {
      odooApiEmail,
      odooApiKey,
    });
  }
}
