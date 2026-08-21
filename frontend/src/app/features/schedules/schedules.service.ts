import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TaskType } from '../../core/models/task.models';

export type ScheduleGroup = 'BIMONTHLY_ODD' | 'BIMONTHLY_EVEN' | null;
export type RotationFrequency = 'EVERY_GENERATION' | 'EVERY_TWO_GENERATIONS';

export interface ClientSchedule {
  id: string;
  clientId: string;
  client: { id: string; name: string };
  scheduleGroup: ScheduleGroup;
  technicianId: string | null;
  technician: { id: string; user: { name: string } } | null;
  isActive: boolean;
}

export interface RotationConfig {
  id: string;
  isActive: boolean;
  frequency: RotationFrequency;
  generationsSinceLastRotation: number;
}

export interface MonthlyPreviewClient {
  clientId: string;
  clientName: string;
  technicianId: string | null;
  technicianName: string | null;
}

export interface TaskStats {
  total: number;
  done: number;
  notDone: number;
  clientsWithTasks: number;
}

export interface MonthlyPreview {
  year: number;
  month: number;
  group: 'BIMONTHLY_ODD' | 'BIMONTHLY_EVEN';
  clients: MonthlyPreviewClient[];
  clientsWithoutTechnician: number;
  wasGenerated: boolean;
  taskStats: TaskStats | null;
  taskTypesWithoutTags: TaskType[];
}

export interface GenerationResult {
  tasksCreated: number;
  tasksSkipped: number;
  errors: Array<{ clientId: string; taskType: string; error: string }>;
}

export interface RotationPreview {
  technicians: Array<{
    technicianId: string;
    name: string;
    clientCount: number;
    clients: string[];
  }>;
}

@Injectable({ providedIn: 'root' })
export class SchedulesService {
  private readonly base = `${environment.apiUrl}/schedules`;

  constructor(private http: HttpClient) {}

  findAll(): Observable<ClientSchedule[]> {
    return this.http.get<ClientSchedule[]>(this.base);
  }

  upsert(
    clientId: string,
    body: { scheduleGroup: ScheduleGroup; technicianId: string | null },
  ): Observable<ClientSchedule> {
    return this.http.put<ClientSchedule>(`${this.base}/${clientId}`, body);
  }

  getMonthlyPreview(year: number, month: number): Observable<MonthlyPreview> {
    return this.http.get<MonthlyPreview>(`${this.base}/preview`, { params: { year, month } });
  }

  generateMonth(year: number, month: number): Observable<GenerationResult> {
    return this.http.post<GenerationResult>(`${this.base}/generate`, { year, month });
  }

  getRotationConfig(): Observable<RotationConfig> {
    return this.http.get<RotationConfig>(`${this.base}/rotation`);
  }

  saveRotationConfig(body: { isActive: boolean; frequency: RotationFrequency }): Observable<RotationConfig> {
    return this.http.put<RotationConfig>(`${this.base}/rotation`, body);
  }

  previewRotation(): Observable<RotationPreview> {
    return this.http.get<RotationPreview>(`${this.base}/rotation/preview`);
  }

  getTechnicians(): Observable<Array<{ id: string; user: { name: string } }>> {
    return this.http.get<Array<{ id: string; user: { name: string } }>>(`${environment.apiUrl}/technicians`);
  }

  getClients(): Observable<Array<{ id: string; name: string; isActive: boolean }>> {
    return this.http.get<Array<{ id: string; name: string; isActive: boolean }>>(`${environment.apiUrl}/clients`);
  }
}
