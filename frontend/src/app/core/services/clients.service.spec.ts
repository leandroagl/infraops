import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ClientsService } from './clients.service';
import { environment } from '../../../environments/environment';

describe('ClientsService', () => {
  let service: ClientsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(ClientsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getById hace GET a /clients/:id y retorna el cliente', () => {
    const expected = {
      id: 'abc',
      name: 'ACME Corp',
      primaryAddress: 'Av. Corrientes 123',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    service.getById('abc').subscribe(result => {
      expect(result).toEqual(expected);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/clients/abc`);
    expect(req.request.method).toBe('GET');
    req.flush(expected);
  });
});
