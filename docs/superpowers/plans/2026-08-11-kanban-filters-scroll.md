# Kanban Filters & Scroll — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar filtros por cliente (con buscador) y tipo de tarea al kanban del técnico, y hacer que las columnas tengan scroll interno en lugar de extender la página.

**Architecture:** Los filtros viven como `FormControl`s en `TaskListComponent`. Un getter `filteredTasks` aplica ambos filtros (AND) y se pasa al kanban. `KanbanBoardComponent` recibe un `@Input() scrollable` que activa `max-height` + `overflow-y: auto` en el cuerpo de cada columna. Los KPIs del greeting siguen usando `this.tasks` sin filtrar.

**Tech Stack:** Angular 19, Angular Material (MatAutocompleteModule, MatIconModule), ReactiveFormsModule (ya importado en TechnicianModule)

## Global Constraints

- `appearance="outline"` es el único valor permitido en `mat-form-field`
- Sin `::ng-deep` — usar CSS custom properties con `[ngClass]`
- Sin `FormsModule` — usar `[formControl]` de ReactiveFormsModule
- Sin standalone components
- TDD obligatorio: test antes que implementación
- Archivos base: `frontend/src/app/`

---

## File Structure

| Archivo | Cambio |
|---|---|
| `shared/components/kanban-board/kanban-board.component.ts` | Agregar `@Input() scrollable = false` |
| `shared/components/kanban-board/kanban-board.component.html` | `[class.kanban--scrollable]="scrollable"` en `.kanban` |
| `shared/components/kanban-board/kanban-board.component.scss` | Agregar `.kanban--scrollable` con max-height y overflow |
| `shared/components/kanban-board/kanban-board.component.spec.ts` | Agregar test del input scrollable |
| `features/technician/task-list/task-list.component.ts` | Agregar FormControls, selectedClientId, getters filteredTasks/clientOptions, taskTypes, onClientSelected, clearClientFilter |
| `features/technician/task-list/task-list.component.html` | Barra de filtros; cambiar `[tasks]="tasks"` → `[tasks]="filteredTasks"` y agregar `[scrollable]="true"` |
| `features/technician/task-list/task-list.component.scss` | Agregar `.filter-bar` |
| `features/technician/task-list/task-list.component.spec.ts` | Agregar tests para filteredTasks y clientOptions |
| `features/technician/technician.module.ts` | Agregar MatAutocompleteModule y MatIconModule |

---

### Task 1: KanbanBoard — input `scrollable` y CSS

**Files:**
- Modify: `shared/components/kanban-board/kanban-board.component.spec.ts`
- Modify: `shared/components/kanban-board/kanban-board.component.ts`
- Modify: `shared/components/kanban-board/kanban-board.component.html`
- Modify: `shared/components/kanban-board/kanban-board.component.scss`

**Interfaces:**
- Produces: `KanbanBoardComponent` acepta `@Input() scrollable: boolean`. Cuando `true`, `.kanban` tiene clase `kanban--scrollable` y cada `.kanban__col-body` tiene `max-height: calc(100vh - 300px); overflow-y: auto`.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `describe('KanbanBoardComponent')` en `kanban-board.component.spec.ts`, antes del `});` de cierre:

```typescript
describe('scrollable input', () => {
  it('agrega clase kanban--scrollable cuando scrollable es true', () => {
    component.scrollable = true;
    fixture.detectChanges();
    const kanban: HTMLElement = fixture.nativeElement.querySelector('.kanban');
    expect(kanban.classList.contains('kanban--scrollable')).toBe(true);
  });

  it('NO agrega clase kanban--scrollable cuando scrollable es false (default)', () => {
    // scrollable es false por defecto — no hace falta setear
    fixture.detectChanges();
    const kanban: HTMLElement = fixture.nativeElement.querySelector('.kanban');
    expect(kanban.classList.contains('kanban--scrollable')).toBe(false);
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

```
cd frontend
npx ng test --include="**/kanban-board.component.spec.ts" --watch=false
```

Esperado: FAIL — `component.scrollable` no existe.

- [ ] **Step 3: Agregar `@Input() scrollable` al componente**

En `kanban-board.component.ts`, agregar el input (importar `Input` si no está):

```typescript
@Input() scrollable = false;
```

La clase completa queda:
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
  @Input() scrollable = false;
  @Output() taskSelected = new EventEmitter<Task>();

  private sortByDate(tasks: Task[]): Task[] {
    return [...tasks].sort((a, b) => daysFromToday(a.scheduledDate) - daysFromToday(b.scheduledDate));
  }

  get kanbanBacklog(): Task[]    { return this.sortByDate(this.tasks.filter(t => t.status === 'PENDING')); }
  get kanbanInProgress(): Task[] { return this.sortByDate(this.tasks.filter(t => t.status === 'IN_PROGRESS')); }
  get kanbanDone(): Task[]       { return this.tasks.filter(t => t.status === 'DONE' || t.status === 'ESCALATED' || t.status === 'NOT_DONE'); }

  onTaskSelected(task: Task): void { this.taskSelected.emit(task); }
}
```

- [ ] **Step 4: Agregar binding de clase en el template**

En `kanban-board.component.html`, cambiar la primera línea:

```html
<!-- ANTES -->
<div class="kanban">

<!-- DESPUÉS -->
<div class="kanban" [class.kanban--scrollable]="scrollable">
```

- [ ] **Step 5: Agregar reglas CSS para `.kanban--scrollable`**

Agregar al final de `kanban-board.component.scss`:

```scss
.kanban--scrollable {
  align-items: stretch;

  .kanban__col {
    min-height: 0;
  }

  .kanban__col-body {
    overflow-y: auto;
    max-height: calc(100vh - 300px);
    min-height: 80px;
  }
}
```

- [ ] **Step 6: Correr los tests y verificar que pasan**

```
cd frontend
npx ng test --include="**/kanban-board.component.spec.ts" --watch=false
```

Esperado: todos los tests pasan, incluyendo los 2 nuevos de `scrollable`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/shared/components/kanban-board/kanban-board.component.ts
git add frontend/src/app/shared/components/kanban-board/kanban-board.component.html
git add frontend/src/app/shared/components/kanban-board/kanban-board.component.scss
git add frontend/src/app/shared/components/kanban-board/kanban-board.component.spec.ts
git commit -m "feat(kanban): agregar input scrollable con max-height y overflow en columnas"
```

---

### Task 2: TaskListComponent — lógica de filtros (TDD)

**Files:**
- Modify: `features/technician/task-list/task-list.component.spec.ts`
- Modify: `features/technician/task-list/task-list.component.ts`

**Interfaces:**
- Consumes: nada nuevo del exterior
- Produces:
  - `component.selectedClientId: string | null` — ID del cliente seleccionado en autocomplete
  - `component.clientSearchCtrl: FormControl<string>` — texto de búsqueda del autocomplete
  - `component.typeCtrl: FormControl<TaskType | null>` — tipo de tarea seleccionado
  - `component.filteredTasks: Task[]` — getter, aplica ambos filtros sobre `this.tasks`
  - `component.clientOptions: { id: string; name: string }[]` — getter, clientes únicos filtrados por búsqueda
  - `component.taskTypes: { value: TaskType; label: string }[]` — array estático
  - `component.onClientSelected(event: MatAutocompleteSelectedEvent): void`
  - `component.clearClientFilter(): void`

- [ ] **Step 1: Escribir los tests que fallan**

Agregar estos dos `describe` al final de `describe('TaskListComponent')` en `task-list.component.spec.ts`, antes del `});` de cierre:

```typescript
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
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

```
cd frontend
npx ng test --include="**/task-list.component.spec.ts" --watch=false
```

Esperado: FAIL — `filteredTasks`, `clientOptions`, `selectedClientId`, `typeCtrl`, `clientSearchCtrl` no existen.

- [ ] **Step 3: Implementar la lógica de filtros en el componente**

Reemplazar `task-list.component.ts` completo:

```typescript
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { Task, TaskStatus, TaskType } from '../../../core/models/task.models';
import { AuthService } from '../../../core/services/auth.service';
import { TasksService } from '../../../core/services/tasks.service';
import { typeLabel } from '../../../shared/utils/task-labels';
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

  // ── Filtros ───────────────────────────────────────────────────
  selectedClientId: string | null = null;
  clientSearchCtrl = new FormControl<string>('', { nonNullable: true });
  typeCtrl = new FormControl<TaskType | null>(null);

  readonly taskTypes: { value: TaskType; label: string }[] = [
    { value: 'SERVER_HOST_MAINTENANCE',    label: typeLabel('SERVER_HOST_MAINTENANCE')    },
    { value: 'WINDOWS_DOMAIN_MAINTENANCE', label: typeLabel('WINDOWS_DOMAIN_MAINTENANCE') },
    { value: 'QNAP_MAINTENANCE',           label: typeLabel('QNAP_MAINTENANCE')           },
    { value: 'VEEAM_BACKUP',              label: typeLabel('VEEAM_BACKUP')               },
    { value: 'ROUTER_MAINTENANCE',         label: typeLabel('ROUTER_MAINTENANCE')         },
    { value: 'TERMINAL_MAINTENANCE',       label: typeLabel('TERMINAL_MAINTENANCE')       },
    { value: 'SITE_VISIT',               label: typeLabel('SITE_VISIT')                  },
    { value: 'AV_CONTROL',              label: typeLabel('AV_CONTROL')                   },
    { value: 'UPS_CONTROL',             label: typeLabel('UPS_CONTROL')                  },
    { value: 'ENDPOINT_INVENTORY',       label: typeLabel('ENDPOINT_INVENTORY')           },
  ];

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private authService: AuthService,
    private tasksService: TasksService,
  ) {}

  get currentUser() { return this.authService.getCurrentUser(); }

  // ── KPI getters (sobre tasks sin filtrar) ─────────────────────

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

  // ── Filtros ───────────────────────────────────────────────────

  get filteredTasks(): Task[] {
    return this.tasks.filter(t =>
      (!this.selectedClientId || t.clientId === this.selectedClientId) &&
      (!this.typeCtrl.value   || t.type     === this.typeCtrl.value),
    );
  }

  get clientOptions(): { id: string; name: string }[] {
    const search = this.clientSearchCtrl.value.toLowerCase();
    const seen = new Set<string>();
    const all = this.tasks
      .filter(t => t.client)
      .reduce<{ id: string; name: string }[]>((acc, t) => {
        if (!seen.has(t.clientId)) {
          seen.add(t.clientId);
          acc.push({ id: t.clientId, name: t.client!.name });
        }
        return acc;
      }, [])
      .sort((a, b) => a.name.localeCompare(b.name));
    return search ? all.filter(c => c.name.toLowerCase().includes(search)) : all;
  }

  onClientSelected(event: MatAutocompleteSelectedEvent): void {
    this.selectedClientId = event.option.value as string;
    this.clientSearchCtrl.setValue(event.option.viewValue, { emitEvent: false });
  }

  clearClientFilter(): void {
    this.selectedClientId = null;
    this.clientSearchCtrl.setValue('');
  }

  // ── Lifecycle ─────────────────────────────────────────────────

  ngOnInit(): void {
    this.load();
    this.clientSearchCtrl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => { this.selectedClientId = null; });
  }

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

  onTaskStatusChanged(status: TaskStatus): void {
    this.updateTaskStatusLocally(this.selectedTask?.id, status);
  }

  private updateTaskStatusLocally(taskId: string | undefined, status: TaskStatus): void {
    if (!taskId) return;
    const idx = this.tasks.findIndex(t => t.id === taskId);
    if (idx !== -1) this.tasks[idx] = { ...this.tasks[idx], status };
  }
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

```
cd frontend
npx ng test --include="**/task-list.component.spec.ts" --watch=false
```

Esperado: todos los tests pasan, incluyendo los nuevos de `filteredTasks` y `clientOptions`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/features/technician/task-list/task-list.component.ts
git add frontend/src/app/features/technician/task-list/task-list.component.spec.ts
git commit -m "feat(task-list): filtros por cliente y tipo de tarea con FormControl"
```

---

### Task 3: Filter bar — template, módulo y estilos

**Files:**
- Modify: `features/technician/task-list/task-list.component.html`
- Modify: `features/technician/task-list/task-list.component.scss`
- Modify: `features/technician/technician.module.ts`

**Interfaces:**
- Consumes: `selectedClientId`, `clientSearchCtrl`, `typeCtrl`, `clientOptions`, `taskTypes`, `onClientSelected()`, `clearClientFilter()`, `filteredTasks` — todos definidos en Task 2.

- [ ] **Step 1: Agregar MatAutocompleteModule y MatIconModule al módulo**

En `technician.module.ts`, agregar los dos imports:

```typescript
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatIconModule } from '@angular/material/icon';
```

Y en la lista `imports: [...]` del `@NgModule`:

```typescript
imports: [
  CommonModule,
  ReactiveFormsModule,
  MatCheckboxModule,
  MatFormFieldModule,
  MatSelectModule,
  MatInputModule,
  MatButtonModule,
  MatCardModule,
  MatDialogModule,
  MatSnackBarModule,
  MatProgressSpinnerModule,
  MatAutocompleteModule,  // ← nuevo
  MatIconModule,          // ← nuevo
  TechnicianRoutingModule,
  SharedModule,
  TextFieldModule,
],
```

- [ ] **Step 2: Reemplazar el template completo**

Reemplazar `task-list.component.html` con:

```html
<div class="tl-page">

  <!-- ── Greeting ─────────────────────────────────────────── -->
  <mat-card class="greeting" appearance="outlined">
    <div class="greeting__avatar">{{ technicianName.slice(0, 1).toUpperCase() }}</div>
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

  <!-- ── Filtros ───────────────────────────────────────────── -->
  <div class="filter-bar" *ngIf="!loading">

    <mat-form-field appearance="outline" subscriptSizing="dynamic">
      <mat-label>Cliente</mat-label>
      <input matInput
             [formControl]="clientSearchCtrl"
             [matAutocomplete]="autoCliente"
             placeholder="Todos los clientes" />
      <mat-autocomplete #autoCliente="matAutocomplete"
                        (optionSelected)="onClientSelected($event)">
        <mat-option *ngFor="let c of clientOptions" [value]="c.id">{{ c.name }}</mat-option>
      </mat-autocomplete>
      <button *ngIf="selectedClientId" matSuffix mat-icon-button
              aria-label="Limpiar cliente" (click)="clearClientFilter()">
        <mat-icon>close</mat-icon>
      </button>
    </mat-form-field>

    <mat-form-field appearance="outline" subscriptSizing="dynamic">
      <mat-label>Tipo de tarea</mat-label>
      <mat-select [formControl]="typeCtrl">
        <mat-option [value]="null">Todos los tipos</mat-option>
        <mat-option *ngFor="let t of taskTypes" [value]="t.value">{{ t.label }}</mat-option>
      </mat-select>
    </mat-form-field>

  </div>

  <!-- ── Loading ───────────────────────────────────────────── -->
  <ng-container *ngIf="loading">
    <div class="kanban kanban--loading">
      <div class="skeleton" style="height:200px;border-radius:var(--radius)"></div>
      <div class="skeleton" style="height:200px;border-radius:var(--radius)"></div>
      <div class="skeleton" style="height:200px;border-radius:var(--radius)"></div>
    </div>
  </ng-container>

  <app-kanban-board
    *ngIf="!loading"
    [tasks]="filteredTasks"
    [scrollable]="true"
    [selectedTaskId]="selectedTask?.id ?? null"
    (taskSelected)="selectTask($event)">
  </app-kanban-board>

</div>

<!-- ── Drawer ─────────────────────────────────────────────── -->
<div class="drawer" [class.open]="selectedTask !== null">
  <app-task-drawer
    *ngIf="selectedTask"
    [task]="selectedTask"
    (taskCompleted)="onTaskCompleted()"
    (taskNotDone)="onTaskNotDone()"
    (taskStatusChanged)="onTaskStatusChanged($event)"
    (drawerClosed)="closeDrawer()">
  </app-task-drawer>
</div>
```

- [ ] **Step 3: Agregar estilos para la barra de filtros**

En `task-list.component.scss`, agregar después del bloque `// ── Greeting`:

```scss
// ── Barra de filtros ─────────────────────────────────────────
.filter-bar {
  display: flex;
  gap: 12px;
  flex-shrink: 0;

  mat-form-field {
    width: 220px;
  }
}
```

- [ ] **Step 4: Correr todos los tests de la feature**

```
cd frontend
npx ng test --include="**/task-list.component.spec.ts" --watch=false
npx ng test --include="**/kanban-board.component.spec.ts" --watch=false
```

Esperado: todos los tests pasan. Si algún test de template falla porque busca `app-kanban-board` con `[tasks]="tasks"` directamente, verificar que la búsqueda sea por selector, no por binding.

- [ ] **Step 5: Correr build para verificar tipos**

```
cd frontend
npx ng build --configuration development 2>&1 | head -40
```

Esperado: sin errores de TypeScript. Si hay error de tipo en `MatAutocompleteSelectedEvent`, verificar que el import esté en `task-list.component.ts`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/features/technician/task-list/task-list.component.html
git add frontend/src/app/features/technician/task-list/task-list.component.scss
git add frontend/src/app/features/technician/technician.module.ts
git commit -m "feat(task-list): barra de filtros cliente/tipo y columnas kanban scrolleables"
```

---

## Self-review checklist

- [x] Spec coverage: scrollable kanban (Task 1) ✓ · filteredTasks AND logic (Task 2) ✓ · clientOptions con buscador (Task 2) ✓ · filter bar en template (Task 3) ✓ · KPIs sin filtrar (Task 2, getter usa `this.tasks`) ✓
- [x] Sin placeholders ni TBDs
- [x] Tipos consistentes: `selectedClientId: string | null` usado igual en Task 2 spec y Task 2 impl · `typeCtrl: FormControl<TaskType | null>` consistente en spec y impl · `clientSearchCtrl` con `{ nonNullable: true }` → `.value` es siempre `string`, consistente con `.toLowerCase()` en getter
- [x] `MatAutocompleteSelectedEvent` importado en el componente TS (Task 2) y el módulo tiene `MatAutocompleteModule` (Task 3)
