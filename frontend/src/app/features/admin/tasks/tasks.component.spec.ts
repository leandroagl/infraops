import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { TasksComponent } from './tasks.component';
import { TasksService } from '../../../core/services/tasks.service';
import { Task } from '../../../core/models/task.models';
import { SharedModule } from '../../../shared/shared.module';

const mockTask = (id: string): Task => ({
  id,
  clientId: 'client-1',
  technicianId: 'tech-1',
  type: 'SERVER_MAINTENANCE',
  status: 'PENDING',
  scheduledDate: '2026-06-15',
  completedDate: null,
  odooTicketId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  client: { id: 'client-1', name: 'Acme' },
  technician: { id: 'tech-1', user: { id: 'user-1', name: 'Valen', email: 'valen@ondra.com.ar' } },
});

describe('TasksComponent', () => {
  let component: TasksComponent;
  let fixture: ComponentFixture<TasksComponent>;
  let tasksServiceSpy: jasmine.SpyObj<TasksService>;
  let dialog: MatDialog;

  beforeEach(async () => {
    tasksServiceSpy = jasmine.createSpyObj('TasksService', ['getAll', 'create']);
    tasksServiceSpy.getAll.and.returnValue(of([mockTask('task-1'), mockTask('task-2')]));

    await TestBed.configureTestingModule({
      declarations: [TasksComponent],
      imports: [
        NoopAnimationsModule,
        MatDialogModule,
        MatTableModule,
        MatSortModule,
        MatFormFieldModule,
        MatSelectModule,
        MatButtonModule,
        FormsModule,
        SharedModule,
      ],
      providers: [
        { provide: TasksService, useValue: tasksServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TasksComponent);
    component = fixture.componentInstance;
    dialog = TestBed.inject(MatDialog);
    fixture.detectChanges();
  });

  it('ngOnInit llama a load()', () => {
    expect(tasksServiceSpy.getAll).toHaveBeenCalledTimes(1);
  });

  it('load() asigna las tareas a dataSource.data', () => {
    expect(component.dataSource.data.length).toBe(2);
    expect(component.dataSource.data[0].id).toBe('task-1');
  });

  it('load() setea loading=false y error="" cuando el servicio tiene éxito', () => {
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

  describe('openCreateDialog()', () => {
    it('inserta la nueva tarea en dataSource.data sin llamar a load()', () => {
      const newTask = mockTask('task-3');
      const mockRef = {
        afterClosed: () => of(newTask),
      } as MatDialogRef<unknown>;
      spyOn(dialog, 'open').and.returnValue(mockRef);
      const loadSpy = spyOn(component, 'load').and.callThrough();

      const initialCount = component.dataSource.data.length;
      component.openCreateDialog();

      expect(component.dataSource.data.length).toBe(initialCount + 1);
      expect(component.dataSource.data[component.dataSource.data.length - 1].id).toBe('task-3');
      expect(loadSpy).not.toHaveBeenCalled();
    });

    it('no modifica dataSource.data cuando el dialog cierra con null', () => {
      const mockRef = {
        afterClosed: () => of(null),
      } as MatDialogRef<unknown>;
      spyOn(dialog, 'open').and.returnValue(mockRef);

      const initialCount = component.dataSource.data.length;
      component.openCreateDialog();

      expect(component.dataSource.data.length).toBe(initialCount);
    });
  });
});
