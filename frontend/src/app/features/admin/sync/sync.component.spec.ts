import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { SyncComponent } from './sync.component';
import { SyncService, ClientSyncResult, OdooSyncResult } from '../../../core/services/sync.service';

const clientsResult: ClientSyncResult = {
  created: 2, updated: 1, archived: 0, unchanged: 10, syncedAt: '2026-10-13T08:00:00Z',
};
const odooResult: OdooSyncResult = { matched: 5, unmatched: [], total: 5 };

describe('SyncComponent', () => {
  let fixture: ComponentFixture<SyncComponent>;
  let comp: SyncComponent;
  let mockSvc: jasmine.SpyObj<SyncService>;

  beforeEach(async () => {
    mockSvc = jasmine.createSpyObj('SyncService', ['syncClients', 'syncOdooPartners']);

    await TestBed.configureTestingModule({
      declarations: [SyncComponent],
      imports: [NoopAnimationsModule],
      providers: [{ provide: SyncService, useValue: mockSvc }],
    }).compileComponents();

    fixture = TestBed.createComponent(SyncComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('encadena syncClients y syncOdooPartners secuencialmente', () => {
    mockSvc.syncClients.and.returnValue(of(clientsResult));
    mockSvc.syncOdooPartners.and.returnValue(of(odooResult));

    comp.runSync();

    expect(mockSvc.syncClients).toHaveBeenCalledTimes(1);
    expect(mockSvc.syncOdooPartners).toHaveBeenCalledTimes(1);
    expect(comp.loading).toBe(false);
    expect(comp.clientsResult).toEqual(clientsResult);
    expect(comp.odooResult).toEqual(odooResult);
  });

  it('setea error y loading=false si syncClients falla', () => {
    mockSvc.syncClients.and.returnValue(throwError(() => ({ error: { message: 'InfraDoc no disponible' } })));

    comp.runSync();

    expect(comp.loading).toBe(false);
    expect(comp.error).toBe('InfraDoc no disponible');
    expect(mockSvc.syncOdooPartners).not.toHaveBeenCalled();
  });

  it('setea error y loading=false si syncOdooPartners falla', () => {
    mockSvc.syncClients.and.returnValue(of(clientsResult));
    mockSvc.syncOdooPartners.and.returnValue(throwError(() => ({ error: { message: 'Odoo no disponible' } })));

    comp.runSync();

    expect(comp.loading).toBe(false);
    expect(comp.error).toBe('Odoo no disponible');
    expect(comp.clientsResult).toEqual(clientsResult);
  });

  it('usa fallback específico "clientes" cuando syncClients falla sin mensaje de error', () => {
    mockSvc.syncClients.and.returnValue(throwError(() => ({})));

    comp.runSync();

    expect(comp.error).toBe('Error al sincronizar clientes desde InfraDoc');
  });

  it('usa fallback específico "partners" cuando syncOdooPartners falla sin mensaje de error', () => {
    mockSvc.syncClients.and.returnValue(of(clientsResult));
    mockSvc.syncOdooPartners.and.returnValue(throwError(() => ({})));

    comp.runSync();

    expect(comp.error).toBe('Error al sincronizar partners de Odoo');
  });
});
