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
    type: 'SERVER_MAINTENANCE', status: 'PENDING',
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

  describe('kanbanPending', () => {
    it('incluye PENDING e IN_PROGRESS, excluye terminales', () => {
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

  describe('template', () => {
    it('renderiza las 3 columnas con sus headers', () => {
      fixture.detectChanges();
      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('Pendientes');
      expect(text).toContain('Completadas');
      expect(text).toContain('Cerradas');
    });
  });
});
