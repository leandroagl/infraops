import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Technician, AssignTechnicianPayload } from '../models/technician.models';

@Injectable({ providedIn: 'root' })
export class TechniciansService {
  private readonly base = `${environment.apiUrl}/technicians`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Technician[]> {
    return this.http.get<Technician[]>(this.base);
  }

  assign(payload: AssignTechnicianPayload): Observable<Technician> {
    return this.http.post<Technician>(this.base, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
