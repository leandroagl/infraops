import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { DeviationRulesComponent } from './deviation-rules.component';
import { DeviationRulesService } from '../../../core/services/deviation-rules.service';
import { AvailableDeviationSignal, DeviationRuleDto } from '../../../core/models/deviation-rule.models';
import { DeviationRuleEditDialogComponent } from './deviation-rule-edit-dialog/deviation-rule-edit-dialog.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

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

const SIGNALS: AvailableDeviationSignal[] = [
  { taskType: 'QNAP_MAINTENANCE', key: 'maxUsedSpacePct', label: '% de espacio usado', valueType: 'number' },
  { taskType: 'QNAP_MAINTENANCE', key: 'anyDiskWithError', label: 'Algún disco con error', valueType: 'boolean' },
  { taskType: 'VEEAM_BACKUP', key: 'anyVmWithoutBackup', label: 'Alguna VM sin backup', valueType: 'boolean' },
];

describe('DeviationRulesComponent', () => {
  let component: DeviationRulesComponent;
  let fixture: ComponentFixture<DeviationRulesComponent>;
  let svc: jasmine.SpyObj<DeviationRulesService>;
  let dialog: jasmine.SpyObj<MatDialog>;

  beforeEach(async () => {
    svc = jasmine.createSpyObj('DeviationRulesService', ['getAll', 'getAvailableSignals', 'remove']);
    svc.getAll.and.returnValue(of([makeRule()]));
    svc.getAvailableSignals.and.returnValue(of(SIGNALS));
    dialog = jasmine.createSpyObj('MatDialog', ['open']);

    await TestBed.configureTestingModule({
      declarations: [DeviationRulesComponent],
      imports: [NoopAnimationsModule, MatTableModule, MatIconModule, MatButtonModule, MatDialogModule, MatSnackBarModule],
      providers: [
        { provide: DeviationRulesService, useValue: svc },
        { provide: MatDialog, useValue: dialog },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(DeviationRulesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carga las reglas y las señales disponibles al iniciar', () => {
    expect(svc.getAll).toHaveBeenCalled();
    expect(svc.getAvailableSignals).toHaveBeenCalled();
    expect(component.loading).toBe(false);
    expect(component.rules.length).toBe(1);
  });

  it('loading termina en false aunque getAll falle', () => {
    svc.getAll.and.returnValue(throwError(() => new Error('fail')));
    const f = TestBed.createComponent(DeviationRulesComponent);
    f.detectChanges();
    expect(f.componentInstance.loading).toBe(false);
  });

  it('signalLabel devuelve el label de la señal registrada', () => {
    expect(component.signalLabel(makeRule())).toBe('% de espacio usado');
  });

  it('signalLabel devuelve el signalKey si no encuentra la señal', () => {
    expect(component.signalLabel(makeRule({ signalKey: 'noExiste' }))).toBe('noExiste');
  });

  it('operatorLabel mapea cada operador a su símbolo', () => {
    expect(component.operatorLabel('gt')).toBe('>');
    expect(component.operatorLabel('gte')).toBe('≥');
    expect(component.operatorLabel('lt')).toBe('<');
    expect(component.operatorLabel('lte')).toBe('≤');
    expect(component.operatorLabel('eq')).toBe('=');
  });

  it('thresholdDisplay muestra el valor numérico', () => {
    expect(component.thresholdDisplay(makeRule({ thresholdNumber: 90, thresholdBoolean: null }))).toBe('90');
  });

  it('thresholdDisplay muestra Sí/No para umbral booleano', () => {
    expect(component.thresholdDisplay(makeRule({ thresholdNumber: null, thresholdBoolean: true }))).toBe('Sí');
    expect(component.thresholdDisplay(makeRule({ thresholdNumber: null, thresholdBoolean: false }))).toBe('No');
  });

  it('openCreate abre el dialog en modo create y agrega el resultado a la lista', () => {
    const created = makeRule({ id: 'rule-2' });
    dialog.open.and.returnValue({ afterClosed: () => of(created) } as any);

    component.openCreate();

    expect(dialog.open).toHaveBeenCalledWith(DeviationRuleEditDialogComponent, {
      data: { mode: 'create', signals: SIGNALS },
      width: '520px',
    });
    expect(component.rules).toContain(created);
  });

  it('openEdit abre el dialog en modo edit con la regla de la fila y actualiza solo esa fila', () => {
    const a = makeRule({ id: 'rule-1', thresholdNumber: 90 });
    const b = makeRule({ id: 'rule-2', signalKey: 'anyDiskWithError', thresholdNumber: null, thresholdBoolean: true, taskType: 'QNAP_MAINTENANCE' });
    component.rules = [a, b];
    const updatedA = { ...a, thresholdNumber: 95 };
    dialog.open.and.returnValue({ afterClosed: () => of(updatedA) } as any);

    component.openEdit(a);

    expect(dialog.open).toHaveBeenCalledWith(DeviationRuleEditDialogComponent, {
      data: { mode: 'edit', rule: a, signals: SIGNALS },
      width: '520px',
    });
    expect(component.rules[0].thresholdNumber).toBe(95);
    expect(component.rules[1]).toEqual(b);
  });

  it('openEdit no modifica la lista si el dialog se cierra sin guardar', () => {
    const a = makeRule();
    component.rules = [a];
    dialog.open.and.returnValue({ afterClosed: () => of(null) } as any);

    component.openEdit(a);

    expect(component.rules[0]).toEqual(a);
  });

  it('deleteRule elimina la fila si se confirma', () => {
    const a = makeRule({ id: 'rule-1' });
    component.rules = [a];
    dialog.open.and.returnValue({ afterClosed: () => of(true) } as any);
    svc.remove.and.returnValue(of(undefined));

    component.deleteRule(a);

    expect(dialog.open).toHaveBeenCalledWith(ConfirmDialogComponent, jasmine.objectContaining({
      data: jasmine.objectContaining({ title: jasmine.any(String) }),
    }));
    expect(svc.remove).toHaveBeenCalledWith('rule-1');
    expect(component.rules.length).toBe(0);
  });

  it('deleteRule no llama a remove si se cancela la confirmación', () => {
    const a = makeRule({ id: 'rule-1' });
    component.rules = [a];
    dialog.open.and.returnValue({ afterClosed: () => of(false) } as any);

    component.deleteRule(a);

    expect(svc.remove).not.toHaveBeenCalled();
    expect(component.rules.length).toBe(1);
  });

  it('deleteRule muestra un snack de error y no borra la fila si remove falla', () => {
    const snackBar = TestBed.inject(MatSnackBar);
    spyOn(snackBar, 'open');
    const a = makeRule({ id: 'rule-1' });
    component.rules = [a];
    dialog.open.and.returnValue({ afterClosed: () => of(true) } as any);
    svc.remove.and.returnValue(throwError(() => ({ error: { message: 'No se pudo eliminar' } })));

    component.deleteRule(a);

    expect(component.rules.length).toBe(1);
    expect(snackBar.open).toHaveBeenCalled();
  });
});
