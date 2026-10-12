import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { BackupsComponent } from './backups.component';
import { BackupsService } from './services/backups.service';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterTestingModule } from '@angular/router/testing';
import { AuthService } from '../../core/services/auth.service';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import type { ClientBackup } from './models/backup.models';

const mockSvc = { getAll: jest.fn(), getSnapshot: jest.fn(), getOne: jest.fn() };
const mockAuth = { getCurrentUser: jest.fn().mockReturnValue(null) };

const makeClient = (clientId: string, status: ClientBackup['status']): ClientBackup => ({
  clientId, clientName: clientId, status, totalJobs: 0,
  okCount: 0, warnCount: 0, critCount: 0, hasRunningJob: false, lastReadAt: '', jobs: [],
});

describe('BackupsComponent', () => {
  let fixture: ComponentFixture<BackupsComponent>;
  let comp: BackupsComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BackupsComponent],
      imports: [NoopAnimationsModule, MatProgressBarModule, MatSnackBarModule, RouterTestingModule],
      providers: [
        { provide: BackupsService, useValue: mockSvc },
        { provide: AuthService, useValue: mockAuth },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(BackupsComponent);
    comp = fixture.componentInstance;
    jest.clearAllMocks();
  });

  it('muestra snapshot inmediatamente y luego carga datos en vivo', () => {
    const snapshot = [makeClient('1', 'ok')];
    const live = [makeClient('1', 'crit')];
    mockSvc.getSnapshot.mockReturnValue(of(snapshot));
    mockSvc.getAll.mockReturnValue(of(live));
    fixture.detectChanges();
    expect(comp.clients[0].status).toBe('crit');
    expect(comp.loading).toBe(false);
  });

  it('si snapshot falla, igualmente carga datos en vivo', () => {
    const live = [makeClient('1', 'ok')];
    mockSvc.getSnapshot.mockReturnValue(throwError(() => new Error()));
    mockSvc.getAll.mockReturnValue(of(live));
    fixture.detectChanges();
    expect(comp.clients).toEqual(live);
    expect(comp.loading).toBe(false);
  });

  it('debería calcular KPI totales correctamente', () => {
    mockSvc.getSnapshot.mockReturnValue(of([]));
    mockSvc.getAll.mockReturnValue(of([
      makeClient('1', 'ok'),
      makeClient('2', 'warn'),
      makeClient('3', 'crit'),
    ]));
    fixture.detectChanges();
    expect(comp.kpi.total).toBe(3);
    expect(comp.kpi.ok).toBe(1);
    expect(comp.kpi.warn).toBe(1);
    expect(comp.kpi.crit).toBe(1);
  });

  it('debería contar disconnected dentro de noData en KPI', () => {
    mockSvc.getSnapshot.mockReturnValue(of([]));
    mockSvc.getAll.mockReturnValue(of([
      makeClient('1', 'ok'),
      makeClient('2', 'no_data'),
      makeClient('3', 'disconnected'),
    ]));
    fixture.detectChanges();
    expect(comp.kpi.total).toBe(3);
    expect(comp.kpi.noData).toBe(2);
  });

  it('filteredClients con filtro no_data incluye clientes disconnected', () => {
    mockSvc.getSnapshot.mockReturnValue(of([]));
    mockSvc.getAll.mockReturnValue(of([
      makeClient('1', 'ok'),
      makeClient('2', 'no_data'),
      makeClient('3', 'disconnected'),
    ]));
    fixture.detectChanges();
    comp.statusFilter = 'no_data';
    expect(comp.filteredClients).toHaveLength(2);
    expect(comp.filteredClients.map(c => c.status)).toContain('disconnected');
  });

  it('seleccionar cliente abre el drawer', () => {
    mockSvc.getSnapshot.mockReturnValue(of([]));
    mockSvc.getAll.mockReturnValue(of([]));
    fixture.detectChanges();
    const client = makeClient('x', 'ok');
    comp.selectClient(client);
    expect(comp.selectedClient).toBe(client);
    expect(comp.drawerOpen).toBe(true);
  });

  it('cerrar drawer limpia selectedClient', () => {
    mockSvc.getSnapshot.mockReturnValue(of([]));
    mockSvc.getAll.mockReturnValue(of([]));
    fixture.detectChanges();
    comp.drawerOpen = true;
    comp.closeDrawer();
    expect(comp.drawerOpen).toBe(false);
    expect(comp.selectedClient).toBeNull();
  });

  it('onDrawerRefresh actualiza el cliente en el array y en selectedClient', () => {
    mockSvc.getSnapshot.mockReturnValue(of([]));
    mockSvc.getAll.mockReturnValue(of([makeClient('c1', 'ok')]));
    fixture.detectChanges();
    comp.selectedClient = comp.clients[0];
    const updated = makeClient('c1', 'crit');
    mockSvc.getOne.mockReturnValue(of(updated));
    comp.onDrawerRefresh('c1');
    expect(comp.clients[0].status).toBe('crit');
    expect(comp.selectedClient?.status).toBe('crit');
    expect(comp.drawerRefreshing).toBe(false);
  });
});
