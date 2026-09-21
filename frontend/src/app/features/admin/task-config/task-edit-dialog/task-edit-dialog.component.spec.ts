import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { TaskEditDialogComponent } from './task-edit-dialog.component';
import { TaskConfigService } from '../../../../core/services/task-config.service';
import { OdooHelpdeskTagDto, TaskTypeConfigDto } from '../../../../core/models/task.models';

function makeConfig(overrides: Partial<TaskTypeConfigDto> = {}): TaskTypeConfigDto {
  return {
    taskType: 'SERVER_HOST_MAINTENANCE',
    defaultTimeMinutes: 90,
    odooTagIds: [3],
    odooTagNames: ['Urgente'],
    ticketDescription: null,
    defaultTicketDescription: 'Descripción por defecto del ticket',
    timesheetDescription: null,
    defaultTimesheetDescription: 'Mantenimiento realizado',
    ondraOwnedHosts: ['srv1.ondravirtual.com.ar'],
    updatedAt: '2026-09-01T00:00:00Z',
    ...overrides,
  };
}

const TAGS: OdooHelpdeskTagDto[] = [{ id: 3, name: 'Urgente' }, { id: 5, name: 'Garantía' }];

describe('TaskEditDialogComponent', () => {
  let component: TaskEditDialogComponent;
  let fixture: ComponentFixture<TaskEditDialogComponent>;
  let svc: jasmine.SpyObj<TaskConfigService>;
  let dialogRef: jasmine.SpyObj<MatDialogRef<TaskEditDialogComponent>>;

  function setup(config: TaskTypeConfigDto = makeConfig()): void {
    TestBed.resetTestingModule();
    svc = jasmine.createSpyObj('TaskConfigService', ['getHelpdeskTags', 'update']);
    svc.getHelpdeskTags.and.returnValue(of(TAGS));
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);

    TestBed.configureTestingModule({
      declarations: [TaskEditDialogComponent],
      imports: [
        NoopAnimationsModule, ReactiveFormsModule,
        MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule,
      ],
      providers: [
        { provide: TaskConfigService, useValue: svc },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { config } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskEditDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => setup());

  it('popula el form con el tiempo formateado, tagIds y hosts de la config', () => {
    expect(component.form.value.time).toBe('01:30');
    expect(component.form.value.tagIds).toEqual([3]);
    expect(component.ondraHosts).toEqual(['srv1.ondravirtual.com.ar']);
  });

  it('usa ticketDescription/timesheetDescription de la config cuando están seteados', () => {
    setup(makeConfig({ ticketDescription: 'Custom', timesheetDescription: 'Custom timesheet' }));
    expect(component.form.value.ticketDescription).toBe('Custom');
    expect(component.form.value.timesheetDescription).toBe('Custom timesheet');
  });

  it('cae a la descripción por defecto cuando ticketDescription/timesheetDescription son null', () => {
    expect(component.form.value.ticketDescription).toBe('Descripción por defecto del ticket');
    expect(component.form.value.timesheetDescription).toBe('Mantenimiento realizado');
  });

  it('deja el campo time vacío cuando defaultTimeMinutes es null', () => {
    setup(makeConfig({ defaultTimeMinutes: null }));
    expect(component.form.value.time).toBe('');
  });

  it('carga los tags disponibles desde el service', () => {
    expect(svc.getHelpdeskTags).toHaveBeenCalled();
    expect(component.availableTags).toEqual(TAGS);
    expect(component.loadingTags).toBe(false);
  });

  it('loadingTags termina en false aunque getHelpdeskTags falle', () => {
    svc.getHelpdeskTags.and.returnValue(throwError(() => new Error('fail')));
    setup();
    expect(component.loadingTags).toBe(false);
  });

  describe('validación del campo time', () => {
    it('acepta formato HH:MM válido', () => {
      component.form.controls.time.setValue('08:05');
      expect(component.form.controls.time.valid).toBe(true);
    });

    it('rechaza un formato sin dos puntos', () => {
      component.form.controls.time.setValue('0805');
      expect(component.form.controls.time.valid).toBe(false);
    });

    it('rechaza minutos mayores a 59', () => {
      component.form.controls.time.setValue('01:75');
      expect(component.form.controls.time.valid).toBe(false);
    });

    it('rechaza el campo vacío (required)', () => {
      component.form.controls.time.setValue('');
      expect(component.form.controls.time.valid).toBe(false);
    });
  });

  describe('addHost / removeHost', () => {
    it('addHost agrega el valor recortado y limpia el input', () => {
      component.hostInput.setValue('  nuevo-host.com  ');
      component.addHost();
      expect(component.ondraHosts).toContain('nuevo-host.com');
      expect(component.hostInput.value).toBe('');
    });

    it('addHost no agrega nada si el input está vacío o solo espacios', () => {
      const before = [...component.ondraHosts];
      component.hostInput.setValue('   ');
      component.addHost();
      expect(component.ondraHosts).toEqual(before);
    });

    it('removeHost saca el host indicado sin tocar los demás', () => {
      setup(makeConfig({ ondraOwnedHosts: ['a.com', 'b.com'] }));
      component.removeHost('a.com');
      expect(component.ondraHosts).toEqual(['b.com']);
    });
  });

  describe('save', () => {
    it('no llama al service si el form es inválido', () => {
      component.form.controls.time.setValue('');
      component.save();
      expect(svc.update).not.toHaveBeenCalled();
    });

    it('convierte el tiempo a minutos y resuelve los nombres de los tags', () => {
      svc.update.and.returnValue(of(makeConfig()));
      component.form.patchValue({ time: '02:15', tagIds: [3, 5] });

      component.save();

      expect(svc.update).toHaveBeenCalledWith('SERVER_HOST_MAINTENANCE', jasmine.objectContaining({
        defaultTimeMinutes: 135,
        odooTagIds: [3, 5],
        odooTagNames: ['Urgente', 'Garantía'],
      }));
    });

    it('manda ticketDescription/timesheetDescription undefined cuando quedan vacíos', () => {
      svc.update.and.returnValue(of(makeConfig()));
      component.form.patchValue({ ticketDescription: '', timesheetDescription: '' });

      component.save();

      const payload = svc.update.calls.mostRecent().args[1];
      expect(payload.ticketDescription).toBeUndefined();
      expect(payload.timesheetDescription).toBeUndefined();
    });

    it('incluye ondraOwnedHosts solo para SERVER_HOST_MAINTENANCE', () => {
      svc.update.and.returnValue(of(makeConfig()));
      component.save();
      expect(svc.update.calls.mostRecent().args[1].ondraOwnedHosts).toEqual(component.ondraHosts);
    });

    it('no incluye ondraOwnedHosts para otros tipos de tarea', () => {
      setup(makeConfig({ taskType: 'QNAP_MAINTENANCE' }));
      svc.update.and.returnValue(of(makeConfig()));

      component.save();

      expect(svc.update.calls.mostRecent().args[1].ondraOwnedHosts).toBeUndefined();
    });

    it('cierra el dialog con el resultado actualizado cuando el guardado es exitoso', () => {
      const updated = makeConfig({ defaultTimeMinutes: 120 });
      svc.update.and.returnValue(of(updated));

      component.save();

      expect(component.saving).toBe(false);
      expect(dialogRef.close).toHaveBeenCalledWith(updated);
    });

    it('saving queda en false y el dialog no se cierra si el guardado falla', () => {
      svc.update.and.returnValue(throwError(() => new Error('fail')));

      component.save();

      expect(component.saving).toBe(false);
      expect(dialogRef.close).not.toHaveBeenCalled();
    });
  });

  it('cancel cierra el dialog con null', () => {
    component.cancel();
    expect(dialogRef.close).toHaveBeenCalledWith(null);
  });
});
