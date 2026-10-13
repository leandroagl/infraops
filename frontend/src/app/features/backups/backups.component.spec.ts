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

const makeClient = (clientId: string, status: ClientBackup['status']): ClientBackup => ({
  clientId, clientName: clientId, status, totalJobs: 0,
  okCount: 0, warnCount: 0, critCount: 0, hasRunningJob: false, lastReadAt: '', jobs: [],
});

describe('BackupsComponent', () => {
  let fixture: ComponentFixture<BackupsComponent>;
  let comp: BackupsComponent;
  let mockSvc: jasmine.SpyObj<BackupsService>;
  let mockAuth: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    mockSvc  = jasmine.createSpyObj('BackupsService', ['getAll', 'getSnapshot', 'getOne']);
    mockAuth = jasmine.createSpyObj('AuthService', ['getCurrentUser']);
    mockAuth.getCurrentUser.and.returnValue(null);

    await TestBed.configureTestingModule({
      declarations: [BackupsComponent],
      imports: [NoopAnimationsModule, MatProgressBarModule, MatSnackBarModule, RouterTestingModule],
      providers: [
        { provide: BackupsService, useValue: mockSvc },
        { provide: AuthService,    useValue: mockAuth },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(BackupsComponent);
    comp    = fixture.componentInstance;
  });

  it('muestra snapshot inmediatamente y luego carga datos en vivo', () => {
    const snapshot = [makeClient('1', 'ok')];
    const live     = [makeClient('1', 'crit')];
    mockSvc.getSnapshot.and.returnValue(of(snapshot));
    mockSvc.getAll.and.returnValue(of(live));
    fixture.detectChanges();
    expect(comp.clients[0].status).toBe('crit');
    expect(comp.loading).toBe(false);
  });

  it('si snapshot falla, igualmente carga datos en vivo', () => {
    const live = [makeClient('1', 'ok')];
    mockSvc.getSnapshot.and.returnValue(throwError(() => new Error()));
    mockSvc.getAll.and.returnValue(of(live));
    fixture.detectChanges();
    expect(comp.clients).toEqual(live);
    expect(comp.loading).toBe(false);
  });

  it('debería calcular KPI totales correctamente', () => {
    mockSvc.getSnapshot.and.returnValue(of([]));
    mockSvc.getAll.and.returnValue(of([
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
    mockSvc.getSnapshot.and.returnValue(of([]));
    mockSvc.getAll.and.returnValue(of([
      makeClient('1', 'ok'),
      makeClient('2', 'no_data'),
      makeClient('3', 'disconnected'),
    ]));
    fixture.detectChanges();
    expect(comp.kpi.total).toBe(3);
    expect(comp.kpi.noData).toBe(2);
  });

  it('filteredClients con filtro no_data incluye clientes disconnected', () => {
    mockSvc.getSnapshot.and.returnValue(of([]));
    mockSvc.getAll.and.returnValue(of([
      makeClient('1', 'ok'),
      makeClient('2', 'no_data'),
      makeClient('3', 'disconnected'),
    ]));
    fixture.detectChanges();
    comp.statusFilter = 'no_data';
    expect(comp.filteredClients).toHaveSize(2);
    expect(comp.filteredClients.map(c => c.status)).toContain('disconnected');
  });

  it('seleccionar cliente abre el drawer', () => {
    mockSvc.getSnapshot.and.returnValue(of([]));
    mockSvc.getAll.and.returnValue(of([]));
    fixture.detectChanges();
    const client = makeClient('x', 'ok');
    comp.selectClient(client);
    expect(comp.selectedClient).toBe(client);
    expect(comp.drawerOpen).toBe(true);
  });

  it('cerrar drawer limpia selectedClient', () => {
    mockSvc.getSnapshot.and.returnValue(of([]));
    mockSvc.getAll.and.returnValue(of([]));
    fixture.detectChanges();
    comp.drawerOpen = true;
    comp.closeDrawer();
    expect(comp.drawerOpen).toBe(false);
    expect(comp.selectedClient).toBeNull();
  });

  it('onDrawerRefresh actualiza el cliente en el array y en selectedClient', () => {
    mockSvc.getSnapshot.and.returnValue(of([]));
    mockSvc.getAll.and.returnValue(of([makeClient('c1', 'ok')]));
    fixture.detectChanges();
    comp.selectedClient = comp.clients[0];
    const updated = makeClient('c1', 'crit');
    mockSvc.getOne.and.returnValue(of(updated));
    comp.onDrawerRefresh('c1');
    expect(comp.clients[0].status).toBe('crit');
    expect(comp.selectedClient?.status).toBe('crit');
    expect(comp.drawerRefreshing).toBe(false);
  });
});
