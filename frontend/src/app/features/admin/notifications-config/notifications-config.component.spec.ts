import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { NotificationsConfigComponent } from './notifications-config.component';
import { IntegrationConfigService } from '../../../core/services/integration-config.service';
import { ExpirationTypeConfigEntry } from '../../../core/models/notification.models';
import { NotificationsTypeEditDialogComponent } from './type-edit-dialog/notifications-type-edit-dialog.component';

const MOCK_TEAMS = [{ id: 9, name: 'Vencimientos' }, { id: 7, name: 'Mantenimientos' }];

function mockConfig(expirationsTypeConfigs: object | null = null) {
  return {
    url: 'u', db: 'd', username: 'u', apiKey: '••••••••',
    helpdeskTeamId: 7, expirationsHelpdeskTeamId: 9,
    expirationsTicketDaysAhead: 30, expirationsTagIds: [],
    expirationsTypeConfigs,
    stageInProgressName: '', stageNotDoneName: '', stageDoneName: '',
    updatedAt: null, updatedBy: null,
  };
}

describe('NotificationsConfigComponent', () => {
  let fixture: ComponentFixture<NotificationsConfigComponent>;
  let comp: NotificationsConfigComponent;
  let svc: jasmine.SpyObj<IntegrationConfigService>;
  let dialog: jasmine.SpyObj<MatDialog>;

  beforeEach(async () => {
    svc = jasmine.createSpyObj('IntegrationConfigService', ['getOdoo', 'getHelpdeskTeams']);
    svc.getOdoo.and.returnValue(of(mockConfig() as any));
    svc.getHelpdeskTeams.and.returnValue(of(MOCK_TEAMS));
    dialog = jasmine.createSpyObj('MatDialog', ['open']);

    await TestBed.configureTestingModule({
      declarations: [NotificationsConfigComponent],
      imports: [NoopAnimationsModule, MatTableModule, MatIconModule, MatButtonModule, MatDialogModule, MatProgressSpinnerModule],
      providers: [
        { provide: IntegrationConfigService, useValue: svc },
        { provide: MatDialog, useValue: dialog },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationsConfigComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carga los 4 tipos con defaults cuando no hay config guardada', () => {
    expect(svc.getOdoo).toHaveBeenCalled();
    expect(comp.loading).toBe(false);
    expect(comp.configs.length).toBe(4);
    expect(comp.configs.map(c => c.type)).toEqual(['asset_warranty', 'certificate', 'domain', 'software']);
    expect(comp.configs[0].enabled).toBe(false);
  });

  it('combina expirationsTypeConfigs existente con defaults para los tipos faltantes', () => {
    const configs = {
      domain: {
        enabled: true, helpdeskTeamId: 9, daysAhead: 14, tagIds: [3],
        taskName: 'Dominio', defaultTimeMinutes: 20, ticketDescription: null, timesheetDescription: null,
      },
    };
    svc.getOdoo.and.returnValue(of(mockConfig(configs) as any));
    const f = TestBed.createComponent(NotificationsConfigComponent);
    f.detectChanges();

    const domainRow = f.componentInstance.configs.find(c => c.type === 'domain')!;
    expect(domainRow.enabled).toBe(true);
    expect(domainRow.helpdeskTeamId).toBe(9);
    expect(domainRow.defaultTimeMinutes).toBe(20);

    const certRow = f.componentInstance.configs.find(c => c.type === 'certificate')!;
    expect(certRow.enabled).toBe(false);
  });

  it('loading termina en false aunque getOdoo falle', () => {
    svc.getOdoo.and.returnValue(throwError(() => new Error('fail')));
    const f = TestBed.createComponent(NotificationsConfigComponent);
    f.detectChanges();
    expect(f.componentInstance.loading).toBe(false);
  });

  it('carga los equipos para resolver el nombre en la tabla', () => {
    expect(svc.getHelpdeskTeams).toHaveBeenCalled();
    expect(comp.teamName(9)).toBe('Vencimientos');
  });

  it('teamName devuelve "—" para un id sin equipo asociado', () => {
    expect(comp.teamName(null)).toBe('—');
    expect(comp.teamName(999)).toBe('—');
  });

  it('openEdit abre el dialog con el tipo y la entrada de la fila', () => {
    const row = comp.configs[0];
    dialog.open.and.returnValue({ afterClosed: () => of(null) } as any);

    comp.openEdit(row);

    expect(dialog.open).toHaveBeenCalledWith(NotificationsTypeEditDialogComponent, {
      data: { type: row.type, entry: row },
      width: '640px', maxWidth: '90vw',
    });
  });

  it('actualiza la fila local cuando el dialog devuelve una entrada guardada', () => {
    const row = comp.configs.find(c => c.type === 'domain')!;
    const updated: ExpirationTypeConfigEntry = { ...row, enabled: true, helpdeskTeamId: 9 };
    dialog.open.and.returnValue({ afterClosed: () => of(updated) } as any);

    comp.openEdit(row);

    const result = comp.configs.find(c => c.type === 'domain')!;
    expect(result.enabled).toBe(true);
    expect(result.helpdeskTeamId).toBe(9);
  });

  it('no modifica las filas cuando el dialog se cierra sin guardar', () => {
    const before = [...comp.configs];
    dialog.open.and.returnValue({ afterClosed: () => of(null) } as any);

    comp.openEdit(comp.configs[0]);

    expect(comp.configs).toEqual(before);
  });

  it('solo actualiza la fila correspondiente cuando hay más de un tipo', () => {
    const domainRow = comp.configs.find(c => c.type === 'domain')!;
    const certRow = comp.configs.find(c => c.type === 'certificate')!;
    const updated: ExpirationTypeConfigEntry = { ...domainRow, enabled: true };
    dialog.open.and.returnValue({ afterClosed: () => of(updated) } as any);

    comp.openEdit(domainRow);

    expect(comp.configs.find(c => c.type === 'domain')!.enabled).toBe(true);
    expect(comp.configs.find(c => c.type === 'certificate')!).toEqual(certRow);
  });

  it('formatMinutes muestra "— sin configurar" cuando minutes es null', () => {
    expect(comp.formatMinutes(null)).toBe('— sin configurar');
  });

  it('formatMinutes formatea 90 minutos como 1:30 h', () => {
    expect(comp.formatMinutes(90)).toBe('1:30 h');
  });

  it('displayedColumns incluye todas las columnas de la tabla', () => {
    expect(comp.displayedColumns).toEqual(['type', 'enabled', 'helpdeskTeamId', 'daysAhead', 'defaultTimeMinutes', 'tagIds', 'actions']);
  });
});
