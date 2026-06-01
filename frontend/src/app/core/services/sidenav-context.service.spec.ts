import { TestBed } from '@angular/core/testing';
import { SidenavContextService, ClientSidenavContext } from './sidenav-context.service';

describe('SidenavContextService', () => {
  let service: SidenavContextService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SidenavContextService);
  });

  it('emite null inicialmente', () => {
    let emitted: ClientSidenavContext | null | undefined;
    service.client$.subscribe(v => (emitted = v));
    expect(emitted).toBeNull();
  });

  it('emite el cliente tras llamar setClient', () => {
    service.setClient({ id: '1', name: 'ACME Corp' });
    let emitted: ClientSidenavContext | null | undefined;
    service.client$.subscribe(v => (emitted = v));
    expect(emitted).toEqual({ id: '1', name: 'ACME Corp' });
  });

  it('emite null tras llamar clearClient', () => {
    service.setClient({ id: '1', name: 'ACME Corp' });
    service.clearClient();
    let emitted: ClientSidenavContext | null | undefined;
    service.client$.subscribe(v => (emitted = v));
    expect(emitted).toBeNull();
  });
});
