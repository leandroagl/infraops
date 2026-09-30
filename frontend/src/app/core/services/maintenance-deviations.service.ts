import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MaintenanceDeviationDto, MaintenanceDeviationStatus } from '../models/maintenance-deviation.models';

@Injectable({ providedIn: 'root' })
export class MaintenanceDeviationsService {
  private readonly base = `${environment.apiUrl}/maintenance-deviations`;

  constructor(private http: HttpClient) {}

  getByTaskId(taskId: string): Observable<MaintenanceDeviationDto[]> {
    return this.http.get<MaintenanceDeviationDto[]>(`${this.base}/by-task/${taskId}`);
  }

  updateStatus(id: string, status: MaintenanceDeviationStatus): Observable<MaintenanceDeviationDto> {
    return this.http.patch<MaintenanceDeviationDto>(`${this.base}/${id}/status`, { status });
  }
}
