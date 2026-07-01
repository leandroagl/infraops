import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { VmwareHealthResult } from '../../../core/models/maintenance-log.models';

@Injectable({ providedIn: 'root' })
export class VmwareApiService {
  constructor(private readonly http: HttpClient) {}

  healthCheck(hostUri: string): Observable<VmwareHealthResult> {
    return this.http.post<VmwareHealthResult>(
      `${environment.apiUrl}/integrations/vmware/health-check`,
      { hostUri },
    );
  }
}
