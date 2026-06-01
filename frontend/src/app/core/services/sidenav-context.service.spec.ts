import { TestBed } from '@angular/core/testing';
import { SidenavContextService } from './sidenav-context.service';

describe('SidenavContextService', () => {
  let service: SidenavContextService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SidenavContextService);
  });

  it('emite null inicialmente', (done) => {
    service.client$.subscribe(val => {
      expect(val).toBeNull();
      done();
    });
  });

  it('emite el cliente tras llamar setClient', (done) => {
    service.setClient({ id: '1', name: 'ACME Corp' });
    service.client$.subscribe(val => {
      expect(val).toEqual({ id: '1', name: 'ACME Corp' });
      done();
    });
  });

  it('emite null tras llamar clearClient', (done) => {
    service.setClient({ id: '1', name: 'ACME Corp' });
    service.clearClient();
    service.client$.subscribe(val => {
      expect(val).toBeNull();
      done();
    });
  });
});
