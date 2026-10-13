import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { BackupsService } from './backups.service';

describe('BackupsService (JetBackup)', () => {
  let svc: BackupsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    svc = TestBed.inject(BackupsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listJetbackupJobs hace GET a /api/backups/jetbackup/jobs', () => {
    svc.listJetbackupJobs().subscribe(jobs => expect(jobs.length).toBe(1));
    const req = http.expectOne('/api/backups/jetbackup/jobs');
    expect(req.request.method).toBe('GET');
    req.flush([{ jobId: 'j1', name: 'PSQ', disabled: false, configured: false, configuredClientName: null }]);
  });

  it('createJetbackupConfigs hace POST a /api/backups/configs/jetbackup con el dto', () => {
    const dto = { clientId: 'c1', clientName: 'ACME', isEnabled: true, jobs: [{ jobId: 'j1', jobName: 'PSQ' }] };
    svc.createJetbackupConfigs(dto).subscribe();
    const req = http.expectOne('/api/backups/configs/jetbackup');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush([]);
  });

  it('updateJetbackupConfig hace PATCH a /api/backups/configs/jetbackup/:id', () => {
    svc.updateJetbackupConfig('jc1', { isEnabled: false }).subscribe();
    const req = http.expectOne('/api/backups/configs/jetbackup/jc1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ isEnabled: false });
    req.flush({});
  });

  it('deleteJetbackupConfig hace DELETE a /api/backups/configs/jetbackup/:id', () => {
    svc.deleteJetbackupConfig('jc1').subscribe();
    const req = http.expectOne('/api/backups/configs/jetbackup/jc1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
