# Diseño: Kanban + Filtros en Vista Admin

**Fecha:** 2026-06-11
**Branch objetivo:** feat/admin-kanban-filters

---

## Contexto

La vista Admin de tareas actualmente muestra una `mat-table` con un único filtro por estado. La vista del Técnico (Mis Tareas) ya tiene un tablero kanban funcional con `app-task-card` compartido en `shared/`. Se quiere unificar la experiencia visual y agregar filtros por cliente y técnico en la vista Admin.

---

## Objetivos

1. Reemplazar la `mat-table` en `admin/tasks` por un tablero kanban idéntico al de `technician/task-list`.
2. Agregar filtros por cliente y técnico (además del existente por estado).
3. Mostrar el técnico asignado en las cards del tablero Admin (avatar con inicial).
4. Permitir al Admin hacer click en una card para ver un drawer de solo lectura con detalles de la tarea.
5. Extraer la lógica del tablero kanban a `shared/` para evitar duplicación.

---

## Decisiones de diseño

| Pregunta | Decisión |
|---|---|
| ¿Drawer para Admin? | Sí, solo lectura — sin acciones |
| ¿Técnico en card? | Avatar circular con inicial, esquina superior derecha |
| ¿Compartir kanban? | Extraer `KanbanBoardComponent` a `shared/` |
| ¿Filtros combinados? | AND lógico, omite parámetros vacíos |
| ¿Greeting/KPI en Admin? | No — solo header con filtros y botón Nueva tarea |

---

## Arquitectura

### Componentes nuevos

#### `shared/components/kanban-board/kanban-board.component`

Extrae la lógica de columnas actualmente inline en `TaskListComponent`.

```typescript
@Input() tasks: Task[] = [];
@Input() showTechnicianAvatar = false;
@Output() taskSelected = new EventEmitter<Task>();
```

Columnas internas (misma lógica que hoy en `TaskListComponent`):
- **Pendientes**: `PENDING` + `IN_PROGRESS`, ordenadas por urgencia ascendente
- **Completadas**: `DONE`
- **Cerradas**: `ESCALATED` + `NOT_DONE`

Pasa `[showTechnicianAvatar]` a cada `app-task-card`.

#### `admin/tasks/admin-task-drawer/admin-task-drawer.component`

Panel de solo lectura. Sin formularios ni transiciones de estado.

```typescript
@Input() task!: Task;
@Output() drawerClosed = new EventEmitter<void>();
```

Campos que muestra:
- Cliente (nombre)
- Tipo de tarea (label legible)
- Técnico asignado (nombre completo)
- Período (fecha programada, formato mes/año)
- Estado (badge con color semántico)
- Ticket Odoo (link si existe, `—` si no)

### Componentes modificados

#### `shared/components/task-card/task-card.component`

Suma un input condicional:

```typescript
@Input() showTechnicianAvatar = false;
```

Cuando `true`: renderiza en la esquina superior derecha un círculo de 22×22px con la inicial del técnico (`task.technician?.user?.name[0]`). Si no hay técnico, no renderiza nada.

La vista del técnico no pasa este input → no muestra avatar → sin cambio de comportamiento.

#### `technician/task-list/task-list.component`

Reemplaza el HTML de las 3 columnas kanban por:

```html
<app-kanban-board
  [tasks]="tasks"
  (taskSelected)="selectTask($event)">
</app-kanban-board>
```

Los getters `kanbanPending`, `kanbanDone`, `kanbanClosed` se eliminan (pasan a `KanbanBoardComponent`). El greeting, los KPIs y el drawer existente no se tocan.

#### `admin/tasks/tasks.component`

Reemplaza `mat-table` por:

```html
<app-kanban-board
  [tasks]="tasks"
  [showTechnicianAvatar]="true"
  (taskSelected)="selectTask($event)">
</app-kanban-board>
```

Suma en el header dos `mat-select` adicionales: Cliente y Técnico.

Nuevas propiedades:
```typescript
clients: Client[] = [];
technicians: Technician[] = [];
filterClientId = '';
filterTechnicianId = '';
selectedTask: Task | null = null;
tasks: Task[] = [];
```

`ngOnInit` carga clientes, técnicos y tareas en paralelo. Cualquier cambio en los 3 filtros llama a `load()`.

`load()` construye los filtros omitiendo los vacíos:
```typescript
const filters: TaskFilters = {};
if (this.filterStatus)       filters.status      = this.filterStatus;
if (this.filterClientId)     filters.clientId    = this.filterClientId;
if (this.filterTechnicianId) filters.technicianId = this.filterTechnicianId;
this.tasksService.getAll(filters).subscribe(...)
```

Abre `AdminTaskDrawerComponent` al seleccionar una card (mismo patrón de drawer que el técnico: `position: fixed`, deslizable desde la derecha).

### Sin cambios

- `TasksService` — ya soporta `clientId`, `technicianId`, `status`, `type`
- `TaskDrawerComponent` — el técnico lo sigue usando sin modificación
- Backend — no requiere cambios

---

## Flujo de filtros

```
Usuario cambia select (Estado / Cliente / Técnico)
  → load() con filtros combinados en AND
  → TasksService.getAll({ status?, clientId?, technicianId? })
  → API GET /tasks?status=X&clientId=Y&technicianId=Z
  → tasks[] se actualiza → KanbanBoardComponent recomputa columnas
```

Los selects de Cliente y Técnico se cargan una sola vez en `ngOnInit`. No hay recarga al abrir el drawer.

---

## Actualizaciones de estado local

Dado que `AdminTaskDrawerComponent` es solo lectura y no modifica el estado, no se necesita emisión de cambios hacia el padre. Al cerrar el drawer, `TasksComponent` setea `selectedTask = null`.

---

## Módulos

`SharedModule` exporta el nuevo `KanbanBoardComponent` además de `TaskCardComponent` y `ConfirmDialogComponent`.

`AdminModule` declara `AdminTaskDrawerComponent`. No requiere nuevos módulos Material (los que necesita — `MatFormFieldModule`, `MatSelectModule` — ya están importados).

---

## Testing

- **`KanbanBoardComponent`**: spec verifica que las 3 columnas se calculan correctamente para distintos estados, y que `taskSelected` emite al seleccionar una card.
- **`TaskCardComponent`**: spec verifica que el avatar aparece cuando `showTechnicianAvatar=true` y no aparece cuando es `false`.
- **`TasksComponent`** (Admin): spec verifica que `load()` se llama con los filtros correctos al cambiar cada select, y que el drawer se abre/cierra correctamente.
- **`AdminTaskDrawerComponent`**: spec verifica que los campos del task se renderizan y que `drawerClosed` emite al hacer click en cerrar.
