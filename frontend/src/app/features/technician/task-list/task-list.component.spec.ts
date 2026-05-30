import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TaskListComponent } from './task-list.component';
import { TasksService } from '../../../core/services/tasks.service';
import { AuthService } from '../../../core/services/auth.service';
import { Task } from '../../../core/models/task.models';
import { NO_ERRORS_SCHEMA } from '@angular/core';

// Helpers para construir fechas relativas al día de hoy
function dateOffsetDays(offset: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    clientId: 'client-1',
    technicianId: 'tech-1',
    type: 'SERVER_MAINTENANCE',
    status: 'PENDING',
    scheduledDate: dateOffsetDays(10),
    completedDate: null,
    odooTicketId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
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
    authServiceSpy  = jasmine.createSpyObj('AuthService', ['getCurrentUser']);

    tasksServiceSpy.getAll.and.returnValue(of([]));
    authServiceSpy.getCurrentUser.and.returnValue({
      id: 'user-1',
      email: 'valen@ondra.com.ar',
      role: 'TECHNICIAN',
      technicianId: 'tech-1',
    });

    await TestBed.configureTestingModule({
      declarations: [TaskListComponent],
      providers: [
        { provide: TasksService, useValue: tasksServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture   = TestBed.createComponent(TaskListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ---------------------------------------------------------------------------
  // daysFromToday
  // ---------------------------------------------------------------------------
  describe('daysFromToday()', () => {
    it('should return negative days for past dates', () => {
      const pastDate = dateOffsetDays(-5);
      expect(component.daysFromToday(pastDate)).toBe(-5);
    });

    it('should return 0 for today', () => {
      const today = dateOffsetDays(0);
      expect(component.daysFromToday(today)).toBe(0);
    });

    it('should return positive days for future dates', () => {
      const futureDate = dateOffsetDays(10);
      expect(component.daysFromToday(futureDate)).toBe(10);
    });
  });

  // ---------------------------------------------------------------------------
  // urgencyLabel
  // ---------------------------------------------------------------------------
  describe('urgencyLabel()', () => {
    it('should return "+Xd vencido" when days < 0', () => {
      expect(component.urgencyLabel(-3)).toBe('+3d vencido');
    });

    it('should return "vence en Xd" when days === 0', () => {
      expect(component.urgencyLabel(0)).toBe('vence en 0d');
    });

    it('should return "vence en Xd" when 0 < days <= 7', () => {
      expect(component.urgencyLabel(5)).toBe('vence en 5d');
    });

    it('should return "Xd restantes" when days > 7', () => {
      expect(component.urgencyLabel(14)).toBe('14d restantes');
    });
  });

  // ---------------------------------------------------------------------------
  // urgencyClass
  // ---------------------------------------------------------------------------
  describe('urgencyClass()', () => {
    it('should return urg-crit when overdue (days < 0)', () => {
      expect(component.urgencyClass(-1)).toBe('urg-crit');
    });

    it('should return urg-warn when due this week (days === 0)', () => {
      expect(component.urgencyClass(0)).toBe('urg-warn');
    });

    it('should return urg-warn when due this week (0 < days <= 7)', () => {
      expect(component.urgencyClass(7)).toBe('urg-warn');
    });

    it('should return urg-ok when on time (days > 7)', () => {
      expect(component.urgencyClass(8)).toBe('urg-ok');
    });
  });

  // ---------------------------------------------------------------------------
  // KPI getters
  // ---------------------------------------------------------------------------
  describe('KPI getters', () => {
    beforeEach(() => {
      component.tasks = [
        makeTask({ id: 't1', status: 'PENDING',     scheduledDate: dateOffsetDays(-3) }),  // overdue
        makeTask({ id: 't2', status: 'IN_PROGRESS', scheduledDate: dateOffsetDays(-1) }),  // overdue
        makeTask({ id: 't3', status: 'PENDING',     scheduledDate: dateOffsetDays(3)  }),  // this week
        makeTask({ id: 't4', status: 'IN_PROGRESS', scheduledDate: dateOffsetDays(0)  }),  // this week (today)
        makeTask({ id: 't5', status: 'PENDING',     scheduledDate: dateOffsetDays(15) }),  // on time
        makeTask({ id: 't6', status: 'DONE',        scheduledDate: dateOffsetDays(-5) }),  // terminal — excluded
        makeTask({ id: 't7', status: 'ESCALATED',   scheduledDate: dateOffsetDays(-2) }),  // terminal — excluded
        makeTask({ id: 't8', status: 'NOT_DONE',    scheduledDate: dateOffsetDays(1)  }),  // terminal — excluded
      ];
    });

    it('overdueCount should count only active tasks with scheduledDate < today', () => {
      expect(component.overdueCount).toBe(2);
    });

    it('thisWeekCount should count active tasks with 0 <= days <= 7', () => {
      expect(component.thisWeekCount).toBe(2);
    });

    it('onTimeCount should count active tasks with days > 7', () => {
      expect(component.onTimeCount).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // technicianName
  // ---------------------------------------------------------------------------
  describe('technicianName', () => {
    it('should return name from tasks[0].technician.user.name when available', () => {
      component.tasks = [
        makeTask({
          technician: { id: 'tech-1', user: { id: 'user-1', name: 'Valentina López', email: 'valen@ondra.com.ar' } },
        }),
      ];
      expect(component.technicianName).toBe('Valentina López');
    });

    it('should fallback to email prefix when tasks is empty', () => {
      component.tasks = [];
      expect(component.technicianName).toBe('valen');
    });

    it('should fallback to email prefix when technician is null', () => {
      component.tasks = [makeTask({ technician: undefined })];
      expect(component.technicianName).toBe('valen');
    });
  });

  // ---------------------------------------------------------------------------
  // Section getters
  // ---------------------------------------------------------------------------
  describe('overdueTasks', () => {
    it('should only include active tasks with scheduledDate < today', () => {
      component.tasks = [
        makeTask({ id: 't1', status: 'PENDING',   scheduledDate: dateOffsetDays(-2) }),
        makeTask({ id: 't2', status: 'PENDING',   scheduledDate: dateOffsetDays(5)  }),
        makeTask({ id: 't3', status: 'DONE',      scheduledDate: dateOffsetDays(-1) }),
        makeTask({ id: 't4', status: 'ESCALATED', scheduledDate: dateOffsetDays(-3) }),
      ];
      const result = component.overdueTasks;
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('t1');
    });
  });

  describe('pendingTasks', () => {
    it('should include active tasks with scheduledDate >= today (PENDING and IN_PROGRESS)', () => {
      component.tasks = [
        makeTask({ id: 't1', status: 'PENDING',     scheduledDate: dateOffsetDays(0)  }),
        makeTask({ id: 't2', status: 'IN_PROGRESS', scheduledDate: dateOffsetDays(3)  }),
        makeTask({ id: 't3', status: 'PENDING',     scheduledDate: dateOffsetDays(-1) }),  // overdue, excluded
        makeTask({ id: 't4', status: 'DONE',        scheduledDate: dateOffsetDays(2)  }),  // terminal, excluded
      ];
      const result = component.pendingTasks;
      expect(result.length).toBe(2);
      expect(result.map(t => t.id)).toEqual(['t1', 't2']);
    });
  });

  describe('doneTasks', () => {
    it('should include DONE, ESCALATED, NOT_DONE tasks', () => {
      component.tasks = [
        makeTask({ id: 't1', status: 'DONE'      }),
        makeTask({ id: 't2', status: 'ESCALATED' }),
        makeTask({ id: 't3', status: 'NOT_DONE'  }),
        makeTask({ id: 't4', status: 'PENDING'   }),
      ];
      const result = component.doneTasks;
      expect(result.length).toBe(3);
      expect(result.map(t => t.status)).toEqual(['DONE', 'ESCALATED', 'NOT_DONE']);
    });
  });

  // ---------------------------------------------------------------------------
  // statusDotColor
  // ---------------------------------------------------------------------------
  describe('statusDotColor()', () => {
    it('should return var(--crit) for overdue tasks', () => {
      const task = makeTask({ scheduledDate: dateOffsetDays(-1) });
      expect(component.statusDotColor(task)).toBe('var(--crit)');
    });

    it('should return var(--warn) for tasks due this week', () => {
      const task = makeTask({ scheduledDate: dateOffsetDays(3) });
      expect(component.statusDotColor(task)).toBe('var(--warn)');
    });

    it('should return var(--warn) for tasks due today', () => {
      const task = makeTask({ scheduledDate: dateOffsetDays(0) });
      expect(component.statusDotColor(task)).toBe('var(--warn)');
    });

    it('should return var(--ok) for tasks on time (days > 7)', () => {
      const task = makeTask({ scheduledDate: dateOffsetDays(10) });
      expect(component.statusDotColor(task)).toBe('var(--ok)');
    });
  });

  // ---------------------------------------------------------------------------
  // Drawer integration (Fase 6)
  // ---------------------------------------------------------------------------
  describe('drawer integration', () => {
    it('should pass selectedTask to app-task-drawer', () => {
      const task = makeTask({ id: 'task-sel', scheduledDate: dateOffsetDays(5) });
      component.selectTask(task);
      fixture.detectChanges();
      const drawer = fixture.nativeElement.querySelector('app-task-drawer');
      expect(drawer).toBeTruthy();
    });

    it('should set selectedTask to null on closeDrawer()', () => {
      component.selectedTask = makeTask();
      component.closeDrawer();
      expect(component.selectedTask).toBeNull();
    });

    it('drawer should have class "open" when selectedTask is set', () => {
      component.selectedTask = makeTask();
      fixture.detectChanges();
      const drawer = fixture.nativeElement.querySelector('.drawer');
      expect(drawer.classList.contains('open')).toBe(true);
    });

    it('should NOT render .d-hdr directly in task-list template', () => {
      component.selectedTask = makeTask();
      fixture.detectChanges();
      // .d-hdr belongs to task-drawer now — task-list should not have its own
      const dHdr = fixture.nativeElement.querySelector('.d-hdr');
      expect(dHdr).toBeNull();
    });

    it('should NOT render .d-body wrapper in task-list template', () => {
      component.selectedTask = makeTask();
      fixture.detectChanges();
      const dBody = fixture.nativeElement.querySelector('.d-body');
      expect(dBody).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Template tests
  // ---------------------------------------------------------------------------
  describe('template', () => {
    it('should render "Requieren atención" section only when overdueTasks.length > 0', () => {
      // No overdue tasks
      component.tasks = [
        makeTask({ id: 't1', status: 'PENDING', scheduledDate: dateOffsetDays(5) }),
      ];
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).not.toContain('Requieren atención');

      // With overdue task
      component.tasks = [
        makeTask({ id: 't2', status: 'PENDING', scheduledDate: dateOffsetDays(-2) }),
      ];
      fixture.detectChanges();
      expect(el.textContent).toContain('Requieren atención');
    });

    it('should not render "Pendientes" section when pendingTasks is empty', () => {
      component.tasks = [
        makeTask({ id: 't1', status: 'DONE', scheduledDate: dateOffsetDays(5) }),
      ];
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).not.toContain('Pendientes');
    });

    it('should render urgency badge with days text', () => {
      component.tasks = [
        makeTask({ id: 't1', status: 'PENDING', scheduledDate: dateOffsetDays(3) }),
      ];
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('vence en 3d');
    });

    it('should render status dot element (.sdot) in active task cards', () => {
      component.tasks = [
        makeTask({ id: 't1', status: 'PENDING', scheduledDate: dateOffsetDays(5) }),
      ];
      fixture.detectChanges();
      const sdot = fixture.nativeElement.querySelector('.sdot');
      expect(sdot).toBeTruthy();
    });

    it('should render "En curso" text for IN_PROGRESS tasks', () => {
      component.tasks = [
        makeTask({ id: 't1', status: 'IN_PROGRESS', scheduledDate: dateOffsetDays(5) }),
      ];
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('En curso');
    });

    it('should render "Pendiente" text for PENDING tasks', () => {
      component.tasks = [
        makeTask({ id: 't1', status: 'PENDING', scheduledDate: dateOffsetDays(5) }),
      ];
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Pendiente');
    });

    it('should NOT render .task__chips element', () => {
      component.tasks = [
        makeTask({ id: 't1', status: 'PENDING', scheduledDate: dateOffsetDays(5) }),
      ];
      fixture.detectChanges();
      const chips = fixture.nativeElement.querySelector('.task__chips');
      expect(chips).toBeNull();
    });

    it('should render KPI label "Vencidas"', () => {
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Vencidas');
    });

    it('should render KPI label "Esta semana"', () => {
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Esta semana');
    });

    it('should render KPI label "En plazo"', () => {
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('En plazo');
    });

    it('should render greeting with technicianName', () => {
      component.tasks = [
        makeTask({
          technician: { id: 'tech-1', user: { id: 'user-1', name: 'Valentina López', email: 'valen@ondra.com.ar' } },
        }),
      ];
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Valentina López');
    });
  });
});
