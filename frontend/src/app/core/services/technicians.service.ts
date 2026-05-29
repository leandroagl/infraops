import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Technician, AssignTechnicianPayload } from '../models/technician.models';

@Injectable({ providedIn: 'root' })
export class TechniciansService {
  private readonly base = `${environment.apiUrl}/technicians`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Technician[]> {
    return this.http
      .get<{ ok: boolean; data: Technician[] }>(this.base)
      .pipe(map(r => r.data));
  }

  assign(payload: AssignTechnicianPayload): Observable<Technician> {
    return this.http
      .post<{ ok: boolean; data: Technician }>(this.base, payload)
      .pipe(map(r => r.data));
  }

  remove(id: string): Observable<void> {
    return this.http
      .delete<void>(`${this.base}/${id}`);
  }
}
