import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TasksUnifiedComponent } from './tasks-unified.component';
import { TasksService } from '../../core/services/tasks.service';
import { AuthService } from '../../core/services/auth.service';
import { Task } from '../../core/models/task.models';

function makeTask(id: string, clientId: string, clientName: string, status: Task['status'] = 'PENDING'): Task {
  return {
    id, clientId, technicianId: 'tech-1',
    type: 'SERVER_HOST_MAINTENANCE', status,
    scheduledDate: '2026-08-01', completedDate: null,
    odooTicketId: null, createdAt: '2026-08-01T00:00:00Z',
    client: { id: clientId, name: clientName },
    technician: { id: 'tech-1', user: { id: 'u1', name: 'Valen', email: 'v@ondra' } },
  };
}

describe('TasksUnifiedComponent', () => {
  let component: TasksUnifiedComponent;
  let fixture: ComponentFixture<TasksUnifiedComponent>;
  let tasksServiceSpy: jasmine.SpyObj<TasksService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  const now = new Date();

  beforeEach(async () => {
    tasksServiceSpy = jasmine.createSpyObj('TasksService', ['getAll', 'delete']);
    authServiceSpy  = jasmine.createSpyObj('AuthService', ['getCurrentUser']);

    tasksServiceSpy.getAll.and.returnValue(of([
      makeTask('t1', 'c1', 'ACME S.A.', 'DONE'),
      makeTask('t2', 'c1', 'ACME S.A.', 'PENDING'),
      makeTask('t3', 'c2', 'Distribuidora', 'IN_PROGRESS'),
    ]));
    authServiceSpy.getCurrentUser.and.returnValue({
      id: 'u1', email: 'omar@ondra', role: 'ADMIN', technicianId: null,
    });

    await TestBed.configureTestingModule({
      declarations: [TasksUnifiedComponent],
      imports: [NoopAnimationsModule, ReactiveFormsModule, MatButtonModule, MatIconModule],
      providers: [
        { provide: TasksService, useValue: tasksServiceSpy },
        { provide: AuthService,  useValue: authServiceSpy  },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TasksUnifiedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carga las tareas del mes y año actuales al iniciar', () => {
    expect(tasksServiceSpy.getAll).toHaveBeenCalledWith(
      jasmine.objectContaining({ month: now.getMonth() + 1, year: now.getFullYear() })
    );
  });

  it('agrupa las tareas por cliente', () => {
    expect(component.groups.length).toBe(2);
    expect(component.groups[0].clientId).toBe('c1');
    expect(component.groups[0].tasks.length).toBe(2);
    expect(component.groups[1].clientId).toBe('c2');
  });

  it('calcula stats correctamente', () => {
    expect(component.stats.assigned).toBe(3);
    expect(component.stats.done).toBe(1);
    expect(component.stats.pending).toBe(1);
    expect(component.stats.inprogress).toBe(1);
  });

  it('navegar al mes anterior recarga con el mes correcto', () => {
    const prevMonth = component.currentMonth === 1 ? 12 : component.currentMonth - 1;
    const prevYear  = component.currentMonth === 1 ? component.currentYear - 1 : component.currentYear;
    component.prevMonth();
    expect(tasksServiceSpy.getAll).toHaveBeenCalledWith(
      jasmine.objectContaining({ month: prevMonth, year: prevYear })
    );
  });

  it('applica filtro technicianId para roles TECHNICIAN', () => {
    authServiceSpy.getCurrentUser.and.returnValue({
      id: 'u2', email: 'valen@ondra', role: 'TECHNICIAN', technicianId: 'tech-1',
    });
    tasksServiceSpy.getAll.and.returnValue(of([]));
    component.ngOnInit();
    expect(tasksServiceSpy.getAll).toHaveBeenCalledWith(
      jasmine.objectContaining({ technicianId: 'tech-1' })
    );
  });

  it('cycleClosed es true cuando el mes seleccionado es anterior al actual', () => {
    component.currentYear  = now.getFullYear();
    component.currentMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // mes anterior
    if (component.currentMonth === 12) component.currentYear = now.getFullYear() - 1;
    expect(component.cycleClosed).toBeTrue();
  });

  it('cycleClosed es false para el mes actual', () => {
    component.currentMonth = now.getMonth() + 1;
    component.currentYear  = now.getFullYear();
    expect(component.cycleClosed).toBeFalse();
  });

  it('muestra error si la carga falla', () => {
    tasksServiceSpy.getAll.and.returnValue(throwError(() => new Error('red')));
    component.load();
    expect(component.error).toBeTruthy();
  });
});
