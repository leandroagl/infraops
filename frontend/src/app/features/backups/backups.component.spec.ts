import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { BackupsComponent } from './backups.component';
import { BackupsService } from './services/backups.service';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterTestingModule } from '@angular/router/testing';
import { AuthService } from '../../core/services/auth.service';
import { NO_ERRORS_SCHEMA } from '@angular/core';

const mockSvc = { getAll: jest.fn() };
const mockAuth = { getCurrentUser: jest.fn().mockReturnValue(null) };

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
  });

  it('debería cargar clientes al init', () => {
    mockSvc.getAll.mockReturnValue(of([]));
    fixture.detectChanges();
    expect(mockSvc.getAll).toHaveBeenCalled();
  });

  it('debería calcular KPI totales correctamente', () => {
    mockSvc.getAll.mockReturnValue(of([
      { status: 'ok', clientId: '1', clientName: 'A', totalJobs: 1, okCount: 1, warnCount: 0, critCount: 0, hasRunningJob: false, lastReadAt: '', jobs: [] },
      { status: 'warn', clientId: '2', clientName: 'B', totalJobs: 2, okCount: 1, warnCount: 1, critCount: 0, hasRunningJob: false, lastReadAt: '', jobs: [] },
      { status: 'crit', clientId: '3', clientName: 'C', totalJobs: 1, okCount: 0, warnCount: 0, critCount: 1, hasRunningJob: false, lastReadAt: '', jobs: [] },
    ]));
    fixture.detectChanges();
    expect(comp.kpi.total).toBe(3);
    expect(comp.kpi.ok).toBe(1);
    expect(comp.kpi.warn).toBe(1);
    expect(comp.kpi.crit).toBe(1);
  });

  it('seleccionar cliente abre el drawer', () => {
    mockSvc.getAll.mockReturnValue(of([]));
    fixture.detectChanges();
    const client = { clientId: 'x', clientName: 'X', status: 'ok' as const, totalJobs: 0, okCount: 0, warnCount: 0, critCount: 0, hasRunningJob: false, lastReadAt: '', jobs: [] };
    comp.selectClient(client);
    expect(comp.selectedClient).toBe(client);
    expect(comp.drawerOpen).toBe(true);
  });

  it('cerrar drawer limpia selectedClient', () => {
    mockSvc.getAll.mockReturnValue(of([]));
    fixture.detectChanges();
    comp.drawerOpen = true;
    comp.closeDrawer();
    expect(comp.drawerOpen).toBe(false);
    expect(comp.selectedClient).toBeNull();
  });
});
