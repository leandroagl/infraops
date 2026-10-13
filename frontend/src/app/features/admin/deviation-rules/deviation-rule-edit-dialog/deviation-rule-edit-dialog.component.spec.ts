import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { DeviationRuleEditDialogComponent, DeviationRuleEditDialogData } from './deviation-rule-edit-dialog.component';
import { DeviationRulesService } from '../../../../core/services/deviation-rules.service';
import { IntegrationConfigService, HelpdeskTeamDto, HelpdeskTagDto } from '../../../../core/services/integration-config.service';
import { AvailableDeviationSignal, DeviationRuleDto } from '../../../../core/models/deviation-rule.models';

const SIGNALS: AvailableDeviationSignal[] = [
  { taskType: 'QNAP_MAINTENANCE', key: 'maxUsedSpacePct', label: '% de espacio usado', valueType: 'number' },
  { taskType: 'QNAP_MAINTENANCE', key: 'anyDiskWithError', label: 'Algún disco con error', valueType: 'boolean' },
  { taskType: 'VEEAM_BACKUP', key: 'anyVmWithoutBackup', label: 'Alguna VM sin backup', valueType: 'boolean' },
];

const TEAMS: HelpdeskTeamDto[] = [{ id: 7, name: 'Mantenimientos' }];
const TAGS: HelpdeskTagDto[] = [{ id: 3, name: 'Urgente' }];

function makeRule(overrides: Partial<DeviationRuleDto> = {}): DeviationRuleDto {
  return {
    id: 'rule-1',
    taskType: 'QNAP_MAINTENANCE',
    signalKey: 'maxUsedSpacePct',
    operator: 'gt',
    thresholdNumber: 90,
    thresholdBoolean: null,
    enabled: true,
    helpdeskTeamId: 7,
    tagIds: [3],
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
    ...overrides,
  };
}

describe('DeviationRuleEditDialogComponent', () => {
  let component: DeviationRuleEditDialogComponent;
  let fixture: ComponentFixture<DeviationRuleEditDialogComponent>;
  let rulesSvc: jasmine.SpyObj<DeviationRulesService>;
  let integrationSvc: jasmine.SpyObj<IntegrationConfigService>;
  let dialogRef: jasmine.SpyObj<MatDialogRef<DeviationRuleEditDialogComponent>>;

  function setup(data: DeviationRuleEditDialogData): void {
    TestBed.resetTestingModule();
    rulesSvc = jasmine.createSpyObj('DeviationRulesService', ['create', 'update']);
    integrationSvc = jasmine.createSpyObj('IntegrationConfigService', ['getHelpdeskTeams', 'getHelpdeskTags']);
    integrationSvc.getHelpdeskTeams.and.returnValue(of(TEAMS));
    integrationSvc.getHelpdeskTags.and.returnValue(of(TAGS));
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);

    TestBed.configureTestingModule({
      declarations: [DeviationRuleEditDialogComponent],
      imports: [
        NoopAnimationsModule, ReactiveFormsModule, MatDialogModule,
        MatFormFieldModule, MatInputModule, MatSelectModule, MatCheckboxModule, MatButtonModule,
      ],
      providers: [
        { provide: DeviationRulesService, useValue: rulesSvc },
        { provide: IntegrationConfigService, useValue: integrationSvc },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(DeviationRuleEditDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe('modo create', () => {
    beforeEach(() => setup({ mode: 'create', signals: SIGNALS }));

    it('arranca con el form vacío y taskType/signalKey habilitados', () => {
      expect(component.form.value.taskType).toBeNull();
      expect(component.form.controls.taskType.disabled).toBe(false);
      expect(component.form.controls.signalKey.disabled).toBe(false);
    });

    it('carga equipos y tags desde IntegrationConfigService', () => {
      expect(component.teams).toEqual(TEAMS);
      expect(component.tags).toEqual(TAGS);
    });

    it('availableSignalsForTaskType filtra por el taskType elegido', () => {
      component.form.patchValue({ taskType: 'QNAP_MAINTENANCE' });
      expect(component.availableSignalsForTaskType.map(s => s.key)).toEqual([
        'maxUsedSpacePct', 'anyDiskWithError',
      ]);
    });

    it('operatorOptions solo tiene "eq" cuando la señal elegida es booleana', () => {
      component.form.patchValue({ taskType: 'QNAP_MAINTENANCE', signalKey: 'anyDiskWithError' });
      expect(component.operatorOptions.map(o => o.value)).toEqual(['eq']);
    });

    it('operatorOptions tiene los 5 operadores cuando la señal elegida es numérica', () => {
      component.form.patchValue({ taskType: 'QNAP_MAINTENANCE', signalKey: 'maxUsedSpacePct' });
      expect(component.operatorOptions.map(o => o.value)).toEqual(['gt', 'gte', 'lt', 'lte', 'eq']);
    });

    it('isValid es false si falta thresholdNumber en una señal numérica', () => {
      component.form.patchValue({
        taskType: 'QNAP_MAINTENANCE', signalKey: 'maxUsedSpacePct', operator: 'gt',
        thresholdNumber: null, helpdeskTeamId: 7,
      });
      expect(component.isValid).toBe(false);
    });

    it('isValid es false si enabled y no hay helpdeskTeamId', () => {
      component.form.patchValue({
        taskType: 'QNAP_MAINTENANCE', signalKey: 'maxUsedSpacePct', operator: 'gt',
        thresholdNumber: 90, enabled: true, helpdeskTeamId: null,
      });
      expect(component.isValid).toBe(false);
    });

    it('isValid es true con una señal numérica completa', () => {
      component.form.patchValue({
        taskType: 'QNAP_MAINTENANCE', signalKey: 'maxUsedSpacePct', operator: 'gt',
        thresholdNumber: 90, enabled: true, helpdeskTeamId: 7,
      });
      expect(component.isValid).toBe(true);
    });

    it('save crea la regla con thresholdNumber cuando la señal es numérica', () => {
      rulesSvc.create.and.returnValue(of(makeRule()));
      component.form.patchValue({
        taskType: 'QNAP_MAINTENANCE', signalKey: 'maxUsedSpacePct', operator: 'gt',
        thresholdNumber: 90, enabled: true, helpdeskTeamId: 7, tagIds: [3],
      });

      component.save();

      expect(rulesSvc.create).toHaveBeenCalledWith({
        taskType: 'QNAP_MAINTENANCE', signalKey: 'maxUsedSpacePct', operator: 'gt',
        thresholdNumber: 90, thresholdBoolean: undefined, enabled: true, helpdeskTeamId: 7, tagIds: [3],
      });
      expect(dialogRef.close).toHaveBeenCalledWith(makeRule());
    });

    it('save crea la regla con thresholdBoolean cuando la señal es booleana', () => {
      rulesSvc.create.and.returnValue(of(makeRule()));
      component.form.patchValue({
        taskType: 'QNAP_MAINTENANCE', signalKey: 'anyDiskWithError', operator: 'eq',
        thresholdBoolean: true, enabled: true, helpdeskTeamId: 7, tagIds: [],
      });

      component.save();

      expect(rulesSvc.create).toHaveBeenCalledWith(jasmine.objectContaining({
        signalKey: 'anyDiskWithError', thresholdBoolean: true, thresholdNumber: undefined,
      }));
    });

    it('no llama al service si el form es inválido', () => {
      component.save();
      expect(rulesSvc.create).not.toHaveBeenCalled();
    });

    it('saving queda en false y el diálogo no se cierra si el guardado falla', () => {
      rulesSvc.create.and.returnValue(throwError(() => new Error('fail')));
      component.form.patchValue({
        taskType: 'QNAP_MAINTENANCE', signalKey: 'maxUsedSpacePct', operator: 'gt',
        thresholdNumber: 90, enabled: true, helpdeskTeamId: 7,
      });

      component.save();

      expect(component.saving).toBe(false);
      expect(dialogRef.close).not.toHaveBeenCalled();
    });
  });

  describe('modo edit', () => {
    const rule = makeRule();
    beforeEach(() => setup({ mode: 'edit', rule, signals: SIGNALS }));

    it('popula el form con los valores de la regla y deja taskType/signalKey deshabilitados', () => {
      expect(component.form.getRawValue().taskType).toBe('QNAP_MAINTENANCE');
      expect(component.form.getRawValue().signalKey).toBe('maxUsedSpacePct');
      expect(component.form.value.thresholdNumber).toBe(90);
      expect(component.form.controls.taskType.disabled).toBe(true);
      expect(component.form.controls.signalKey.disabled).toBe(true);
    });

    it('save actualiza la regla sin mandar taskType/signalKey', () => {
      rulesSvc.update.and.returnValue(of({ ...rule, thresholdNumber: 95 }));
      component.form.patchValue({ thresholdNumber: 95 });

      component.save();

      expect(rulesSvc.update).toHaveBeenCalledWith('rule-1', {
        operator: 'gt', thresholdNumber: 95, thresholdBoolean: undefined,
        enabled: true, helpdeskTeamId: 7, tagIds: [3],
      });
    });
  });

  it('cancel cierra el diálogo con null', () => {
    setup({ mode: 'create', signals: SIGNALS });
    component.cancel();
    expect(dialogRef.close).toHaveBeenCalledWith(null);
  });
});
