import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Client, ClientSubscriptionHours } from '../models/client.models';

@Injectable({ providedIn: 'root' })
export class ClientsService {
  private readonly base = `${environment.apiUrl}/clients`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Client[]> {
    return this.http.get<Client[]>(this.base);
  }

  getById(id: string): Observable<Client> {
    return this.http.get<Client>(`${this.base}/${id}`);
  }

  getSubscriptionHours(month?: number, year?: number): Observable<ClientSubscriptionHours[]> {
    let params = new HttpParams();
    if (month !== undefined) params = params.set('month', month);
    if (year  !== undefined) params = params.set('year',  year);
    return this.http.get<ClientSubscriptionHours[]>(`${this.base}/subscription-hours`, { params });
  }
}
