import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { NotificationsService } from './notifications.service';
import { environment } from '../../../environments/environment';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/notifications`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [NotificationsService] });
    service = TestBed.inject(NotificationsService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('getExpirations hace GET a /notifications/expirations con days', () => {
    service.getExpirations(30).subscribe();
    const req = http.expectOne(`${base}/expirations?days=30`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getExpirations hace GET a /notifications/expirations sin days cuando no se provee', () => {
    service.getExpirations().subscribe();
    const req = http.expectOne(`${base}/expirations`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getExpirationByTaskId hace GET a /notifications/expiration-tickets/by-task/:taskId', () => {
    service.getExpirationByTaskId('task-1').subscribe();
    const req = http.expectOne(`${base}/expiration-tickets/by-task/task-1`);
    expect(req.request.method).toBe('GET');
    req.flush(null);
  });

  it('patchConfig hace PATCH a /notifications/config con expirationsTypeConfigs', () => {
    const configs = { domain: { enabled: true, helpdeskTeamId: 9, daysAhead: 30, tagIds: [] } };
    service.patchConfig(configs).subscribe();
    const req = http.expectOne(`${base}/config`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ expirationsTypeConfigs: configs });
    req.flush({});
  });
});
