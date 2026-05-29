import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Task, UpdateTaskStatusPayload } from '../models/task.models';

export interface TaskFilters {
  status?: string;
  clientId?: string;
  technicianId?: string;
}

export interface CreateTaskPayload {
  clientId: string;
  technicianId: string;
  type: string;
  scheduledDate: string;
}

@Injectable({ providedIn: 'root' })
export class TasksService {
  private readonly base = `${environment.apiUrl}/tasks`;

  constructor(private http: HttpClient) {}

  getAll(filters: TaskFilters = {}): Observable<Task[]> {
    let params = new HttpParams();
    if (filters.status)      params = params.set('status',      filters.status);
    if (filters.clientId)    params = params.set('clientId',    filters.clientId);
    if (filters.technicianId) params = params.set('technicianId', filters.technicianId);
    return this.http.get<Task[]>(this.base, { params });
  }

  create(payload: CreateTaskPayload): Observable<Task> {
    return this.http.post<Task>(this.base, payload);
  }

  updateStatus(id: string, payload: UpdateTaskStatusPayload): Observable<Task> {
    return this.http.patch<Task>(`${this.base}/${id}/status`, payload);
  }
}
