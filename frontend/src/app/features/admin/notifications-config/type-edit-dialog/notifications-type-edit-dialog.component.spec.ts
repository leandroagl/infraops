import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { NotificationsTypeEditDialogComponent } from './notifications-type-edit-dialog.component';
import { NotificationsService } from '../../../../core/services/notifications.service';
import { IntegrationConfigService, HelpdeskTeamDto, HelpdeskTagDto } from '../../../../core/services/integration-config.service';
import { ExpirationTypeConfigEntry } from '../../../../core/models/notification.models';

function makeEntry(overrides: Partial<ExpirationTypeConfigEntry> = {}): ExpirationTypeConfigEntry {
  return {
    enabled: true,
    helpdeskTeamId: 9,
    daysAhead: 30,
    tagIds: [3],
    taskName: 'Dominio',
    defaultTimeMinutes: 20,
    ticketDescription: null,
    timesheetDescription: null,
    ...overrides,
  };
}

const TEAMS: HelpdeskTeamDto[] = [{ id: 9, name: 'Vencimientos' }, { id: 7, name: 'Mantenimientos' }];
const TAGS: HelpdeskTagDto[] = [{ id: 3, name: 'Urgente' }, { id: 5, name: 'Garantía' }];

describe('NotificationsTypeEditDialogComponent', () => {
  let component: NotificationsTypeEditDialogComponent;
  let fixture: ComponentFixture<NotificationsTypeEditDialogComponent>;
  let notificationsSvc: jasmine.SpyObj<NotificationsService>;
  let integrationSvc: jasmine.SpyObj<IntegrationConfigService>;
  let dialogRef: jasmine.SpyObj<MatDialogRef<NotificationsTypeEditDialogComponent>>;

  function setup(entry: ExpirationTypeConfigEntry = makeEntry()): void {
    TestBed.resetTestingModule();
    notificationsSvc = jasmine.createSpyObj('NotificationsService', ['patchTypeConfig']);
    integrationSvc = jasmine.createSpyObj('IntegrationConfigService', ['getHelpdeskTeams', 'getHelpdeskTags', 'getHelpdeskSlas']);
    integrationSvc.getHelpdeskTeams.and.returnValue(of(TEAMS));
    integrationSvc.getHelpdeskTags.and.returnValue(of(TAGS));
    integrationSvc.getHelpdeskSlas.and.returnValue(of([{ id: 5, name: 'SLA Normal', time_days: 18 }]));
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);

    TestBed.configureTestingModule({
      declarations: [NotificationsTypeEditDialogComponent],
      imports: [
        NoopAnimationsModule, ReactiveFormsModule, MatDialogModule,
        MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule, MatButtonModule,
      ],
      providers: [
        { provide: NotificationsService, useValue: notificationsSvc },
        { provide: IntegrationConfigService, useValue: integrationSvc },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { type: 'domain', entry } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationsTypeEditDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => setup());

  it('popula el form con los valores de la entrada', () => {
    expect(component.form.value.enabled).toBe(true);
    expect(component.form.value.helpdeskTeamId).toBe(9);
    expect(component.form.value.daysAhead).toBe(30);
    expect(component.form.value.taskName).toBe('Dominio');
    expect(component.form.value.time).toBe('00:20');
    expect(component.form.value.tagIds).toEqual([3]);
  });

  it('deja el campo time vacío cuando defaultTimeMinutes es null', () => {
    setup(makeEntry({ defaultTimeMinutes: null }));
    expect(component.form.value.time).toBe('');
  });

  it('carga equipos y tags desde IntegrationConfigService', () => {
    expect(integrationSvc.getHelpdeskTeams).toHaveBeenCalled();
    expect(integrationSvc.getHelpdeskTags).toHaveBeenCalled();
    expect(component.teams).toEqual(TEAMS);
    expect(component.tags).toEqual(TAGS);
    expect(component.loading).toBe(false);
  });

  it('loading termina en false aunque falle la carga de equipos/tags', () => {
    integrationSvc.getHelpdeskTeams.and.returnValue(throwError(() => new Error('fail')));
    setup();
    expect(component.loading).toBe(false);
  });

  describe('save', () => {
    it('no llama al service si el form es inválido (sin equipo con habilitado)', () => {
      component.form.patchValue({ enabled: true, helpdeskTeamId: null });
      component.save();
      expect(notificationsSvc.patchTypeConfig).not.toHaveBeenCalled();
    });

    it('convierte el tiempo a minutos y arma la entrada completa', () => {
      notificationsSvc.patchTypeConfig.and.returnValue(of({}));
      component.form.patchValue({ time: '00:45', taskName: 'Dominio renovado' });

      component.save();

      expect(notificationsSvc.patchTypeConfig).toHaveBeenCalledWith('domain', jasmine.objectContaining({
        enabled: true, helpdeskTeamId: 9, daysAhead: 30, tagIds: [3],
        taskName: 'Dominio renovado', defaultTimeMinutes: 45,
      }));
    });

    it('manda ticketDescription/timesheetDescription null cuando quedan vacíos', () => {
      notificationsSvc.patchTypeConfig.and.returnValue(of({}));
      component.form.patchValue({ ticketDescription: '', timesheetDescription: '' });

      component.save();

      const entry = notificationsSvc.patchTypeConfig.calls.mostRecent().args[1];
      expect(entry.ticketDescription).toBeNull();
      expect(entry.timesheetDescription).toBeNull();
    });

    it('cierra el diálogo con la entrada guardada cuando el guardado es exitoso', () => {
      notificationsSvc.patchTypeConfig.and.returnValue(of({}));

      component.save();

      expect(component.saving).toBe(false);
      expect(dialogRef.close).toHaveBeenCalledWith(jasmine.objectContaining({ helpdeskTeamId: 9 }));
    });

    it('saving queda en false y el diálogo no se cierra si el guardado falla', () => {
      notificationsSvc.patchTypeConfig.and.returnValue(throwError(() => new Error('fail')));

      component.save();

      expect(component.saving).toBe(false);
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('no exige equipo cuando enabled es false', () => {
      notificationsSvc.patchTypeConfig.and.returnValue(of({}));
      component.form.patchValue({ enabled: false, helpdeskTeamId: null });

      component.save();

      expect(notificationsSvc.patchTypeConfig).toHaveBeenCalled();
    });
  });

  it('cancel cierra el diálogo con null', () => {
    component.cancel();
    expect(dialogRef.close).toHaveBeenCalledWith(null);
  });
});
