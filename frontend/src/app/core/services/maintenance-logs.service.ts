import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ServerMaintenancePayload, TerminalPayload } from '../models/maintenance-log.models';

export type LogResult = 'ok' | 'warn' | 'error';

export interface LogItem {
  item: string;
  result: LogResult;
  notes?: string;
}

export interface CreateLogPayload {
  payload: ServerMaintenancePayload | TerminalPayload;
  notes?: string;
}

export interface MaintenanceLog {
  id: string;
  taskId: string;
  technicianId: string;
  payload: ServerMaintenancePayload | TerminalPayload;
  notes?: string;
  registeredAt: string;
}

@Injectable({ providedIn: 'root' })
export class MaintenanceLogsService {
  constructor(private http: HttpClient) {}

  private url(taskId: string): string {
    return `${environment.apiUrl}/tasks/${taskId}/log`;
  }

  create(taskId: string, body: CreateLogPayload): Observable<MaintenanceLog> {
    return this.http.post<MaintenanceLog>(this.url(taskId), body);
  }

  get(taskId: string): Observable<MaintenanceLog> {
    return this.http.get<MaintenanceLog>(this.url(taskId));
  }
}
