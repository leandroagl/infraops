import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { IntegrationConfigService, OdooConfigDto } from './integration-config.service';
import { environment } from '../../../environments/environment';

describe('IntegrationConfigService', () => {
  let service: IntegrationConfigService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/integration-config`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [IntegrationConfigService] });
    service = TestBed.inject(IntegrationConfigService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('getOdoo hace GET a /integration-config/odoo', () => {
    const mock: OdooConfigDto = { url: 'u', db: 'd', username: 'u', apiKey: '••••••••', helpdeskTeamId: 7, updatedAt: null, updatedBy: null };
    service.getOdoo().subscribe(r => expect(r).toEqual(mock));
    http.expectOne(`${base}/odoo`).flush(mock);
  });

  it('patchOdoo hace PATCH a /integration-config/odoo', () => {
    const mock: OdooConfigDto = { url: 'nuevo', db: 'd', username: 'u', apiKey: '••••••••', helpdeskTeamId: 7, updatedAt: null, updatedBy: 'a' };
    service.patchOdoo({ url: 'nuevo' }).subscribe(r => expect(r.url).toBe('nuevo'));
    const req = http.expectOne(`${base}/odoo`);
    expect(req.request.method).toBe('PATCH');
    req.flush(mock);
  });

  it('testOdoo hace POST a /integration-config/odoo/test', () => {
    service.testOdoo().subscribe(r => expect(r.ok).toBe(true));
    const req = http.expectOne(`${base}/odoo/test`);
    expect(req.request.method).toBe('POST');
    req.flush({ ok: true, message: 'Conexión exitosa' });
  });
});
