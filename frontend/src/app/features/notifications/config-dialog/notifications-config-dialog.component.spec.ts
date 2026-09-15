import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { NEVER, of, throwError } from 'rxjs';
import { NotificationsConfigDialogComponent } from './notifications-config-dialog.component';
import { IntegrationConfigService } from '../../../core/services/integration-config.service';

const MOCK_TEAMS = [{ id: 9, name: 'Vencimientos' }, { id: 7, name: 'Mantenimientos' }];
const MOCK_TAGS  = [{ id: 3, name: 'Urgente' }, { id: 5, name: 'Garantía' }];
const MOCK_CONFIG = {
  url: 'u', db: 'd', username: 'u', apiKey: '••••••••',
  helpdeskTeamId: 7, expirationsHelpdeskTeamId: 9,
  expirationsTicketDaysAhead: 30, expirationsTagIds: [3],
  expirationsTypeConfigs: null,
  stageInProgressName: '', stageNotDoneName: '', stageDoneName: '',
  updatedAt: null, updatedBy: null,
};

describe('NotificationsConfigDialogComponent', () => {
  let fixture: ComponentFixture<NotificationsConfigDialogComponent>;
  let comp: NotificationsConfigDialogComponent;
  let svc: jasmine.SpyObj<IntegrationConfigService>;
  let dialogRef: jasmine.SpyObj<MatDialogRef<NotificationsConfigDialogComponent>>;

  beforeEach(async () => {
    svc = jasmine.createSpyObj('IntegrationConfigService', ['getOdoo', 'getHelpdeskTeams', 'getHelpdeskTags', 'patchOdoo']);
    svc.getOdoo.and.returnValue(of(MOCK_CONFIG));
    svc.getHelpdeskTeams.and.returnValue(of(MOCK_TEAMS));
    svc.getHelpdeskTags.and.returnValue(of(MOCK_TAGS));
    svc.patchOdoo.and.returnValue(of(MOCK_CONFIG));

    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);

    await TestBed.configureTestingModule({
      declarations: [NotificationsConfigDialogComponent],
      imports: [
        NoopAnimationsModule, ReactiveFormsModule, MatDialogModule,
        MatFormFieldModule, MatInputModule, MatSelectModule,
        MatButtonModule, MatProgressSpinnerModule,
      ],
      providers: [
        { provide: IntegrationConfigService, useValue: svc },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationsConfigDialogComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carga config, teams y tags al inicializar', fakeAsync(() => {
    tick();
    expect(svc.getOdoo).toHaveBeenCalled();
    expect(svc.getHelpdeskTeams).toHaveBeenCalled();
    expect(svc.getHelpdeskTags).toHaveBeenCalled();
    expect(comp.loading).toBe(false);
  }));

  it('popula el form con los valores de la config', fakeAsync(() => {
    tick();
    expect(comp.form.get('expirationsHelpdeskTeamId')?.value).toBe(9);
    expect(comp.form.get('expirationsTicketDaysAhead')?.value).toBe(30);
    expect(comp.form.get('expirationsTagIds')?.value).toEqual([3]);
  }));

  it('muestra advertencia de teams si getHelpdeskTeams falla pero sigue cargando', fakeAsync(() => {
    svc.getHelpdeskTeams.and.returnValue(throwError(() => new Error('timeout')));
    const f = TestBed.createComponent(NotificationsConfigDialogComponent);
    f.componentInstance.ngOnInit();
    tick();
    expect(f.componentInstance.teamsError).toBe(true);
    expect(f.componentInstance.loading).toBe(false);
  }));

  it('llama patchOdoo con los tres campos al guardar', fakeAsync(() => {
    tick();
    comp.form.setValue({
      expirationsHelpdeskTeamId: 9,
      expirationsTicketDaysAhead: 14,
      expirationsTagIds: [3, 5],
    });
    comp.save();
    tick();
    expect(svc.patchOdoo).toHaveBeenCalledWith({
      expirationsHelpdeskTeamId: 9,
      expirationsTicketDaysAhead: 14,
      expirationsTagIds: [3, 5],
    });
  }));

  it('cierra el diálogo con true al guardar con éxito', fakeAsync(() => {
    tick();
    comp.form.setValue({
      expirationsHelpdeskTeamId: 9,
      expirationsTicketDaysAhead: 14,
      expirationsTagIds: [],
    });
    comp.save();
    tick();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  }));

  it('deshabilita el botón guardar mientras está en progreso', fakeAsync(() => {
    tick();
    comp.form.setValue({ expirationsHelpdeskTeamId: 9, expirationsTicketDaysAhead: 14, expirationsTagIds: [] });
    svc.patchOdoo.and.returnValue(NEVER);
    comp.save();
    expect(comp.saving).toBe(true);
    expect(comp.form.disabled).toBe(true);
  }));
});
