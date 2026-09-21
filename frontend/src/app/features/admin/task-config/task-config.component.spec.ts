import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { TaskConfigComponent } from './task-config.component';
import { TaskConfigService } from '../../../core/services/task-config.service';
import { TaskTypeConfigDto } from '../../../core/models/task.models';
import { TaskEditDialogComponent } from './task-edit-dialog/task-edit-dialog.component';

function makeConfig(overrides: Partial<TaskTypeConfigDto> = {}): TaskTypeConfigDto {
  return {
    taskType: 'SERVER_HOST_MAINTENANCE',
    defaultTimeMinutes: 90,
    odooTagIds: [3],
    odooTagNames: ['Urgente'],
    ticketDescription: null,
    timesheetDescription: null,
    ondraOwnedHosts: [],
    updatedAt: '2026-09-01T00:00:00Z',
    ...overrides,
  };
}

describe('TaskConfigComponent', () => {
  let component: TaskConfigComponent;
  let fixture: ComponentFixture<TaskConfigComponent>;
  let svc: jasmine.SpyObj<TaskConfigService>;
  let dialog: jasmine.SpyObj<MatDialog>;

  beforeEach(async () => {
    svc = jasmine.createSpyObj('TaskConfigService', ['getAll']);
    svc.getAll.and.returnValue(of([makeConfig()]));
    dialog = jasmine.createSpyObj('MatDialog', ['open']);

    await TestBed.configureTestingModule({
      declarations: [TaskConfigComponent],
      imports: [NoopAnimationsModule, MatTableModule, MatIconModule, MatButtonModule, MatDialogModule],
      providers: [
        { provide: TaskConfigService, useValue: svc },
        { provide: MatDialog, useValue: dialog },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carga la config al iniciar', () => {
    expect(svc.getAll).toHaveBeenCalled();
    expect(component.loading).toBe(false);
    expect(component.configs.length).toBe(1);
  });

  it('loading termina en false aunque getAll falle', () => {
    svc.getAll.and.returnValue(throwError(() => new Error('fail')));
    const f = TestBed.createComponent(TaskConfigComponent);
    f.detectChanges();
    expect(f.componentInstance.loading).toBe(false);
  });

  it('openEdit abre el dialog con la config de la fila', () => {
    const config = makeConfig();
    dialog.open.and.returnValue({ afterClosed: () => of(null) } as any);

    component.openEdit(config);

    expect(dialog.open).toHaveBeenCalledWith(TaskEditDialogComponent, {
      data: { config }, width: '720px', maxWidth: '90vw',
    });
  });

  it('actualiza la config local cuando el dialog devuelve un resultado', () => {
    const original = makeConfig({ defaultTimeMinutes: 90 });
    component.configs = [original];
    const updated = { ...original, defaultTimeMinutes: 60 };
    dialog.open.and.returnValue({ afterClosed: () => of(updated) } as any);

    component.openEdit(original);

    expect(component.configs[0].defaultTimeMinutes).toBe(60);
  });

  it('no modifica la config local cuando el dialog se cierra sin guardar', () => {
    const original = makeConfig();
    component.configs = [original];
    dialog.open.and.returnValue({ afterClosed: () => of(null) } as any);

    component.openEdit(original);

    expect(component.configs[0]).toEqual(original);
  });

  it('solo actualiza la fila correspondiente cuando hay más de una config', () => {
    const a = makeConfig({ taskType: 'SERVER_HOST_MAINTENANCE', defaultTimeMinutes: 90 });
    const b = makeConfig({ taskType: 'QNAP_MAINTENANCE', defaultTimeMinutes: 45 });
    component.configs = [a, b];
    const updatedA = { ...a, defaultTimeMinutes: 120 };
    dialog.open.and.returnValue({ afterClosed: () => of(updatedA) } as any);

    component.openEdit(a);

    expect(component.configs[0].defaultTimeMinutes).toBe(120);
    expect(component.configs[1]).toEqual(b);
  });

  it('formatMinutes muestra "— sin configurar" cuando minutes es null', () => {
    expect(component.formatMinutes(null)).toBe('— sin configurar');
  });

  it('formatMinutes formatea 90 minutos como 1:30 h', () => {
    expect(component.formatMinutes(90)).toBe('1:30 h');
  });

  it('formatMinutes formatea 0 minutos como 0:00 h', () => {
    expect(component.formatMinutes(0)).toBe('0:00 h');
  });

  it('displayedColumns incluye todas las columnas de la tabla', () => {
    expect(component.displayedColumns).toEqual(['taskType', 'defaultTimeMinutes', 'odooTags', 'ondraHosts', 'actions']);
  });

  it('taskTypeLabels mapea SERVER_HOST_MAINTENANCE a un label legible', () => {
    expect(component.taskTypeLabels['SERVER_HOST_MAINTENANCE']).toBe('Hosts VMware / BMC');
  });
});
