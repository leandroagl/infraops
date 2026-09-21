# Spec: Tareas de Vencimientos en la cola unificada de /tasks

**Fecha:** 2026-09-21
**Branch:** a acordar (ej. `feature/expiration-tasks-in-queue`)
**Alcance:** backend + frontend

---

## Contexto

El cron diario (`ExpirationTicketsService.createPendingExpirationTickets`, regla de
negocio 6) ya crea tickets en Odoo para vencimientos de garantías, dominios,
licencias y certificados dentro de la ventana configurada por tipo. Esos tickets:

- Se crean **sin técnico asignado** (`createExpirationTicket` no manda `user_id`).
- Viven en la **misma ticketera de Mantenimientos** que usan las `MaintenanceTask`
  generadas por `SchedulesService`, porque comparten el mismo SLA extendido.
- No tienen ninguna representación en InfraOps más allá de la fila de dedupe en
  `expiration_tickets` (excepción acotada a la regla 3 — solo guarda
  `type/sourceId/expireDate/clientId/odooTicketId`, no inventario).

Hasta ahora esa ticketera se administraba a mano en Odoo. Al pasar a administrarla
desde InfraOps, un ticket de vencimiento sin `Task` asociada obliga a un técnico o
al TL a entrar a Odoo igual — justo lo que se quiere evitar.

Restricción adicional: estas tareas no tienen un ciclo mensual. Su deadline es la
fecha de vencimiento, no el mes calendario, así que **no pueden quedar sujetas al
cierre automático de fin de mes** (`SchedulesService.closeUnfinishedTasksFromPreviousMonth`),
que hoy fuerza a `NOT_DONE` cualquier tarea `PENDING`/`IN_PROGRESS` cuyo
`scheduledDate` cae en el mes anterior — **sin filtrar por tipo**.

---

## Decisión

Representar cada ticket de vencimiento como una `Task` más en la cola unificada de
`/tasks`, con un `TaskType` nuevo y no cíclico, en vez de una cola paralela en
`expiration_tickets`. Reaprovecha toda la maquinaria ya construida (asignación,
transición de estado, cierre de ticket con timesheet, drawer) y evita partir la
visibilidad/métricas de trabajo técnico entre dos sistemas.

El costo se concentra en tres puntos, todos acotados:
1. Permitir una `Task` sin técnico al crearse (hoy `technician_id` es `NOT NULL`).
2. Excluir el nuevo tipo del cierre automático de mes (y de las stats del ciclo).
3. Mostrarla en `/tasks` fuera del agrupado mensual mientras siga abierta.

---

## Modelo de datos

### `TaskType` — nuevo valor

```typescript
// backend/src/tasks/task-type.enum.ts
EXPIRATION_CONTROL = 'EXPIRATION_CONTROL'
```

Un solo tipo para los 4 `ExpirationType` (`asset_warranty`, `certificate`, `domain`,
`software`) — la diferenciación fina (qué venció, de qué cliente) no vive en el
`TaskType` sino en el link a `expiration_tickets` (ver abajo). Evita explotar el
enum y no requiere fila en `task_config` por sub-tipo (el tagging de Odoo ya lo
resuelve `expirationsTypeConfigs`, no `TaskConfigService`).

### `tasks.technician_id` pasa a nullable

```typescript
@Column({ name: 'technician_id', type: 'uuid', nullable: true })
technicianId: string | null;
```

Migración `AlterTasksTechnicianIdNullable`. Es el único cambio de esquema sobre
`tasks`; todo lo demás (`scheduledDate`, `odooTicketId`, `status`) se reusa tal cual.

### `expiration_tickets.task_id` — nuevo FK nullable

```typescript
@Column({ name: 'task_id', type: 'uuid', nullable: true, default: null })
taskId: string | null;
```

Enlace 1:1 hacia la `Task` creada para ese ticket. Se completa en el mismo paso
donde hoy se guarda `odooTicketId` (`createPendingExpirationTickets`). El detalle
del ítem (nombre, make/model/serial) **no se persiste** — se resuelve en vivo
contra InfraDoc por `(type, sourceId)` cuando hace falta mostrarlo, igual que hace
hoy `getExpirationsWithTickets`. Mantiene la regla 3 intacta.

Filas sembradas como backlog al activar un tipo (`seedBacklogForType`, sin
`odooTicketId`) **no** generan `Task` — no hay ticket real, no hay trabajo que
asignar todavía.

---

## Backend

### 1. `TasksService` — creación sin técnico desde un ticket existente

Nuevo método interno, **no expuesto** por `CreateTaskDto`/`POST /tasks` (ese
endpoint sigue exigiendo técnico y crea su propio ticket — lo usan Admin y
`SchedulesService`):

```typescript
async createFromExistingTicket(params: {
  clientId: string;
  type: TaskType;
  odooTicketId: number;
  scheduledDate: string;
}): Promise<Task>
```

- No llama a `odooService.createTicket` (el ticket ya existe).
- No exige técnico — inserta con `technicianId: null`, `status: PENDING`.
- Sin `validateTagConfig`/`validateInfrastructure` (no aplican a este tipo).

`ExpirationTicketsService.createPendingExpirationTickets`, en la rama donde hoy
guarda la fila en `ticketRepo` tras crear el ticket (líneas 105-111 actuales),
agrega:

```typescript
const task = await this.tasksService.createFromExistingTicket({
  clientId: client.id,
  type: TaskType.EXPIRATION_CONTROL,
  odooTicketId,
  scheduledDate: today(), // fecha de creación, no de vencimiento
});
await this.ticketRepo.save({ ...fila anterior..., taskId: task.id });
```

### 2. `TasksService.updateStatus` — guard de técnico sin asignar

Antes de evaluar la transición, si `newStatus !== TaskStatus.PENDING` y
`task.technicianId === null` → `BadRequestException('Asigná un técnico antes de continuar')`.
Mismo patrón de guard que ya existe para tags faltantes
(`feature/task-config-required-guard`), aplicado a la ausencia de técnico.

Asignar el técnico sigue siendo `PATCH /tasks/:id` con `UpdateTaskDto.technicianId`
— **ya soportado**, no requiere endpoint nuevo.

### 3. `SchedulesService` — excluir el tipo no cíclico

```typescript
const NON_CYCLICAL_TASK_TYPES: TaskType[] = [TaskType.EXPIRATION_CONTROL];
```

Aplicar `type: Not(In(NON_CYCLICAL_TASK_TYPES))` en:
- `closeUnfinishedTasksFromPreviousMonth` (ambas condiciones del `where`, líneas
  253-256) — para que el cierre de mes nunca las toque.
- `getMonthlyPreview` (query de `taskStats`, línea 206) — para que no ensucien el
  "N/M completado" del ciclo mensual (hoy esa query no filtra por tipo y las
  incluiría si el `scheduledDate` cae en el rango del mes consultado).

### 4. `TasksService.findAll` — que no desaparezcan al cambiar de mes

Hoy el filtro `month` de `GET /tasks` arma el rango por `scheduledDate`. Una
`EXPIRATION_CONTROL` creada en agosto y todavía abierta en octubre necesita seguir
apareciendo. Cuando se filtra por `month`, el `where` pasa a ser:

```
(scheduledDate BETWEEN <rango del mes>)
OR (type = EXPIRATION_CONTROL AND status IN (PENDING, IN_PROGRESS))
```

combinado con los demás filtros (`technicianId`, `clientId`, `type`, `status`) igual
que hoy.

---

## Frontend

### 1. Labels y semántica visual

- `TASK_TYPE_LABELS['EXPIRATION_CONTROL'] = 'Vencimiento'`.
- Color: reusa `--warn`/`--crit` (semántica de vencimientos ya establecida en
  `/notifications`), no `--srv` (sería confuso mezclarlo con mantenimiento de
  servidores).

### 2. `cycle-table.component` — no necesita sección nueva

`tasks-unified.component.ts` ya agrupa el array plano de `Task` por cliente
(getter `groups`, líneas 110-121) para armar el `TaskGroup[]` que consume
`cycle-table`. En cuanto `TasksService.findAll` (punto 4) devuelva las
`EXPIRATION_CONTROL` abiertas dentro del `month` filtrado, van a aparecer solas
como una tarea más dentro del grupo de su cliente — mismo label/badge que
cualquier otro tipo, sin tocar el componente de tabla.

Lo que sí hay que ajustar es el KPI `stats` del header del ciclo
(`tasks-unified.component.ts`, líneas 128-137): hoy cuenta `this.tasks` sin
filtrar por tipo. Igual que `getMonthlyPreview.taskStats` en el backend, debe
excluir `EXPIRATION_CONTROL` de esos conteos — si no, el "completado del ciclo"
queda inflado con tareas que no son del ciclo mensual.

### 3. Task drawer

**No existe hoy ningún control de reasignación de técnico sobre una tarea ya
creada** — se verificó que el frontend nunca llama a `PATCH /tasks/:id` (el
`TasksService` del core solo expone `updateStatus` → `PATCH /tasks/:id/status`).
La regla 4 ("el TL puede reasignar") hoy se resuelve en `ClientSchedule` antes de
generar, no sobre la tarea. Para este caso hace falta agregar esa pieza, acotada
a lo necesario:

- `TasksService` (core) — nuevo método `assignTechnician(taskId, technicianId): Observable<Task>` → `PATCH /tasks/:id` con `{ technicianId }`.
- Drawer: si `task.technicianId` es `null`, header muestra un `mat-select` de
  técnicos (en vez del chip de técnico normal) visible para `TL`/`ADMIN`; al
  elegir uno dispara `assignTechnician` y actualiza `task` localmente (regla de
  reactividad de estado — sin recargar).
- Reusa el guard existente: extender `isConfigMissing`/`formReadOnly`/`canComplete`
  (líneas 194-211 de `task-drawer.component.ts`) con `isUnassigned = task.technicianId == null`,
  mismo patrón que ya usan para tags de Odoo faltantes (banner + form deshabilitado).
- Bloque de detalle del vencimiento (qué venció, cliente, fecha, días restantes):
  resuelto vía `expirationTicketId` → nuevo endpoint
  `GET /notifications/expiration-tickets/:id` que cruza `expiration_tickets` con
  el ítem vivo de InfraDoc (`NotificationsService.getExpirations`) por
  `(type, sourceId)`.
- Formulario de cierre: se suma al `ng-container` genérico que ya comparten
  `AV_CONTROL`/`UPS_CONTROL`/`ENDPOINT_INVENTORY` (línea 185 de
  `task-drawer.component.html`) — no hace falta un sub-form nuevo.

### 4. `/notifications`

Sin cambios de fondo — sigue siendo la vista en vivo de InfraDoc (regla 5, sin
cachear). El badge existente de "ticket creado" gana un link opcional a la tarea
en `/tasks` una vez que existe (`expiration_tickets.taskId`), como acceso directo
para el TL — no bloqueante, se puede dejar para una iteración siguiente.

---

## Testing

### Backend

**`TasksService.createFromExistingTicket`:**
- Crea la tarea con `technicianId: null`, `status: PENDING`, sin llamar a
  `odooService.createTicket`.

**`TasksService.updateStatus`:**
- Lanza `BadRequestException` al intentar transicionar desde `PENDING` sin técnico
  asignado.
- Transiciona normalmente una vez asignado el técnico.

**`ExpirationTicketsService.createPendingExpirationTickets`:**
- Al crear un ticket exitosamente, crea la `Task` asociada y persiste `taskId` en
  `expiration_tickets`.
- El backlog sembrado (`seedBacklogForType`) **no** crea `Task`.

**`SchedulesService.closeUnfinishedTasksFromPreviousMonth`:**
- No toca tareas `EXPIRATION_CONTROL` `PENDING`/`IN_PROGRESS` del mes anterior.
- Sigue cerrando normalmente el resto de los tipos.

**`SchedulesService.getMonthlyPreview`:**
- `taskStats` no cuenta tareas `EXPIRATION_CONTROL`.

**`TasksService.findAll`:**
- Con filtro `month`, incluye `EXPIRATION_CONTROL` abiertas aunque su
  `scheduledDate` no caiga en ese mes.
- No las duplica si además caen dentro del rango.

### Frontend

**`tasks-unified.component` — `stats`:**
- No cuenta tareas `EXPIRATION_CONTROL` en los KPIs del header del ciclo.

**Task drawer:**
- Muestra "Sin asignar" y deshabilita acciones cuando `technicianId` es `null`.
- Habilita acciones tras asignar técnico.

---

## Archivos a crear / modificar

### Backend
| Acción | Archivo |
|---|---|
| Modificar | `tasks/task.entity.ts` (`technicianId` nullable) |
| Modificar | `tasks/task-type.enum.ts` (`EXPIRATION_CONTROL`) |
| Crear | `migrations/TIMESTAMP-AlterTasksTechnicianIdNullable.ts` |
| Crear | `migrations/TIMESTAMP-AlterExpirationTicketsAddTaskId.ts` |
| Modificar | `notifications/expiration-ticket.entity.ts` (`taskId`) |
| Modificar | `notifications/expiration-tickets.service.ts` (crea `Task`, guarda `taskId`) |
| Modificar | `tasks/tasks.service.ts` (`createFromExistingTicket`, guard en `updateStatus`, `findAll`) |
| Modificar | `schedules/schedules.service.ts` (`NON_CYCLICAL_TASK_TYPES` en cierre y preview) |
| Crear | `notifications/notifications.controller.ts` — endpoint `GET /notifications/expiration-tickets/:id` |

### Frontend
| Acción | Archivo |
|---|---|
| Modificar | `core/models/task.models.ts` (`EXPIRATION_CONTROL`, `technicianId` nullable) |
| Modificar | `shared/utils/task-labels.ts` (label/badge de `EXPIRATION_CONTROL`) |
| Modificar | `features/tasks/tasks-unified.component.ts` (`stats` excluye `EXPIRATION_CONTROL`) |
| Modificar | `core/services/tasks.service.ts` (`assignTechnician`) |
| Modificar | `features/technician/task-drawer/task-drawer.component.ts/.html` (`mat-select` sin asignar, guard, bloque de detalle) |

---

## Fuera de alcance / trabajo futuro

- Granularidad de `TaskType` por sub-tipo de vencimiento (si en algún momento hace
  falta timesheet/descriptions distintos por `asset_warranty` vs `domain`, etc.).
- Técnico por defecto por tipo de vencimiento y cliente (equivalente a la regla 4
  para mantenimientos) — hoy la asignación es 100% manual por el TL.
- Reflejar el estado de la `Task` de vuelta en `/notifications` (hoy solo muestra
  si hay ticket, no si está `IN_PROGRESS`/`DONE`) — sumaría un link directo desde
  el badge "ticket creado" hacia la tarea en `/tasks`.
- Reasignar técnico sobre una tarea ya en curso, para cualquier `TaskType` — este
  spec solo cubre asignar el primer técnico a una `EXPIRATION_CONTROL` que nace
  sin uno.
