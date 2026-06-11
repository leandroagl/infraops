// frontend/src/app/shared/components/task-card/task-card.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatCardModule } from '@angular/material/card';
import { CommonModule } from '@angular/common';
import { TaskCardComponent } from './task-card.component';
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
    client: { id: 'client-1', name: 'Empresa Test' },
    ...overrides,
  };
}

describe('TaskCardComponent', () => {
  let component: TaskCardComponent;
  let fixture: ComponentFixture<TaskCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskCardComponent],
      imports: [NoopAnimationsModule, MatCardModule, CommonModule],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskCardComponent);
    component = fixture.componentInstance;
    component.task = makeTask();
    fixture.detectChanges();
  });

  // ── borderClass ────────────────────────────────────────────
  describe('borderClass', () => {
    it('returns tc-crit when PENDING and overdue', () => {
      component.task = makeTask({ status: 'PENDING', scheduledDate: dateOffsetDays(-3) });
      expect(component.borderClass).toBe('tc-crit');
    });

    it('returns tc-crit when IN_PROGRESS and overdue — urgency gana sobre tipo', () => {
      component.task = makeTask({
        status: 'IN_PROGRESS', type: 'TERMINAL_MAINTENANCE', scheduledDate: dateOffsetDays(-1),
      });
      expect(component.borderClass).toBe('tc-crit');
    });

    it('returns tc-visit when TERMINAL_MAINTENANCE not overdue', () => {
      component.task = makeTask({ type: 'TERMINAL_MAINTENANCE', scheduledDate: dateOffsetDays(3) });
      expect(component.borderClass).toBe('tc-visit');
    });

    it('returns tc-visit when SITE_VISIT not overdue', () => {
      component.task = makeTask({ type: 'SITE_VISIT', scheduledDate: dateOffsetDays(5) });
      expect(component.borderClass).toBe('tc-visit');
    });

    it('returns tc-srv when SERVER_MAINTENANCE not overdue', () => {
      component.task = makeTask({ type: 'SERVER_MAINTENANCE', scheduledDate: dateOffsetDays(10) });
      expect(component.borderClass).toBe('tc-srv');
    });

    it('returns tc-done when status is DONE', () => {
      component.task = makeTask({ status: 'DONE' });
      expect(component.borderClass).toBe('tc-done');
    });

    it('returns tc-done when status is ESCALATED', () => {
      component.task = makeTask({ status: 'ESCALATED' });
      expect(component.borderClass).toBe('tc-done');
    });

    it('returns tc-done when status is NOT_DONE', () => {
      component.task = makeTask({ status: 'NOT_DONE' });
      expect(component.borderClass).toBe('tc-done');
    });
  });

  // ── selected output ────────────────────────────────────────
  describe('selected output', () => {
    it('emite la tarea al hacer click en la card', () => {
      const emitted: Task[] = [];
      component.selected.subscribe(t => emitted.push(t));
      const task = makeTask({ id: 'clicked' });
      component.task = task;
      fixture.detectChanges();
      fixture.nativeElement.querySelector('mat-card').click();
      expect(emitted.length).toBe(1);
      expect(emitted[0]).toBe(task);
    });
  });

  // ── active input ───────────────────────────────────────────
  describe('active input', () => {
    it('aplica clase .active cuando active es true', () => {
      component.active = true;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('mat-card').classList.contains('active')).toBe(true);
    });

    it('no aplica .active cuando active es false', () => {
      component.active = false;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('mat-card').classList.contains('active')).toBe(false);
    });
  });

  // ── urgency badge ──────────────────────────────────────────
  describe('urgency badge', () => {
    it('muestra badge de urgencia para tareas PENDING', () => {
      component.task = makeTask({ status: 'PENDING', scheduledDate: dateOffsetDays(3) });
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('vence en 3d');
    });

    it('muestra badge de urgencia para tareas IN_PROGRESS', () => {
      component.task = makeTask({ status: 'IN_PROGRESS', scheduledDate: dateOffsetDays(-2) });
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('+2d vencido');
    });

    it('no renderiza .urg para tareas DONE', () => {
      component.task = makeTask({ status: 'DONE' });
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.urg')).toBeNull();
    });
  });

  // ── status badge (terminales) ──────────────────────────────
  describe('status badge para tareas terminales', () => {
    it('muestra "Listo" para DONE', () => {
      component.task = makeTask({ status: 'DONE' });
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Listo');
    });

    it('muestra "Escalado" para ESCALATED', () => {
      component.task = makeTask({ status: 'ESCALATED' });
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Escalado');
    });

    it('muestra "No hecho" para NOT_DONE', () => {
      component.task = makeTask({ status: 'NOT_DONE' });
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('No hecho');
    });
  });

  // ── odoo ticket link ───────────────────────────────────────
  describe('odoo ticket link', () => {
    it('muestra el link del ticket cuando odooTicketId está definido', () => {
      component.task = makeTask({ odooTicketId: 5137 });
      fixture.detectChanges();
      const link = fixture.nativeElement.querySelector('.tc-odoo-link');
      expect(link).toBeTruthy();
      expect(link.textContent.trim()).toBe('#05137');
    });

    it('el href del link contiene el id del ticket', () => {
      component.task = makeTask({ odooTicketId: 5137 });
      fixture.detectChanges();
      const link: HTMLAnchorElement = fixture.nativeElement.querySelector('.tc-odoo-link');
      expect(link.getAttribute('href')).toContain('5137');
    });

    it('no renderiza el link cuando odooTicketId es null', () => {
      component.task = makeTask({ odooTicketId: null });
      fixture.detectChanges();
      const link = fixture.nativeElement.querySelector('.tc-odoo-link');
      expect(link).toBeNull();
    });

    it('el click en el link no emite el evento selected', () => {
      component.task = makeTask({ odooTicketId: 5137 });
      fixture.detectChanges();
      const emitted: Task[] = [];
      component.selected.subscribe(t => emitted.push(t));
      const link: HTMLElement = fixture.nativeElement.querySelector('.tc-odoo-link');
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(emitted.length).toBe(0);
    });
  });

  // ── showTechnicianAvatar ───────────────────────────────────
  describe('showTechnicianAvatar', () => {
    it('no renderiza .tc-tech-avatar cuando showTechnicianAvatar es false (default)', () => {
      component.task = makeTask();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.tc-tech-avatar')).toBeNull();
    });

    it('no renderiza .tc-tech-avatar cuando showTechnicianAvatar=true pero task sin técnico', () => {
      component.showTechnicianAvatar = true;
      component.task = makeTask({ technician: undefined });
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.tc-tech-avatar')).toBeNull();
    });

    it('renderiza .tc-tech-avatar con la inicial cuando showTechnicianAvatar=true', () => {
      component.showTechnicianAvatar = true;
      component.task = makeTask({
        technician: { id: 'tech-1', user: { id: 'u1', name: 'Valentina López', email: 'valen@ondra.com.ar' } },
      });
      fixture.detectChanges();
      const avatar = fixture.nativeElement.querySelector('.tc-tech-avatar');
      expect(avatar).toBeTruthy();
      expect(avatar.textContent.trim()).toBe('V');
    });
  });
});
