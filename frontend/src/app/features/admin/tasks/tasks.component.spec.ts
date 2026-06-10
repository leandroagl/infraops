import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
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
    tasksServiceSpy = jasmine.createSpyObj('TasksService', ['getAll', 'create', 'delete']);
    tasksServiceSpy.getAll.and.returnValue(of([mockTask('task-1'), mockTask('task-2')]));

    await TestBed.configureTestingModule({
      declarations: [TasksComponent],
      imports: [
        NoopAnimationsModule,
        MatDialogModule,
        MatMenuModule,
        MatSnackBarModule,
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

  describe('deleteTask()', () => {
    it('elimina la tarea del dataSource cuando el usuario confirma', () => {
      tasksServiceSpy.delete.and.returnValue(of(void 0));
      const mockRef = { afterClosed: () => of(true) } as MatDialogRef<unknown>;
      spyOn(dialog, 'open').and.returnValue(mockRef);

      component.deleteTask(mockTask('task-1'));

      expect(tasksServiceSpy.delete).toHaveBeenCalledWith('task-1');
      expect(component.dataSource.data.find(t => t.id === 'task-1')).toBeUndefined();
      expect(component.dataSource.data.length).toBe(1);
    });

    it('no modifica dataSource cuando el usuario cancela', () => {
      const mockRef = { afterClosed: () => of(undefined) } as MatDialogRef<unknown>;
      spyOn(dialog, 'open').and.returnValue(mockRef);

      const initialCount = component.dataSource.data.length;
      component.deleteTask(mockTask('task-1'));

      expect(tasksServiceSpy.delete).not.toHaveBeenCalled();
      expect(component.dataSource.data.length).toBe(initialCount);
    });

    it('muestra snackbar de error cuando el servicio falla y no modifica el dataSource', () => {
      tasksServiceSpy.delete.and.returnValue(throwError(() => new Error('Error')));
      const mockRef = { afterClosed: () => of(true) } as MatDialogRef<unknown>;
      spyOn(dialog, 'open').and.returnValue(mockRef);
      const snackBar = TestBed.inject(MatSnackBar);
      spyOn(snackBar, 'open');

      component.deleteTask(mockTask('task-1'));

      expect(snackBar.open).toHaveBeenCalledWith(
        'No se pudo eliminar la tarea',
        'Cerrar',
        jasmine.any(Object),
      );
      expect(component.dataSource.data.length).toBe(2);
    });
  });

  describe('odooTicket column', () => {
    it('renderiza el link del ticket cuando odooTicketId está definido', () => {
      tasksServiceSpy.getAll.and.returnValue(
        of([{ ...mockTask('t1'), odooTicketId: 5137 }])
      );
      component.load();
      fixture.detectChanges();

      const link = fixture.nativeElement.querySelector('.odoo-ticket-link');
      expect(link).toBeTruthy();
      expect(link.textContent.trim()).toBe('#05137');
    });

    it('el href del link contiene el id del ticket', () => {
      tasksServiceSpy.getAll.and.returnValue(
        of([{ ...mockTask('t1'), odooTicketId: 5137 }])
      );
      component.load();
      fixture.detectChanges();

      const link: HTMLAnchorElement = fixture.nativeElement.querySelector('.odoo-ticket-link');
      expect(link.getAttribute('href')).toContain('5137');
    });

    it('renderiza — cuando odooTicketId es null', () => {
      // mockTask ya tiene odooTicketId: null
      fixture.detectChanges();
      const link = fixture.nativeElement.querySelector('.odoo-ticket-link');
      expect(link).toBeNull();
      const dash = Array.from(fixture.nativeElement.querySelectorAll('td'))
        .find((td: any) => td.textContent?.trim() === '—');
      expect(dash).toBeTruthy();
    });
  });
});
