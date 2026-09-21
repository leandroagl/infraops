# Tareas de Vencimientos en /tasks — Implementation Plan

**Goal:** Que cada ticket de vencimiento que crea el cron diario (`ExpirationTicketsService.createPendingExpirationTickets`) tenga una `Task` en InfraOps, asignable y trabajable desde `/tasks` como cualquier otra, sin que el cierre automático de fin de mes la fuerce a `NOT_DONE` y sin duplicar el ticket ya creado en Odoo.

**Architecture:** Nuevo `TaskType.EXPIRATION_CONTROL`, no cíclico. `tasks.technician_id` pasa a nullable para poder crear la tarea sin técnico (igual que el ticket de Odoo). `expiration_tickets` gana un FK `task_id` 1:1 hacia la tarea creada. `SchedulesService` excluye el tipo nuevo del cierre de mes y de las stats del ciclo. El drawer de tareas gana la pieza que hoy no existe: un control para asignar técnico a una tarea ya creada (hoy solo se asigna al generar).

**Tech Stack:** NestJS (TypeORM), Angular 19, Angular Material, Jest (backend), Jasmine/TestBed (frontend).

**Spec:** `docs/superpowers/specs/2026-09-21-expiration-tasks-design.md`

**Estado:** Implementado en `feature/expiration-tasks-in-queue` (2026-09-21). Suite completa
verde (backend 541/541, frontend 919/919). Una desviación real del plan original: durante la
Task 10 se descubrió que AV_CONTROL/UPS_CONTROL/ENDPOINT_INVENTORY ya estaban deshabilitados
en el drawer por no tener payload definido (`isUnsupported`), y que no existía ningún control
de reasignación de técnico en el frontend. Se resolvió con un paso adicional (payload de solo
notas para EXPIRATION_CONTROL, confirmado con el usuario) antes de completar la Task 10 tal
como quedó documentada abajo.

## Global Constraints

- TDD obligatorio: test antes que implementación en cada task.
- Idioma del código: inglés; commits y documentación: español.
- No mezclar lógica de negocio en controllers (va en services).
- Angular Material exclusivamente para componentes interactivos — `appearance="outline"`.
- Reactividad de estado: el drawer actualiza `task` local al asignar técnico, sin recargar la lista.
- `EXPIRATION_CONTROL` no entra a `V1_TASK_TYPES` de `schedules.service.ts` — no se genera por schedule, solo la crea `ExpirationTicketsService`.
- `EXPIRATION_CONTROL` no requiere fila en `task_config` (tags/timesheet) — usa el default de `TIMESHEET_DESCRIPTION_DEFAULT` en `closeTicket`.
- `ALTER TYPE ... ADD VALUE` no puede correr dentro de una transacción — la migración del enum necesita `transaction = false` (ver precedente `1782259200000-AddVeeamBackupTaskType.ts`).

---

## File Map

| Acción | Archivo |
|---|---|
| Crear | `backend/src/migrations/1789600000000-AddExpirationControlTaskType.ts` |
| Crear | `backend/src/migrations/1789700000000-AlterTasksTechnicianIdNullable.ts` |
| Crear | `backend/src/migrations/1789800000000-AddTaskIdToExpirationTickets.ts` |
| Modificar | `backend/src/tasks/task-type.enum.ts` |
| Modificar | `backend/src/tasks/task.entity.ts` |
| Modificar | `backend/src/tasks/dto/update-task.dto.ts` (sin cambios de forma, ver Task 2) |
| Modificar | `backend/src/tasks/tasks.service.ts` |
| Modificar | `backend/src/tasks/tasks.service.spec.ts` |
| Modificar | `backend/src/tasks/dto/filter-tasks.dto.ts` (si hace falta tipar el nuevo filtro) |
| Modificar | `backend/src/notifications/expiration-ticket.entity.ts` |
| Modificar | `backend/src/notifications/expiration-tickets.service.ts` |
| Modificar | `backend/src/notifications/expiration-tickets.service.spec.ts` |
| Modificar | `backend/src/notifications/notifications.controller.ts` |
| Modificar | `backend/src/notifications/notifications.controller.spec.ts` |
| Modificar | `backend/src/schedules/schedules.service.ts` |
| Modificar | `backend/src/schedules/schedules.service.spec.ts` |
| Modificar | `frontend/src/app/core/models/task.models.ts` |
| Modificar | `frontend/src/app/shared/utils/task-labels.ts` |
| Modificar | `frontend/src/app/core/services/tasks.service.ts` |
| Modificar | `frontend/src/app/core/services/tasks.service.spec.ts` |
| Modificar | `frontend/src/app/features/tasks/tasks-unified.component.ts` |
| Modificar | `frontend/src/app/features/tasks/tasks-unified.component.spec.ts` |
| Modificar | `frontend/src/app/features/technician/task-drawer/task-drawer.component.ts` |
| Modificar | `frontend/src/app/features/technician/task-drawer/task-drawer.component.html` |
| Modificar | `frontend/src/app/features/technician/task-drawer/task-drawer.component.spec.ts` |

---

### Task 1: Migraciones + entidades

**Files:**
- Create: `backend/src/migrations/1789600000000-AddExpirationControlTaskType.ts`
- Create: `backend/src/migrations/1789700000000-AlterTasksTechnicianIdNullable.ts`
- Create: `backend/src/migrations/1789800000000-AddTaskIdToExpirationTickets.ts`
- Modify: `backend/src/tasks/task-type.enum.ts`
- Modify: `backend/src/tasks/task.entity.ts`
- Modify: `backend/src/notifications/expiration-ticket.entity.ts`

**Interfaces:**
- Produces: `TaskType.EXPIRATION_CONTROL`; `Task.technicianId: string | null`; `ExpirationTicket.taskId: string | null`.

- [x] **Step 1: Migración del enum**

```typescript
// backend/src/migrations/1789600000000-AddExpirationControlTaskType.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExpirationControlTaskType1789600000000 implements MigrationInterface {
  name = 'AddExpirationControlTaskType1789600000000';
  transaction = false as const; // ALTER TYPE ADD VALUE no puede ejecutarse dentro de una transacción

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."tasks_type_enum" ADD VALUE IF NOT EXISTS 'EXPIRATION_CONTROL'`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL no soporta eliminar valores de un enum sin recrearlo.
  }
}
```

- [x] **Step 2: Migración `technician_id` nullable**

```typescript
// backend/src/migrations/1789700000000-AlterTasksTechnicianIdNullable.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterTasksTechnicianIdNullable1789700000000 implements MigrationInterface {
  name = 'AlterTasksTechnicianIdNullable1789700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" ALTER COLUMN "technician_id" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" ALTER COLUMN "technician_id" SET NOT NULL`);
  }
}
```

- [x] **Step 3: Migración `expiration_tickets.task_id`**

```typescript
// backend/src/migrations/1789800000000-AddTaskIdToExpirationTickets.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskIdToExpirationTickets1789800000000 implements MigrationInterface {
  name = 'AddTaskIdToExpirationTickets1789800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "expiration_tickets" ADD COLUMN IF NOT EXISTS "task_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "expiration_tickets" ADD CONSTRAINT "FK_expiration_tickets_task_id" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "expiration_tickets" DROP CONSTRAINT "FK_expiration_tickets_task_id"`);
    await queryRunner.query(`ALTER TABLE "expiration_tickets" DROP COLUMN "task_id"`);
  }
}
```

- [x] **Step 4: `task-type.enum.ts`** — agregar `EXPIRATION_CONTROL = 'EXPIRATION_CONTROL'` al final del enum.

- [x] **Step 5: `task.entity.ts`** — `technicianId` y la relación pasan a nullable:

```typescript
@Column({ name: 'technician_id', type: 'uuid', nullable: true })
technicianId: string | null;

@ManyToOne(() => Technician, { nullable: true })
@JoinColumn({ name: 'technician_id' })
technician: Technician | null;
```

- [x] **Step 6: `expiration-ticket.entity.ts`** — agregar:

```typescript
@Column({ name: 'task_id', type: 'uuid', nullable: true, default: null })
taskId: string | null;
```

- [x] **Step 7: Verificar compilación**

```bash
cd backend && npx tsc --noEmit
```
Expected: errores de tipos en los sitios que asumen `technicianId: string` (esperado — se resuelven en las tasks siguientes).

- [x] **Step 8: Commit**

```bash
git add backend/src/migrations/1789600000000-AddExpirationControlTaskType.ts \
        backend/src/migrations/1789700000000-AlterTasksTechnicianIdNullable.ts \
        backend/src/migrations/1789800000000-AddTaskIdToExpirationTickets.ts \
        backend/src/tasks/task-type.enum.ts \
        backend/src/tasks/task.entity.ts \
        backend/src/notifications/expiration-ticket.entity.ts
git commit -m "feat(tasks): agregar EXPIRATION_CONTROL y permitir tareas sin técnico asignado"
```

---

### Task 2: `TasksService.createFromExistingTicket`

**Files:**
- Modify: `backend/src/tasks/tasks.service.ts`
- Modify: `backend/src/tasks/tasks.service.spec.ts`

**Interfaces:**
- Produces: `TasksService.createFromExistingTicket(params: { clientId: string; type: TaskType; odooTicketId: number; scheduledDate: string }): Promise<Task>` — no crea ticket en Odoo, no exige técnico, no valida tags/infra.

- [x] **Step 1: Tests que fallan** — en `tasks.service.spec.ts`, nuevo `describe('createFromExistingTicket', ...)`:
  - Crea la tarea con `technicianId: null`, `status: PENDING`, `odooTicketId` recibido tal cual.
  - No llama a `odooService.createTicket`.
  - No llama a `validateTagConfig` ni `validateInfrastructure` (verificar que no lanza aunque el cliente no tenga infra o el tipo no tenga tags configurados).
  - Lanza `NotFoundException` si `clientId` no existe.

- [x] **Step 2:** `cd backend && npx jest tasks.service.spec --no-coverage` → fallan.

- [x] **Step 3: Implementar** en `tasks.service.ts`, después de `create()`:

```typescript
async createFromExistingTicket(params: {
  clientId: string;
  type: TaskType;
  odooTicketId: number;
  scheduledDate: string;
}): Promise<Task> {
  const client = await this.clientRepository.findOne({ where: { id: params.clientId } });
  if (!client) throw new NotFoundException('Cliente no encontrado');

  const task = this.taskRepository.create({
    clientId: params.clientId,
    technicianId: null,
    type: params.type,
    scheduledDate: params.scheduledDate,
    odooTicketId: params.odooTicketId,
  });
  const saved = await this.taskRepository.save(task);
  return this.loadTask(saved.id);
}
```

- [x] **Step 4:** `cd backend && npx jest tasks.service.spec --no-coverage` → pasan.

- [x] **Step 5: Commit**

```bash
git add backend/src/tasks/tasks.service.ts backend/src/tasks/tasks.service.spec.ts
git commit -m "feat(tasks): agregar createFromExistingTicket para tareas creadas desde un ticket existente"
```

---

### Task 3: `TasksService.updateStatus` — guard de técnico sin asignar

**Files:**
- Modify: `backend/src/tasks/tasks.service.ts`
- Modify: `backend/src/tasks/tasks.service.spec.ts`

**Interfaces:**
- Produces: `updateStatus` lanza `BadRequestException('Asigná un técnico antes de continuar')` si `task.technicianId === null` y `newStatus !== TaskStatus.PENDING`.

- [x] **Step 1: Tests que fallan** — en el `describe('updateStatus', ...)` existente:
  - Lanza `BadRequestException` al transicionar `PENDING → IN_PROGRESS` (o cualquier destino) sin técnico.
  - Transiciona normalmente si `technicianId` no es `null` (no debe romper ningún test existente — todos los mocks actuales ya tienen técnico).

- [x] **Step 2:** `cd backend && npx jest tasks.service.spec --no-coverage` → falla el nuevo test.

- [x] **Step 3: Implementar** — al inicio de `updateStatus`, después de cargar `task` y antes de validar la transición:

```typescript
if (task.technicianId === null && newStatus !== TaskStatus.PENDING) {
  throw new BadRequestException('Asigná un técnico antes de continuar');
}
```

- [x] **Step 4:** `cd backend && npx jest tasks.service.spec --no-coverage` → pasan.

- [x] **Step 5: Commit**

```bash
git add backend/src/tasks/tasks.service.ts backend/src/tasks/tasks.service.spec.ts
git commit -m "fix(tasks): bloquear transiciones de estado sin técnico asignado"
```

---

### Task 4: `TasksService.findAll` — persistencia entre meses

**Files:**
- Modify: `backend/src/tasks/tasks.service.ts`
- Modify: `backend/src/tasks/tasks.service.spec.ts`

**Interfaces:**
- Produces: con filtro `month`/`year`, el resultado incluye además cualquier `EXPIRATION_CONTROL` en `PENDING`/`IN_PROGRESS` sin importar su `scheduledDate`.

- [x] **Step 1: Revisar la construcción actual del filtro `month`** en `findAll` (usa `Between` sobre `scheduledDate`, similar a `schedules.service.ts`). Confirmar el nombre exacto del método/bloque antes de tocarlo.

- [x] **Step 2: Tests que fallan** — en el `describe('findAll', ...)`:
  - Con `month`/`year` seteados, una tarea `EXPIRATION_CONTROL` `PENDING` con `scheduledDate` de dos meses atrás **aparece** en el resultado.
  - Una `EXPIRATION_CONTROL` `DONE` de dos meses atrás **no** aparece (ya no está abierta).
  - No duplica una `EXPIRATION_CONTROL` cuyo `scheduledDate` sí cae dentro del rango consultado.
  - El resto de los tipos siguen filtrando solo por rango de mes, sin cambios.

- [x] **Step 3:** `cd backend && npx jest tasks.service.spec --no-coverage` → fallan.

- [x] **Step 4: Implementar** — reemplazar el filtro por rango de fecha simple por un `where` compuesto (usando `Brackets` de TypeORM si `findAll` usa QueryBuilder, o dos condiciones `OR` si usa `find()` con array de `where`):

```typescript
// si usa QueryBuilder:
qb.andWhere(
  new Brackets(sub => {
    sub.where('task.scheduledDate BETWEEN :from AND :to', { from: firstDay, to: lastDay })
       .orWhere('task.type = :expType AND task.status IN (:...openStatuses)', {
         expType: TaskType.EXPIRATION_CONTROL,
         openStatuses: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS],
       });
  }),
);
```

Adaptar la sintaxis exacta al estilo ya usado en `findAll` (revisar si es QueryBuilder o `Repository.find` con `where` — mantener consistencia, no migrar de uno a otro solo por esto).

- [x] **Step 5:** `cd backend && npx jest tasks.service.spec --no-coverage` → pasan.

- [x] **Step 6: Commit**

```bash
git add backend/src/tasks/tasks.service.ts backend/src/tasks/tasks.service.spec.ts
git commit -m "feat(tasks): mantener visibles las EXPIRATION_CONTROL abiertas al cambiar de mes en /tasks"
```

---

### Task 5: `ExpirationTicketsService` — crear la `Task` junto al ticket

**Files:**
- Modify: `backend/src/notifications/expiration-tickets.service.ts`
- Modify: `backend/src/notifications/expiration-tickets.service.spec.ts`

**Interfaces:**
- Consumes: `TasksService.createFromExistingTicket` (Task 2).
- Produces: al crear un ticket con éxito, crea la `Task` y guarda `taskId` en la fila de `expiration_tickets`.

- [x] **Step 1: Tests que fallan** — en `describe('createPendingExpirationTickets', ...)`:
  - Al crear el ticket exitosamente, llama a `tasksService.createFromExistingTicket` con `{ clientId, type: EXPIRATION_CONTROL, odooTicketId, scheduledDate: <hoy> }`.
  - Guarda la fila de `expiration_tickets` con `taskId` igual al `id` de la tarea creada.
  - Si `createFromExistingTicket` lanza, se loguea el error y continúa con el siguiente ítem del batch (mismo criterio que un fallo de `createExpirationTicket`) — **no** deja la fila de `expiration_tickets` a medio guardar (ticket creado en Odoo sin `Task`, sin registro de dedupe, generaría un ticket duplicado mañana). Decidir en la implementación: guardar la fila de `expiration_tickets` primero (dedupe garantizado) y la `Task` después; si falla la `Task`, logear y seguir — la fila ya quedó para evitar duplicar el ticket de Odoo.
  - `seedBacklogForType` sigue sin crear `Task` (no cambia).

- [x] **Step 2:** `cd backend && npx jest expiration-tickets.service.spec --no-coverage` → fallan.

- [x] **Step 3: Implementar** — inyectar `TasksService` en el constructor y actualizar el bloque de creación:

```typescript
const odooTicketId = await this.odooService.createExpirationTicket(
  item, client.id, cfg.helpdeskTeamId!, cfg.tagIds,
);
await this.ticketRepo.save({
  type: item.type,
  sourceId: item.sourceId,
  expireDate: item.expireDate,
  clientId: client.id,
  odooTicketId,
});
created++;

try {
  const task = await this.tasksService.createFromExistingTicket({
    clientId: client.id,
    type: TaskType.EXPIRATION_CONTROL,
    odooTicketId,
    scheduledDate: new Date().toISOString().slice(0, 10),
  });
  await this.ticketRepo.update(
    { type: item.type, sourceId: item.sourceId, expireDate: item.expireDate },
    { taskId: task.id },
  );
} catch (err: unknown) {
  this.logger.error(
    `Ticket ${odooTicketId} creado pero falló crear la Task asociada: ${(err as Error).message}`,
  );
}
```

- [x] **Step 4: `notifications.module.ts`** — agregar `TasksModule` a `imports`.

- [x] **Step 5:** `cd backend && npx jest expiration-tickets.service.spec --no-coverage` → pasan.

- [x] **Step 6: Commit**

```bash
git add backend/src/notifications/expiration-tickets.service.ts \
        backend/src/notifications/expiration-tickets.service.spec.ts \
        backend/src/notifications/notifications.module.ts
git commit -m "feat(notifications): crear Task en InfraOps al generar un ticket automático de vencimiento"
```

---

### Task 6: `SchedulesService` — excluir `EXPIRATION_CONTROL` del ciclo mensual

**Files:**
- Modify: `backend/src/schedules/schedules.service.ts`
- Modify: `backend/src/schedules/schedules.service.spec.ts`

**Interfaces:**
- Produces: `closeUnfinishedTasksFromPreviousMonth` y `getMonthlyPreview` ignoran tareas `EXPIRATION_CONTROL`.

- [x] **Step 1: Tests que fallan**
  - `closeUnfinishedTasksFromPreviousMonth`: dado un `EXPIRATION_CONTROL` `PENDING` con `scheduledDate` del mes anterior, tras `generateMonth` sigue en `PENDING` (no lo toca `updateStatus`).
  - `getMonthlyPreview`: una `EXPIRATION_CONTROL` con `scheduledDate` dentro del mes consultado no suma a `taskStats.total`.

- [x] **Step 2:** `cd backend && npx jest schedules.service.spec --no-coverage` → fallan.

- [x] **Step 3: Implementar** — agregar constante cerca de `V1_TASK_TYPES`:

```typescript
const NON_CYCLICAL_TASK_TYPES: TaskType[] = [TaskType.EXPIRATION_CONTROL];
```

En `getMonthlyPreview`, el `find` de `tasks` (línea ~206):
```typescript
const tasks = await this.taskRepo.find({
  where: {
    scheduledDate: Between(firstDay, lastDay) as unknown as string,
    type: Not(In(NON_CYCLICAL_TASK_TYPES)),
  },
  select: ['id', 'status', 'clientId'],
});
```

En `closeUnfinishedTasksFromPreviousMonth`, agregar `type: Not(In(NON_CYCLICAL_TASK_TYPES))` a ambas condiciones del `where` (PENDING e IN_PROGRESS).

Agregar `Not, In` al import de `typeorm` al inicio del archivo.

- [x] **Step 4:** `cd backend && npx jest schedules.service.spec --no-coverage` → pasan.

- [x] **Step 5:** `cd backend && npx jest --no-coverage` (suite completa) → pasan.

- [x] **Step 6: Commit**

```bash
git add backend/src/schedules/schedules.service.ts backend/src/schedules/schedules.service.spec.ts
git commit -m "fix(schedules): excluir EXPIRATION_CONTROL del cierre automático de mes y de las stats del ciclo"
```

---

### Task 7: Endpoint de detalle de vencimiento para el drawer

**Files:**
- Modify: `backend/src/notifications/notifications.controller.ts`
- Modify: `backend/src/notifications/notifications.controller.spec.ts`
- Modify: `backend/src/notifications/expiration-tickets.service.ts`
- Modify: `backend/src/notifications/expiration-tickets.service.spec.ts`

**Interfaces:**
- Produces: `GET /notifications/expiration-tickets/by-task/:taskId` → `ExpirationItemDto | null` — busca la fila de `expiration_tickets` por `taskId`, y cruza con el ítem vivo de InfraDoc (`NotificationsService.getExpirations`) por `(type, sourceId)`.

- [x] **Step 1: Tests que fallan**
  - `ExpirationTicketsService.getExpirationByTaskId(taskId)`: si no hay fila con ese `taskId` → `null`. Si hay fila, busca el ítem vivo en `getExpirations()` sin límite de días y lo devuelve enriquecido con `odooTicketId`; si el ítem ya no aparece en InfraDoc (vencimiento resuelto/borrado), devuelve un DTO parcial solo con los datos de la fila (`type`, `expireDate`, `clientId`) y `itemName: null`.
  - Controller: requiere `JwtAuthGuard` (ya aplicado a nivel de clase); delega en el service y devuelve el resultado.

- [x] **Step 2:** `cd backend && npx jest notifications.controller.spec expiration-tickets.service.spec --no-coverage` → fallan.

- [x] **Step 3: Implementar** `getExpirationByTaskId` en `ExpirationTicketsService` y el endpoint en el controller, siguiendo el estilo de `getExpirations`/`getExpirationsWithTickets` ya existentes.

- [x] **Step 4:** correr los tests → pasan.

- [x] **Step 5: Commit**

```bash
git add backend/src/notifications/notifications.controller.ts \
        backend/src/notifications/notifications.controller.spec.ts \
        backend/src/notifications/expiration-tickets.service.ts \
        backend/src/notifications/expiration-tickets.service.spec.ts
git commit -m "feat(notifications): endpoint de detalle de vencimiento por Task para el drawer"
```

---

### Task 8: Frontend — modelos, labels, servicio de asignación

**Files:**
- Modify: `frontend/src/app/core/models/task.models.ts`
- Modify: `frontend/src/app/shared/utils/task-labels.ts`
- Modify: `frontend/src/app/core/services/tasks.service.ts`
- Modify: `frontend/src/app/core/services/tasks.service.spec.ts`

**Interfaces:**
- Produces: `TaskType` incluye `'EXPIRATION_CONTROL'`; `Task.technicianId: string | null`; `typeLabel`/`typeLabelLong`/`typeBadge` cubren el tipo nuevo; `TasksService.assignTechnician(taskId: string, technicianId: string): Observable<Task>`.

- [x] **Step 1:** `task.models.ts` — agregar `'EXPIRATION_CONTROL'` a la unión `TaskType`; `technicianId: string | null` en `Task`.

- [x] **Step 2:** `task-labels.ts` — el compilador va a marcar los 3 `Record<TaskType, string>`/`Record<TaskType, string>` como incompletos hasta agregar:
  - `typeLabel`: `EXPIRATION_CONTROL: 'Vencimiento'`
  - `typeLabelLong`: `EXPIRATION_CONTROL: 'Vencimiento de licencia/dominio/garantía/certificado'`
  - `typeBadge`: `EXPIRATION_CONTROL: 'badge--warn'`

- [x] **Step 3: Test que falla** en `tasks.service.spec.ts` — `assignTechnician` hace `PATCH /tasks/:id` con body `{ technicianId }` y devuelve el `Task` actualizado.

- [x] **Step 4:** `cd frontend && npx ng test --include="**/tasks.service.spec.ts" --watch=false --browsers=ChromeHeadless` → falla.

- [x] **Step 5: Implementar** en `tasks.service.ts`:

```typescript
assignTechnician(id: string, technicianId: string): Observable<Task> {
  return this.http.patch<Task>(`${this.base}/${id}`, { technicianId });
}
```

- [x] **Step 6:** correr el test → pasa.

- [x] **Step 7:** `cd frontend && npx tsc --noEmit` → sin errores (confirma que los `Record<TaskType, ...>` quedaron completos).

- [x] **Step 8: Commit**

```bash
git add frontend/src/app/core/models/task.models.ts \
        frontend/src/app/shared/utils/task-labels.ts \
        frontend/src/app/core/services/tasks.service.ts \
        frontend/src/app/core/services/tasks.service.spec.ts
git commit -m "feat(frontend): agregar TaskType EXPIRATION_CONTROL, labels y TasksService.assignTechnician"
```

---

### Task 9: Frontend — `stats` del ciclo excluye `EXPIRATION_CONTROL`

**Files:**
- Modify: `frontend/src/app/features/tasks/tasks-unified.component.ts`
- Modify: `frontend/src/app/features/tasks/tasks-unified.component.spec.ts`

**Interfaces:**
- Produces: `stats` (getter, líneas 128-137) calcula los conteos sobre `this.tasks.filter(t => t.type !== 'EXPIRATION_CONTROL')`.

- [x] **Step 1: Test que falla** — con una `EXPIRATION_CONTROL` `PENDING` mezclada en `this.tasks`, `stats.pending` no la cuenta (el resto de los conteos tampoco).

- [x] **Step 2:** `cd frontend && npx ng test --include="**/tasks-unified.component.spec.ts" --watch=false --browsers=ChromeHeadless` → falla.

- [x] **Step 3: Implementar**

```typescript
get stats(): CycleStats {
  const cyclical = this.tasks.filter(t => t.type !== 'EXPIRATION_CONTROL');
  return {
    assigned:   cyclical.length,
    inprogress: cyclical.filter(t => t.status === 'IN_PROGRESS').length,
    pending:    cyclical.filter(t => t.status === 'PENDING').length,
    done:       cyclical.filter(t => t.status === 'DONE').length,
    escalated:  cyclical.filter(t => t.status === 'ESCALATED' || t.status === 'NOT_DONE').length,
  };
}
```

- [x] **Step 4:** correr el test → pasa.

- [x] **Step 5: Commit**

```bash
git add frontend/src/app/features/tasks/tasks-unified.component.ts \
        frontend/src/app/features/tasks/tasks-unified.component.spec.ts
git commit -m "fix(tasks): excluir EXPIRATION_CONTROL de los KPIs del ciclo mensual"
```

---

### Task 10: Frontend — Task drawer: asignar técnico + detalle de vencimiento

**Files:**
- Modify: `frontend/src/app/features/technician/task-drawer/task-drawer.component.ts`
- Modify: `frontend/src/app/features/technician/task-drawer/task-drawer.component.html`
- Modify: `frontend/src/app/features/technician/task-drawer/task-drawer.component.spec.ts`

**Interfaces:**
- Consumes: `TasksService.assignTechnician` (Task 8); nuevo endpoint de detalle de vencimiento (Task 7).
- Produces: header con `mat-select` de técnicos cuando `task.technicianId` es `null`; `isConfigMissing`/`formReadOnly`/`canComplete` incorporan `isUnassigned`; bloque de detalle para `EXPIRATION_CONTROL`.

- [x] **Step 1: Tests que fallan**
  - `isUnassigned` es `true` cuando `task.technicianId === null`.
  - `formReadOnly` es `true` cuando `isUnassigned`, incluso si `isConfigMissing` es `false`.
  - Al seleccionar un técnico en el `mat-select` de asignación, llama a `assignTechnician` y, al resolver, actualiza `this.task` localmente (`{ ...this.task, technicianId }`) sin volver a pedir la tarea — **no** debe llamar a ningún método de recarga.
  - El bloque de detalle de vencimiento solo se pide (`GET` del endpoint de Task 7) cuando `task.type === 'EXPIRATION_CONTROL'`.

- [x] **Step 2:** `cd frontend && npx ng test --include="**/task-drawer.component.spec.ts" --watch=false --browsers=ChromeHeadless` → fallan.

- [x] **Step 3: Implementar en `task-drawer.component.ts`**

```typescript
get isUnassigned(): boolean {
  return this.task.technicianId == null;
}

get formReadOnly(): boolean {
  return !this.isActiveTask || this.isConfigMissing || this.isUnassigned;
}

get canComplete(): boolean {
  return this.isActiveTask && this.canExecute && !this.isConfigMissing && !this.isUnassigned;
}

assignTechnician(technicianId: string): void {
  this.tasksService.assignTechnician(this.task.id, technicianId).subscribe(updated => {
    this.task = { ...this.task, technicianId: updated.technicianId };
  });
}
```

Cargar el detalle de vencimiento en el setter/`ngOnChanges` de `task` cuando `task.type === 'EXPIRATION_CONTROL'`, guardando el resultado en una propiedad (`expirationDetail`) que el template consume.

- [x] **Step 4: Implementar en `task-drawer.component.html`** — en el header (reemplazando o junto al chip de técnico existente):

```html
<mat-form-field *ngIf="isUnassigned && (userRole === 'TL' || userRole === 'ADMIN')" appearance="outline" subscriptSizing="dynamic">
  <mat-label>Asignar técnico</mat-label>
  <mat-select (selectionChange)="assignTechnician($event.value)">
    <mat-option *ngFor="let t of technicians" [value]="t.id">{{ t.user?.name ?? t.id }}</mat-option>
  </mat-select>
</mat-form-field>
<span *ngIf="isUnassigned && userRole === 'TECHNICIAN'" class="d-unassigned-hint">Sin técnico asignado</span>
```

Sumar `EXPIRATION_CONTROL` al `ng-container` genérico que ya comparten `AV_CONTROL`/`UPS_CONTROL`/`ENDPOINT_INVENTORY` (línea 185), y agregar el bloque de detalle del vencimiento arriba de ese formulario cuando `expirationDetail` esté disponible.

- [x] **Step 5:** correr los tests → pasan.

- [x] **Step 6:** `cd frontend && npx tsc --noEmit` → sin errores.

- [x] **Step 7: Commit**

```bash
git add frontend/src/app/features/technician/task-drawer/task-drawer.component.ts \
        frontend/src/app/features/technician/task-drawer/task-drawer.component.html \
        frontend/src/app/features/technician/task-drawer/task-drawer.component.spec.ts
git commit -m "feat(task-drawer): asignar técnico y mostrar detalle de vencimiento en tareas EXPIRATION_CONTROL"
```

---

## Verificación final

- [x] `cd backend && npx jest --no-coverage` — suite completa verde.
- [x] `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless` — suite completa verde.
- [x] `cd backend && npx tsc --noEmit` y `cd frontend && npx tsc --noEmit` — sin errores.
- [x] Probar manualmente en dev: forzar un vencimiento dentro de la ventana configurada, correr el cron a mano (o invocar `createPendingExpirationTickets` desde un script), confirmar que aparece en `/tasks` sin técnico, asignarlo, completarlo, y verificar en Odoo que el ticket se cerró con timesheet.
