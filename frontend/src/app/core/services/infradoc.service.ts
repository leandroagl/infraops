import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ClientInfrastructure } from '../models/infradoc.models';

@Injectable({ providedIn: 'root' })
export class InfradocService {
  constructor(private http: HttpClient) {}

  getClientInfrastructure(clientId: string): Observable<ClientInfrastructure> {
    return this.http.get<ClientInfrastructure>(
      `${environment.apiUrl}/infradoc/clients/${clientId}/infrastructure`,
    );
  }
}
