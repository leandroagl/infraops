# Vista de Tareas Unificada por Ciclo — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar las vistas `admin/tasks` y `technician/task-list` con una única vista de tareas por ciclo mensual, con comportamiento por rol y drawer de ejecución unificado.

**Architecture:** Un módulo nuevo `features/tasks/` monta el componente raíz `TasksUnifiedComponent` (smart). Dos componentes presentacionales (`KpiStripComponent`, `CycleTableComponent`) reciben datos y emiten eventos. El `TaskDrawerComponent` existente se mueve a este módulo y se extiende con inputs `userRole` y `cycleClosed` para controlar qué acciones son visibles. `TasksService.getAll()` ya soporta filtros `year`/`month` — no hay cambios de backend.

**Tech Stack:** Angular 17 · Angular Material · TypeScript · Jasmine/TestBed · NgModule (sin standalone)

**Spec:** `docs/superpowers/specs/2026-08-17-tasks-unified-cycle-view-design.md`

## Global Constraints

- Sin standalone components — todo en NgModules
- Sin `mat-table` ni Ag-Grid — tabla HTML nativa con `<table>`
- Sin `appearance="fill"` ni `appearance="legacy"` — solo `appearance="outline"`
- Sin `any` en TypeScript
- Sin elementos HTML nativos en formularios — siempre Angular Material
- TDD obligatorio: test antes que implementación en cada componente
- Un archivo por confirmación de scope — no generar múltiples archivos sin confirmación
- Idioma del código: inglés; idioma de commits y comentarios: español
- Reactividad local: nunca recargar con `load()` tras una acción conocida — mutar array local

---

## Mapa de archivos

### Nuevos
```
frontend/src/app/features/tasks/
├── tasks.module.ts
├── tasks-routing.module.ts
├── tasks-unified.component.ts
├── tasks-unified.component.html
├── tasks-unified.component.scss
├── tasks-unified.component.spec.ts
├── kpi-strip/
│   ├── kpi-strip.component.ts
│   ├── kpi-strip.component.html
│   ├── kpi-strip.component.scss
│   └── kpi-strip.component.spec.ts
└── cycle-table/
    ├── cycle-table.component.ts
    ├── cycle-table.component.html
    ├── cycle-table.component.scss
    └── cycle-table.component.spec.ts
```

### Modificados
```
frontend/src/app/core/models/task.models.ts                              ← añadir TaskGroup, CycleStats
frontend/src/app/app-routing.module.ts                                   ← /tasks → TasksModule
frontend/src/app/features/admin/admin-routing.module.ts                  ← redirect /admin/tasks → /tasks
frontend/src/app/features/admin/admin.module.ts                          ← quitar TasksComponent, AdminTaskDrawerComponent
frontend/src/app/features/technician/technician.module.ts                ← quitar TaskListComponent + drawer components
frontend/src/app/features/technician/task-drawer/task-drawer.component.ts    ← añadir userRole, cycleClosed
frontend/src/app/features/technician/task-drawer/task-drawer.component.html  ← wrappear acciones en ngIf
frontend/src/app/features/technician/task-drawer/task-drawer.component.spec.ts ← nuevos tests de permisos
```

### Eliminados
```
frontend/src/app/features/admin/tasks/tasks.component.{ts,html,scss,spec.ts}
frontend/src/app/features/admin/tasks/admin-task-drawer/*
frontend/src/app/features/technician/task-list/*
```

### Movidos (declaración migra, archivos permanecen en sitio hasta Task 5)
```
features/technician/task-drawer/task-drawer.component.ts       → declarado en TasksModule
features/technician/task-drawer/(todos los sub-componentes)    → declarados en TasksModule
features/admin/tasks/task-create-dialog/*                      → declarado en TasksModule
```

---

## Task 1: Tipos + scaffold del módulo + routing

**Files:**
- Modify: `frontend/src/app/core/models/task.models.ts`
- Create: `frontend/src/app/features/tasks/tasks-routing.module.ts`
- Create: `frontend/src/app/features/tasks/tasks.module.ts`
- Create: `frontend/src/app/features/tasks/tasks-unified.component.ts`
- Create: `frontend/src/app/features/tasks/tasks-unified.component.html`
- Create: `frontend/src/app/features/tasks/tasks-unified.component.scss`
- Modify: `frontend/src/app/app-routing.module.ts`
- Modify: `frontend/src/app/features/admin/admin-routing.module.ts`
- Modify: `frontend/src/app/features/admin/admin.module.ts`

**Interfaces:**
- Produces: `TaskGroup { clientId, clientName, tasks: Task[] }`, `CycleStats { assigned, inprogress, pending, done }`

- [ ] **Step 1: Añadir tipos a task.models.ts**

Al final de `frontend/src/app/core/models/task.models.ts`, agregar:

```typescript
export interface TaskGroup {
  clientId: string;
  clientName: string;
  tasks: Task[];
}

export interface CycleStats {
  assigned: number;
  inprogress: number;
  pending: number;
  done: number;
}
```

- [ ] **Step 2: Crear tasks-routing.module.ts**

```typescript
// frontend/src/app/features/tasks/tasks-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TasksUnifiedComponent } from './tasks-unified.component';

const routes: Routes = [
  { path: '', component: TasksUnifiedComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TasksRoutingModule {}
```

- [ ] **Step 3: Crear tasks-unified.component.ts (stub)**

```typescript
// frontend/src/app/features/tasks/tasks-unified.component.ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-tasks-unified',
  templateUrl: './tasks-unified.component.html',
  styleUrl: './tasks-unified.component.scss',
})
export class TasksUnifiedComponent {}
```

- [ ] **Step 4: Crear tasks-unified.component.html (stub)**

```html
<!-- frontend/src/app/features/tasks/tasks-unified.component.html -->
<p>Tareas — en construcción</p>
```

- [ ] **Step 5: Crear tasks-unified.component.scss (vacío)**

```scss
// frontend/src/app/features/tasks/tasks-unified.component.scss
```

- [ ] **Step 6: Crear tasks.module.ts**

```typescript
// frontend/src/app/features/tasks/tasks.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TasksRoutingModule } from './tasks-routing.module';
import { TasksUnifiedComponent } from './tasks-unified.component';

@NgModule({
  declarations: [TasksUnifiedComponent],
  imports: [CommonModule, TasksRoutingModule],
})
export class TasksModule {}
```

- [ ] **Step 7: Actualizar app-routing.module.ts**

Cambiar el bloque de `/tasks`:

```typescript
// ANTES
{
  path: 'tasks',
  loadChildren: () =>
    import('./features/technician/technician.module').then(m => m.TechnicianModule),
},

// DESPUÉS
{
  path: 'tasks',
  loadChildren: () =>
    import('./features/tasks/tasks.module').then(m => m.TasksModule),
},
```

- [ ] **Step 8: Actualizar admin-routing.module.ts**

Reemplazar la ruta `tasks` dentro del AdminLayout por un redirect, y cambiar el default:

```typescript
// frontend/src/app/features/admin/admin-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminLayoutComponent } from './admin-layout/admin-layout.component';
import { UsersComponent } from './users/users.component';
import { TechniciansComponent } from './technicians/technicians.component';
import { SyncComponent } from './sync/sync.component';

const routes: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    children: [
      { path: 'users',       component: UsersComponent       },
      { path: 'technicians', component: TechniciansComponent },
      { path: 'sync',        component: SyncComponent        },
      { path: 'tasks',       redirectTo: '/tasks', pathMatch: 'full' },
      { path: '',            redirectTo: 'users',  pathMatch: 'full' },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminRoutingModule {}
```

- [ ] **Step 9: Actualizar admin.module.ts — quitar TasksComponent y AdminTaskDrawerComponent**

Eliminar del array `declarations`:
- `TasksComponent`
- `TaskCreateDialogComponent`  
- `AdminTaskDrawerComponent`

Eliminar sus imports correspondientes. El resto del módulo queda intacto.

- [ ] **Step 10: Verificar que compila**

```bash
cd frontend && npx ng build --configuration development 2>&1 | tail -20
```

Esperado: sin errores de compilación.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/app/core/models/task.models.ts \
        frontend/src/app/features/tasks/ \
        frontend/src/app/app-routing.module.ts \
        frontend/src/app/features/admin/admin-routing.module.ts \
        frontend/src/app/features/admin/admin.module.ts
git commit -m "feat(tasks): scaffold módulo unificado de tareas por ciclo, actualizar routing"
```

---

## Task 2: KpiStripComponent

**Files:**
- Create: `frontend/src/app/features/tasks/kpi-strip/kpi-strip.component.ts`
- Create: `frontend/src/app/features/tasks/kpi-strip/kpi-strip.component.html`
- Create: `frontend/src/app/features/tasks/kpi-strip/kpi-strip.component.scss`
- Create: `frontend/src/app/features/tasks/kpi-strip/kpi-strip.component.spec.ts`
- Modify: `frontend/src/app/features/tasks/tasks.module.ts`

**Interfaces:**
- Consumes: `CycleStats` de `task.models.ts`
- Produces: componente presentacional sin outputs

- [ ] **Step 1: Escribir el test**

```typescript
// frontend/src/app/features/tasks/kpi-strip/kpi-strip.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { KpiStripComponent } from './kpi-strip.component';
import { CycleStats } from '../../../core/models/task.models';

const STATS: CycleStats = { assigned: 24, inprogress: 4, pending: 10, done: 8 };

describe('KpiStripComponent', () => {
  let component: KpiStripComponent;
  let fixture: ComponentFixture<KpiStripComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [KpiStripComponent],
      imports: [NoopAnimationsModule],
    }).compileComponents();
    fixture = TestBed.createComponent(KpiStripComponent);
    component = fixture.componentInstance;
    component.stats = STATS;
    component.closed = false;
    fixture.detectChanges();
  });

  it('renderiza los cuatro valores de KPI', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('24');
    expect(el.textContent).toContain('4');
    expect(el.textContent).toContain('10');
    expect(el.textContent).toContain('8');
  });

  it('muestra badge "Ciclo abierto" cuando closed=false', () => {
    expect(fixture.nativeElement.textContent).toContain('Ciclo abierto');
  });

  it('muestra badge "Ciclo cerrado" cuando closed=true', () => {
    component.closed = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ciclo cerrado');
  });

  it('calcula el porcentaje de avance correctamente', () => {
    // 8/24 = 33%
    expect(fixture.nativeElement.textContent).toContain('33%');
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

```bash
cd frontend && npx ng test --include="**/kpi-strip.component.spec.ts" --watch=false 2>&1 | tail -15
```

Esperado: FAILED — "KpiStripComponent is not declared"

- [ ] **Step 3: Crear kpi-strip.component.ts**

```typescript
// frontend/src/app/features/tasks/kpi-strip/kpi-strip.component.ts
import { Component, Input } from '@angular/core';
import { CycleStats } from '../../../core/models/task.models';

@Component({
  selector: 'app-kpi-strip',
  templateUrl: './kpi-strip.component.html',
  styleUrl: './kpi-strip.component.scss',
})
export class KpiStripComponent {
  @Input() stats!: CycleStats;
  @Input() closed = false;

  get progressPct(): number {
    if (!this.stats?.assigned) return 0;
    return Math.round((this.stats.done / this.stats.assigned) * 100);
  }
}
```

- [ ] **Step 4: Crear kpi-strip.component.html**

```html
<!-- frontend/src/app/features/tasks/kpi-strip/kpi-strip.component.html -->
<div class="kpi-strip">
  <div class="kpi-block">
    <div class="kpi-label">Asignadas</div>
    <div class="kpi-val kpi-val--assigned">{{ stats.assigned }}</div>
  </div>
  <div class="kpi-sep"></div>
  <div class="kpi-block">
    <div class="kpi-label">En curso</div>
    <div class="kpi-val kpi-val--inprogress">{{ stats.inprogress }}</div>
  </div>
  <div class="kpi-sep"></div>
  <div class="kpi-block">
    <div class="kpi-label">Pendientes</div>
    <div class="kpi-val kpi-val--pending">{{ stats.pending }}</div>
  </div>
  <div class="kpi-sep"></div>
  <div class="kpi-block">
    <div class="kpi-label">Completadas</div>
    <div class="kpi-val kpi-val--done">{{ stats.done }}</div>
  </div>

  <div class="kpi-progress">
    <div class="kpi-progress-row">
      <span class="kpi-progress-title">Avance del ciclo</span>
      <span class="kpi-progress-pct">{{ progressPct }}%</span>
    </div>
    <div class="kpi-progress-bar">
      <div class="kpi-progress-fill" [style.width.%]="progressPct"></div>
    </div>
  </div>

  <span class="kpi-cycle-badge"
        [class.kpi-cycle-badge--closed]="closed"
        [class.kpi-cycle-badge--open]="!closed">
    {{ closed ? '✓ Ciclo cerrado' : '● Ciclo abierto' }}
  </span>
</div>
```

- [ ] **Step 5: Crear kpi-strip.component.scss**

```scss
// frontend/src/app/features/tasks/kpi-strip/kpi-strip.component.scss
.kpi-strip {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0 24px;
  background: var(--card);
  border-bottom: 1px solid var(--border-lo);
  height: 62px;
}

.kpi-block {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 20px;
  border-right: 1px solid var(--border-lo);
  &:first-child { padding-left: 0; }
}

.kpi-sep { width: 1px; height: 28px; background: var(--border-lo); margin: 0; }

.kpi-label {
  font-size: 9px;
  color: var(--tx-lo);
  text-transform: uppercase;
  letter-spacing: .6px;
  font-family: var(--font-mono);
  margin-bottom: 3px;
}

.kpi-val {
  font-family: var(--font-mono);
  font-size: 22px;
  font-weight: 500;
  line-height: 1;
  &--assigned   { color: var(--tx-hi);   }
  &--inprogress { color: var(--accent);  }
  &--pending    { color: var(--warn);    }
  &--done       { color: var(--ok);      }
}

.kpi-progress {
  flex: 1;
  padding: 0 24px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
}

.kpi-progress-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.kpi-progress-title {
  font-size: 10px;
  color: var(--tx-lo);
  text-transform: uppercase;
  letter-spacing: .5px;
  font-family: var(--font-mono);
}

.kpi-progress-pct {
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font-mono);
  color: var(--tx-hi);
}

.kpi-progress-bar {
  height: 5px;
  border-radius: 3px;
  background: var(--border);
  overflow: hidden;
}

.kpi-progress-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--ok);
  transition: width .4s;
}

.kpi-cycle-badge {
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 10px;
  font-family: var(--font-mono);
  font-weight: 600;
  white-space: nowrap;
  &--open   { background: var(--warn-bg); border: 1px solid var(--warn-bd); color: var(--warn); }
  &--closed { background: var(--ok-bg);   border: 1px solid var(--ok-bd);   color: var(--ok);   }
}
```

- [ ] **Step 6: Declarar en tasks.module.ts**

```typescript
import { KpiStripComponent } from './kpi-strip/kpi-strip.component';
// Añadir al array declarations: [TasksUnifiedComponent, KpiStripComponent]
```

- [ ] **Step 7: Ejecutar el test y verificar que pasa**

```bash
cd frontend && npx ng test --include="**/kpi-strip.component.spec.ts" --watch=false 2>&1 | tail -15
```

Esperado: 4 specs, 0 failures

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/features/tasks/kpi-strip/ \
        frontend/src/app/features/tasks/tasks.module.ts
git commit -m "feat(tasks): agregar KpiStripComponent — cuatro KPIs y barra de avance del ciclo"
```

---

## Task 3: CycleTableComponent

**Files:**
- Create: `frontend/src/app/features/tasks/cycle-table/cycle-table.component.ts`
- Create: `frontend/src/app/features/tasks/cycle-table/cycle-table.component.html`
- Create: `frontend/src/app/features/tasks/cycle-table/cycle-table.component.scss`
- Create: `frontend/src/app/features/tasks/cycle-table/cycle-table.component.spec.ts`
- Modify: `frontend/src/app/features/tasks/tasks.module.ts`

**Interfaces:**
- Consumes: `TaskGroup[]`, `selectedTaskId: string | null`
- Produces: `@Output() taskSelected = new EventEmitter<Task>()`

- [ ] **Step 1: Escribir el test**

```typescript
// frontend/src/app/features/tasks/cycle-table/cycle-table.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CycleTableComponent } from './cycle-table.component';
import { Task, TaskGroup } from '../../../core/models/task.models';
import { SharedModule } from '../../../shared/shared.module';

function makeTask(id: string, clientId: string, techId: string, status: Task['status'] = 'PENDING'): Task {
  return {
    id, clientId, technicianId: techId,
    type: 'SERVER_HOST_MAINTENANCE', status,
    scheduledDate: '2026-08-01', completedDate: null,
    odooTicketId: 3810, createdAt: '2026-08-01T00:00:00Z',
    client: { id: clientId, name: 'ACME S.A.' },
    technician: { id: techId, user: { id: 'u1', name: 'Valen', email: 'v@ondra' } },
  };
}

const GROUPS: TaskGroup[] = [
  {
    clientId: 'c1', clientName: 'ACME S.A.',
    tasks: [makeTask('t1', 'c1', 'tech1', 'DONE'), makeTask('t2', 'c1', 'tech1', 'PENDING')],
  },
  {
    clientId: 'c2', clientName: 'Distribuidora Norte',
    tasks: [makeTask('t3', 'c2', 'tech2', 'IN_PROGRESS')],
  },
];

describe('CycleTableComponent', () => {
  let component: CycleTableComponent;
  let fixture: ComponentFixture<CycleTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CycleTableComponent],
      imports: [NoopAnimationsModule, SharedModule],
    }).compileComponents();
    fixture = TestBed.createComponent(CycleTableComponent);
    component = fixture.componentInstance;
    component.groups = GROUPS;
    component.selectedTaskId = null;
    fixture.detectChanges();
  });

  it('renderiza un group-header por cada grupo', () => {
    const headers = fixture.nativeElement.querySelectorAll('.group-header');
    expect(headers.length).toBe(2);
    expect(headers[0].textContent).toContain('ACME S.A.');
    expect(headers[1].textContent).toContain('Distribuidora Norte');
  });

  it('renderiza una fila por cada tarea', () => {
    const rows = fixture.nativeElement.querySelectorAll('.task-row');
    expect(rows.length).toBe(3);
  });

  it('emite taskSelected al hacer click en una fila', () => {
    const emitted: Task[] = [];
    component.taskSelected.subscribe((t: Task) => emitted.push(t));
    const row: HTMLElement = fixture.nativeElement.querySelector('.task-row');
    row.click();
    expect(emitted.length).toBe(1);
    expect(emitted[0].id).toBe('t1');
  });

  it('aplica clase selected a la fila cuyo id coincide con selectedTaskId', () => {
    component.selectedTaskId = 't2';
    fixture.detectChanges();
    const rows: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.task-row');
    expect(rows[1].classList).toContain('selected');
    expect(rows[0].classList).not.toContain('selected');
  });

  it('muestra el progreso por grupo (done/total)', () => {
    const headers = fixture.nativeElement.querySelectorAll('.group-header');
    expect(headers[0].textContent).toContain('1/2');
  });

  it('muestra el número de ticket Odoo', () => {
    const firstRow: HTMLElement = fixture.nativeElement.querySelector('.task-row');
    expect(firstRow.textContent).toContain('3810');
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

```bash
cd frontend && npx ng test --include="**/cycle-table.component.spec.ts" --watch=false 2>&1 | tail -15
```

Esperado: FAILED — "CycleTableComponent is not declared"

- [ ] **Step 3: Crear cycle-table.component.ts**

```typescript
// frontend/src/app/features/tasks/cycle-table/cycle-table.component.ts
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Task, TaskGroup } from '../../../core/models/task.models';
import { typeLabel, typeBadge, statusLabel, statusBadge } from '../../../shared/utils/task-labels';
import { formatOdooTicketId } from '../../../shared/utils/odoo';

@Component({
  selector: 'app-cycle-table',
  templateUrl: './cycle-table.component.html',
  styleUrl: './cycle-table.component.scss',
})
export class CycleTableComponent {
  @Input() groups: TaskGroup[] = [];
  @Input() selectedTaskId: string | null = null;
  @Output() taskSelected = new EventEmitter<Task>();

  groupDoneCount(group: TaskGroup): number {
    return group.tasks.filter(t => t.status === 'DONE').length;
  }

  groupProgressPct(group: TaskGroup): number {
    if (!group.tasks.length) return 0;
    return Math.round((this.groupDoneCount(group) / group.tasks.length) * 100);
  }

  typeLabel(t: Task): string  { return typeLabel(t.type); }
  typeBadge(t: Task): string  { return typeBadge(t.type); }
  statusLabel(t: Task): string { return statusLabel(t.status); }
  statusBadge(t: Task): string { return statusBadge(t.status); }

  ticketLabel(t: Task): string {
    return t.odooTicketId != null ? formatOdooTicketId(t.odooTicketId) : '—';
  }
}
```

- [ ] **Step 4: Crear cycle-table.component.html**

```html
<!-- frontend/src/app/features/tasks/cycle-table/cycle-table.component.html -->
<table class="cycle-table">
  <thead>
    <tr>
      <th>Tipo</th>
      <th>Técnico</th>
      <th>Estado</th>
      <th>Ticket Odoo</th>
      <th>Notas</th>
    </tr>
  </thead>
  <tbody>
    <ng-container *ngFor="let group of groups">
      <tr class="group-header">
        <td colspan="5">
          <div class="group-label">
            <span class="group-label__client">{{ group.clientName }}</span>
            <span class="group-label__count">{{ group.tasks.length }} tareas</span>
            <span class="group-label__progress">
              <div class="group-progress-bar">
                <div class="group-progress-fill"
                     [style.width.%]="groupProgressPct(group)"></div>
              </div>
              <span class="group-progress-text">
                {{ groupDoneCount(group) }}/{{ group.tasks.length }}
              </span>
            </span>
          </div>
        </td>
      </tr>
      <tr *ngFor="let task of group.tasks"
          class="task-row"
          [class.selected]="task.id === selectedTaskId"
          [class.cancelled]="task.status === 'NOT_DONE'"
          (click)="taskSelected.emit(task)">
        <td>
          <span class="badge" [ngClass]="typeBadge(task)">{{ typeLabel(task) }}</span>
        </td>
        <td>
          <div class="col-tech">
            <span class="avatar">{{ task.technician?.user?.name?.slice(0,1) ?? '?' }}</span>
            {{ task.technician?.user?.name ?? '—' }}
          </div>
        </td>
        <td>
          <span class="badge" [ngClass]="statusBadge(task)">{{ statusLabel(task) }}</span>
        </td>
        <td>
          <span class="col-ticket" [class.col-ticket--none]="!task.odooTicketId">
            {{ ticketLabel(task) }}
          </span>
        </td>
        <td>
          <span class="col-notes">—</span>
        </td>
      </tr>
    </ng-container>

    <tr *ngIf="groups.length === 0">
      <td colspan="5" class="empty-state">
        Sin tareas para este ciclo con los filtros actuales
      </td>
    </tr>
  </tbody>
</table>
```

- [ ] **Step 5: Crear cycle-table.component.scss**

```scss
// frontend/src/app/features/tasks/cycle-table/cycle-table.component.scss
.cycle-table {
  width: 100%;
  border-collapse: collapse;

  thead tr {
    background: var(--card);
    border-bottom: 1px solid var(--border-lo);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  thead th {
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .5px;
    color: var(--tx-lo);
    font-family: var(--font-mono);
    padding: 9px 14px;
    text-align: left;
  }
}

.group-header td {
  padding: 9px 14px 5px;
  background: var(--base);
  border-top: 2px solid var(--border);
}

.group-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .8px;
  font-family: var(--font-mono);
  display: flex;
  align-items: center;
  gap: 8px;

  &__client { color: var(--tx-md); }

  &__count {
    font-size: 9px;
    padding: 1px 6px;
    border-radius: 10px;
    background: var(--card);
    border: 1px solid var(--border-lo);
    color: var(--tx-lo);
  }

  &__progress {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
  }
}

.group-progress-bar {
  width: 64px;
  height: 3px;
  border-radius: 2px;
  background: var(--border);
  overflow: hidden;
}

.group-progress-fill {
  height: 100%;
  border-radius: 2px;
  background: var(--ok);
}

.group-progress-text {
  font-size: 9px;
  color: var(--tx-lo);
  font-family: var(--font-mono);
}

.task-row {
  border-bottom: 1px solid var(--border-lo);
  cursor: pointer;
  transition: background .12s ease;

  &:hover { background: var(--hover); }
  &.selected { background: var(--elevated); }
  &.cancelled td { opacity: .5; }

  td { padding: 9px 14px; vertical-align: middle; }
  td:first-child { padding-left: 28px; }
}

.col-tech {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--tx-md);
}

.avatar {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--elevated);
  border: 1px solid var(--border);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 600;
  color: var(--tx-md);
  font-family: var(--font-mono);
  flex-shrink: 0;
}

.col-ticket {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--accent);
  cursor: pointer;
  &:hover { text-decoration: underline; }
  &--none { color: var(--tx-lo); cursor: default; &:hover { text-decoration: none; } }
}

.col-notes {
  font-size: 11px;
  color: var(--tx-lo);
  font-style: italic;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-state {
  padding: 60px 24px;
  text-align: center;
  color: var(--tx-lo);
  font-size: 12px;
}
```

- [ ] **Step 6: Declarar CycleTableComponent en tasks.module.ts**

Añadir a `declarations`: `CycleTableComponent`
Añadir a `imports`: `CommonModule` (ya está), `SharedModule`

```typescript
import { SharedModule } from '../../shared/shared.module';
import { CycleTableComponent } from './cycle-table/cycle-table.component';
// declarations: [TasksUnifiedComponent, KpiStripComponent, CycleTableComponent]
// imports: [CommonModule, TasksRoutingModule, SharedModule]
```

- [ ] **Step 7: Ejecutar el test y verificar que pasa**

```bash
cd frontend && npx ng test --include="**/cycle-table.component.spec.ts" --watch=false 2>&1 | tail -15
```

Esperado: 6 specs, 0 failures

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/features/tasks/cycle-table/ \
        frontend/src/app/features/tasks/tasks.module.ts
git commit -m "feat(tasks): agregar CycleTableComponent — tabla de tareas agrupada por cliente"
```

---

## Task 4: TasksUnifiedComponent (smart)

**Files:**
- Modify: `frontend/src/app/features/tasks/tasks-unified.component.ts`
- Modify: `frontend/src/app/features/tasks/tasks-unified.component.html`
- Modify: `frontend/src/app/features/tasks/tasks-unified.component.scss`
- Create: `frontend/src/app/features/tasks/tasks-unified.component.spec.ts`
- Modify: `frontend/src/app/features/tasks/tasks.module.ts`

**Interfaces:**
- Consumes: `TasksService.getAll({ month, year, technicianId? })`, `AuthService.getCurrentUser()`
- Produces: `groups: TaskGroup[]`, `stats: CycleStats`, `cycleClosed: boolean` — pasados a hijos presentacionales

- [ ] **Step 1: Escribir el test**

```typescript
// frontend/src/app/features/tasks/tasks-unified.component.spec.ts
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
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

```bash
cd frontend && npx ng test --include="**/tasks-unified.component.spec.ts" --watch=false 2>&1 | tail -15
```

Esperado: FAILED

- [ ] **Step 3: Implementar tasks-unified.component.ts**

```typescript
// frontend/src/app/features/tasks/tasks-unified.component.ts
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Task, TaskGroup, TaskStatus, CycleStats } from '../../core/models/task.models';
import { TasksService } from '../../core/services/tasks.service';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models/auth.models';

@Component({
  selector: 'app-tasks-unified',
  templateUrl: './tasks-unified.component.html',
  styleUrl: './tasks-unified.component.scss',
})
export class TasksUnifiedComponent implements OnInit {
  tasks: Task[] = [];
  selectedTask: Task | null = null;
  loading = false;
  error = '';
  currentMonth: number;
  currentYear: number;
  techFilter: string | null = null;

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private tasksService: TasksService,
    private authService: AuthService,
  ) {
    const now = new Date();
    this.currentMonth = now.getMonth() + 1;
    this.currentYear  = now.getFullYear();
  }

  get currentUser() { return this.authService.getCurrentUser(); }
  get userRole(): UserRole { return this.currentUser?.role ?? 'TECHNICIAN'; }

  get canCreateTask(): boolean {
    return this.userRole === 'ADMIN' || this.userRole === 'TL';
  }

  get cycleClosed(): boolean {
    const now = new Date();
    const nowYear  = now.getFullYear();
    const nowMonth = now.getMonth() + 1;
    return this.currentYear < nowYear
      || (this.currentYear === nowYear && this.currentMonth < nowMonth);
  }

  get monthLabel(): string {
    const names = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    return `${names[this.currentMonth - 1]} ${this.currentYear}`;
  }

  get groups(): TaskGroup[] {
    const map = new Map<string, TaskGroup>();
    for (const task of this.tasks) {
      const clientId   = task.clientId;
      const clientName = task.client?.name ?? clientId;
      if (!map.has(clientId)) {
        map.set(clientId, { clientId, clientName, tasks: [] });
      }
      map.get(clientId)!.tasks.push(task);
    }
    return Array.from(map.values());
  }

  get stats(): CycleStats {
    return {
      assigned:   this.tasks.length,
      inprogress: this.tasks.filter(t => t.status === 'IN_PROGRESS').length,
      pending:    this.tasks.filter(t => t.status === 'PENDING').length,
      done:       this.tasks.filter(t => t.status === 'DONE').length,
    };
  }

  ngOnInit(): void {
    const user = this.currentUser;
    if (user?.role === 'TECHNICIAN' && user.technicianId) {
      this.techFilter = user.technicianId;
    }
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error   = '';
    const filters: Record<string, unknown> = {
      month: this.currentMonth,
      year:  this.currentYear,
    };
    if (this.techFilter) filters['technicianId'] = this.techFilter;
    this.tasksService.getAll(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:  tasks => { this.tasks = tasks; this.loading = false; },
      error: ()    => { this.error = 'No se pudieron cargar las tareas.'; this.loading = false; },
    });
  }

  prevMonth(): void {
    if (this.currentMonth === 1) { this.currentMonth = 12; this.currentYear--; }
    else { this.currentMonth--; }
    this.selectedTask = null;
    this.load();
  }

  nextMonth(): void {
    if (this.currentMonth === 12) { this.currentMonth = 1; this.currentYear++; }
    else { this.currentMonth++; }
    this.selectedTask = null;
    this.load();
  }

  toggleTechFilter(): void {
    const user = this.currentUser;
    if (!user?.technicianId) return;
    this.techFilter = this.techFilter ? null : user.technicianId;
    this.load();
  }

  selectTask(task: Task): void { this.selectedTask = task; }
  closeDrawer(): void          { this.selectedTask = null; }

  onTaskStatusChanged(status: TaskStatus): void {
    if (!this.selectedTask) return;
    const idx = this.tasks.findIndex(t => t.id === this.selectedTask!.id);
    if (idx !== -1) this.tasks[idx] = { ...this.tasks[idx], status };
  }

  onTaskCompleted(): void {
    this.onTaskStatusChanged('DONE');
    this.closeDrawer();
  }

  onTaskNotDone(): void {
    this.onTaskStatusChanged('NOT_DONE');
    this.closeDrawer();
  }

  onTaskDeleted(): void {
    if (!this.selectedTask) return;
    this.tasks = this.tasks.filter(t => t.id !== this.selectedTask!.id);
    this.closeDrawer();
  }
}
```

- [ ] **Step 4: Implementar tasks-unified.component.html**

```html
<!-- frontend/src/app/features/tasks/tasks-unified.component.html -->

<!-- Controls bar -->
<div class="controls-bar">
  <div class="month-nav">
    <button mat-icon-button (click)="prevMonth()">
      <mat-icon>chevron_left</mat-icon>
    </button>
    <span class="month-label">{{ monthLabel }}</span>
    <button mat-icon-button (click)="nextMonth()">
      <mat-icon>chevron_right</mat-icon>
    </button>
  </div>

  <div class="controls-sep"></div>

  <div class="filter-chip"
       [class.applied]="!!techFilter"
       (click)="toggleTechFilter()">
    Técnico: {{ techFilter ? currentUser?.email?.split('@')[0] : 'Todos' }}
  </div>

  <div class="controls-spacer"></div>

  <button *ngIf="canCreateTask" mat-flat-button color="primary">
    <mat-icon>add</mat-icon>
    Nueva tarea
  </button>
</div>

<!-- KPI strip -->
<app-kpi-strip [stats]="stats" [closed]="cycleClosed"></app-kpi-strip>

<!-- Closed banner -->
<div class="cycle-closed-banner" *ngIf="cycleClosed">
  <mat-icon style="font-size:14px;height:14px;width:14px">check_circle</mat-icon>
  Ciclo cerrado — solo lectura
</div>

<!-- Error -->
<div *ngIf="error" class="error-banner">
  {{ error }}
  <button mat-button (click)="load()">Reintentar</button>
</div>

<!-- Loading -->
<div *ngIf="loading" class="loading-row">Cargando…</div>

<!-- Tabla -->
<div class="table-scroll" *ngIf="!loading">
  <app-cycle-table
    [groups]="groups"
    [selectedTaskId]="selectedTask?.id ?? null"
    (taskSelected)="selectTask($event)">
  </app-cycle-table>
</div>

<!-- Drawer -->
<div class="drawer" [class.open]="selectedTask !== null">
  <!-- Task 5 lo monta aquí -->
</div>
```

- [ ] **Step 5: Implementar tasks-unified.component.scss**

```scss
// frontend/src/app/features/tasks/tasks-unified.component.scss
:host {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.controls-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 24px;
  background: var(--surface);
  border-bottom: 1px solid var(--border-lo);
  flex-shrink: 0;
}

.month-nav {
  display: flex;
  align-items: center;
  gap: 4px;
}

.month-label {
  font-size: 15px;
  font-weight: 600;
  min-width: 164px;
  text-align: center;
  color: var(--tx-hi);
}

.controls-sep { width: 1px; height: 22px; background: var(--border-lo); }
.controls-spacer { flex: 1; }

.filter-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  border-radius: 20px;
  background: var(--card);
  border: 1px solid var(--border-lo);
  color: var(--tx-md);
  font-size: 11px;
  cursor: pointer;
  transition: background .12s;
  &:hover { background: var(--elevated); color: var(--tx-hi); }
  &.applied { background: var(--srv-bg); border-color: var(--srv-bd); color: var(--srv); }
}

.cycle-closed-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 24px;
  background: var(--ok-bg);
  border-bottom: 1px solid var(--ok-bd);
  font-size: 11px;
  color: var(--ok);
  flex-shrink: 0;
}

.error-banner {
  margin: 12px 24px;
  padding: 10px 14px;
  background: var(--crit-bg);
  border: 1px solid var(--crit-bd);
  border-radius: var(--radius-sm);
  color: var(--crit);
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.loading-row {
  padding: 24px;
  font-size: 12px;
  color: var(--tx-lo);
}

.table-scroll {
  flex: 1;
  overflow-y: auto;
}

.drawer {
  position: absolute;
  top: 0;
  right: 0;
  width: 520px;
  height: 100%;
  background: var(--surface);
  border-left: 1px solid var(--border-lo);
  transform: translateX(100%);
  transition: transform .2s ease;
  overflow-y: auto;
  z-index: 20;
  &.open { transform: translateX(0); }
}
```

- [ ] **Step 6: Añadir imports necesarios a tasks.module.ts**

```typescript
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
// declarations: [TasksUnifiedComponent, KpiStripComponent, CycleTableComponent]
// imports: [..., MatButtonModule, MatIconModule]
```

- [ ] **Step 7: Ejecutar el test y verificar que pasa**

```bash
cd frontend && npx ng test --include="**/tasks-unified.component.spec.ts" --watch=false 2>&1 | tail -20
```

Esperado: 8 specs, 0 failures

- [ ] **Step 8: Verificar visualmente que la ruta /tasks carga y muestra la tabla**

```bash
cd frontend && npx ng serve 2>&1 &
# Abrir http://localhost:4200/tasks
```

Esperado: ver controls bar con nav de mes, KPI strip y tabla (puede estar vacía si no hay backend).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/app/features/tasks/tasks-unified.component.* \
        frontend/src/app/features/tasks/tasks.module.ts
git commit -m "feat(tasks): implementar TasksUnifiedComponent — carga por ciclo mensual, agrupado por cliente, filtro por técnico"
```

---

## Task 5: Drawer unificado — extender TaskDrawerComponent

**Files:**
- Modify: `frontend/src/app/features/technician/task-drawer/task-drawer.component.ts`
- Modify: `frontend/src/app/features/technician/task-drawer/task-drawer.component.html`
- Modify: `frontend/src/app/features/technician/task-drawer/task-drawer.component.spec.ts`
- Modify: `frontend/src/app/features/tasks/tasks.module.ts`
- Modify: `frontend/src/app/features/technician/technician.module.ts`

**Interfaces:**
- Consumes (nuevo): `@Input() userRole: UserRole`, `@Input() cycleClosed: boolean`
- Produces (nuevo): `@Output() taskDeleted = new EventEmitter<void>()`
- Conserva: `taskCompleted`, `taskNotDone`, `taskStatusChanged`, `drawerClosed`

- [ ] **Step 1: Agregar tests de permisos al spec existente**

Abrir `frontend/src/app/features/technician/task-drawer/task-drawer.component.spec.ts` y añadir al bloque `describe` existente:

```typescript
// Al final del describe principal, antes del cierre }):

describe('visibilidad de acciones según rol', () => {
  function setup(role: UserRole, cycleClosed = false): ComponentFixture<TaskDrawerComponent> {
    const fix = TestBed.createComponent(TaskDrawerComponent);
    fix.componentInstance.task = mockTask;
    fix.componentInstance.userRole   = role;
    fix.componentInstance.cycleClosed = cycleClosed;
    fix.detectChanges();
    return fix;
  }

  it('TECHNICIAN ve el botón de completar', () => {
    const fix = setup('TECHNICIAN');
    const btn = fix.nativeElement.querySelector('[data-testid="btn-complete"]');
    expect(btn).toBeTruthy();
  });

  it('COORDINATOR no ve botones de acción', () => {
    const fix = setup('COORDINATOR');
    const btn = fix.nativeElement.querySelector('[data-testid="btn-complete"]');
    expect(btn).toBeFalsy();
  });

  it('ADMIN ve el botón de eliminar', () => {
    const fix = setup('ADMIN');
    const btn = fix.nativeElement.querySelector('[data-testid="btn-delete"]');
    expect(btn).toBeTruthy();
  });

  it('TECHNICIAN no ve el botón de eliminar', () => {
    const fix = setup('TECHNICIAN');
    const btn = fix.nativeElement.querySelector('[data-testid="btn-delete"]');
    expect(btn).toBeFalsy();
  });

  it('ciclo cerrado oculta todos los botones de acción', () => {
    const fix = setup('ADMIN', true);
    expect(fix.nativeElement.querySelector('[data-testid="btn-complete"]')).toBeFalsy();
    expect(fix.nativeElement.querySelector('[data-testid="btn-delete"]')).toBeFalsy();
  });
});
```

Agregar el import de `UserRole` al spec:
```typescript
import { UserRole } from '../../../../core/models/auth.models';
```

- [ ] **Step 2: Ejecutar tests del drawer y verificar que los nuevos fallan**

```bash
cd frontend && npx ng test --include="**/task-drawer.component.spec.ts" --watch=false 2>&1 | tail -20
```

Esperado: los tests preexistentes pasan; los nuevos de "visibilidad de acciones" fallan.

- [ ] **Step 3: Añadir inputs/outputs a task-drawer.component.ts**

Al inicio de la clase `TaskDrawerComponent`, después de los `@Output()` existentes:

```typescript
import { UserRole } from '../../../core/models/auth.models';

// Dentro de la clase:
@Input() userRole: UserRole = 'TECHNICIAN';
@Input() cycleClosed = false;
@Output() taskDeleted = new EventEmitter<void>();

get canExecute(): boolean {
  return !this.cycleClosed
    && (this.userRole === 'TECHNICIAN' || this.userRole === 'TL' || this.userRole === 'ADMIN');
}

get canDelete(): boolean {
  return !this.cycleClosed && this.userRole === 'ADMIN';
}
```

- [ ] **Step 4: Actualizar task-drawer.component.html**

Envolver el bloque de botones de acción principal (los botones "Completar", "Guardar progreso", "No realizada") con:

```html
<ng-container *ngIf="canExecute">
  <!-- bloque de acciones existente con data-testid="btn-complete" en el botón completar -->
</ng-container>
```

Añadir el botón de eliminar solo para ADMIN, al final del `adr-body`:

```html
<div class="adr-admin-actions" *ngIf="canDelete">
  <button mat-stroked-button color="warn"
          data-testid="btn-delete"
          (click)="taskDeleted.emit()">
    Eliminar tarea
  </button>
</div>
```

Añadir `data-testid="btn-complete"` al botón de completar existente.

- [ ] **Step 5: Ejecutar todos los tests del drawer y verificar que pasan**

```bash
cd frontend && npx ng test --include="**/task-drawer.component.spec.ts" --watch=false 2>&1 | tail -20
```

Esperado: todos los specs pasan (incluyendo los preexistentes).

- [ ] **Step 6: Migrar declaraciones del drawer a TasksModule**

En `frontend/src/app/features/tasks/tasks.module.ts`, añadir todos los componentes del drawer que actualmente están en `TechnicianModule`:

```typescript
import { ReactiveFormsModule } from '@angular/forms';
import { TextFieldModule } from '@angular/cdk/text-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { TaskDrawerComponent } from '../technician/task-drawer/task-drawer.component';
import { MaintenanceFormComponent } from '../technician/task-drawer/maintenance-form/maintenance-form.component';
import { ConfirmMaintenanceDialogComponent } from '../technician/task-drawer/confirm-maintenance-dialog/confirm-maintenance-dialog.component';
import { TimeSpentDialogComponent } from '../technician/task-drawer/time-spent-dialog/time-spent-dialog.component';
import { DcHealthCardComponent } from '../technician/task-drawer/maintenance-form/dc-health-card/dc-health-card.component';
import { QnapFormComponent } from '../technician/task-drawer/qnap-form/qnap-form.component';
import { QnapDeviceCardComponent } from '../technician/task-drawer/qnap-form/qnap-device-card/qnap-device-card.component';
import { VeeamFormComponent } from '../technician/task-drawer/veeam-form/veeam-form.component';
import { ServerHostFormComponent } from '../technician/task-drawer/server-host-form/server-host-form.component';
import { RouterFormComponent } from '../technician/task-drawer/router-form/router-form.component';
import { RouterDeviceCardComponent } from '../technician/task-drawer/router-form/router-device-card/router-device-card.component';
import { EsxiHostCardComponent } from '../technician/task-drawer/server-host-form/esxi-host-card/esxi-host-card.component';
import { TaskCreateDialogComponent } from '../admin/tasks/task-create-dialog/task-create-dialog.component';
```

Añadir todos al array `declarations` y sus imports de Angular Material al array `imports`.

- [ ] **Step 7: Quitar las mismas declaraciones de TechnicianModule**

En `frontend/src/app/features/technician/technician.module.ts`, eliminar de `declarations` los mismos componentes del drawer y sus imports. Dejar solo `TaskListComponent` en declarations (se eliminará en Task 7).

- [ ] **Step 8: Montar el drawer en tasks-unified.component.html**

Reemplazar el comentario `<!-- Task 5 lo monta aquí -->` en el bloque `.drawer`:

```html
<div class="drawer" [class.open]="selectedTask !== null">
  <app-task-drawer
    *ngIf="selectedTask"
    [task]="selectedTask"
    [userRole]="userRole"
    [cycleClosed]="cycleClosed"
    (taskCompleted)="onTaskCompleted()"
    (taskNotDone)="onTaskNotDone()"
    (taskStatusChanged)="onTaskStatusChanged($event)"
    (taskDeleted)="onTaskDeleted()"
    (drawerClosed)="closeDrawer()">
  </app-task-drawer>
</div>
```

- [ ] **Step 9: Implementar onTaskDeleted con confirmación en TasksUnifiedComponent**

Añadir a `tasks-unified.component.ts`:

```typescript
import { MatDialog } from '@angular/material/dialog';
import { EMPTY, switchMap } from 'rxjs';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { MatSnackBar } from '@angular/material/snack-bar';

// En el constructor:
constructor(
  private tasksService: TasksService,
  private authService: AuthService,
  private dialog: MatDialog,
  private snackBar: MatSnackBar,
) { ... }

// Reemplazar el método onTaskDeleted():
onTaskDeleted(): void {
  if (!this.selectedTask) return;
  const task = this.selectedTask;
  this.dialog.open(ConfirmDialogComponent, {
    data: {
      title: 'Eliminar tarea',
      message: `¿Eliminar la tarea de ${task.client?.name ?? 'este cliente'}? Esta acción no se puede deshacer.`,
    },
  }).afterClosed().pipe(
    takeUntilDestroyed(this.destroyRef),
    switchMap(confirmed => confirmed ? this.tasksService.delete(task.id) : EMPTY),
  ).subscribe({
    next: () => {
      this.tasks = this.tasks.filter(t => t.id !== task.id);
      this.closeDrawer();
      this.snackBar.open('Tarea eliminada', 'Cerrar', { duration: 3000 });
    },
    error: () => this.snackBar.open('No se pudo eliminar la tarea', 'Cerrar', { duration: 4000 }),
  });
}
```

Añadir a imports de `tasks.module.ts`: `MatDialogModule`, `MatSnackBarModule`.

- [ ] **Step 10: Verificar que compila**

```bash
cd frontend && npx ng build --configuration development 2>&1 | tail -20
```

- [ ] **Step 11: Ejecutar todos los tests**

```bash
cd frontend && npx ng test --watch=false 2>&1 | tail -25
```

Esperado: sin regresiones.

- [ ] **Step 12: Commit**

```bash
git add frontend/src/app/features/technician/task-drawer/task-drawer.component.ts \
        frontend/src/app/features/technician/task-drawer/task-drawer.component.html \
        frontend/src/app/features/technician/task-drawer/task-drawer.component.spec.ts \
        frontend/src/app/features/technician/technician.module.ts \
        frontend/src/app/features/tasks/tasks.module.ts \
        frontend/src/app/features/tasks/tasks-unified.component.ts \
        frontend/src/app/features/tasks/tasks-unified.component.html
git commit -m "feat(tasks): drawer unificado con permisos por rol — ADMIN puede eliminar, COORDINATOR solo lectura"
```

---

## Task 6: Cleanup — eliminar vistas antiguas

**Files:**
- Delete: `frontend/src/app/features/admin/tasks/tasks.component.{ts,html,scss,spec.ts}`
- Delete: `frontend/src/app/features/admin/tasks/admin-task-drawer/` (directorio completo)
- Delete: `frontend/src/app/features/technician/task-list/` (directorio completo)
- Modify: `frontend/src/app/features/technician/technician.module.ts`

**Interfaces:**
- Sin cambios de interfaz — solo limpieza

- [ ] **Step 1: Eliminar archivos del admin TasksComponent**

```bash
cd frontend/src/app/features/admin/tasks
rm tasks.component.ts tasks.component.html tasks.component.scss tasks.component.spec.ts
rm -rf admin-task-drawer/
```

- [ ] **Step 2: Eliminar archivos del TaskListComponent**

```bash
cd frontend/src/app/features/technician
rm -rf task-list/
```

- [ ] **Step 3: Limpiar TechnicianModule**

Después de quitar las declaraciones del drawer en Task 5, `TechnicianModule` solo debería tener `TaskListComponent`. Con la eliminación del Step 2, quitar esa declaración también.

Si el módulo queda vacío de declaraciones de componentes de vistas (solo routing), dejarlo como módulo vacío que simplemente carga la ruta vieja (que ya no existe). Si `TechnicianRoutingModule` apuntaba a `TaskListComponent`, eliminar también `technician-routing.module.ts` o actualizarlo para que no tenga rutas de componentes.

Actualizar `technician.module.ts` eliminando `TaskListComponent` y todos los imports de Angular Material que ya no se usen:

```typescript
// frontend/src/app/features/technician/technician.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

@NgModule({
  declarations: [],
  imports: [CommonModule],
})
export class TechnicianModule {}
```

> Si `TechnicianModule` queda completamente vacío y `app-routing.module.ts` ya no lo referencia (Task 1 cambió `/tasks` a `TasksModule`), se puede eliminar el módulo entero con sus archivos. Verificar antes con `grep -r "TechnicianModule" src/` para asegurarse de que no hay otras referencias.

- [ ] **Step 4: Verificar que no quedan referencias rotas**

```bash
cd frontend && npx ng build --configuration development 2>&1 | tail -20
```

- [ ] **Step 5: Ejecutar la suite completa de tests**

```bash
cd frontend && npx ng test --watch=false 2>&1 | tail -30
```

Esperado: 0 failures. Si algún spec importaba `TaskListComponent` o `AdminTaskDrawerComponent`, eliminar esos specs también.

- [ ] **Step 6: Commit final**

```bash
git add -A
git commit -m "refactor(tasks): eliminar vistas antiguas admin/tasks y technician/task-list — reemplazadas por vista unificada por ciclo"
```

---

## Checklist de cobertura del spec

| Requisito del spec | Tarea |
|---|---|
| Vista unificada `/tasks` para todos los roles | Task 1 (routing) |
| Tipos `TaskGroup` y `CycleStats` | Task 1 |
| KPI strip: Asignadas / En curso / Pendientes / Completadas + barra | Task 2 |
| Tabla agrupada por cliente con columnas Tipo / Técnico / Estado / Ticket / Notas | Task 3 |
| Month nav patrón schedules | Task 4 |
| Carga por `month` + `year` via `TasksService.getAll()` | Task 4 |
| Filtro técnico por defecto para TECHNICIAN (removible) | Task 4 |
| `cycleClosed` para meses pasados | Task 4 |
| Banner de ciclo cerrado | Task 4 |
| Drawer unificado con bloques condicionales por rol | Task 5 |
| ADMIN puede eliminar con confirmación | Task 5 |
| COORDINATOR solo lectura en drawer | Task 5 |
| Ciclo cerrado deshabilita acciones | Task 5 |
| Redirect `/admin/tasks` → `/tasks` | Task 1 |
| Eliminar `AdminTaskDrawerComponent` y `admin/tasks` | Task 6 |
| Eliminar `TaskListComponent` | Task 6 |
| Reactividad local (no reload tras acción) | Task 4 (onTaskCompleted/NotDone/StatusChanged) |
