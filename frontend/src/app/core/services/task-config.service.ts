import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  OdooHelpdeskTagDto,
  TaskType,
  TaskTypeConfigDto,
  UpdateTaskConfigPayload,
} from '../models/task.models';

@Injectable({ providedIn: 'root' })
export class TaskConfigService {
  private readonly base = `${environment.apiUrl}/task-config`;
  private readonly odooBase = `${environment.apiUrl}/admin/odoo`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<TaskTypeConfigDto[]> {
    return this.http.get<TaskTypeConfigDto[]>(this.base);
  }

  update(taskType: TaskType, payload: UpdateTaskConfigPayload): Observable<TaskTypeConfigDto> {
    return this.http.patch<TaskTypeConfigDto>(`${this.base}/${taskType}`, payload);
  }

  getHelpdeskTags(): Observable<OdooHelpdeskTagDto[]> {
    return this.http.get<OdooHelpdeskTagDto[]>(`${this.odooBase}/helpdesk-tags`);
  }
}
