import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { NEVER, of } from 'rxjs';
import { NotificationsConfigComponent } from './notifications-config.component';
import { IntegrationConfigService } from '../../../core/services/integration-config.service';

const MOCK_TEAMS = [{ id: 9, name: 'Vencimientos' }, { id: 7, name: 'Mantenimientos' }];
const MOCK_TAGS  = [{ id: 3, name: 'Urgente' }, { id: 5, name: 'Garantía' }];

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
  let router: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    svc = jasmine.createSpyObj('IntegrationConfigService', [
      'getOdoo', 'getHelpdeskTeams', 'getHelpdeskTags', 'patchOdoo',
    ]);
    svc.getOdoo.and.returnValue(of(mockConfig() as any));
    svc.getHelpdeskTeams.and.returnValue(of(MOCK_TEAMS));
    svc.getHelpdeskTags.and.returnValue(of(MOCK_TAGS));
    svc.patchOdoo.and.returnValue(of(mockConfig() as any));

    router = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      declarations: [NotificationsConfigComponent],
      imports: [
        NoopAnimationsModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        MatSlideToggleModule,
      ],
      providers: [
        { provide: IntegrationConfigService, useValue: svc },
        { provide: Router, useValue: router },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationsConfigComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carga config, teams y tags al inicializar', fakeAsync(() => {
    tick();
    expect(svc.getOdoo).toHaveBeenCalled();
    expect(svc.getHelpdeskTeams).toHaveBeenCalled();
    expect(svc.getHelpdeskTags).toHaveBeenCalled();
    expect(comp.loading).toBe(false);
    expect(comp.teams).toEqual(MOCK_TEAMS);
    expect(comp.tags).toEqual(MOCK_TAGS);
  }));

  it('popula el formulario con expirationsTypeConfigs existente', fakeAsync(() => {
    const configs = {
      domain:         { enabled: true,  helpdeskTeamId: 9, daysAhead: 14, tagIds: [3] },
      asset_warranty: { enabled: false, helpdeskTeamId: null, daysAhead: 60, tagIds: [] },
    };
    svc.getOdoo.and.returnValue(of(mockConfig(configs) as any));
    const f = TestBed.createComponent(NotificationsConfigComponent);
    f.detectChanges();
    tick();
    const domainGroup = f.componentInstance.form.get('domain')!;
    expect(domainGroup.get('enabled')!.value).toBe(true);
    expect(domainGroup.get('helpdeskTeamId')!.value).toBe(9);
    expect(domainGroup.get('daysAhead')!.value).toBe(14);
    expect(domainGroup.get('tagIds')!.value).toEqual([3]);
  }));

  it('toggle ON habilita campos del tipo', fakeAsync(() => {
    tick();
    const group = comp.form.get('domain')!;
    expect(group.get('helpdeskTeamId')!.disabled).toBe(true);
    group.get('enabled')!.setValue(true);
    comp.onToggleChange('domain');
    expect(group.get('helpdeskTeamId')!.disabled).toBe(false);
    expect(group.get('daysAhead')!.disabled).toBe(false);
    expect(group.get('tagIds')!.disabled).toBe(false);
  }));

  it('toggle OFF deshabilita campos del tipo', fakeAsync(() => {
    tick();
    const group = comp.form.get('software')!;
    group.get('enabled')!.setValue(true);
    comp.onToggleChange('software');
    expect(group.get('helpdeskTeamId')!.disabled).toBe(false);
    group.get('enabled')!.setValue(false);
    comp.onToggleChange('software');
    expect(group.get('helpdeskTeamId')!.disabled).toBe(true);
    expect(group.get('daysAhead')!.disabled).toBe(true);
  }));

  it('formValid es false cuando un tipo está habilitado pero sin equipo', fakeAsync(() => {
    tick();
    const group = comp.form.get('domain')!;
    group.get('enabled')!.setValue(true);
    comp.onToggleChange('domain');
    group.get('helpdeskTeamId')!.setValue(null);
    expect(comp.formValid).toBe(false);
  }));

  it('formValid es true cuando todos los tipos habilitados tienen equipo', fakeAsync(() => {
    tick();
    const group = comp.form.get('domain')!;
    group.get('enabled')!.setValue(true);
    comp.onToggleChange('domain');
    group.get('helpdeskTeamId')!.setValue(9);
    expect(comp.formValid).toBe(true);
  }));

  it('save llama patchOdoo con el payload correcto para tipos activos e inactivos', fakeAsync(() => {
    tick();
    const group = comp.form.get('domain')!;
    group.get('enabled')!.setValue(true);
    comp.onToggleChange('domain');
    group.get('helpdeskTeamId')!.setValue(9);
    group.get('daysAhead')!.setValue(14);
    group.get('tagIds')!.setValue([3]);
    comp.save();
    tick();
    const call = svc.patchOdoo.calls.mostRecent().args[0];
    expect(call.expirationsTypeConfigs!['domain']).toEqual({
      enabled: true, helpdeskTeamId: 9, daysAhead: 14, tagIds: [3],
    });
    expect(call.expirationsTypeConfigs!['software'].enabled).toBe(false);
  }));

  it('save bloquea cuando formValid es false (enabled sin team)', fakeAsync(() => {
    tick();
    const group = comp.form.get('domain')!;
    group.get('enabled')!.setValue(true);
    comp.onToggleChange('domain');
    group.get('helpdeskTeamId')!.setValue(null);
    comp.save();
    tick();
    expect(svc.patchOdoo).not.toHaveBeenCalled();
  }));

  it('save navega a /notifications al completar', fakeAsync(() => {
    tick();
    comp.save();
    tick();
    expect(router.navigate).toHaveBeenCalledWith(['/notifications']);
  }));

  it('save activa saving=true mientras está en progreso', fakeAsync(() => {
    tick();
    svc.patchOdoo.and.returnValue(NEVER);
    comp.save();
    expect(comp.saving).toBe(true);
  }));

  it('displayedColumns incluye todas las columnas de la tabla', () => {
    expect(comp.displayedColumns).toEqual(['type', 'enabled', 'helpdeskTeamId', 'daysAhead', 'tagIds']);
  });
});
