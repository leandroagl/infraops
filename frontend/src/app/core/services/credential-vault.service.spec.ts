import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { CredentialVaultService } from './credential-vault.service';

describe('CredentialVaultService', () => {
  let svc: CredentialVaultService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [CredentialVaultService],
    });
    svc = TestBed.inject(CredentialVaultService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list llama GET /api/credential-vault', () => {
    svc.list().subscribe();
    const req = http.expectOne('/api/credential-vault');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('create llama POST /api/credential-vault con name y password', () => {
    svc.create('Veeam ACME', 'pass123').subscribe();
    const req = http.expectOne('/api/credential-vault');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Veeam ACME', password: 'pass123' });
    req.flush({ id: 'u1', name: 'Veeam ACME', createdAt: '2026-01-01' });
  });

  it('delete llama DELETE /api/credential-vault/:id', () => {
    svc.delete('u1').subscribe();
    const req = http.expectOne('/api/credential-vault/u1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
