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
    type: 'SERVER_MAINTENANCE', status: 'PENDING',
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

  // ── kanbanPending ────────────────────────────────────────────
  describe('kanbanPending', () => {
    it('incluye tareas PENDING e IN_PROGRESS, excluye terminales', () => {
      component.tasks = [
        makeTask({ id: 't1', status: 'PENDING'     }),
        makeTask({ id: 't2', status: 'IN_PROGRESS' }),
        makeTask({ id: 't3', status: 'DONE'        }),
        makeTask({ id: 't4', status: 'ESCALATED'   }),
        makeTask({ id: 't5', status: 'NOT_DONE'    }),
      ];
      const ids = component.kanbanPending.map(t => t.id);
      expect(ids).toContain('t1');
      expect(ids).toContain('t2');
      expect(ids).not.toContain('t3');
      expect(ids).not.toContain('t4');
      expect(ids).not.toContain('t5');
    });

    it('ordena overdue primero (días negativos antes que positivos)', () => {
      component.tasks = [
        makeTask({ id: 'future', status: 'PENDING', scheduledDate: dateOffsetDays(10) }),
        makeTask({ id: 'past',   status: 'PENDING', scheduledDate: dateOffsetDays(-3) }),
        makeTask({ id: 'week',   status: 'PENDING', scheduledDate: dateOffsetDays(3)  }),
      ];
      const ids = component.kanbanPending.map(t => t.id);
      expect(ids[0]).toBe('past');
      expect(ids[1]).toBe('week');
      expect(ids[2]).toBe('future');
    });
  });

  // ── kanbanDone ───────────────────────────────────────────────
  describe('kanbanDone', () => {
    it('incluye solo tareas DONE', () => {
      component.tasks = [
        makeTask({ id: 't1', status: 'DONE'      }),
        makeTask({ id: 't2', status: 'ESCALATED' }),
        makeTask({ id: 't3', status: 'PENDING'   }),
      ];
      expect(component.kanbanDone.length).toBe(1);
      expect(component.kanbanDone[0].id).toBe('t1');
    });
  });

  // ── kanbanClosed ─────────────────────────────────────────────
  describe('kanbanClosed', () => {
    it('incluye ESCALATED y NOT_DONE, excluye DONE y activas', () => {
      component.tasks = [
        makeTask({ id: 't1', status: 'ESCALATED' }),
        makeTask({ id: 't2', status: 'NOT_DONE'  }),
        makeTask({ id: 't3', status: 'DONE'      }),
        makeTask({ id: 't4', status: 'PENDING'   }),
      ];
      const ids = component.kanbanClosed.map(t => t.id);
      expect(ids).toContain('t1');
      expect(ids).toContain('t2');
      expect(ids).not.toContain('t3');
      expect(ids).not.toContain('t4');
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

    it('mueve la tarea a kanbanDone', () => {
      const task = makeTask({ id: 'task-1', status: 'IN_PROGRESS', scheduledDate: dateOffsetDays(5) });
      component.tasks = [task];
      component.selectedTask = task;
      component.onTaskCompleted();
      expect(component.kanbanDone.length).toBe(1);
      expect(component.kanbanPending.length).toBe(0);
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

    it('mueve la tarea a kanbanClosed', () => {
      const task = makeTask({ id: 'task-1', status: 'PENDING', scheduledDate: dateOffsetDays(5) });
      component.tasks = [task];
      component.selectedTask = task;
      component.onTaskNotDone();
      expect(component.kanbanClosed.length).toBe(1);
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

    it('renderiza los headers de las tres columnas kanban', () => {
      fixture.detectChanges();
      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('Pendientes');
      expect(text).toContain('Completadas');
      expect(text).toContain('Cerradas');
    });

    it('renderiza un app-task-card por tarea (todas las columnas)', () => {
      component.tasks = [
        makeTask({ id: 't1', status: 'PENDING'     }),
        makeTask({ id: 't2', status: 'IN_PROGRESS' }),
      ];
      fixture.detectChanges();
      const cards = fixture.nativeElement.querySelectorAll('app-task-card');
      expect(cards.length).toBe(2);
    });

    it('muestra el empty state cuando no hay tareas pendientes', () => {
      component.tasks = [];
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Sin tareas pendientes');
    });
  });
});
