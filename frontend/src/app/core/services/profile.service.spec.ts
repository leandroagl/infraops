import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ProfileService } from './profile.service';
import { environment } from '../../../environments/environment';

describe('ProfileService', () => {
  let service: ProfileService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(ProfileService);
    http    = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getMe hace GET /users/me', () => {
    const mockMe = {
      id: '1',
      name: 'Valen',
      email: 'v@ondra.com.ar',
      role: 'TECHNICIAN',
      technicianId: null,
      odooKeyValid: true,
      odooKeyValidatedAt: null,
      odooApiEmail: 'v@ondra.com.ar',
      odooExempt: false,
    };
    service.getMe().subscribe(me => expect(me).toEqual(mockMe));
    const req = http.expectOne(`${environment.apiUrl}/users/me`);
    expect(req.request.method).toBe('GET');
    req.flush(mockMe);
  });

  it('updateOdooCredentials hace PUT /users/me/odoo-credentials con el body correcto', () => {
    service.updateOdooCredentials('v@ondra.com.ar', 'my-api-key').subscribe();
    const req = http.expectOne(`${environment.apiUrl}/users/me/odoo-credentials`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ odooApiEmail: 'v@ondra.com.ar', odooApiKey: 'my-api-key' });
    req.flush(null);
  });
});
