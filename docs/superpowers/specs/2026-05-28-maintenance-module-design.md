---
title: Módulo de Mantenimientos (Frontend) — Diseño
date: 2026-05-28
status: approved
---

# Módulo de Mantenimientos — Frontend Angular

Vistas frontend para gestión y ejecución de tareas de mantenimiento. Consume los módulos de backend `tasks`, `maintenance-logs` e `integrations/infradoc` ya completos.

## Contexto

El backend tiene completos: `auth`, `users`, `clients`, `technicians`, `tasks`, `maintenance-logs`, `integrations/infradoc`. El frontend tiene completos: auth, admin/users. Este módulo agrega las vistas de mantenimiento para Admin/TL y Técnico.

UPS se trata como un asset más dentro del form del técnico — no como módulo separado. Los dispositivos UPS de un cliente se cargan desde InfraDoc junto con el resto de la infraestructura.

---

## Arquitectura general

**Enfoque:** Dos módulos Angular lazy-loaded independientes, drawer controlado con `signal()` local, servicios compartidos en `core/services/`.

### Rutas

| Ruta | Módulo | Guard |
|---|---|---|
| `/tasks` | `TasksModule` | ADMIN + TL |
| `/my-tasks` | `MyTasksModule` | TECHNICIAN + TL |

El TL accede a ambas rutas (puede gestionar Y ejecutar tareas).

### Guards nuevos

```
core/guards/
  tasks.guard.ts       ← permite ADMIN y TL, redirige a /dashboard si no
  my-tasks.guard.ts    ← permite TECHNICIAN y TL, redirige a /dashboard si no
```

Mismo patrón que `AdminGuard`: `CanActivate`, lee `auth.getCurrentUser().role`.

### Sidebar — `ShellComponent`

Se agrega `roles?: UserRole[]` a `NavItem`. El template filtra ítems con `visibleNavItems` computado desde el usuario actual.

| Ruta | Ícono | Visible para |
|---|---|---|
| `/tasks` | clipboard/wrench | ADMIN, TL |
| `/my-tasks` | clipboard/check | TECHNICIAN, TL |

---

## Modelos (`core/models/`)

| Archivo | Contenido |
|---|---|
| `client.models.ts` | `Client { id, name, isActive, createdAt }` |
| `technician.models.ts` | `Technician { id, createdAt, user: { id, name, email, role } }` |
| `task.models.ts` | `TaskType` enum · `TaskStatus` enum · `Task` · `CreateTaskPayload` · `UpdateTaskPayload` · `UpdateTaskStatusPayload` · `FilterTasksParams` |
| `maintenance-log.models.ts` | `LogItemResult ('ok'\|'warn'\|'error')` · `LogItem { item, result, notes? }` · `MaintenanceLog` · `CreateLogPayload` · `UpdateLogPayload` |
| `infradoc.models.ts` | `InfraAsset { assetId, name, ip, os, model }` · `ClientInfrastructure { servers, vms, nas, routers, ups }` |

### Enums (`task.models.ts`)

```typescript
export enum TaskType {
  SERVER_MAINTENANCE = 'SERVER_MAINTENANCE',
  TERMINAL_MAINTENANCE = 'TERMINAL_MAINTENANCE',
  SITE_VISIT = 'SITE_VISIT',
  AV_CONTROL = 'AV_CONTROL',
  UPS_CONTROL = 'UPS_CONTROL',
  ENDPOINT_INVENTORY = 'ENDPOINT_INVENTORY',
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  ESCALATED = 'ESCALATED',
  NOT_DONE = 'NOT_DONE',
}
```

---

## Servicios (`core/services/`)

Todos siguen el patrón existente: `@Injectable({ providedIn: 'root' })`, `HttpClient`, retornan `Observable<T>`.

| Servicio | Métodos |
|---|---|
| `clients.service.ts` | `getAll(): Observable<Client[]>` |
| `technicians.service.ts` | `getAll(): Observable<Technician[]>` |
| `tasks.service.ts` | `getAll(filters?: FilterTasksParams)` · `create(payload)` · `update(id, payload)` · `updateStatus(id, payload)` |
| `maintenance-logs.service.ts` | `create(taskId, payload)` · `getByTaskId(taskId)` · `update(taskId, payload)` |
| `infradoc.service.ts` | `getInfrastructure(clientId): Observable<ClientInfrastructure>` |

Cada servicio tiene su spec con mocks de `HttpClient`, verificando URL y payload correctos.

---

## Utilidad compartida

### `core/utils/task-urgency.ts`

Función pura usada en ambos módulos:

```typescript
export type Urgency = 'crit' | 'warn' | 'ok' | 'done';

export function getUrgency(task: Task): Urgency {
  if (['DONE', 'ESCALATED', 'NOT_DONE'].includes(task.status)) return 'done';
  const today = new Date();
  const scheduled = new Date(task.scheduledDate);
  const diffDays = Math.floor((scheduled.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return 'crit';
  if (diffDays <= 7) return 'warn';
  return 'ok';
}
```

---

## SharedModule — componentes nuevos

**`TaskTypeBadgeComponent`** — recibe `type: TaskType`, renderiza badge con color e ícono SVG inline por tipo de tarea.

**`TaskStatusBadgeComponent`** — recibe `status: TaskStatus`, renderiza badge semántico (ok / warn / crit / neutral).

Sin lógica, solo presentación. Se agregan a `SharedModule` y se exportan.

---

## Vista Admin/TL — `features/tasks/`

### Estructura de archivos

```
features/tasks/
  tasks.module.ts
  tasks-routing.module.ts
  tasks.component.ts / .html / .scss
  task-create-dialog/
    task-create-dialog.component.ts / .html
  task-drawer/
    task-drawer.component.ts / .html / .scss
```

### `TasksComponent`

**Layout:** KPIs + barra de progreso del mes arriba. Dos columnas: lista de tareas (izquierda) + panel lateral con carga por técnico y errores activos (derecha).

**KPIs:** vencidas · esta semana · en plazo · completadas · escaladas · total. Calculados con `computed()` desde el array de tareas.

> El KPI "errores activos" del mockup requeriría cargar todos los logs para ver cuáles tienen LogItems con `result: 'error'`. Para el MVP se usa ESCALATED como proxy: una tarea escalada es la que tuvo un error no resuelto. El filtro "Con errores" del mockup se implementa como "Escaladas".

**Filtros:** chips de estado (Todas / Vencidas / Esta semana / En plazo / Completadas / Escaladas) + chips por técnico + input de búsqueda por nombre de cliente.

**Acciones:** botón "Nueva tarea" → abre `TaskCreateDialogComponent` (MatDialog).

**Estado:**

```typescript
tasks        = signal<Task[]>([])
clients      = signal<Client[]>([])
technicians  = signal<Technician[]>([])
selectedTask = signal<Task | null>(null)
drawerOpen   = signal(false)
activeFilter = signal<string>('all')
searchTerm   = signal('')
loading      = signal(false)

filteredTasks = computed(() => /* filtra por activeFilter + searchTerm */)
kpis          = computed(() => /* cuenta por categoría de urgencia */)
```

### `TaskDrawerComponent`

Panel lateral de 520px (fixed, derecha). Recibe la tarea seleccionada vía `@Input()`.

**Secciones:**
1. **Header**: nombre del cliente, `TaskTypeBadgeComponent`, badge de urgencia, `TaskStatusBadgeComponent`
2. **Reasignar**: select de técnico + botón confirmar → `PATCH /tasks/:id`
3. **Estado**: botones de transición válidos según estado actual → `PATCH /tasks/:id/status`
4. **Registro del técnico**: readonly del `MaintenanceLog` si existe (lista de LogItems con badge de resultado por ítem)

Overlay oscuro detrás cierra el drawer al hacer click.

### `TaskCreateDialogComponent`

MatDialog con `ReactiveFormsModule`:

| Campo | Control | Fuente |
|---|---|---|
| Cliente | `MatSelect` | `GET /clients` |
| Técnico | `MatSelect` | `GET /technicians` |
| Tipo de tarea | `MatSelect` | enum `TaskType` |
| Fecha programada | `MatDatepicker` | — |

Al confirmar: `POST /tasks` → snackbar de éxito → recarga la lista.

### Tests

- `TasksComponent`: KPIs computados correctos, filtros aplican bien, click en tarea abre drawer.
- `TaskCreateDialogComponent`: validación del form, payload correcto al submit.

---

## Vista Técnico — `features/my-tasks/`

### Estructura de archivos

```
features/my-tasks/
  my-tasks.module.ts
  my-tasks-routing.module.ts
  my-tasks.component.ts / .html / .scss
  execution-drawer/
    execution-drawer.component.ts / .html / .scss
```

### `MyTasksComponent`

**Greeting card**: "Buenas, {nombre}" + KPIs personales (vencidas / esta semana / en plazo).

**Lista de tareas propias**: agrupadas visualmente — urgentes primero (crit + warn), luego en plazo, luego completadas (opacidad reducida). Cada tarjeta muestra cliente, tipo de tarea, badge de urgencia.

Click en tarea → abre `ExecutionDrawerComponent`.

**Estado:**

```typescript
myTasks      = signal<Task[]>([])
selectedTask = signal<Task | null>(null)
drawerOpen   = signal(false)
loading      = signal(false)
```

### `ExecutionDrawerComponent`

Panel lateral de 520px. Recibe la tarea seleccionada vía `@Input()`.

**Secciones:**

1. **Header**: nombre del cliente, tipo de tarea, badge de urgencia
2. **Infraestructura del cliente**: grid readonly con los assets de InfraDoc (nombre, IP, modelo) — referencia visual
3. **Registro de control**: lista editable de `LogItemDraft`. Por cada ítem:
   - Nombre del asset
   - Select de resultado: `ok` / `warn` / `error` (color semántico al seleccionar)
   - Campo de notas opcional
4. **Notas generales**: textarea para el campo `notes` del log
5. **Footer**: "Guardar registro" + botones de cierre (DONE / ESCALATED / NOT_DONE)

**Estado:**

```typescript
infrastructure        = signal<ClientInfrastructure | null>(null)
infrastructureLoading = signal(false)
existingLog           = signal<MaintenanceLog | null>(null)
logItems              = signal<LogItemDraft[]>([])
globalNotes           = signal('')
saving                = signal(false)

allItemsMarked = computed(() => logItems().every(i => i.result !== null))
```

```typescript
interface LogItemDraft {
  item: string;
  result: 'ok' | 'warn' | 'error' | null;  // null = sin marcar
  notes: string;
}
```

**Data flow al abrir el drawer:**

```
1. Carga en paralelo (forkJoin):
   GET /tasks/:taskId/log                          → existingLog
   GET /infradoc/clients/:clientId/infrastructure  → infrastructure

2. Construye logItems:
   - Si existe log → pre-popula desde log.payload (resultado ya marcado)
   - Si no hay log → genera un LogItemDraft por asset en infrastructure
     (servers + vms + nas + routers + ups), result = null

3. El técnico marca cada ítem y agrega notas opcionales

4. "Guardar registro":
   - Deshabilitado mientras !allItemsMarked()
   - Si no hay log → POST /tasks/:taskId/log
   - Si hay log    → PATCH /tasks/:taskId/log

5. Botones de cierre (DONE / ESCALATED / NOT_DONE):
   - PATCH /tasks/:taskId/status
   - Cierra drawer + refresca lista
```

### Tests

- `MyTasksComponent`: agrupación por urgencia correcta, greeting con datos del usuario actual.
- `ExecutionDrawerComponent`: construcción del draft desde InfraDoc, construcción desde log existente, botón deshabilitado hasta que todos los ítems estén marcados, payload correcto al guardar.

---

## Dependencia de backend

El `ClientInfrastructureDto` actual no incluye UPS. Se necesita:

1. Agregar `ups: InfraAssetDto[]` a `backend/src/integrations/infradoc/dto/client-infrastructure.dto.ts`
2. Agregar entrada `'ups'` (o `'UPS'`) al mapa de tipos en `backend/src/integrations/infradoc/infrastructure.service.ts`

Cambio de 2 líneas. Se incluye como primer paso del plan de implementación.

---

## Resumen de archivos

### Nuevos

```
core/guards/         tasks.guard.ts · my-tasks.guard.ts
core/models/         client · technician · task · maintenance-log · infradoc
core/services/       clients · technicians · tasks · maintenance-logs · infradoc
core/utils/          task-urgency.ts
features/tasks/      TasksModule · TasksComponent · TaskDrawerComponent · TaskCreateDialogComponent
features/my-tasks/   MyTasksModule · MyTasksComponent · ExecutionDrawerComponent
shared/              TaskTypeBadgeComponent · TaskStatusBadgeComponent
```

### Modificados

```
app-routing.module.ts     ← rutas /tasks y /my-tasks
shell.component.ts        ← nav items con filtro por rol
shared.module.ts          ← declarar y exportar nuevos badges
```