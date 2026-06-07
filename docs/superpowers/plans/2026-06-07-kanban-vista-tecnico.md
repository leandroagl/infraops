# Kanban Vista Técnico — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir la vista de tareas del técnico de lista vertical a tablero Kanban de 3 columnas (Pendientes / Completadas / Cerradas), extrayendo `TaskCardComponent` a `shared/` para eliminar la triplicación del template.

**Architecture:** `TaskCardComponent` se crea en `shared/components/task-card/` y se registra en `SharedModule`. `TaskListComponent` reemplaza sus secciones `*ngIf` por un grid CSS con tres columnas, cada una consumida por un getter dedicado. El drawer y toda la lógica de cambio de estado permanecen sin cambios. La greeting bar pasa de `<div>` a `<mat-card>` con KPI values en Roboto sans monospace.

**Tech Stack:** Angular, Angular Material (MatCardModule), CSS Grid, Karma/Jasmine (TDD)

---

## Mapa de archivos

| Acción | Archivo |
|---|---|
| Crear | `frontend/src/app/shared/components/task-card/task-card.component.spec.ts` |
| Crear | `frontend/src/app/shared/components/task-card/task-card.component.ts` |
| Crear | `frontend/src/app/shared/components/task-card/task-card.component.html` |
| Crear | `frontend/src/app/shared/components/task-card/task-card.component.scss` |
| Modificar | `frontend/src/app/shared/shared.module.ts` |
| Modificar | `frontend/src/app/features/technician/task-list/task-list.component.ts` |
| Modificar | `frontend/src/app/features/technician/task-list/task-list.component.spec.ts` |
| Modificar | `frontend/src/app/features/technician/task-list/task-list.component.html` |
| Modificar | `frontend/src/app/features/technician/task-list/task-list.component.scss` |

---

### Task 1: TaskCardComponent — spec (failing)

**Files:**
- Create: `frontend/src/app/shared/components/task-card/task-card.component.spec.ts`

- [ ] **Step 1.1: Crear el archivo spec**

```typescript
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
});
```

- [ ] **Step 1.2: Verificar que falla**

```bash
cd frontend && npx ng test --watch=false --include="**/task-card.component.spec.ts"
```

Expected: ERROR — `TaskCardComponent` no existe aún.

---

### Task 2: TaskCardComponent — implementación

**Files:**
- Create: `frontend/src/app/shared/components/task-card/task-card.component.ts`
- Create: `frontend/src/app/shared/components/task-card/task-card.component.html`
- Create: `frontend/src/app/shared/components/task-card/task-card.component.scss`

- [ ] **Step 2.1: Crear task-card.component.ts**

```typescript
// frontend/src/app/shared/components/task-card/task-card.component.ts
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Task } from '../../../core/models/task.models';
import { daysFromToday, urgencyLabel, urgencyClass } from '../../utils/urgency';
import { typeLabelLong } from '../../utils/task-labels';

@Component({
  selector: 'app-task-card',
  templateUrl: './task-card.component.html',
  styleUrl: './task-card.component.scss',
})
export class TaskCardComponent {
  @Input() task!: Task;
  @Input() active = false;
  @Output() selected = new EventEmitter<Task>();

  get isActive(): boolean {
    return this.task.status === 'PENDING' || this.task.status === 'IN_PROGRESS';
  }

  get days(): number { return daysFromToday(this.task.scheduledDate); }

  get borderClass(): string {
    if (!this.isActive) return 'tc-done';
    if (this.days < 0) return 'tc-crit';
    const t = this.task.type;
    if (t === 'TERMINAL_MAINTENANCE' || t === 'SITE_VISIT') return 'tc-visit';
    return 'tc-srv';
  }

  get urgencyLabelText(): string { return urgencyLabel(this.days); }
  get urgencyClassStr(): string  { return urgencyClass(this.days); }
  get typeLabel(): string        { return typeLabelLong(this.task.type); }

  get statusLabel(): string {
    const map: Record<string, string> = {
      PENDING:     'Pendiente',
      IN_PROGRESS: 'En curso',
      DONE:        'Listo',
      ESCALATED:   'Escalado',
      NOT_DONE:    'No hecho',
    };
    return map[this.task.status] ?? this.task.status;
  }

  get statusDotColor(): string {
    if (this.days < 0) return 'var(--crit)';
    if (this.days <= 7) return 'var(--warn)';
    return 'var(--ok)';
  }
}
```

- [ ] **Step 2.2: Crear task-card.component.html**

```html
<!-- frontend/src/app/shared/components/task-card/task-card.component.html -->
<mat-card
  class="task-card"
  [class.active]="active"
  [ngClass]="borderClass"
  role="button"
  tabindex="0"
  (click)="selected.emit(task)"
  (keydown.enter)="selected.emit(task)"
  (keydown.space)="$event.preventDefault(); selected.emit(task)">

  <div class="tc-top">
    <div class="tc-client">{{ task.client?.name ?? task.clientId }}</div>
    <div class="tc-type">{{ typeLabel }}</div>
  </div>

  <div class="tc-bottom">
    <ng-container *ngIf="isActive">
      <span class="urg" [ngClass]="urgencyClassStr">{{ urgencyLabelText }}</span>
      <div class="tc-status">
        <span class="sdot" [style.background]="statusDotColor"></span>
        {{ statusLabel }}
      </div>
    </ng-container>
    <ng-container *ngIf="!isActive">
      <span class="badge" [ngClass]="task.status === 'DONE' ? 'badge--ok' : 'badge--muted'">
        {{ statusLabel }}
      </span>
    </ng-container>
  </div>
</mat-card>
```

- [ ] **Step 2.3: Crear task-card.component.scss**

```scss
// frontend/src/app/shared/components/task-card/task-card.component.scss
:host { display: block; }

mat-card.task-card {
  --mdc-elevated-card-container-color: var(--card);
  --mdc-elevated-card-container-elevation: none;
  border: 1px solid var(--border-lo);
  border-radius: var(--radius);
  padding: 10px 12px;
  cursor: pointer;
  transition: background var(--transition), border-color var(--transition);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
  }

  &.tc-crit::before  { background: var(--crit);   }
  &.tc-srv::before   { background: var(--srv);     }
  &.tc-visit::before { background: var(--purple);  }
  &.tc-done::before  { background: var(--border);  }

  &:hover  { background: var(--hover); }
  &.active { background: var(--hover); border-color: var(--srv-bd); }
  &.tc-done { opacity: 0.6; }
}

.tc-top { margin-bottom: 8px; }

.tc-client {
  font-size: 13px; font-weight: 500; color: var(--tx-hi);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.tc-type { font-size: 11px; color: var(--tx-md); margin-top: 2px; }

.tc-bottom {
  display: flex; align-items: center; justify-content: space-between;
}

.tc-status {
  display: flex; align-items: center; gap: 4px;
  font-size: 10px; color: var(--tx-lo);
}

.sdot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }

.urg {
  display: inline-flex; align-items: center;
  padding: 2px 8px; border-radius: 10px;
  font-size: 10px; font-weight: 600; border: 1px solid;
}

.urg-crit { background: var(--crit-bg); color: var(--crit); border-color: var(--crit-bd); }
.urg-warn { background: var(--warn-bg); color: var(--warn); border-color: var(--warn-bd); }
.urg-ok   { background: var(--ok-bg);   color: var(--ok);   border-color: var(--ok-bd);   }

.badge {
  display: inline-flex; align-items: center;
  padding: 2px 8px; border-radius: 10px;
  font-size: 10px; font-weight: 500; border: 1px solid;
}

.badge--ok    { background: var(--ok-bg);  color: var(--ok);    border-color: var(--ok-bd);     }
.badge--muted { background: var(--card);   color: var(--tx-lo); border-color: var(--border-lo); }
```

- [ ] **Step 2.4: Correr tests del TaskCardComponent**

```bash
cd frontend && npx ng test --watch=false --include="**/task-card.component.spec.ts"
```

Expected: los 15 tests pasan.

---

### Task 3: Registrar TaskCardComponent en SharedModule

**Files:**
- Modify: `frontend/src/app/shared/shared.module.ts`

- [ ] **Step 3.1: Actualizar SharedModule**

```typescript
// frontend/src/app/shared/shared.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule } from '@angular/material/dialog';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { TaskCardComponent } from './components/task-card/task-card.component';
import { LocalDatePipe } from './pipes/local-date.pipe';

@NgModule({
  declarations: [LocalDatePipe, ConfirmDialogComponent, TaskCardComponent],
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatCardModule],
  exports: [LocalDatePipe, ConfirmDialogComponent, TaskCardComponent],
})
export class SharedModule {}
```

- [ ] **Step 3.2: Commit**

```bash
git add frontend/src/app/shared/components/task-card/ frontend/src/app/shared/shared.module.ts
git commit -m "feat(shared): agregar TaskCardComponent reutilizable"
```

---

### Task 4: Actualizar task-list.component.ts

**Files:**
- Modify: `frontend/src/app/features/technician/task-list/task-list.component.ts`

Se eliminan: `overdueTasks`, `pendingTasks`, `doneTasks`, `statusDotColor`, `typeLabel`, `typeIconClass`, `urgencyLabel`, `urgencyClass` (todos movidos a `TaskCardComponent`).
Se agregan: `kanbanPending`, `kanbanDone`, `kanbanClosed`.

- [ ] **Step 4.1: Reemplazar el archivo completo**

```typescript
// frontend/src/app/features/technician/task-list/task-list.component.ts
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Task, TaskStatus } from '../../../core/models/task.models';
import { AuthService } from '../../../core/services/auth.service';
import { TasksService } from '../../../core/services/tasks.service';
import { daysFromToday } from '../../../shared/utils/urgency';

@Component({
  selector: 'app-task-list',
  templateUrl: './task-list.component.html',
  styleUrl: './task-list.component.scss',
})
export class TaskListComponent implements OnInit {
  tasks: Task[] = [];
  selectedTask: Task | null = null;
  loading = false;
  error = '';

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private authService: AuthService,
    private tasksService: TasksService,
  ) {}

  get currentUser() { return this.authService.getCurrentUser(); }

  // ── KPI getters ───────────────────────────────────────────────────────────

  private get activeTasks(): Task[] {
    return this.tasks.filter(
      t => t.status !== 'DONE' && t.status !== 'ESCALATED' && t.status !== 'NOT_DONE',
    );
  }

  get overdueCount(): number {
    return this.activeTasks.filter(t => daysFromToday(t.scheduledDate) < 0).length;
  }

  get thisWeekCount(): number {
    return this.activeTasks.filter(t => {
      const d = daysFromToday(t.scheduledDate);
      return d >= 0 && d <= 7;
    }).length;
  }

  get onTimeCount(): number {
    return this.activeTasks.filter(t => daysFromToday(t.scheduledDate) > 7).length;
  }

  get technicianName(): string {
    const nameFromTask = this.tasks[0]?.technician?.user?.name;
    if (nameFromTask) return nameFromTask;
    return this.currentUser?.email?.split('@')[0] ?? '';
  }

  // ── Kanban columns ────────────────────────────────────────────────────────

  get kanbanPending(): Task[] {
    return [...this.activeTasks].sort(
      (a, b) => daysFromToday(a.scheduledDate) - daysFromToday(b.scheduledDate),
    );
  }

  get kanbanDone(): Task[] {
    return this.tasks.filter(t => t.status === 'DONE');
  }

  get kanbanClosed(): Task[] {
    return this.tasks.filter(t => t.status === 'ESCALATED' || t.status === 'NOT_DONE');
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void { this.load(); }

  load(): void {
    const user = this.currentUser;
    if (!user?.technicianId) return;
    this.loading = true;
    this.error = '';
    this.tasksService.getAll({ technicianId: user.technicianId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: tasks => { this.tasks = tasks; this.loading = false; },
        error: () => { this.error = 'No se pudieron cargar las tareas.'; this.loading = false; },
      });
  }

  selectTask(task: Task): void { this.selectedTask = task; }
  closeDrawer(): void          { this.selectedTask = null; }

  onTaskCompleted(): void {
    this.updateTaskStatusLocally(this.selectedTask?.id, 'DONE');
    this.closeDrawer();
  }

  onTaskNotDone(): void {
    this.updateTaskStatusLocally(this.selectedTask?.id, 'NOT_DONE');
    this.closeDrawer();
  }

  private updateTaskStatusLocally(taskId: string | undefined, status: TaskStatus): void {
    if (!taskId) return;
    const idx = this.tasks.findIndex(t => t.id === taskId);
    if (idx !== -1) this.tasks[idx] = { ...this.tasks[idx], status };
  }
}
```

---

### Task 5: Actualizar task-list.component.spec.ts

**Files:**
- Modify: `frontend/src/app/features/technician/task-list/task-list.component.spec.ts`

Se eliminan: tests de `daysFromToday`, `urgencyLabel`, `urgencyClass`, `statusDotColor`, `overdueTasks`, `pendingTasks`, `doneTasks`, y template tests que referencian el DOM antiguo (`.task--done`, `.sdot`, `Requieren atención`, secciones dinámicas).
Se agregan: tests de `kanbanPending`, `kanbanDone`, `kanbanClosed`, y template tests del tablero kanban.

- [ ] **Step 5.1: Reemplazar el archivo spec completo**

```typescript
// frontend/src/app/features/technician/task-list/task-list.component.spec.ts
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

  // ── KPI getters ─────────────────────────────────────────────────────────
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

  // ── technicianName ───────────────────────────────────────────────────────
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

  // ── kanbanPending ────────────────────────────────────────────────────────
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

  // ── kanbanDone ───────────────────────────────────────────────────────────
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

  // ── kanbanClosed ─────────────────────────────────────────────────────────
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

  // ── onTaskCompleted ──────────────────────────────────────────────────────
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

  // ── onTaskNotDone ────────────────────────────────────────────────────────
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

  // ── Drawer ───────────────────────────────────────────────────────────────
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

  // ── Template ─────────────────────────────────────────────────────────────
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

    it('renderiza un app-task-card por tarea activa', () => {
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
```

⚠️ **No correr tests aún.** El TS actualizado en Task 4 rompe el template viejo (que aún referencia `overdueTasks`, `pendingTasks`, `doneTasks`). Los tests se corren recién después de actualizar el HTML en Task 6.

---

### Task 6: Actualizar task-list.component.html — layout kanban

**Files:**
- Modify: `frontend/src/app/features/technician/task-list/task-list.component.html`

- [ ] **Step 6.1: Reemplazar el template completo**

```html
<!-- frontend/src/app/features/technician/task-list/task-list.component.html -->
<div class="tl-page">

  <!-- ── Greeting ─────────────────────────────────────────── -->
  <mat-card class="greeting">
    <div class="greeting__avatar">{{ technicianName[0]?.toUpperCase() }}</div>
    <div class="greeting__info">
      <div class="greeting__name">Buenas, {{ technicianName }}</div>
      <div class="greeting__sub">Tenés {{ tasks.length }} tareas asignadas · {{ overdueCount + thisWeekCount }} requieren atención</div>
    </div>
    <div class="greeting__kpis">
      <div class="kpi">
        <div class="kpi__value kv-crit">{{ overdueCount }}</div>
        <div class="kpi__label">Vencidas</div>
      </div>
      <div class="kpi">
        <div class="kpi__value kv-warn">{{ thisWeekCount }}</div>
        <div class="kpi__label">Esta semana</div>
      </div>
      <div class="kpi">
        <div class="kpi__value kv-ok">{{ onTimeCount }}</div>
        <div class="kpi__label">En plazo</div>
      </div>
    </div>
  </mat-card>

  <!-- ── Error ─────────────────────────────────────────────── -->
  <div *ngIf="error" class="error-banner">
    {{ error }}
    <button mat-button (click)="load()">Reintentar</button>
  </div>

  <!-- ── Loading ───────────────────────────────────────────── -->
  <ng-container *ngIf="loading">
    <div class="kanban kanban--loading">
      <div class="skeleton" style="height:200px;border-radius:var(--radius)"></div>
      <div class="skeleton" style="height:200px;border-radius:var(--radius)"></div>
      <div class="skeleton" style="height:200px;border-radius:var(--radius)"></div>
    </div>
  </ng-container>

  <!-- ── Kanban ─────────────────────────────────────────────── -->
  <div class="kanban" *ngIf="!loading">

    <!-- Pendientes (PENDING + IN_PROGRESS), ordenadas por urgencia -->
    <div class="kanban__col">
      <div class="kanban__col-header">
        <span class="col-label col-label--active">Pendientes</span>
        <span class="col-cnt col-cnt--active">{{ kanbanPending.length }}</span>
      </div>
      <div class="kanban__col-body">
        <app-task-card
          *ngFor="let task of kanbanPending"
          [task]="task"
          [active]="selectedTask?.id === task.id"
          (selected)="selectTask($event)">
        </app-task-card>
        <div *ngIf="kanbanPending.length === 0" class="col-empty">Sin tareas pendientes</div>
      </div>
    </div>

    <!-- Completadas (DONE) -->
    <div class="kanban__col">
      <div class="kanban__col-header">
        <span class="col-label">Completadas</span>
        <span class="col-cnt">{{ kanbanDone.length }}</span>
      </div>
      <div class="kanban__col-body">
        <app-task-card
          *ngFor="let task of kanbanDone"
          [task]="task"
          [active]="selectedTask?.id === task.id"
          (selected)="selectTask($event)">
        </app-task-card>
        <div *ngIf="kanbanDone.length === 0" class="col-empty">Sin completadas este mes</div>
      </div>
    </div>

    <!-- Cerradas (ESCALATED + NOT_DONE) -->
    <div class="kanban__col">
      <div class="kanban__col-header">
        <span class="col-label">Cerradas</span>
        <span class="col-cnt">{{ kanbanClosed.length }}</span>
      </div>
      <div class="kanban__col-body">
        <app-task-card
          *ngFor="let task of kanbanClosed"
          [task]="task"
          [active]="selectedTask?.id === task.id"
          (selected)="selectTask($event)">
        </app-task-card>
        <div *ngIf="kanbanClosed.length === 0" class="col-empty">Sin cerradas este mes</div>
      </div>
    </div>

  </div>

</div>

<!-- ── Drawer ─────────────────────────────────────────────── -->
<div class="drawer" [class.open]="selectedTask">
  <app-task-drawer
    *ngIf="selectedTask"
    [task]="selectedTask"
    (taskCompleted)="onTaskCompleted()"
    (taskNotDone)="onTaskNotDone()"
    (drawerClosed)="closeDrawer()">
  </app-task-drawer>
</div>
```

---

### Task 7: Actualizar task-list.component.scss — kanban + greeting Material

**Files:**
- Modify: `frontend/src/app/features/technician/task-list/task-list.component.scss`

- [ ] **Step 7.1: Reemplazar el SCSS completo**

```scss
// frontend/src/app/features/technician/task-list/task-list.component.scss
:host { display: block; }

.tl-page {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

// ── Greeting (mat-card) ──────────────────────────────────────
mat-card.greeting {
  --mdc-elevated-card-container-color: var(--surface);
  --mdc-elevated-card-container-elevation: none;
  border: 1px solid var(--border-lo);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  flex-shrink: 0;
}

.greeting__avatar {
  width: 40px; height: 40px;
  border-radius: 50%;
  background: var(--srv-bg);
  border: 2px solid var(--srv-bd);
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; font-weight: 600; color: var(--srv);
  flex-shrink: 0;
}

.greeting__name {
  font-size: 14px; font-weight: 500; color: var(--tx-hi);
}

.greeting__sub {
  font-size: 11px; color: var(--tx-lo);
  letter-spacing: .3px; margin-top: 2px;
}

.greeting__kpis {
  margin-left: auto;
  display: flex; gap: 8px;
}

// ── KPI ─────────────────────────────────────────────────────
.kpi {
  background: var(--card);
  border: 1px solid var(--border-lo);
  border-radius: var(--radius-sm);
  padding: 10px 18px;
  text-align: center;
  min-width: 68px;
}

.kpi__value {
  font-size: 22px;
  font-weight: 400;
  line-height: 1.1;
  letter-spacing: -0.5px;
  color: var(--tx-hi);
}

.kpi__label {
  font-size: 10px; color: var(--tx-lo);
  margin-top: 3px; letter-spacing: .4px; text-transform: uppercase;
}

.kv-crit { color: var(--crit); }
.kv-warn { color: var(--warn); }
.kv-ok   { color: var(--ok);   }

// ── Kanban board ─────────────────────────────────────────────
.kanban {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 14px;
  align-items: start;

  &--loading { align-items: stretch; }
}

.kanban__col {
  background: var(--surface);
  border: 1px solid var(--border-lo);
  border-radius: var(--radius);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.kanban__col-header {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-lo);
  background: var(--card);
  flex-shrink: 0;
}

.col-label {
  font-size: 10px; font-weight: 600;
  letter-spacing: .8px; text-transform: uppercase;
  color: var(--tx-lo); flex: 1;

  &--active { color: var(--srv); }
}

.col-cnt {
  font-size: 10px; font-weight: 500;
  padding: 2px 7px; border-radius: 10px;
  background: rgba(255,255,255,.04);
  border: 1px solid var(--border-lo);
  color: var(--tx-lo);

  &--active {
    background: var(--srv-bg);
    border-color: var(--srv-bd);
    color: var(--srv);
  }
}

.kanban__col-body {
  display: flex; flex-direction: column; gap: 6px;
  padding: 10px;
  min-height: 80px;
}

.col-empty {
  text-align: center; color: var(--tx-lo);
  font-size: 11px; padding: 20px 0;
}

// ── Error banner ─────────────────────────────────────────────
.error-banner {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px;
  background: var(--crit-bg);
  border: 1px solid var(--crit-bd);
  border-radius: var(--radius);
  color: var(--crit); font-size: 12px;
}

// ── Drawer ───────────────────────────────────────────────────
.drawer {
  position: fixed;
  right: 0; top: 0; bottom: 0;
  width: 780px;
  background: var(--surface);
  border-left: 1px solid var(--border-lo);
  z-index: 50;
  transform: translateX(100%);
  transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex; flex-direction: column; overflow: hidden;

  &.open { transform: translateX(0); }
}
```

- [ ] **Step 7.2: Correr todos los tests** *(primer test run de task-list desde Task 5)*

```bash
cd frontend && npx ng test --watch=false
```

Expected: todos los tests del proyecto pasan sin errores.

- [ ] **Step 7.3: Commit final**

```bash
git add frontend/src/app/features/technician/task-list/
git commit -m "feat(technician): convertir vista de tareas a tablero kanban"
```
