# Admin Kanban + Filtros — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la tabla de tareas en la vista Admin por un kanban reutilizable, agregar filtros por cliente y técnico, y mostrar el técnico asignado en las cards.

**Architecture:** Se extrae `KanbanBoardComponent` a `shared/` para compartir la lógica de columnas entre la vista Técnico (existente) y la vista Admin (nueva). `TaskCard` suma un input condicional para el avatar del técnico. La vista Admin suma dos selects de filtro y un drawer de solo lectura.

**Tech Stack:** Angular 19 · Angular Material · TypeScript · Jasmine

---

## File Map

**Nuevos:**
- `frontend/src/app/shared/components/kanban-board/kanban-board.component.{ts,html,scss,spec.ts}`
- `frontend/src/app/features/admin/tasks/admin-task-drawer/admin-task-drawer.component.{ts,html,scss,spec.ts}`

**Modificados:**
- `frontend/src/app/shared/components/task-card/task-card.component.{ts,html,scss,spec.ts}`
- `frontend/src/app/shared/shared.module.ts`
- `frontend/src/app/features/technician/task-list/task-list.component.{ts,html,scss,spec.ts}`
- `frontend/src/app/features/admin/tasks/tasks.component.{ts,html,scss,spec.ts}`
- `frontend/src/app/features/admin/admin.module.ts`

---

### Task 1: Avatar de técnico en TaskCard

**Files:**
- Modify: `frontend/src/app/shared/components/task-card/task-card.component.spec.ts`
- Modify: `frontend/src/app/shared/components/task-card/task-card.component.ts`
- Modify: `frontend/src/app/shared/components/task-card/task-card.component.html`
- Modify: `frontend/src/app/shared/components/task-card/task-card.component.scss`

- [ ] **Paso 1: Agregar tests al final del describe en `task-card.component.spec.ts`**

```typescript
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
```

- [ ] **Paso 2: Correr el test para verificar que falla**

```bash
cd frontend && npx ng test --include="**/task-card.component.spec.ts" --watch=false
```

Esperado: FAIL — `.tc-tech-avatar` no existe.

- [ ] **Paso 3: Agregar input y getter en `task-card.component.ts`**

```typescript
@Input() showTechnicianAvatar = false;

get technicianInitial(): string {
  return this.task.technician?.user?.name?.[0]?.toUpperCase() ?? '';
}
```

- [ ] **Paso 4: Actualizar el template `task-card.component.html`**

Reemplazar el `<div class="tc-top">` existente por:

```html
<div class="tc-top">
  <div class="tc-top__info">
    <div class="tc-client">{{ task.client?.name ?? task.clientId }}</div>
    <div class="tc-type">{{ typeLabel }}</div>
  </div>
  <div *ngIf="showTechnicianAvatar && technicianInitial" class="tc-tech-avatar">
    {{ technicianInitial }}
  </div>
</div>
```

- [ ] **Paso 5: Actualizar estilos en `task-card.component.scss`**

Reemplazar `.tc-top { margin-bottom: 8px; }` por:

```scss
.tc-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}

.tc-top__info { flex: 1; min-width: 0; }

.tc-tech-avatar {
  width: 22px; height: 22px;
  border-radius: 50%;
  background: var(--srv-bg);
  border: 1px solid var(--srv-bd);
  display: flex; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 700;
  color: var(--srv);
  flex-shrink: 0;
  font-family: var(--font-mono);
  text-transform: uppercase;
}
```

- [ ] **Paso 6: Verificar que todos los tests pasan**

```bash
cd frontend && npx ng test --include="**/task-card.component.spec.ts" --watch=false
```

Esperado: todos pasan.

- [ ] **Paso 7: Commit**

```bash
git add frontend/src/app/shared/components/task-card/
git commit -m "feat(task-card): agregar avatar de técnico condicional con showTechnicianAvatar"
```

---

### Task 2: KanbanBoardComponent en shared/

**Files:**
- Create: `frontend/src/app/shared/components/kanban-board/kanban-board.component.spec.ts`
- Create: `frontend/src/app/shared/components/kanban-board/kanban-board.component.ts`
- Create: `frontend/src/app/shared/components/kanban-board/kanban-board.component.html`
- Create: `frontend/src/app/shared/components/kanban-board/kanban-board.component.scss`
- Modify: `frontend/src/app/shared/shared.module.ts`

- [ ] **Paso 1: Crear `kanban-board.component.spec.ts`**

```typescript
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
```

- [ ] **Paso 2: Verificar que el spec falla**

```bash
cd frontend && npx ng test --include="**/kanban-board.component.spec.ts" --watch=false
```

Esperado: FAIL — component not found.

- [ ] **Paso 3: Crear `kanban-board.component.ts`**

```typescript
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Task } from '../../../core/models/task.models';
import { daysFromToday } from '../../utils/urgency';

@Component({
  selector: 'app-kanban-board',
  templateUrl: './kanban-board.component.html',
  styleUrl: './kanban-board.component.scss',
})
export class KanbanBoardComponent {
  @Input() tasks: Task[] = [];
  @Input() showTechnicianAvatar = false;
  @Input() selectedTaskId: string | null = null;
  @Output() taskSelected = new EventEmitter<Task>();

  private get activeTasks(): Task[] {
    return this.tasks.filter(
      t => t.status !== 'DONE' && t.status !== 'ESCALATED' && t.status !== 'NOT_DONE',
    );
  }

  get kanbanPending(): Task[] {
    return [...this.activeTasks].sort(
      (a, b) => daysFromToday(a.scheduledDate) - daysFromToday(b.scheduledDate),
    );
  }

  get kanbanDone(): Task[]   { return this.tasks.filter(t => t.status === 'DONE'); }
  get kanbanClosed(): Task[] { return this.tasks.filter(t => t.status === 'ESCALATED' || t.status === 'NOT_DONE'); }

  onTaskSelected(task: Task): void { this.taskSelected.emit(task); }
}
```

- [ ] **Paso 4: Crear `kanban-board.component.html`**

```html
<div class="kanban">

  <div class="kanban__col">
    <div class="kanban__col-header">
      <span class="col-label col-label--active">Pendientes</span>
      <span class="col-cnt col-cnt--active">{{ kanbanPending.length }}</span>
    </div>
    <div class="kanban__col-body">
      <app-task-card
        *ngFor="let task of kanbanPending"
        [task]="task"
        [active]="selectedTaskId === task.id"
        [showTechnicianAvatar]="showTechnicianAvatar"
        (selected)="onTaskSelected($event)">
      </app-task-card>
      <div *ngIf="kanbanPending.length === 0" class="col-empty">Sin tareas pendientes</div>
    </div>
  </div>

  <div class="kanban__col">
    <div class="kanban__col-header">
      <span class="col-label">Completadas</span>
      <span class="col-cnt">{{ kanbanDone.length }}</span>
    </div>
    <div class="kanban__col-body">
      <app-task-card
        *ngFor="let task of kanbanDone"
        [task]="task"
        [active]="selectedTaskId === task.id"
        [showTechnicianAvatar]="showTechnicianAvatar"
        (selected)="onTaskSelected($event)">
      </app-task-card>
      <div *ngIf="kanbanDone.length === 0" class="col-empty">Sin completadas este mes</div>
    </div>
  </div>

  <div class="kanban__col">
    <div class="kanban__col-header">
      <span class="col-label">Cerradas</span>
      <span class="col-cnt">{{ kanbanClosed.length }}</span>
    </div>
    <div class="kanban__col-body">
      <app-task-card
        *ngFor="let task of kanbanClosed"
        [task]="task"
        [active]="selectedTaskId === task.id"
        [showTechnicianAvatar]="showTechnicianAvatar"
        (selected)="onTaskSelected($event)">
      </app-task-card>
      <div *ngIf="kanbanClosed.length === 0" class="col-empty">Sin cerradas este mes</div>
    </div>
  </div>

</div>
```

- [ ] **Paso 5: Crear `kanban-board.component.scss`**

```scss
:host { display: block; }

.kanban {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 14px;
  align-items: start;
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
  &--active { background: var(--srv-bg); border-color: var(--srv-bd); color: var(--srv); }
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
```

- [ ] **Paso 6: Registrar `KanbanBoardComponent` en `shared.module.ts`**

Reemplazar el contenido completo de `shared.module.ts`:

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule } from '@angular/material/dialog';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { TaskCardComponent } from './components/task-card/task-card.component';
import { KanbanBoardComponent } from './components/kanban-board/kanban-board.component';
import { LocalDatePipe } from './pipes/local-date.pipe';

@NgModule({
  declarations: [LocalDatePipe, ConfirmDialogComponent, TaskCardComponent, KanbanBoardComponent],
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatCardModule],
  exports: [LocalDatePipe, ConfirmDialogComponent, TaskCardComponent, KanbanBoardComponent],
})
export class SharedModule {}
```

- [ ] **Paso 7: Verificar que los tests pasan**

```bash
cd frontend && npx ng test --include="**/kanban-board.component.spec.ts" --watch=false
```

Esperado: todos pasan.

- [ ] **Paso 8: Commit**

```bash
git add frontend/src/app/shared/components/kanban-board/ frontend/src/app/shared/shared.module.ts
git commit -m "feat(shared): agregar KanbanBoardComponent reutilizable"
```

---

### Task 3: Refactor TaskListComponent para usar KanbanBoardComponent

**Files:**
- Modify: `frontend/src/app/features/technician/task-list/task-list.component.spec.ts`
- Modify: `frontend/src/app/features/technician/task-list/task-list.component.ts`
- Modify: `frontend/src/app/features/technician/task-list/task-list.component.html`
- Modify: `frontend/src/app/features/technician/task-list/task-list.component.scss`

- [ ] **Paso 1: Actualizar `task-list.component.spec.ts`**

Eliminar los bloques `describe` completos de `kanbanPending`, `kanbanDone` y `kanbanClosed`.

En `describe('onTaskCompleted()')`, eliminar el test `'mueve la tarea a kanbanDone'` (el que accede a `component.kanbanDone` y `component.kanbanPending`).

En `describe('onTaskNotDone()')`, eliminar el test `'mueve la tarea a kanbanClosed'` (accede a `component.kanbanClosed`).

En `describe('template')`, reemplazar los tests `'renderiza los headers de las tres columnas kanban'` y `'renderiza un app-task-card por tarea'` por:

```typescript
it('renderiza app-kanban-board en el template', () => {
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('app-kanban-board')).toBeTruthy();
});
```

- [ ] **Paso 2: Verificar que el nuevo test falla**

```bash
cd frontend && npx ng test --include="**/task-list.component.spec.ts" --watch=false
```

Esperado: `'renderiza app-kanban-board'` falla (todavía no está en el HTML). El resto pasa.

- [ ] **Paso 3: Eliminar los kanban getters de `task-list.component.ts`**

Eliminar `kanbanPending`, `kanbanDone`, `kanbanClosed`. Mantener `activeTasks`, `overdueCount`, `thisWeekCount`, `onTimeCount`, `technicianName`. El archivo completo queda:

```typescript
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

- [ ] **Paso 4: Reemplazar el bloque kanban en `task-list.component.html`**

Reemplazar desde `<ng-container *ngIf="loading">` hasta el cierre del `<div class="kanban" *ngIf="!loading">` por:

```html
<ng-container *ngIf="loading">
  <div class="kanban kanban--loading">
    <div class="skeleton" style="height:200px;border-radius:var(--radius)"></div>
    <div class="skeleton" style="height:200px;border-radius:var(--radius)"></div>
    <div class="skeleton" style="height:200px;border-radius:var(--radius)"></div>
  </div>
</ng-container>

<app-kanban-board
  *ngIf="!loading"
  [tasks]="tasks"
  [selectedTaskId]="selectedTask?.id ?? null"
  (taskSelected)="selectTask($event)">
</app-kanban-board>
```

- [ ] **Paso 5: Eliminar estilos de columnas de `task-list.component.scss`**

Eliminar los bloques: `.kanban__col`, `.kanban__col-header`, `.col-label`, `.col-cnt`, `.kanban__col-body`, `.col-empty`. **Mantener** `.kanban { ... &--loading { ... } }` (necesario para el skeleton de carga).

- [ ] **Paso 6: Verificar que todos los tests pasan**

```bash
cd frontend && npx ng test --include="**/task-list.component.spec.ts" --watch=false
```

Esperado: todos pasan.

- [ ] **Paso 7: Commit**

```bash
git add frontend/src/app/features/technician/task-list/
git commit -m "refactor(task-list): delegar tablero kanban a KanbanBoardComponent"
```

---

### Task 4: AdminTaskDrawerComponent (solo lectura)

**Files:**
- Create: `frontend/src/app/features/admin/tasks/admin-task-drawer/admin-task-drawer.component.spec.ts`
- Create: `frontend/src/app/features/admin/tasks/admin-task-drawer/admin-task-drawer.component.ts`
- Create: `frontend/src/app/features/admin/tasks/admin-task-drawer/admin-task-drawer.component.html`
- Create: `frontend/src/app/features/admin/tasks/admin-task-drawer/admin-task-drawer.component.scss`
- Modify: `frontend/src/app/features/admin/admin.module.ts`

- [ ] **Paso 1: Crear `admin-task-drawer.component.spec.ts`**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatButtonModule } from '@angular/material/button';
import { AdminTaskDrawerComponent } from './admin-task-drawer.component';
import { LocalDatePipe } from '../../../../shared/pipes/local-date.pipe';
import { Task } from '../../../../core/models/task.models';

function mockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1', clientId: 'client-1', technicianId: 'tech-1',
    type: 'SERVER_MAINTENANCE', status: 'PENDING',
    scheduledDate: '2026-06-15', completedDate: null,
    odooTicketId: null, createdAt: '2026-01-01T00:00:00.000Z',
    client: { id: 'client-1', name: 'Acme Corp' },
    technician: { id: 'tech-1', user: { id: 'u1', name: 'Valentina López', email: 'valen@ondra.com.ar' } },
    ...overrides,
  };
}

describe('AdminTaskDrawerComponent', () => {
  let component: AdminTaskDrawerComponent;
  let fixture: ComponentFixture<AdminTaskDrawerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AdminTaskDrawerComponent, LocalDatePipe],
      imports: [CommonModule, NoopAnimationsModule, MatButtonModule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminTaskDrawerComponent);
    component = fixture.componentInstance;
    component.task = mockTask();
    fixture.detectChanges();
  });

  it('renderiza el nombre del cliente', () => {
    expect(fixture.nativeElement.textContent).toContain('Acme Corp');
  });

  it('renderiza el nombre del técnico asignado', () => {
    expect(fixture.nativeElement.textContent).toContain('Valentina López');
  });

  it('renderiza "—" cuando no hay técnico asignado', () => {
    component.task = mockTask({ technician: undefined });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('—');
  });

  it('renderiza el link del ticket Odoo cuando existe', () => {
    component.task = mockTask({ odooTicketId: 5137 });
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('a');
    expect(link).toBeTruthy();
    expect(link.textContent.trim()).toBe('#05137');
  });

  it('no renderiza link cuando odooTicketId es null', () => {
    expect(fixture.nativeElement.querySelector('a')).toBeNull();
  });

  it('drawerClosed emite al hacer click en el botón cerrar', () => {
    const emitted: void[] = [];
    component.drawerClosed.subscribe(() => emitted.push());
    fixture.nativeElement.querySelector('.adr-close').click();
    expect(emitted.length).toBe(1);
  });
});
```

- [ ] **Paso 2: Verificar que el spec falla**

```bash
cd frontend && npx ng test --include="**/admin-task-drawer.component.spec.ts" --watch=false
```

Esperado: FAIL — component not found.

- [ ] **Paso 3: Crear `admin-task-drawer.component.ts`**

```typescript
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Task } from '../../../../core/models/task.models';
import { typeLabel, statusLabel, statusBadge } from '../../../../shared/utils/task-labels';
import { formatOdooTicketId, odooTicketUrl } from '../../../../shared/utils/odoo';

@Component({
  selector: 'app-admin-task-drawer',
  templateUrl: './admin-task-drawer.component.html',
  styleUrl: './admin-task-drawer.component.scss',
})
export class AdminTaskDrawerComponent {
  @Input() task!: Task;
  @Output() drawerClosed = new EventEmitter<void>();

  get typeLabel(): string   { return typeLabel(this.task.type); }
  get statusLabel(): string { return statusLabel(this.task.status); }
  get statusBadge(): string { return statusBadge(this.task.status); }

  get odooLabel(): string | null {
    return this.task.odooTicketId != null ? formatOdooTicketId(this.task.odooTicketId) : null;
  }
  get odooLink(): string | null {
    return this.task.odooTicketId != null ? odooTicketUrl(this.task.odooTicketId) : null;
  }
}
```

- [ ] **Paso 4: Crear `admin-task-drawer.component.html`**

```html
<div class="adr-header">
  <span class="adr-title">Detalle de tarea</span>
  <button mat-icon-button class="adr-close" (click)="drawerClosed.emit()">
    <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  </button>
</div>

<div class="adr-body">
  <div class="adr-field">
    <span class="adr-label">Cliente</span>
    <span class="adr-value">{{ task.client?.name ?? '—' }}</span>
  </div>
  <div class="adr-field">
    <span class="adr-label">Tipo</span>
    <span class="adr-value">{{ typeLabel }}</span>
  </div>
  <div class="adr-field">
    <span class="adr-label">Técnico</span>
    <span class="adr-value">{{ task.technician?.user?.name ?? '—' }}</span>
  </div>
  <div class="adr-field">
    <span class="adr-label">Período</span>
    <span class="adr-value adr-value--mono">{{ task.scheduledDate | localDate:'month' }}</span>
  </div>
  <div class="adr-field">
    <span class="adr-label">Estado</span>
    <span class="badge" [ngClass]="statusBadge">{{ statusLabel }}</span>
  </div>
  <div class="adr-field">
    <span class="adr-label">Ticket Odoo</span>
    <a *ngIf="odooLink" [href]="odooLink" target="_blank" rel="noopener noreferrer" class="adr-odoo-link">{{ odooLabel }}</a>
    <span *ngIf="!odooLink" class="adr-value">—</span>
  </div>
</div>
```

- [ ] **Paso 5: Crear `admin-task-drawer.component.scss`**

```scss
:host { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

.adr-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border-lo);
  flex-shrink: 0;
}

.adr-title { font-size: 13px; font-weight: 600; color: var(--tx-hi); }

.adr-body { display: flex; flex-direction: column; overflow-y: auto; flex: 1; padding: 8px 0; }

.adr-field {
  display: flex; flex-direction: column; gap: 3px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-lo);
  &:last-child { border-bottom: none; }
}

.adr-label {
  font-size: 10px; color: var(--tx-lo);
  text-transform: uppercase; letter-spacing: .6px; font-weight: 600;
}

.adr-value { font-size: 13px; color: var(--tx-hi); &--mono { font-family: var(--font-mono); font-size: 12px; } }

.adr-odoo-link {
  font-size: 12px; color: var(--accent); font-family: var(--font-mono); text-decoration: none;
  &:hover { text-decoration: underline; }
}

.badge {
  display: inline-flex; align-items: center;
  padding: 2px 8px; border-radius: 10px;
  font-size: 10px; font-weight: 500; border: 1px solid;
  align-self: flex-start;
}
```

- [ ] **Paso 6: Declarar `AdminTaskDrawerComponent` en `admin.module.ts`**

Agregar al array `declarations`:

```typescript
import { AdminTaskDrawerComponent } from './tasks/admin-task-drawer/admin-task-drawer.component';

// en declarations:
AdminTaskDrawerComponent,
```

- [ ] **Paso 7: Verificar que los tests pasan**

```bash
cd frontend && npx ng test --include="**/admin-task-drawer.component.spec.ts" --watch=false
```

Esperado: todos pasan.

- [ ] **Paso 8: Commit**

```bash
git add frontend/src/app/features/admin/tasks/admin-task-drawer/ frontend/src/app/features/admin/admin.module.ts
git commit -m "feat(admin): agregar AdminTaskDrawerComponent de solo lectura"
```

---

### Task 5: Refactor TasksComponent — filtros + kanban + drawer

**Files:**
- Modify: `frontend/src/app/features/admin/tasks/tasks.component.spec.ts`
- Modify: `frontend/src/app/features/admin/tasks/tasks.component.ts`
- Modify: `frontend/src/app/features/admin/tasks/tasks.component.html`
- Modify: `frontend/src/app/features/admin/tasks/tasks.component.scss`

- [ ] **Paso 1: Reemplazar `tasks.component.spec.ts`**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TasksComponent } from './tasks.component';
import { TasksService } from '../../../core/services/tasks.service';
import { ClientsService } from '../../../core/services/clients.service';
import { TechniciansService } from '../../../core/services/technicians.service';
import { Task } from '../../../core/models/task.models';

function mockTask(id: string): Task {
  return {
    id, clientId: 'client-1', technicianId: 'tech-1',
    type: 'SERVER_MAINTENANCE', status: 'PENDING',
    scheduledDate: '2026-06-15', completedDate: null,
    odooTicketId: null, createdAt: '2026-01-01T00:00:00.000Z',
    client: { id: 'client-1', name: 'Acme' },
    technician: { id: 'tech-1', user: { id: 'user-1', name: 'Valen', email: 'valen@ondra.com.ar' } },
  };
}

describe('TasksComponent', () => {
  let component: TasksComponent;
  let fixture: ComponentFixture<TasksComponent>;
  let tasksServiceSpy: jasmine.SpyObj<TasksService>;
  let clientsServiceSpy: jasmine.SpyObj<ClientsService>;
  let techniciansServiceSpy: jasmine.SpyObj<TechniciansService>;
  let dialog: MatDialog;

  beforeEach(async () => {
    tasksServiceSpy       = jasmine.createSpyObj('TasksService',       ['getAll', 'create', 'delete']);
    clientsServiceSpy     = jasmine.createSpyObj('ClientsService',     ['getAll']);
    techniciansServiceSpy = jasmine.createSpyObj('TechniciansService', ['getAll']);

    tasksServiceSpy.getAll.and.returnValue(of([mockTask('task-1'), mockTask('task-2')]));
    clientsServiceSpy.getAll.and.returnValue(of([]));
    techniciansServiceSpy.getAll.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      declarations: [TasksComponent],
      imports: [NoopAnimationsModule, MatDialogModule, MatSnackBarModule],
      providers: [
        { provide: TasksService,       useValue: tasksServiceSpy       },
        { provide: ClientsService,     useValue: clientsServiceSpy     },
        { provide: TechniciansService, useValue: techniciansServiceSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TasksComponent);
    component = fixture.componentInstance;
    dialog = TestBed.inject(MatDialog);
    fixture.detectChanges();
  });

  it('ngOnInit carga tareas, clientes y técnicos', () => {
    expect(tasksServiceSpy.getAll).toHaveBeenCalledTimes(1);
    expect(clientsServiceSpy.getAll).toHaveBeenCalledTimes(1);
    expect(techniciansServiceSpy.getAll).toHaveBeenCalledTimes(1);
  });

  it('load() asigna las tareas al array tasks', () => {
    expect(component.tasks.length).toBe(2);
    expect(component.tasks[0].id).toBe('task-1');
  });

  it('load() setea loading=false y error="" cuando tiene éxito', () => {
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

  describe('filtros', () => {
    it('pasa filterStatus al servicio', () => {
      component.filterStatus = 'PENDING';
      component.load();
      expect(tasksServiceSpy.getAll).toHaveBeenCalledWith({ status: 'PENDING' });
    });

    it('pasa filterClientId al servicio', () => {
      component.filterClientId = 'client-1';
      component.load();
      expect(tasksServiceSpy.getAll).toHaveBeenCalledWith({ clientId: 'client-1' });
    });

    it('pasa filterTechnicianId al servicio', () => {
      component.filterTechnicianId = 'tech-1';
      component.load();
      expect(tasksServiceSpy.getAll).toHaveBeenCalledWith({ technicianId: 'tech-1' });
    });

    it('combina múltiples filtros', () => {
      component.filterStatus = 'DONE';
      component.filterClientId = 'client-1';
      component.load();
      expect(tasksServiceSpy.getAll).toHaveBeenCalledWith({ status: 'DONE', clientId: 'client-1' });
    });

    it('llama al servicio con objeto vacío cuando no hay filtros', () => {
      component.filterStatus = '';
      component.filterClientId = '';
      component.filterTechnicianId = '';
      component.load();
      expect(tasksServiceSpy.getAll).toHaveBeenCalledWith({});
    });
  });

  describe('drawer', () => {
    it('selectTask() setea selectedTask', () => {
      const task = mockTask('task-1');
      component.selectTask(task);
      expect(component.selectedTask).toBe(task);
    });

    it('closeDrawer() limpia selectedTask', () => {
      component.selectedTask = mockTask('task-1');
      component.closeDrawer();
      expect(component.selectedTask).toBeNull();
    });
  });

  describe('openCreateDialog()', () => {
    it('inserta la nueva tarea en tasks sin llamar a load()', () => {
      const newTask = mockTask('task-3');
      const mockRef = { afterClosed: () => of(newTask) } as MatDialogRef<unknown>;
      spyOn(dialog, 'open').and.returnValue(mockRef);
      const loadSpy = spyOn(component, 'load').and.callThrough();

      const initialCount = component.tasks.length;
      component.openCreateDialog();

      expect(component.tasks.length).toBe(initialCount + 1);
      expect(component.tasks[component.tasks.length - 1].id).toBe('task-3');
      expect(loadSpy).not.toHaveBeenCalled();
    });

    it('no modifica tasks cuando el dialog cierra con null', () => {
      const mockRef = { afterClosed: () => of(null) } as MatDialogRef<unknown>;
      spyOn(dialog, 'open').and.returnValue(mockRef);

      const initialCount = component.tasks.length;
      component.openCreateDialog();

      expect(component.tasks.length).toBe(initialCount);
    });
  });

  describe('deleteTask()', () => {
    it('elimina la tarea del array tasks cuando el usuario confirma', () => {
      tasksServiceSpy.delete.and.returnValue(of(void 0));
      const mockRef = { afterClosed: () => of(true) } as MatDialogRef<unknown>;
      spyOn(dialog, 'open').and.returnValue(mockRef);

      component.deleteTask(mockTask('task-1'));

      expect(tasksServiceSpy.delete).toHaveBeenCalledWith('task-1');
      expect(component.tasks.find(t => t.id === 'task-1')).toBeUndefined();
      expect(component.tasks.length).toBe(1);
    });

    it('no modifica tasks cuando el usuario cancela', () => {
      const mockRef = { afterClosed: () => of(undefined) } as MatDialogRef<unknown>;
      spyOn(dialog, 'open').and.returnValue(mockRef);

      const initialCount = component.tasks.length;
      component.deleteTask(mockTask('task-1'));

      expect(tasksServiceSpy.delete).not.toHaveBeenCalled();
      expect(component.tasks.length).toBe(initialCount);
    });

    it('muestra snackbar de error cuando el servicio falla', () => {
      tasksServiceSpy.delete.and.returnValue(throwError(() => new Error('Error')));
      const mockRef = { afterClosed: () => of(true) } as MatDialogRef<unknown>;
      spyOn(dialog, 'open').and.returnValue(mockRef);
      const snackBar = TestBed.inject(MatSnackBar);
      spyOn(snackBar, 'open');

      component.deleteTask(mockTask('task-1'));

      expect(snackBar.open).toHaveBeenCalledWith(
        'No se pudo eliminar la tarea', 'Cerrar', jasmine.any(Object),
      );
      expect(component.tasks.length).toBe(2);
    });
  });
});
```

- [ ] **Paso 2: Verificar que el spec falla**

```bash
cd frontend && npx ng test --include="**/admin/tasks/tasks.component.spec.ts" --watch=false
```

Esperado: múltiples fallas — `component.tasks` no existe aún.

- [ ] **Paso 3: Reemplazar `tasks.component.ts`**

```typescript
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, EMPTY, switchMap } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Task } from '../../../core/models/task.models';
import { Client } from '../../../core/models/client.models';
import { Technician } from '../../../core/models/technician.models';
import { TasksService, TaskFilters } from '../../../core/services/tasks.service';
import { ClientsService } from '../../../core/services/clients.service';
import { TechniciansService } from '../../../core/services/technicians.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { TaskCreateDialogComponent } from './task-create-dialog/task-create-dialog.component';

@Component({
  selector: 'app-tasks',
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.scss',
})
export class TasksComponent implements OnInit {
  tasks: Task[] = [];
  clients: Client[] = [];
  technicians: Technician[] = [];
  loading = false;
  error = '';
  filterStatus = '';
  filterClientId = '';
  filterTechnicianId = '';
  selectedTask: Task | null = null;

  private readonly destroyRef = inject(DestroyRef);

  readonly statusOptions: { value: string; label: string }[] = [
    { value: '',            label: 'Todos'        },
    { value: 'PENDING',     label: 'Pendiente'    },
    { value: 'IN_PROGRESS', label: 'En curso'     },
    { value: 'DONE',        label: 'Completado'   },
    { value: 'ESCALATED',   label: 'Escalado'     },
    { value: 'NOT_DONE',    label: 'No realizado' },
  ];

  constructor(
    private tasksService: TasksService,
    private clientsService: ClientsService,
    private techniciansService: TechniciansService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    forkJoin({
      clients:     this.clientsService.getAll(),
      technicians: this.techniciansService.getAll(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ clients, technicians }) => {
        this.clients     = clients;
        this.technicians = technicians;
      },
    });
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    const filters: TaskFilters = {};
    if (this.filterStatus)       filters.status       = this.filterStatus;
    if (this.filterClientId)     filters.clientId     = this.filterClientId;
    if (this.filterTechnicianId) filters.technicianId = this.filterTechnicianId;
    this.tasksService.getAll(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: tasks => { this.tasks = tasks; this.loading = false; },
      error: () => { this.error = 'No se pudieron cargar las tareas.'; this.loading = false; },
    });
  }

  selectTask(task: Task): void { this.selectedTask = task; }
  closeDrawer(): void          { this.selectedTask = null; }

  openCreateDialog(): void {
    this.dialog.open(TaskCreateDialogComponent, { width: '480px' })
      .afterClosed().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(task => {
        if (task) this.tasks = [...this.tasks, task];
      });
  }

  deleteTask(task: Task): void {
    const clientName = task.client?.name ?? 'este cliente';
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar tarea',
        message: `¿Eliminar la tarea de ${clientName}? Esta acción no se puede deshacer.`,
      },
    }).afterClosed()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(confirmed => confirmed ? this.tasksService.delete(task.id) : EMPTY),
      )
      .subscribe({
        next: () => {
          this.tasks = this.tasks.filter(t => t.id !== task.id);
          this.snackBar.open('Tarea eliminada', 'Cerrar', { duration: 3000 });
        },
        error: () => {
          this.snackBar.open('No se pudo eliminar la tarea', 'Cerrar', { duration: 4000 });
        },
      });
  }
}
```

- [ ] **Paso 4: Reemplazar `tasks.component.html`**

```html
<div class="page">
  <div class="page-header">
    <div class="page-header__left">
      <button mat-flat-button color="primary" (click)="openCreateDialog()">
        <svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;margin-right:4px;vertical-align:middle">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Nueva tarea
      </button>
      <span class="page-header__count" *ngIf="!loading">{{ tasks.length }} tareas</span>
    </div>
    <div class="page-header__actions">
      <mat-form-field appearance="outline" subscriptSizing="dynamic" style="width:160px">
        <mat-label>Estado</mat-label>
        <mat-select [(ngModel)]="filterStatus" (selectionChange)="load()">
          <mat-option *ngFor="let s of statusOptions" [value]="s.value">{{ s.label }}</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" subscriptSizing="dynamic" style="width:180px">
        <mat-label>Cliente</mat-label>
        <mat-select [(ngModel)]="filterClientId" (selectionChange)="load()">
          <mat-option value="">Todos</mat-option>
          <mat-option *ngFor="let c of clients" [value]="c.id">{{ c.name }}</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" subscriptSizing="dynamic" style="width:180px">
        <mat-label>Técnico</mat-label>
        <mat-select [(ngModel)]="filterTechnicianId" (selectionChange)="load()">
          <mat-option value="">Todos</mat-option>
          <mat-option *ngFor="let tech of technicians" [value]="tech.id">{{ tech.user.name }}</mat-option>
        </mat-select>
      </mat-form-field>
    </div>
  </div>

  <div *ngIf="error" class="error-banner">
    {{ error }}
    <button mat-button (click)="load()">Reintentar</button>
  </div>

  <div *ngIf="loading" class="loading-row">Cargando…</div>

  <app-kanban-board
    *ngIf="!loading"
    [tasks]="tasks"
    [showTechnicianAvatar]="true"
    [selectedTaskId]="selectedTask?.id ?? null"
    (taskSelected)="selectTask($event)">
  </app-kanban-board>
</div>

<div class="drawer" [class.open]="selectedTask !== null">
  <app-admin-task-drawer
    *ngIf="selectedTask"
    [task]="selectedTask"
    (drawerClosed)="closeDrawer()">
  </app-admin-task-drawer>
</div>
```

- [ ] **Paso 5: Actualizar `tasks.component.scss`**

Eliminar los bloques `.tasks-table`, `.cell-secondary`, `.cell-mono`, `.dot` (eran de la tabla). Agregar al final:

```scss
.loading-row {
  color: var(--tx-lo);
  font-size: 12px;
  padding: 40px;
  text-align: center;
}

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

- [ ] **Paso 6: Verificar que los tests del componente pasan**

```bash
cd frontend && npx ng test --include="**/admin/tasks/tasks.component.spec.ts" --watch=false
```

Esperado: todos pasan.

- [ ] **Paso 7: Correr la suite completa**

```bash
cd frontend && npx ng test --watch=false 2>&1 | tail -10
```

Esperado: todas las suites pasan. Si falla alguna, revisar la salida completa.

- [ ] **Paso 8: Commit final**

```bash
git add frontend/src/app/features/admin/tasks/tasks.component.ts \
        frontend/src/app/features/admin/tasks/tasks.component.html \
        frontend/src/app/features/admin/tasks/tasks.component.scss \
        frontend/src/app/features/admin/tasks/tasks.component.spec.ts
git commit -m "feat(admin): reemplazar tabla por kanban con filtros cliente/técnico y drawer de solo lectura"
```
