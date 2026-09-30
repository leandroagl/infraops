import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MaintenanceDeviationsService } from './maintenance-deviations.service';
import { MaintenanceDeviationDto } from '../models/maintenance-deviation.models';
import { environment } from '../../../environments/environment';

describe('MaintenanceDeviationsService', () => {
  let service: MaintenanceDeviationsService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/maintenance-deviations`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [MaintenanceDeviationsService],
    });
    service = TestBed.inject(MaintenanceDeviationsService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('getByTaskId hace GET a /maintenance-deviations/by-task/:taskId', () => {
    const mock: MaintenanceDeviationDto[] = [];
    service.getByTaskId('task-1').subscribe(r => expect(r).toEqual(mock));
    http.expectOne(`${base}/by-task/task-1`).flush(mock);
  });

  it('updateStatus hace PATCH a /maintenance-deviations/:id/status', () => {
    service.updateStatus('dev-1', 'CONFIRMED').subscribe();
    const req = http.expectOne(`${base}/dev-1/status`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'CONFIRMED' });
    req.flush({});
  });
});
