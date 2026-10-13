import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AvailableDeviationSignal,
  CreateDeviationRulePayload,
  DeviationRuleDto,
  UpdateDeviationRulePayload,
} from '../models/deviation-rule.models';

@Injectable({ providedIn: 'root' })
export class DeviationRulesService {
  private readonly base = `${environment.apiUrl}/deviation-rules`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<DeviationRuleDto[]> {
    return this.http.get<DeviationRuleDto[]>(this.base);
  }

  getAvailableSignals(): Observable<AvailableDeviationSignal[]> {
    return this.http.get<AvailableDeviationSignal[]>(`${this.base}/signals`);
  }

  create(payload: CreateDeviationRulePayload): Observable<DeviationRuleDto> {
    return this.http.post<DeviationRuleDto>(this.base, payload);
  }

  update(id: string, payload: UpdateDeviationRulePayload): Observable<DeviationRuleDto> {
    return this.http.patch<DeviationRuleDto>(`${this.base}/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
