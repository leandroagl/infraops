import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TaskListComponent } from './task-list.component';
import { TasksService } from '../../../core/services/tasks.service';
import { AuthService } from '../../../core/services/auth.service';
import { Task } from '../../../core/models/task.models';

function dateOffsetDays(offset: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1', clientId: 'client-1', technicianId: 'tech-1',
    type: 'WINDOWS_DOMAIN_MAINTENANCE', status: 'PENDING',
    scheduledDate: dateOffsetDays(10), completedDate: null,
    odooTicketId: null, createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('TaskListComponent', () => {
  let component: TaskListComponent;
  let fixture: ComponentFixture<TaskListComponent>;
  let tasksServiceSpy: jasmine.SpyObj<TasksService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    tasksServiceSpy = jasmine.createSpyObj('TasksService', ['getAll']);
    authServiceSpy  = jasmine.createSpyObj('AuthService',  ['getCurrentUser']);

    tasksServiceSpy.getAll.and.returnValue(of([]));
    authServiceSpy.getCurrentUser.and.returnValue({
      id: 'user-1', email: 'valen@ondra.com.ar',
      role: 'TECHNICIAN', technicianId: 'tech-1',
      odooKeyValid: false, odooExempt: false,
    });

    await TestBed.configureTestingModule({
      declarations: [TaskListComponent],
      providers: [
        { provide: TasksService, useValue: tasksServiceSpy },
        { provide: AuthService,  useValue: authServiceSpy  },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture   = TestBed.createComponent(TaskListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ── KPI getters ─────────────────────────────────────────────
  describe('KPI getters', () => {
    beforeEach(() => {
      component.tasks = [
        makeTask({ id: 't1', status: 'PENDING',     scheduledDate: dateOffsetDays(-3) }),
        makeTask({ id: 't2', status: 'IN_PROGRESS', scheduledDate: dateOffsetDays(-1) }),
        makeTask({ id: 't3', status: 'PENDING',     scheduledDate: dateOffsetDays(3)  }),
        makeTask({ id: 't4', status: 'IN_PROGRESS', scheduledDate: dateOffsetDays(0)  }),
        makeTask({ id: 't5', status: 'PENDING',     scheduledDate: dateOffsetDays(15) }),
        makeTask({ id: 't6', status: 'DONE',        scheduledDate: dateOffsetDays(-5) }),
        makeTask({ id: 't7', status: 'ESCALATED',   scheduledDate: dateOffsetDays(-2) }),
        makeTask({ id: 't8', status: 'NOT_DONE',    scheduledDate: dateOffsetDays(1)  }),
      ];
    });

    it('overdueCount cuenta solo tareas activas con scheduledDate < hoy', () => {
      expect(component.overdueCount).toBe(2);
    });

    it('thisWeekCount cuenta tareas activas con 0 <= días <= 7', () => {
      expect(component.thisWeekCount).toBe(2);
    });

    it('onTimeCount cuenta tareas activas con días > 7', () => {
      expect(component.onTimeCount).toBe(1);
    });
  });

  // ── technicianName ───────────────────────────────────────────
  describe('technicianName', () => {
    it('retorna nombre de tasks[0].technician.user.name cuando existe', () => {
      component.tasks = [makeTask({
        technician: { id: 'tech-1', user: { id: 'u1', name: 'Valentina López', email: 'valen@ondra.com.ar' } },
      })];
      expect(component.technicianName).toBe('Valentina López');
    });

    it('fallback al prefijo del email cuando tasks está vacío', () => {
      component.tasks = [];
      expect(component.technicianName).toBe('valen');
    });

    it('fallback al prefijo del email cuando technician es undefined', () => {
      component.tasks = [makeTask({ technician: undefined })];
      expect(component.technicianName).toBe('valen');
    });
  });

  // ── onTaskCompleted ──────────────────────────────────────────
  describe('onTaskCompleted()', () => {
    it('actualiza el status de la tarea seleccionada a DONE en el array', () => {
      const task = makeTask({ id: 'task-1', status: 'IN_PROGRESS', scheduledDate: dateOffsetDays(5) });
      component.tasks = [task];
      component.selectedTask = task;
      component.onTaskCompleted();
      expect(component.tasks[0].status).toBe('DONE');
    });

    it('cierra el drawer', () => {
      const task = makeTask({ id: 'task-1', status: 'IN_PROGRESS', scheduledDate: dateOffsetDays(5) });
      component.tasks = [task];
      component.selectedTask = task;
      component.onTaskCompleted();
      expect(component.selectedTask).toBeNull();
    });

    it('no hace nada si selectedTask es null', () => {
      component.tasks = [makeTask({ id: 'task-1', status: 'PENDING' })];
      component.selectedTask = null;
      component.onTaskCompleted();
      expect(component.tasks[0].status).toBe('PENDING');
    });
  });

  // ── onTaskNotDone ────────────────────────────────────────────
  describe('onTaskNotDone()', () => {
    it('actualiza el status a NOT_DONE', () => {
      const task = makeTask({ id: 'task-1', status: 'PENDING', scheduledDate: dateOffsetDays(5) });
      component.tasks = [task];
      component.selectedTask = task;
      component.onTaskNotDone();
      expect(component.tasks[0].status).toBe('NOT_DONE');
    });

    it('cierra el drawer', () => {
      const task = makeTask({ id: 'task-1', status: 'PENDING', scheduledDate: dateOffsetDays(5) });
      component.tasks = [task];
      component.selectedTask = task;
      component.onTaskNotDone();
      expect(component.selectedTask).toBeNull();
    });

    it('no modifica tasks cuando selectedTask es null', () => {
      component.tasks = [makeTask({ id: 't1' })];
      component.selectedTask = null;
      component.onTaskNotDone();
      expect(component.tasks[0].status).toBe('PENDING'); // sin modificar
    });

  });

  // ── onTaskStatusChanged ──────────────────────────────────────
  describe('onTaskStatusChanged()', () => {
    it('actualiza el status localmente sin cerrar el drawer', () => {
      const task = makeTask({ id: 'task-1', status: 'PENDING', scheduledDate: dateOffsetDays(5) });
      component.tasks = [task];
      component.selectedTask = task;
      component.onTaskStatusChanged('IN_PROGRESS');
      expect(component.tasks[0].status).toBe('IN_PROGRESS');
      expect(component.selectedTask).toBe(task);
    });

    it('no modifica tasks cuando selectedTask es null', () => {
      component.tasks = [makeTask({ id: 't1' })];
      component.selectedTask = null;
      component.onTaskStatusChanged('IN_PROGRESS');
      expect(component.tasks[0].status).toBe('PENDING');
    });
  });

  // ── Drawer ───────────────────────────────────────────────────
  describe('drawer', () => {
    it('selectTask() asigna selectedTask', () => {
      const task = makeTask();
      component.selectTask(task);
      expect(component.selectedTask).toBe(task);
    });

    it('closeDrawer() limpia selectedTask', () => {
      component.selectedTask = makeTask();
      component.closeDrawer();
      expect(component.selectedTask).toBeNull();
    });

    it('drawer tiene clase "open" cuando selectedTask está seteado', () => {
      component.selectedTask = makeTask();
      fixture.detectChanges();
      const drawer = fixture.nativeElement.querySelector('.drawer');
      expect(drawer.classList.contains('open')).toBe(true);
    });
  });

  // ── filteredTasks ─────────────────────────────────────────────
  describe('filteredTasks', () => {
    beforeEach(() => {
      component.tasks = [
        makeTask({ id: 't1', clientId: 'c1', type: 'QNAP_MAINTENANCE',
                   client: { id: 'c1', name: 'ACME SA' } }),
        makeTask({ id: 't2', clientId: 'c2', type: 'VEEAM_BACKUP',
                   client: { id: 'c2', name: 'Beta Corp' } }),
        makeTask({ id: 't3', clientId: 'c1', type: 'VEEAM_BACKUP',
                   client: { id: 'c1', name: 'ACME SA' } }),
      ];
    });

    it('sin filtros retorna todas las tareas', () => {
      expect(component.filteredTasks.length).toBe(3);
    });

    it('filtra por cliente cuando selectedClientId está seteado', () => {
      component.selectedClientId = 'c1';
      const ids = component.filteredTasks.map(t => t.id);
      expect(ids).toContain('t1');
      expect(ids).toContain('t3');
      expect(ids).not.toContain('t2');
    });

    it('filtra por tipo cuando typeCtrl tiene valor', () => {
      component.typeCtrl.setValue('VEEAM_BACKUP');
      const ids = component.filteredTasks.map(t => t.id);
      expect(ids).toContain('t2');
      expect(ids).toContain('t3');
      expect(ids).not.toContain('t1');
    });

    it('aplica ambos filtros simultáneamente (AND)', () => {
      component.selectedClientId = 'c1';
      component.typeCtrl.setValue('VEEAM_BACKUP');
      const ids = component.filteredTasks.map(t => t.id);
      expect(ids).toEqual(['t3']);
    });

    it('con ambos filtros en null retorna todas (equivalente a sin filtros)', () => {
      component.selectedClientId = null;
      component.typeCtrl.setValue(null);
      expect(component.filteredTasks.length).toBe(3);
    });
  });

  // ── clientOptions ─────────────────────────────────────────────
  describe('clientOptions', () => {
    beforeEach(() => {
      component.tasks = [
        makeTask({ id: 't1', clientId: 'c1', client: { id: 'c1', name: 'Zeta SA' } }),
        makeTask({ id: 't2', clientId: 'c2', client: { id: 'c2', name: 'ACME Corp' } }),
        makeTask({ id: 't3', clientId: 'c1', client: { id: 'c1', name: 'Zeta SA' } }),
        makeTask({ id: 't4', clientId: 'c3' }), // sin client — debe excluirse
      ];
    });

    it('retorna clientes únicos ordenados alfabéticamente', () => {
      const names = component.clientOptions.map(c => c.name);
      expect(names).toEqual(['ACME Corp', 'Zeta SA']);
    });

    it('excluye tasks sin client', () => {
      expect(component.clientOptions.length).toBe(2);
    });

    it('filtra por texto de búsqueda (case-insensitive)', () => {
      component.clientSearchCtrl.setValue('acme', { emitEvent: false });
      const names = component.clientOptions.map(c => c.name);
      expect(names).toEqual(['ACME Corp']);
    });

    it('retorna todos cuando la búsqueda está vacía', () => {
      component.clientSearchCtrl.setValue('', { emitEvent: false });
      expect(component.clientOptions.length).toBe(2);
    });
  });

  // ── Template ─────────────────────────────────────────────────
  describe('template', () => {
    it('renderiza KPI label "Vencidas"', () => {
      expect(fixture.nativeElement.textContent).toContain('Vencidas');
    });

    it('renderiza KPI label "Esta semana"', () => {
      expect(fixture.nativeElement.textContent).toContain('Esta semana');
    });

    it('renderiza KPI label "En plazo"', () => {
      expect(fixture.nativeElement.textContent).toContain('En plazo');
    });

    it('renderiza el nombre del técnico en el greeting', () => {
      component.tasks = [makeTask({
        technician: { id: 'tech-1', user: { id: 'u1', name: 'Valentina López', email: 'valen@ondra.com.ar' } },
      })];
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Valentina López');
    });

    it('renderiza app-kanban-board en el template', () => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-kanban-board')).toBeTruthy();
    });

  });
});
