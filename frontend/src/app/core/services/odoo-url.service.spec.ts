import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { BehaviorSubject } from 'rxjs';
import { OdooUrlService } from './odoo-url.service';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

describe('OdooUrlService', () => {
  let service: OdooUrlService;
  let httpMock: HttpTestingController;
  let userSubject: BehaviorSubject<{ role: string } | null>;

  beforeEach(() => {
    userSubject = new BehaviorSubject<{ role: string } | null>(null);
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        OdooUrlService,
        { provide: AuthService, useValue: { user$: userSubject.asObservable() } },
      ],
    });
    service = TestBed.inject(OdooUrlService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('carga ticketsBaseUrl cuando el usuario se autentica', () => {
    userSubject.next({ role: 'TECHNICIAN' });

    const req = httpMock.expectOne(`${environment.apiUrl}/integration-config/odoo/public`);
    req.flush({ ticketsBaseUrl: 'https://ondra.odoo.com/odoo/helpdesk/7/tickets' });

    expect(service.ticketUrl(100)).toBe('https://ondra.odoo.com/odoo/helpdesk/7/tickets/100');
  });

  it('devuelve string vacío si la URL aún no fue cargada', () => {
    expect(service.ticketUrl(42)).toBe('');
  });

  it('no hace request si el usuario es null', () => {
    httpMock.expectNone(`${environment.apiUrl}/integration-config/odoo/public`);
    expect(service.ticketUrl(1)).toBe('');
  });
});
