import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MaintenanceDeviationDto, MaintenanceDeviationStatus } from '../models/maintenance-deviation.models';

@Injectable({ providedIn: 'root' })
export class MaintenanceDeviationsService {
  private readonly base = `${environment.apiUrl}/maintenance-deviations`;

  constructor(private http: HttpClient) {}

  getByTaskId(taskId: string): Observable<MaintenanceDeviationDto[]> {
    return this.http.get<MaintenanceDeviationDto[]>(`${this.base}/by-task/${taskId}`);
  }

  getByTaskIds(taskIds: string[]): Observable<MaintenanceDeviationDto[]> {
    if (taskIds.length === 0) return of([]);
    return this.http.get<MaintenanceDeviationDto[]>(this.base, { params: { taskIds: taskIds.join(',') } });
  }

  updateStatus(id: string, status: MaintenanceDeviationStatus): Observable<MaintenanceDeviationDto> {
    return this.http.patch<MaintenanceDeviationDto>(`${this.base}/${id}/status`, { status });
  }
}
