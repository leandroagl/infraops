import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TasksComponent } from './tasks.component';
import { TasksService } from '../../../core/services/tasks.service';
import { ClientsService } from '../../../core/services/clients.service';
import { TechniciansService } from '../../../core/services/technicians.service';
import { Task } from '../../../core/models/task.models';

function mockTask(id: string): Task {
  return {
    id, clientId: 'client-1', technicianId: 'tech-1',
    type: 'WINDOWS_DOMAIN_MAINTENANCE', status: 'PENDING',
    scheduledDate: '2026-06-15', completedDate: null,
    odooTicketId: null, createdAt: '2026-01-01T00:00:00.000Z',
    client: { id: 'client-1', name: 'Acme' },
    technician: { id: 'tech-1', user: { id: 'user-1', name: 'Valen', email: 'valen@ondra.com.ar' } },
  };
}

describe('TasksComponent', () => {
  let component: TasksComponent;
  let fixture: ComponentFixture<TasksComponent>;
  let tasksServiceSpy: jasmine.SpyObj<TasksService>;
  let clientsServiceSpy: jasmine.SpyObj<ClientsService>;
  let techniciansServiceSpy: jasmine.SpyObj<TechniciansService>;
  let dialog: MatDialog;

  beforeEach(async () => {
    tasksServiceSpy       = jasmine.createSpyObj('TasksService',       ['getAll', 'create', 'delete']);
    clientsServiceSpy     = jasmine.createSpyObj('ClientsService',     ['getAll']);
    techniciansServiceSpy = jasmine.createSpyObj('TechniciansService', ['getAll']);

    tasksServiceSpy.getAll.and.returnValue(of([mockTask('task-1'), mockTask('task-2')]));
    clientsServiceSpy.getAll.and.returnValue(of([]));
    techniciansServiceSpy.getAll.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      declarations: [TasksComponent],
      imports: [NoopAnimationsModule, MatDialogModule, MatSnackBarModule],
      providers: [
        { provide: TasksService,       useValue: tasksServiceSpy       },
        { provide: ClientsService,     useValue: clientsServiceSpy     },
        { provide: TechniciansService, useValue: techniciansServiceSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TasksComponent);
    component = fixture.componentInstance;
    dialog = TestBed.inject(MatDialog);
    fixture.detectChanges();
  });

  it('ngOnInit carga tareas, clientes y técnicos', () => {
    expect(tasksServiceSpy.getAll).toHaveBeenCalledTimes(1);
    expect(clientsServiceSpy.getAll).toHaveBeenCalledTimes(1);
    expect(techniciansServiceSpy.getAll).toHaveBeenCalledTimes(1);
  });

  it('load() asigna las tareas al array tasks', () => {
    expect(component.tasks.length).toBe(2);
    expect(component.tasks[0].id).toBe('task-1');
  });

  it('load() setea loading=false y error="" cuando tiene éxito', () => {
    component.load();
    expect(component.loading).toBeFalse();
    expect(component.error).toBe('');
  });

  it('load() setea error cuando el servicio falla', () => {
    tasksServiceSpy.getAll.and.returnValue(throwError(() => new Error('Network')));
    component.load();
    expect(component.error).toBeTruthy();
    expect(component.loading).toBeFalse();
  });

  describe('filtros', () => {
    it('pasa filterStatus al servicio', () => {
      component.filterStatus = 'PENDING';
      component.load();
      expect(tasksServiceSpy.getAll).toHaveBeenCalledWith(jasmine.objectContaining({ status: 'PENDING' }));
    });

    it('pasa filterClientId al servicio', () => {
      component.filterClientId = 'client-1';
      component.load();
      expect(tasksServiceSpy.getAll).toHaveBeenCalledWith(jasmine.objectContaining({ clientId: 'client-1' }));
    });

    it('pasa filterTechnicianId al servicio', () => {
      component.filterTechnicianId = 'tech-1';
      component.load();
      expect(tasksServiceSpy.getAll).toHaveBeenCalledWith(jasmine.objectContaining({ technicianId: 'tech-1' }));
    });

    it('combina múltiples filtros', () => {
      component.filterStatus = 'DONE';
      component.filterClientId = 'client-1';
      component.load();
      expect(tasksServiceSpy.getAll).toHaveBeenCalledWith(jasmine.objectContaining({ status: 'DONE', clientId: 'client-1' }));
    });

    it('llama al servicio con objeto vacío cuando no hay filtros', () => {
      component.filterStatus = '';
      component.filterClientId = '';
      component.filterTechnicianId = '';
      component.load();
      expect(tasksServiceSpy.getAll).toHaveBeenCalledWith({});
    });
  });

  describe('drawer', () => {
    it('selectTask() setea selectedTask', () => {
      const task = mockTask('task-1');
      component.selectTask(task);
      expect(component.selectedTask).toBe(task);
    });

    it('closeDrawer() limpia selectedTask', () => {
      component.selectedTask = mockTask('task-1');
      component.closeDrawer();
      expect(component.selectedTask).toBeNull();
    });
  });

  describe('openCreateDialog()', () => {
    it('inserta la nueva tarea en tasks sin llamar a load()', () => {
      const newTask = mockTask('task-3');
      const mockRef = { afterClosed: () => of(newTask) } as MatDialogRef<unknown>;
      spyOn(dialog, 'open').and.returnValue(mockRef);
      const loadSpy = spyOn(component, 'load').and.callThrough();

      const initialCount = component.tasks.length;
      component.openCreateDialog();

      expect(component.tasks.length).toBe(initialCount + 1);
      expect(component.tasks[component.tasks.length - 1].id).toBe('task-3');
      expect(loadSpy).not.toHaveBeenCalled();
    });

    it('no modifica tasks cuando el dialog cierra con null', () => {
      const mockRef = { afterClosed: () => of(null) } as MatDialogRef<unknown>;
      spyOn(dialog, 'open').and.returnValue(mockRef);

      const initialCount = component.tasks.length;
      component.openCreateDialog();

      expect(component.tasks.length).toBe(initialCount);
    });
  });

  describe('deleteTask()', () => {
    it('elimina la tarea del array tasks cuando el usuario confirma', () => {
      tasksServiceSpy.delete.and.returnValue(of(void 0));
      const mockRef = { afterClosed: () => of(true) } as MatDialogRef<unknown>;
      spyOn(dialog, 'open').and.returnValue(mockRef);

      component.deleteTask(mockTask('task-1'));

      expect(tasksServiceSpy.delete).toHaveBeenCalledWith('task-1');
      expect(component.tasks.find(t => t.id === 'task-1')).toBeUndefined();
      expect(component.tasks.length).toBe(1);
    });

    it('no modifica tasks cuando el usuario cancela', () => {
      const mockRef = { afterClosed: () => of(undefined) } as MatDialogRef<unknown>;
      spyOn(dialog, 'open').and.returnValue(mockRef);

      const initialCount = component.tasks.length;
      component.deleteTask(mockTask('task-1'));

      expect(tasksServiceSpy.delete).not.toHaveBeenCalled();
      expect(component.tasks.length).toBe(initialCount);
    });

    it('muestra snackbar de error cuando el servicio falla', () => {
      tasksServiceSpy.delete.and.returnValue(throwError(() => new Error('Error')));
      const mockRef = { afterClosed: () => of(true) } as MatDialogRef<unknown>;
      spyOn(dialog, 'open').and.returnValue(mockRef);
      const snackBar = TestBed.inject(MatSnackBar);
      spyOn(snackBar, 'open');

      component.deleteTask(mockTask('task-1'));

      expect(snackBar.open).toHaveBeenCalledWith(
        'No se pudo eliminar la tarea', 'Cerrar', jasmine.any(Object),
      );
      expect(component.tasks.length).toBe(2);
    });
  });
});
