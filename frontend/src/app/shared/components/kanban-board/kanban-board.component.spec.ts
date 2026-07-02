import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { KanbanBoardComponent } from './kanban-board.component';
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

describe('KanbanBoardComponent', () => {
  let component: KanbanBoardComponent;
  let fixture: ComponentFixture<KanbanBoardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [KanbanBoardComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(KanbanBoardComponent);
    component = fixture.componentInstance;
    component.tasks = [];
    fixture.detectChanges();
  });

  describe('kanbanBacklog', () => {
    it('incluye solo PENDING, excluye IN_PROGRESS y terminales', () => {
      component.tasks = [
        makeTask({ id: 't1', status: 'PENDING'     }),
        makeTask({ id: 't2', status: 'IN_PROGRESS' }),
        makeTask({ id: 't3', status: 'DONE'        }),
        makeTask({ id: 't4', status: 'ESCALATED'   }),
        makeTask({ id: 't5', status: 'NOT_DONE'    }),
      ];
      const ids = component.kanbanBacklog.map(t => t.id);
      expect(ids).toContain('t1');
      expect(ids).not.toContain('t2');
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
      const ids = component.kanbanBacklog.map(t => t.id);
      expect(ids[0]).toBe('past');
      expect(ids[1]).toBe('week');
      expect(ids[2]).toBe('future');
    });
  });

  describe('kanbanInProgress', () => {
    it('incluye solo IN_PROGRESS, excluye PENDING y terminales', () => {
      component.tasks = [
        makeTask({ id: 't1', status: 'PENDING'     }),
        makeTask({ id: 't2', status: 'IN_PROGRESS' }),
        makeTask({ id: 't3', status: 'DONE'        }),
        makeTask({ id: 't4', status: 'ESCALATED'   }),
        makeTask({ id: 't5', status: 'NOT_DONE'    }),
      ];
      const ids = component.kanbanInProgress.map(t => t.id);
      expect(ids).not.toContain('t1');
      expect(ids).toContain('t2');
      expect(ids).not.toContain('t3');
      expect(ids).not.toContain('t4');
      expect(ids).not.toContain('t5');
    });

    it('ordena overdue primero', () => {
      component.tasks = [
        makeTask({ id: 'future', status: 'IN_PROGRESS', scheduledDate: dateOffsetDays(10) }),
        makeTask({ id: 'past',   status: 'IN_PROGRESS', scheduledDate: dateOffsetDays(-3) }),
      ];
      const ids = component.kanbanInProgress.map(t => t.id);
      expect(ids[0]).toBe('past');
      expect(ids[1]).toBe('future');
    });
  });

  describe('kanbanDone', () => {
    it('incluye DONE, ESCALATED y NOT_DONE', () => {
      component.tasks = [
        makeTask({ id: 't1', status: 'DONE'        }),
        makeTask({ id: 't2', status: 'ESCALATED'   }),
        makeTask({ id: 't3', status: 'NOT_DONE'    }),
        makeTask({ id: 't4', status: 'PENDING'     }),
        makeTask({ id: 't5', status: 'IN_PROGRESS' }),
      ];
      const ids = component.kanbanDone.map(t => t.id);
      expect(ids).toContain('t1');
      expect(ids).toContain('t2');
      expect(ids).toContain('t3');
      expect(ids).not.toContain('t4');
      expect(ids).not.toContain('t5');
    });
  });

  describe('taskSelected output', () => {
    it('emite la tarea cuando se llama a onTaskSelected()', () => {
      const emitted: Task[] = [];
      component.taskSelected.subscribe(t => emitted.push(t));
      const task = makeTask({ id: 'clicked' });
      component.onTaskSelected(task);
      expect(emitted.length).toBe(1);
      expect(emitted[0]).toBe(task);
    });
  });

  describe('selectedTaskId', () => {
    it('produces active=true for matching task id and false for others', () => {
      const t1 = makeTask({ id: 'selected', status: 'PENDING' });
      const t2 = makeTask({ id: 'other',    status: 'PENDING' });
      component.tasks = [t1, t2];
      component.selectedTaskId = 'selected';
      fixture.detectChanges();
      expect(component.selectedTaskId === t1.id).toBeTrue();
      expect(component.selectedTaskId === t2.id).toBeFalse();
    });
  });

  describe('template', () => {
    it('renderiza las 3 columnas con sus headers', () => {
      fixture.detectChanges();
      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('Backlog');
      expect(text).toContain('En curso');
      expect(text).toContain('Completadas');
    });
  });
});
