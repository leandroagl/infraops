# No Realizada: Reemplazar eliminación de tareas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el borrado destructivo de tareas por la transición a estado `NOT_DONE`, con motivo registrado en Odoo, y cierre automático al generar el mes siguiente.

**Architecture:** Nuevo método `OdooService.markTicketNotDone()` mueve el ticket al stage "No realizadas" con 0 hs imputadas. `TasksService.updateStatus()` lo usa cuando `newStatus === NOT_DONE` en vez de `closeTicket()`. `SchedulesService.generateMonth()` cierra automáticamente tareas incompletas del mes anterior antes de crear las nuevas. El frontend elimina el botón "Eliminar tarea" y agrega "No realizada" con diálogo de motivo para ADMIN y TL.

**Tech Stack:** NestJS · TypeORM · Jest (backend) · Angular 19 · Angular Material · Angular Testing Library (frontend)

**Spec:** `docs/superpowers/specs/2026-08-22-not-done-replace-delete-design.md`

## Global Constraints

- TDD: escribir el test que falla antes de implementar cada cambio
- Un archivo a la vez — no crear múltiples archivos sin confirmación
- Sin elementos HTML nativos en templates Angular — solo Angular Material
- Idioma del código: inglés · commits: español
- `appearance="outline"` en todos los `mat-form-field`
- Sin `any` en TypeScript salvo casos excepcionales justificados
- No mezclar lógica en controllers (va en services)

---

## File Map

| Archivo | Acción |
|---|---|
| `backend/src/integrations/odoo/odoo.service.ts` | Modificar — agregar `notDoneStageId` + `resolveNotDoneStageId()` + `markTicketNotDone()` |
| `backend/src/tasks/dto/update-task-status.dto.ts` | Modificar — agregar `reason?: string`, quitar `@Min(1)` de NOT_DONE |
| `backend/src/tasks/tasks.service.ts` | Modificar — refactorizar `updateStatus()` para NOT_DONE, eliminar `remove()` |
| `backend/src/tasks/tasks.controller.ts` | Modificar — pasar `reason` al service, eliminar `DELETE` endpoint |
| `backend/src/schedules/schedules.service.ts` | Modificar — agregar cierre automático de mes anterior en `generateMonth()` |
| `backend/src/tasks/tasks.service.spec.ts` | Modificar — agregar mock `markTicketNotDone`, actualizar tests NOT_DONE, eliminar test `remove()` |
| `backend/src/schedules/schedules.service.spec.ts` | Modificar — agregar mock `updateStatus`, agregar tests de cierre automático |
| `backend/src/tasks/tasks.controller.spec.ts` | Modificar — quitar test DELETE, agregar test de `reason` |
| `frontend/src/app/core/models/task.models.ts` | Modificar — agregar `reason?` a `UpdateTaskStatusPayload` |
| `frontend/src/app/core/services/tasks.service.ts` | Modificar — eliminar método `delete()` |
| `frontend/src/app/features/technician/task-drawer/confirm-close-dialog/confirm-close-dialog.component.ts` | Modificar — agregar `reasonCtrl`, nuevo tipo de retorno |
| `frontend/src/app/features/technician/task-drawer/confirm-close-dialog/confirm-close-dialog.component.html` | Modificar — agregar textarea + banner warn para NOT_DONE |
| `frontend/src/app/features/technician/task-drawer/confirm-close-dialog/confirm-close-dialog.component.spec.ts` | Modificar — actualizar tests de confirm/cancel, agregar tests NOT_DONE |
| `frontend/src/app/features/technician/task-drawer/task-drawer.component.ts` | Modificar — eliminar `taskDeleted`/`canDelete`, agregar `canMarkNotDone`, pasar `reason` |
| `frontend/src/app/features/technician/task-drawer/task-drawer.component.html` | Modificar — eliminar botones "Eliminar tarea", agregar botón "No realizada" |
| `frontend/src/app/features/technician/task-drawer/task-drawer.component.spec.ts` | Modificar — eliminar tests de delete, agregar tests de canMarkNotDone |
| `frontend/src/app/features/tasks/tasks-unified.component.ts` | Modificar — eliminar `onTaskDeleted()` y su import de `ConfirmDialogComponent` si queda sin uso |
| `frontend/src/app/features/tasks/tasks-unified.component.html` | Modificar — eliminar binding `(taskDeleted)` |
| `frontend/src/app/features/tasks/tasks-unified.component.spec.ts` | Modificar — eliminar tests de delete |

---

### Task 1: Backend — OdooService.markTicketNotDone()

**Files:**
- Modify: `backend/src/integrations/odoo/odoo.service.ts`

**Interfaces:**
- Consumes: `OdooSystemRpcService.callKw()`, `ConfigService.getOrThrow('ODOO_HELPDESK_TEAM_ID')`, `logTimesheet()` (privado existente)
- Produces: `markTicketNotDone(ticketId: number, employeeId: number, reason: string): Promise<void>`

- [ ] **Step 1: Agregar propiedad de caché y método privado de resolución**

En `odoo.service.ts`, después de `private inProgressStageId: number | null = null;` (línea ~41), agregar:

```typescript
private notDoneStageId: number | null = null;
```

Luego agregar el método privado después de `resolveInProgressStageId()`:

```typescript
private async resolveNotDoneStageId(): Promise<number> {
  if (this.notDoneStageId !== null) return this.notDoneStageId;

  const teamId = parseInt(
    this.configService.getOrThrow<string>('ODOO_HELPDESK_TEAM_ID'),
    10,
  );

  const stages = await this.systemRpc.callKw<Array<{ id: number }>>(
    'helpdesk.stage',
    'search_read',
    [
      [
        ['team_ids', 'in', [teamId]],
        ['name', '=', 'No realizadas'],
      ],
    ],
    { fields: ['id'], limit: 1 },
  );

  if (stages.length === 0) {
    throw new ServiceUnavailableException(
      'No se encontró stage "No realizadas" en Odoo para el equipo configurado',
    );
  }

  this.notDoneStageId = stages[0].id;
  return this.notDoneStageId;
}
```

- [ ] **Step 2: Agregar método público `markTicketNotDone()`**

Después de `markTicketInProgress()`, agregar:

```typescript
async markTicketNotDone(
  ticketId: number,
  employeeId: number,
  reason: string,
): Promise<void> {
  const stageId = await this.resolveNotDoneStageId();
  await this.logTimesheet(ticketId, employeeId, 0, reason);
  await this.systemRpc.callKw<boolean>(
    'helpdesk.ticket',
    'write',
    [[ticketId], { stage_id: stageId }],
    {},
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/integrations/odoo/odoo.service.ts
git commit -m "feat(odoo): agregar markTicketNotDone con stage No realizadas y 0 hs imputadas"
```

---

### Task 2: Backend — DTO + TasksService.updateStatus() refactor

**Files:**
- Modify: `backend/src/tasks/dto/update-task-status.dto.ts`
- Modify: `backend/src/tasks/tasks.service.ts`
- Modify: `backend/src/tasks/tasks.service.spec.ts`

**Interfaces:**
- Consumes: `OdooService.markTicketNotDone()` (Task 1), `OdooService.closeTicket()` (solo para DONE)
- Produces: `TasksService.updateStatus(id: string, newStatus: TaskStatus, options?: { timeSpentMinutes?: number; reason?: string }): Promise<Task>`

- [ ] **Step 1: Escribir tests que fallan en tasks.service.spec.ts**

Agregar `markTicketNotDone: jest.Mock` al mock de `odooService` en `beforeEach`:

```typescript
odooService = {
  createTicket: jest.fn(),
  closeTicket: jest.fn(),
  markTicketNotDone: jest.fn().mockResolvedValue(undefined),  // ← agregar
  resolveEmployeeId: jest.fn(),
  markTicketInProgress: jest.fn(),
  postInternalNote: jest.fn().mockResolvedValue(undefined),
};
```

Agregar al `TestBed` provider de `OdooService` (ya existe, solo añadir el mock al objeto). Luego agregar el bloque de tests:

```typescript
describe('updateStatus → NOT_DONE', () => {
  const taskWithOdoo: Task = {
    ...mockTask,
    id: 'task-nd',
    status: TaskStatus.IN_PROGRESS,
    odooTicketId: 999,
    technician: { ...mockTechnician, user: { id: 'user-1' } as User },
  };

  beforeEach(() => {
    taskRepository.findOne.mockResolvedValue(taskWithOdoo);
    taskRepository.update.mockResolvedValue(undefined);
    odooService.resolveEmployeeId.mockResolvedValue(42);
    odooService.markTicketNotDone.mockResolvedValue(undefined);
    taskRepository.findOne
      .mockResolvedValueOnce(taskWithOdoo)   // primera llamada: encontrar tarea
      .mockResolvedValueOnce(taskWithOdoo);  // segunda llamada: loadTask
  });

  it('llama a markTicketNotDone con ticketId, employeeId y reason', async () => {
    await service.updateStatus('task-nd', TaskStatus.NOT_DONE, {
      reason: 'Cliente canceló',
    });
    expect(odooService.markTicketNotDone).toHaveBeenCalledWith(
      999,
      42,
      'Cliente canceló',
    );
  });

  it('usa reason por defecto cuando no se provee', async () => {
    await service.updateStatus('task-nd', TaskStatus.NOT_DONE, {});
    expect(odooService.markTicketNotDone).toHaveBeenCalledWith(
      999,
      42,
      'Cierre automático de fin de mes',
    );
  });

  it('NO llama a closeTicket al marcar NOT_DONE', async () => {
    await service.updateStatus('task-nd', TaskStatus.NOT_DONE, {
      reason: 'Cancelada',
    });
    expect(odooService.closeTicket).not.toHaveBeenCalled();
  });

  it('no llama a markTicketNotDone si no hay odooTicketId', async () => {
    taskRepository.findOne
      .mockReset()
      .mockResolvedValueOnce({ ...taskWithOdoo, odooTicketId: null })
      .mockResolvedValueOnce({ ...taskWithOdoo, odooTicketId: null });
    await service.updateStatus('task-nd', TaskStatus.NOT_DONE, {
      reason: 'Sin ticket',
    });
    expect(odooService.markTicketNotDone).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Ejecutar y confirmar que fallan**

```bash
cd backend && npx jest tasks.service.spec.ts --no-coverage
```

Esperado: FAIL — `markTicketNotDone is not a function` / `not called`

- [ ] **Step 3: Actualizar UpdateTaskStatusDto**

Reemplazar `backend/src/tasks/dto/update-task-status.dto.ts` completamente:

```typescript
import { IsEnum, IsInt, IsOptional, IsString, Min, ValidateIf } from 'class-validator';
import { TaskStatus } from '../task-status.enum';

export class UpdateTaskStatusDto {
  @IsEnum(TaskStatus)
  status: TaskStatus;

  @ValidateIf((o) => o.status === TaskStatus.DONE)
  @IsInt()
  @Min(1)
  timeSpentMinutes?: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
```

- [ ] **Step 4: Refactorizar TasksService.updateStatus()**

Cambiar la firma del método de:
```typescript
async updateStatus(id: string, newStatus: TaskStatus, timeSpentMinutes?: number): Promise<Task>
```
a:
```typescript
async updateStatus(
  id: string,
  newStatus: TaskStatus,
  options: { timeSpentMinutes?: number; reason?: string } = {},
): Promise<Task>
```

Dentro del método, reemplazar el bloque `shouldCloseTicket` (líneas ~168-210) con:

```typescript
const isTerminal = VALID_TRANSITIONS[newStatus].length === 0;
const completedDate = isTerminal ? new Date() : null;

if (newStatus === TaskStatus.NOT_DONE && task.odooTicketId !== null) {
  const userId = task.technician?.user?.id;
  if (!userId)
    throw new BadRequestException('La tarea no tiene técnico con usuario asociado');

  const employeeId = await this.odooService.resolveEmployeeId(userId);
  if (employeeId === null)
    throw new BadRequestException('El técnico no tiene odooEmployeeId sincronizado');

  const reason = options.reason ?? 'Cierre automático de fin de mes';
  await this.odooService.markTicketNotDone(task.odooTicketId, employeeId, reason);
}

if (newStatus === TaskStatus.DONE && task.odooTicketId !== null) {
  const userId = task.technician?.user?.id;
  if (!userId)
    throw new BadRequestException('La tarea no tiene técnico con usuario asociado');

  const employeeId = await this.odooService.resolveEmployeeId(userId);
  if (employeeId === null)
    throw new BadRequestException('El técnico no tiene odooEmployeeId sincronizado');

  if (!options.timeSpentMinutes)
    throw new BadRequestException('Se requiere timeSpentMinutes para marcar una tarea como DONE');

  const unitAmount = options.timeSpentMinutes / 60;
  await this.odooService.closeTicket(task.odooTicketId, employeeId, unitAmount, task.type);
}

await this.taskRepository.update(id, { status: newStatus, completedDate });

if (newStatus === TaskStatus.DONE && task.odooTicketId !== null) {
  const log = await this.logRepository.findOne({ where: { taskId: id } });
  const userId = task.technician?.user?.id;
  if (log?.notes && userId) {
    try {
      await this.odooService.postInternalNote(task.odooTicketId, log.notes, userId);
    } catch (err) {
      this.logger.warn(`No se pudo postear nota interna en Odoo: ${(err as Error).message}`);
    }
  }
}
```

Eliminar el método `remove()` completo (líneas 214-220).

- [ ] **Step 5: Ejecutar tests y confirmar que pasan**

```bash
cd backend && npx jest tasks.service.spec.ts --no-coverage
```

Esperado: todos los tests de `tasks.service.spec.ts` en verde. Si hay un test existente de `remove()`, eliminarlo del spec.

- [ ] **Step 6: Commit**

```bash
git add backend/src/tasks/dto/update-task-status.dto.ts \
        backend/src/tasks/tasks.service.ts \
        backend/src/tasks/tasks.service.spec.ts
git commit -m "feat(tasks): refactorizar updateStatus para NOT_DONE con motivo; eliminar remove()"
```

---

### Task 3: Backend — TasksController: eliminar DELETE + pasar reason

**Files:**
- Modify: `backend/src/tasks/tasks.controller.ts`
- Modify: `backend/src/tasks/tasks.controller.spec.ts`

**Interfaces:**
- Consumes: `TasksService.updateStatus(id, status, { timeSpentMinutes?, reason? })` (Task 2)
- Produces: `PATCH /tasks/:id/status` acepta `{ status, timeSpentMinutes?, reason? }` · `DELETE /tasks/:id` eliminado

- [ ] **Step 1: Actualizar el spec del controller**

En `backend/src/tasks/tasks.controller.spec.ts`, buscar y eliminar cualquier test del bloque `describe('DELETE /tasks/:id')` o test que invoque `tasksService.remove`. Luego agregar test para `reason`:

```typescript
it('pasa reason al service en PATCH status', async () => {
  const updatedTask = { id: 'task-1', status: 'NOT_DONE' } as Task;
  jest.spyOn(tasksService, 'updateStatus').mockResolvedValue(updatedTask);

  const result = await controller.updateStatus('task-1', {
    status: TaskStatus.NOT_DONE,
    reason: 'Cliente canceló',
  } as UpdateTaskStatusDto);

  expect(tasksService.updateStatus).toHaveBeenCalledWith('task-1', TaskStatus.NOT_DONE, {
    timeSpentMinutes: undefined,
    reason: 'Cliente canceló',
  });
  expect(result).toBe(updatedTask);
});
```

- [ ] **Step 2: Ejecutar spec del controller para confirmar que falla**

```bash
cd backend && npx jest tasks.controller.spec.ts --no-coverage
```

Esperado: FAIL — el método del controller no pasa `reason` todavía.

- [ ] **Step 3: Actualizar TasksController**

En `tasks.controller.ts`:

1. Eliminar el import de `Delete` y `HttpCode` si solo se usan en el endpoint DELETE.
2. Reemplazar el handler `updateStatus`:
```typescript
@Patch(':id/status')
@Roles(UserRole.ADMIN, UserRole.TL, UserRole.TECHNICIAN, UserRole.COORDINATOR)
updateStatus(
  @Param('id', ParseUUIDPipe) id: string,
  @Body() dto: UpdateTaskStatusDto,
): Promise<Task> {
  return this.tasksService.updateStatus(id, dto.status, {
    timeSpentMinutes: dto.timeSpentMinutes,
    reason: dto.reason,
  });
}
```
3. Eliminar completamente el método `remove()` y su decorador `@Delete`.

- [ ] **Step 4: Ejecutar tests y confirmar que pasan**

```bash
cd backend && npx jest tasks.controller.spec.ts --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/tasks/tasks.controller.ts \
        backend/src/tasks/tasks.controller.spec.ts
git commit -m "feat(tasks): eliminar endpoint DELETE; pasar reason a updateStatus"
```

---

### Task 4: Backend — SchedulesService: cierre automático del mes anterior

**Files:**
- Modify: `backend/src/schedules/schedules.service.ts`
- Modify: `backend/src/schedules/schedules.service.spec.ts`

**Interfaces:**
- Consumes: `TasksService.updateStatus(id, NOT_DONE, { reason })` (Task 2) · `taskRepo.find()` con filtro por mes y status
- Produces: `generateMonth()` cierra tareas PENDING/IN_PROGRESS del mes anterior antes de crear las nuevas

- [ ] **Step 1: Agregar mock de `updateStatus` al spec de schedules**

En `schedules.service.spec.ts`, cambiar la definición de `tasksService`:

```typescript
let tasksService: { create: jest.Mock; updateStatus: jest.Mock };
```

Y en `beforeEach`:

```typescript
tasksService = {
  create: jest.fn(),
  updateStatus: jest.fn().mockResolvedValue(undefined),
};
```

Actualizar el provider:
```typescript
{ provide: TasksService, useValue: tasksService },
```

- [ ] **Step 2: Escribir tests de cierre automático**

Agregar al final del archivo de spec:

```typescript
describe('generateMonth — cierre automático del mes anterior', () => {
  const makeTask = (id: string, status: TaskStatus) =>
    ({ id, status, odooTicketId: null } as Task);

  beforeEach(() => {
    // Sin reglas de schedule: el loop de creación no hace nada
    scheduleRepo.find.mockResolvedValue([]);
    rotationRepo.findOne.mockResolvedValue({
      isActive: false, frequency: RotationFrequency.EVERY_GENERATION,
      generationsSinceLastRotation: 0,
    });
  });

  it('cierra tareas PENDING y IN_PROGRESS del mes anterior', async () => {
    taskRepo.find
      .mockResolvedValueOnce([
        makeTask('t-1', TaskStatus.PENDING),
        makeTask('t-2', TaskStatus.IN_PROGRESS),
        makeTask('t-3', TaskStatus.DONE), // NO debe cerrarse
      ])
      .mockResolvedValue([]); // llamadas subsiguientes (wasGenerated)

    await service.generateMonth(2026, 8);

    expect(tasksService.updateStatus).toHaveBeenCalledTimes(2);
    expect(tasksService.updateStatus).toHaveBeenCalledWith('t-1', TaskStatus.NOT_DONE, {
      reason: 'Cierre automático de fin de mes',
    });
    expect(tasksService.updateStatus).toHaveBeenCalledWith('t-2', TaskStatus.NOT_DONE, {
      reason: 'Cierre automático de fin de mes',
    });
  });

  it('calcula correctamente el mes anterior cuando es enero', async () => {
    taskRepo.find.mockResolvedValue([]);
    await service.generateMonth(2026, 1);

    // Primera llamada a taskRepo.find debe ser para diciembre 2025
    const firstCall = taskRepo.find.mock.calls[0][0];
    expect(firstCall.where.scheduledDate).toContain('2025-12');
  });

  it('un error en updateStatus no detiene la generación del nuevo mes', async () => {
    taskRepo.find
      .mockResolvedValueOnce([makeTask('t-err', TaskStatus.PENDING)])
      .mockResolvedValue([]);
    tasksService.updateStatus.mockRejectedValue(new Error('Odoo error'));
    scheduleRepo.find.mockResolvedValueOnce([]) // para applyRotation
                    .mockResolvedValueOnce([]); // para generateMonth loop

    // No debe lanzar
    await expect(service.generateMonth(2026, 8)).resolves.toBeDefined();
  });
});
```

- [ ] **Step 3: Ejecutar y confirmar que fallan**

```bash
cd backend && npx jest schedules.service.spec.ts --no-coverage
```

Esperado: FAIL — `updateStatus is not a function` / assertion failures.

- [ ] **Step 4: Implementar cierre automático en SchedulesService**

En `schedules.service.ts`, agregar una importación de `Between` si no está. Luego agregar el método privado antes de `generateMonth`:

```typescript
private async closeUnfinishedTasksFromPreviousMonth(
  year: number,
  month: number,
): Promise<void> {
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;
  const pad = (n: number) => String(n).padStart(2, '0');
  const firstDay = `${prevYear}-${pad(prevMonth)}-01`;
  const lastDayNum = new Date(prevYear, prevMonth, 0).getDate();
  const lastDay = `${prevYear}-${pad(prevMonth)}-${pad(lastDayNum)}`;

  const unfinished = await this.taskRepo.find({
    where: [
      { scheduledDate: Between(firstDay, lastDay) as unknown as string, status: TaskStatus.PENDING },
      { scheduledDate: Between(firstDay, lastDay) as unknown as string, status: TaskStatus.IN_PROGRESS },
    ],
    select: ['id'],
  });

  for (const task of unfinished) {
    try {
      await this.tasksService.updateStatus(task.id, TaskStatus.NOT_DONE, {
        reason: 'Cierre automático de fin de mes',
      });
    } catch (err) {
      this.logger.warn(
        `No se pudo cerrar tarea ${task.id} automáticamente: ${(err as Error).message}`,
      );
    }
  }
}
```

Al inicio de `generateMonth()`, antes de `await this.applyRotationIfNeeded()`, agregar:

```typescript
await this.closeUnfinishedTasksFromPreviousMonth(year, month);
```

Agregar `TaskStatus` al import desde `'../tasks/task-status.enum'` si no está importado.

- [ ] **Step 5: Ejecutar y confirmar que pasan**

```bash
cd backend && npx jest schedules.service.spec.ts --no-coverage
```

- [ ] **Step 6: Ejecutar toda la suite backend**

```bash
cd backend && npx jest --no-coverage
```

Esperado: todos en verde.

- [ ] **Step 7: Commit**

```bash
git add backend/src/schedules/schedules.service.ts \
        backend/src/schedules/schedules.service.spec.ts
git commit -m "feat(schedules): cerrar tareas incompletas del mes anterior al generar el nuevo mes"
```

---

### Task 5: Frontend — task.models + TasksService

**Files:**
- Modify: `frontend/src/app/core/models/task.models.ts`
- Modify: `frontend/src/app/core/services/tasks.service.ts`

**Interfaces:**
- Produces: `UpdateTaskStatusPayload` con `reason?: string` · `TasksService` sin `delete()`

- [ ] **Step 1: Actualizar UpdateTaskStatusPayload en task.models.ts**

Reemplazar:

```typescript
export interface UpdateTaskStatusPayload {
  status: TaskStatus;
  timeSpentMinutes?: number;
}
```

por:

```typescript
export interface UpdateTaskStatusPayload {
  status: TaskStatus;
  timeSpentMinutes?: number;
  reason?: string;
}
```

- [ ] **Step 2: Eliminar método delete() de TasksService**

En `frontend/src/app/core/services/tasks.service.ts`, eliminar el método:

```typescript
delete(id: string): Observable<void> {
  return this.http.delete<void>(`${this.base}/${id}`);
}
```

- [ ] **Step 3: Ejecutar check de compilación**

```bash
cd frontend && npx ng build --configuration=development 2>&1 | head -30
```

Esperado: errores de compilación en los archivos que aún referencian `delete()` o el tipo viejo — son los archivos que se arreglan en las tareas siguientes. Solo verificar que no haya errores inesperados.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/core/models/task.models.ts \
        frontend/src/app/core/services/tasks.service.ts
git commit -m "feat(tasks): agregar reason a UpdateTaskStatusPayload; eliminar delete() del service"
```

---

### Task 6: Frontend — ConfirmCloseDialogComponent

**Files:**
- Modify: `frontend/src/app/features/technician/task-drawer/confirm-close-dialog/confirm-close-dialog.component.ts`
- Modify: `frontend/src/app/features/technician/task-drawer/confirm-close-dialog/confirm-close-dialog.component.html`
- Modify: `frontend/src/app/features/technician/task-drawer/confirm-close-dialog/confirm-close-dialog.component.spec.ts`

**Interfaces:**
- Consumes: `MAT_DIALOG_DATA: ConfirmCloseDialogData` (sin cambios)
- Produces: `dialogRef.close({ confirmed: true, reason?: string })` en confirm · `dialogRef.close(null)` en cancel

- [ ] **Step 1: Actualizar los tests del spec**

Reemplazar el contenido de `confirm-close-dialog.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { CommonModule } from '@angular/common';
import {
  ConfirmCloseDialogComponent,
  ConfirmCloseDialogData,
} from './confirm-close-dialog.component';

const baseData: ConfirmCloseDialogData = {
  mode: 'DONE',
  taskType: 'SERVER_HOST_MAINTENANCE',
  config: {
    taskType: 'SERVER_HOST_MAINTENANCE',
    defaultTimeMinutes: 90,
    odooTagIds: [1],
    odooTagNames: ['Virtualización'],
    ticketDescription: null,
    timesheetDescription: null,
    updatedAt: '2026-01-01T00:00:00Z',
  },
  odooTicketId: 1234,
  issuesSummary: { dcdiagErrors: [], veeamMissing: false, emptyFields: [] },
};

describe('ConfirmCloseDialogComponent', () => {
  let component: ConfirmCloseDialogComponent;
  let fixture: ComponentFixture<ConfirmCloseDialogComponent>;
  let dialogRef: jasmine.SpyObj<MatDialogRef<ConfirmCloseDialogComponent>>;

  function setup(data: ConfirmCloseDialogData): Promise<void> {
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);
    TestBed.resetTestingModule();
    return TestBed.configureTestingModule({
      declarations: [ConfirmCloseDialogComponent],
      imports: [
        NoopAnimationsModule,
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
      ],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    }).compileComponents().then(() => {
      fixture = TestBed.createComponent(ConfirmCloseDialogComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });
  }

  describe('modo DONE', () => {
    it('muestra el tiempo formateado', async () => {
      await setup(baseData);
      expect(component.formattedTime).toBe('1:30 h');
    });

    it('devuelve { confirmed: true } al confirmar', async () => {
      await setup(baseData);
      component.confirm();
      expect(dialogRef.close).toHaveBeenCalledWith({ confirmed: true });
    });

    it('devuelve null al cancelar', async () => {
      await setup(baseData);
      component.cancel();
      expect(dialogRef.close).toHaveBeenCalledWith(null);
    });

    it('detecta alertas cuando hay errores DCDiag', async () => {
      await setup({ ...baseData, issuesSummary: { dcdiagErrors: ['ERROR: DNS'], veeamMissing: false, emptyFields: [] } });
      expect(component.hasAlerts).toBe(true);
    });
  });

  describe('modo NOT_DONE', () => {
    it('no muestra tags ni ticket', async () => {
      await setup({ ...baseData, mode: 'NOT_DONE' });
      expect(component.showTags).toBe(false);
      expect(component.showTicket).toBe(false);
    });

    it('reasonCtrl existe y comienza vacío', async () => {
      await setup({ ...baseData, mode: 'NOT_DONE' });
      expect(component.reasonCtrl.value).toBe('');
    });

    it('devuelve { confirmed: true, reason } al confirmar con motivo', async () => {
      await setup({ ...baseData, mode: 'NOT_DONE' });
      component.reasonCtrl.setValue('Cliente canceló');
      component.confirm();
      expect(dialogRef.close).toHaveBeenCalledWith({
        confirmed: true,
        reason: 'Cliente canceló',
      });
    });

    it('no cierra si el motivo está vacío', async () => {
      await setup({ ...baseData, mode: 'NOT_DONE' });
      component.reasonCtrl.setValue('');
      component.confirm();
      expect(dialogRef.close).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Ejecutar spec y confirmar que fallan**

```bash
cd frontend && npx ng test --include="**/confirm-close-dialog.component.spec.ts" --watch=false --browsers=ChromeHeadless
```

Esperado: FAIL — `reasonCtrl` no existe, `close` llamado con `true` en vez de `{ confirmed: true }`.

- [ ] **Step 3: Actualizar el componente TypeScript**

Reemplazar el contenido de `confirm-close-dialog.component.ts`:

```typescript
import { Component, Inject } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TaskType, TaskTypeConfigDto } from '../../../../core/models/task.models';

export interface ConfirmCloseDialogData {
  mode: 'DONE' | 'NOT_DONE';
  taskType: TaskType;
  config: TaskTypeConfigDto;
  odooTicketId: number | null;
  issuesSummary: {
    dcdiagErrors: string[];
    veeamMissing: boolean;
    emptyFields: string[];
  };
}

export interface ConfirmCloseDialogResult {
  confirmed: boolean;
  reason?: string;
}

@Component({
  selector: 'app-confirm-close-dialog',
  templateUrl: './confirm-close-dialog.component.html',
})
export class ConfirmCloseDialogComponent {
  readonly reasonCtrl = new FormControl('', [Validators.required]);

  constructor(
    private dialogRef: MatDialogRef<ConfirmCloseDialogComponent, ConfirmCloseDialogResult | null>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmCloseDialogData,
  ) {}

  get formattedTime(): string {
    const m = this.data.config.defaultTimeMinutes ?? 0;
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${h}:${min.toString().padStart(2, '0')} h`;
  }

  get hasAlerts(): boolean {
    const { dcdiagErrors, veeamMissing } = this.data.issuesSummary;
    return dcdiagErrors.length > 0 || veeamMissing;
  }

  get showTags(): boolean {
    return this.data.mode === 'DONE' && this.data.config.odooTagNames.length > 0;
  }

  get showTicket(): boolean {
    return this.data.mode === 'DONE' && this.data.odooTicketId != null;
  }

  get confirmLabel(): string {
    if (this.data.mode === 'NOT_DONE') return 'Confirmar — no realizado';
    return this.hasAlerts ? 'Confirmar con alertas' : 'Confirmar cierre';
  }

  confirm(): void {
    if (this.data.mode === 'NOT_DONE') {
      if (this.reasonCtrl.invalid) {
        this.reasonCtrl.markAsTouched();
        return;
      }
      this.dialogRef.close({ confirmed: true, reason: this.reasonCtrl.value! });
    } else {
      this.dialogRef.close({ confirmed: true });
    }
  }

  cancel(): void { this.dialogRef.close(null); }
}
```

- [ ] **Step 4: Actualizar el template HTML**

Reemplazar el contenido de `confirm-close-dialog.component.html`:

```html
<h2 mat-dialog-title>
  <span *ngIf="data.mode === 'NOT_DONE'">⊘</span>
  <span *ngIf="data.mode !== 'NOT_DONE' && !hasAlerts">✓</span>
  <span *ngIf="data.mode !== 'NOT_DONE' && hasAlerts">⚠</span>
  {{ data.mode === 'NOT_DONE' ? 'Marcar como No realizada' : 'Confirmar cierre' }}
</h2>

<mat-dialog-content>
  <p class="dialog-subtitle">{{ data.taskType }}</p>

  <!-- Modo DONE: información de cierre -->
  <ng-container *ngIf="data.mode === 'DONE'">
    <div class="info-row">
      <span class="info-key">Tiempo a imputar</span>
      <span class="info-val">{{ formattedTime }}</span>
    </div>

    <div *ngIf="showTags" class="info-row">
      <span class="info-key">Tags Odoo</span>
      <div class="info-tags">
        <span *ngFor="let name of data.config.odooTagNames" class="tag-chip">{{ name }}</span>
      </div>
    </div>

    <div *ngIf="showTicket" class="info-row">
      <span class="info-key">Ticket</span>
      <span class="info-val">#{{ data.odooTicketId }}</span>
    </div>

    <div *ngIf="hasAlerts" class="alerts-block">
      <p class="alerts-title">⚠ Errores detectados</p>
      <ul>
        <li *ngFor="let err of data.issuesSummary.dcdiagErrors">{{ err }}</li>
        <li *ngIf="data.issuesSummary.veeamMissing">Hay VMs sin cobertura de backup Veeam</li>
      </ul>
    </div>
  </ng-container>

  <!-- Modo NOT_DONE: motivo + aviso -->
  <ng-container *ngIf="data.mode === 'NOT_DONE'">
    <mat-form-field appearance="outline" subscriptSizing="dynamic" style="width:100%;margin-top:12px">
      <mat-label>Motivo</mat-label>
      <textarea matInput [formControl]="reasonCtrl" rows="3"
                placeholder="Ej: El cliente canceló el mantenimiento por falla de conectividad externa…"></textarea>
      <mat-error *ngIf="reasonCtrl.hasError('required')">El motivo es obligatorio</mat-error>
    </mat-form-field>

    <div class="not-done-warn">
      ⚠ Se imputarán <strong>0:00 hs</strong> en Odoo y el ticket pasará al stage
      <strong>"No realizadas"</strong>. El motivo ingresado se usará como descripción de la imputación.
    </div>
  </ng-container>
</mat-dialog-content>

<mat-dialog-actions align="end">
  <button mat-stroked-button (click)="cancel()">Cancelar</button>
  <button
    mat-flat-button
    [color]="data.mode === 'NOT_DONE' ? 'warn' : (hasAlerts ? 'warn' : 'primary')"
    (click)="confirm()">
    {{ confirmLabel }}
  </button>
</mat-dialog-actions>
```

Agregar los estilos del banner en `confirm-close-dialog.component.scss` (si existe) o inline en el template via `<style>` si el componente no tiene archivo de estilos:

```scss
.not-done-warn {
  margin-top: 14px;
  padding: 10px 12px;
  background: rgba(255, 179, 0, 0.12);
  border: 1px solid rgba(255, 179, 0, 0.25);
  border-radius: 4px;
  font-size: 12px;
  color: #ffb300;
  line-height: 1.5;
}
```

- [ ] **Step 5: Ejecutar spec y confirmar que pasan**

```bash
cd frontend && npx ng test --include="**/confirm-close-dialog.component.spec.ts" --watch=false --browsers=ChromeHeadless
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/features/technician/task-drawer/confirm-close-dialog/
git commit -m "feat(dialog): agregar campo motivo y banner 0:00 hs para modo NOT_DONE"
```

---

### Task 7: Frontend — TaskDrawerComponent

**Files:**
- Modify: `frontend/src/app/features/technician/task-drawer/task-drawer.component.ts`
- Modify: `frontend/src/app/features/technician/task-drawer/task-drawer.component.html`
- Modify: `frontend/src/app/features/technician/task-drawer/task-drawer.component.spec.ts`

**Interfaces:**
- Consumes: `ConfirmCloseDialogResult` (Task 6) · `TasksService.updateStatus()` con `reason?` (Task 5)
- Produces: `canMarkNotDone` getter · sin `taskDeleted` output · sin `canDelete` getter

- [ ] **Step 1: Agregar tests para canMarkNotDone y eliminar tests de delete**

En `task-drawer.component.spec.ts`, buscar y eliminar los tests del bloque que verifican el botón `data-testid="btn-delete"` o el output `taskDeleted`. Luego agregar:

```typescript
describe('canMarkNotDone', () => {
  it('es true para ADMIN con tarea activa y ciclo abierto', () => {
    const fix = setup('ADMIN');
    fix.componentInstance.task = { ...fix.componentInstance.task, status: 'PENDING' };
    fix.componentInstance.cycleClosed = false;
    fix.detectChanges();
    expect(fix.componentInstance.canMarkNotDone).toBeTrue();
  });

  it('es true para TL con tarea activa y ciclo abierto', () => {
    const fix = setup('TL');
    fix.componentInstance.task = { ...fix.componentInstance.task, status: 'IN_PROGRESS' };
    fix.componentInstance.cycleClosed = false;
    fix.detectChanges();
    expect(fix.componentInstance.canMarkNotDone).toBeTrue();
  });

  it('es false para TECHNICIAN', () => {
    const fix = setup('TECHNICIAN');
    fix.componentInstance.cycleClosed = false;
    fix.detectChanges();
    expect(fix.componentInstance.canMarkNotDone).toBeFalse();
  });

  it('es false cuando el ciclo está cerrado', () => {
    const fix = setup('ADMIN');
    fix.componentInstance.cycleClosed = true;
    fix.detectChanges();
    expect(fix.componentInstance.canMarkNotDone).toBeFalse();
  });

  it('es false cuando la tarea está DONE', () => {
    const fix = setup('ADMIN');
    fix.componentInstance.task = { ...fix.componentInstance.task, status: 'DONE' };
    fix.detectChanges();
    expect(fix.componentInstance.canMarkNotDone).toBeFalse();
  });

  it('no renderiza el botón "Eliminar tarea" para ningún rol', () => {
    for (const role of ['ADMIN', 'TL', 'TECHNICIAN'] as const) {
      const fix = setup(role);
      fix.detectChanges();
      const btn = fix.nativeElement.querySelector('[data-testid="btn-delete"]');
      expect(btn).toBeNull(`rol ${role} no debería ver btn-delete`);
    }
  });
});
```

- [ ] **Step 2: Ejecutar spec y confirmar que fallan**

```bash
cd frontend && npx ng test --include="**/task-drawer.component.spec.ts" --watch=false --browsers=ChromeHeadless
```

- [ ] **Step 3: Actualizar task-drawer.component.ts**

Cambios en el TypeScript:

1. Eliminar el import de `ConfirmCloseDialogResult` si no estaba importado; agregar si necesario.
2. Eliminar `@Output() taskDeleted = new EventEmitter<void>();` (línea 56).
3. Eliminar getter `canDelete` (líneas 193-195).
4. Agregar getter `canMarkNotDone`:

```typescript
get canMarkNotDone(): boolean {
  return !this.cycleClosed
    && this.isActiveTask
    && (this.userRole === 'ADMIN' || this.userRole === 'TL');
}
```

5. Actualizar `onRequestNotDone()` para capturar `reason` y pasarlo al service:

```typescript
onRequestNotDone(): void {
  if (!this.taskConfig) return;

  const data: ConfirmCloseDialogData = {
    mode: 'NOT_DONE',
    taskType: this.task.type,
    config: this.taskConfig,
    odooTicketId: this.task.odooTicketId,
    issuesSummary: { dcdiagErrors: [], veeamMissing: false, emptyFields: [] },
  };

  this.dialog.open(ConfirmCloseDialogComponent, { data, width: '420px' })
    .afterClosed()
    .subscribe((result: { confirmed: boolean; reason?: string } | null) => {
      if (!result?.confirmed) return;
      this.tasksService.updateStatus(this.task.id, {
        status: 'NOT_DONE',
        reason: result.reason,
      }).subscribe({
        next: () => { this.taskNotDone.emit(); },
        error: () => { this.confirmError = 'No se pudo actualizar el estado de la tarea.'; },
      });
    });
}
```

6. Actualizar `onRequestComplete()` para el nuevo tipo de retorno del diálogo:

```typescript
onRequestComplete(payload: MaintenancePayload): void {
  if (!this.taskConfig) return;
  this.pendingPayload = payload;

  const data: ConfirmCloseDialogData = {
    mode: 'DONE',
    taskType: this.task.type,
    config: this.taskConfig,
    odooTicketId: this.task.odooTicketId,
    issuesSummary: this.detectIssues(payload),
  };

  this.dialog.open(ConfirmCloseDialogComponent, { data, width: '420px' })
    .afterClosed()
    .subscribe((result: { confirmed: boolean; reason?: string } | null) => {
      if (result?.confirmed) this.saveAndComplete(this.taskConfig!.defaultTimeMinutes!);
    });
}
```

- [ ] **Step 4: Actualizar task-drawer.component.html**

1. Eliminar los dos botones con `data-testid="btn-delete"` (líneas 115-117 y 194-196 del template original).
2. Agregar el botón "No realizada" en el área de acciones activas (dentro de `*ngIf="isActiveTask && canExecute"`). Colocarlo después de todos los bloques `ng-container` de tipos de tarea, antes del cierre de `ng-container *ngIf="isActiveTask && canExecute"`:

```html
<button *ngIf="canMarkNotDone" mat-stroked-button color="warn"
        (click)="onRequestNotDone()" [disabled]="completing">
  No realizada
</button>
```

3. Eliminar el botón "No concretada" que existe solo para SITE_VISIT (línea 152) ya que `onRequestNotDone()` ahora se maneja con el nuevo botón global. (Verificar si ese botón hacía lo mismo — sí, llama a `onRequestNotDone()`.)

- [ ] **Step 5: Ejecutar spec y confirmar que pasan**

```bash
cd frontend && npx ng test --include="**/task-drawer.component.spec.ts" --watch=false --browsers=ChromeHeadless
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/features/technician/task-drawer/task-drawer.component.ts \
        frontend/src/app/features/technician/task-drawer/task-drawer.component.html \
        frontend/src/app/features/technician/task-drawer/task-drawer.component.spec.ts
git commit -m "feat(drawer): reemplazar eliminar-tarea por No-realizada con motivo para ADMIN y TL"
```

---

### Task 8: Frontend — TasksUnifiedComponent cleanup

**Files:**
- Modify: `frontend/src/app/features/tasks/tasks-unified.component.ts`
- Modify: `frontend/src/app/features/tasks/tasks-unified.component.html`
- Modify: `frontend/src/app/features/tasks/tasks-unified.component.spec.ts`

**Interfaces:**
- Eliminado: output binding `(taskDeleted)` · método `onTaskDeleted()` · llamada a `tasksService.delete()`

- [ ] **Step 1: Eliminar tests de delete del spec**

En `tasks-unified.component.spec.ts`, buscar y eliminar cualquier bloque `describe` o `it` que pruebe `onTaskDeleted`, `tasksService.delete`, o el binding `(taskDeleted)`.

- [ ] **Step 2: Ejecutar spec para confirmar baseline**

```bash
cd frontend && npx ng test --include="**/tasks-unified.component.spec.ts" --watch=false --browsers=ChromeHeadless
```

Esperado: en verde (los tests de delete ya eliminados).

- [ ] **Step 3: Limpiar el componente TypeScript**

En `tasks-unified.component.ts`:

1. Eliminar el método `onTaskDeleted()` completo (líneas 229-248).
2. Eliminar el import de `ConfirmDialogComponent` si no se usa en otro lugar del componente.
3. Eliminar el import de `EMPTY` si no se usa en otro lugar (verificar si `switchMap(confirmed => confirmed ? ... : EMPTY)` es el único uso).

- [ ] **Step 4: Limpiar el template HTML**

En `tasks-unified.component.html`, eliminar el binding:

```html
(taskDeleted)="onTaskDeleted()"
```

del elemento `<app-task-drawer>`.

- [ ] **Step 5: Verificar compilación completa**

```bash
cd frontend && npx ng build --configuration=development 2>&1 | tail -20
```

Esperado: 0 errores.

- [ ] **Step 6: Ejecutar suite completa de tests frontend**

```bash
cd frontend && npx ng test --watch=false --browsers=ChromeHeadless
```

Esperado: todos en verde.

- [ ] **Step 7: Commit final**

```bash
git add frontend/src/app/features/tasks/tasks-unified.component.ts \
        frontend/src/app/features/tasks/tasks-unified.component.html \
        frontend/src/app/features/tasks/tasks-unified.component.spec.ts
git commit -m "feat(tasks): eliminar flujo de borrado de tareas; limpiar referencias a taskDeleted"
```

---

## Self-Review

### Spec coverage
- ✅ `OdooService.markTicketNotDone()` — Task 1
- ✅ `UpdateTaskStatusDto.reason` — Task 2
- ✅ `TasksService.updateStatus()` refactor NOT_DONE → `markTicketNotDone` — Task 2
- ✅ `TasksService.remove()` eliminado — Task 2
- ✅ `DELETE /tasks/:id` eliminado — Task 3
- ✅ Cierre automático en `generateMonth()` — Task 4
- ✅ `UpdateTaskStatusPayload.reason` — Task 5
- ✅ `TasksService.delete()` frontend eliminado — Task 5
- ✅ `ConfirmCloseDialogComponent` modo NOT_DONE con textarea + banner — Task 6
- ✅ Nuevo tipo de retorno `{ confirmed, reason? }` — Task 6
- ✅ `TaskDrawerComponent.canMarkNotDone` getter — Task 7
- ✅ Botón "No realizada" para ADMIN/TL en todos los task types — Task 7
- ✅ Botones "Eliminar tarea" eliminados — Task 7
- ✅ `onRequestNotDone()` pasa `reason` — Task 7
- ✅ `cycleClosed` ya calculado correctamente en `TasksUnifiedComponent` — sin cambio necesario
- ✅ `onTaskDeleted()` y binding eliminados — Task 8

### Riesgos conocidos
- El botón "No concretada" de SITE_VISIT (Task 7, step 4) ya llama a `onRequestNotDone()` igual que el nuevo botón global — se elimina para no duplicar. Verificar que el spec de SITE_VISIT no testee ese botón específicamente.
- Si algún test de `tasks.service.spec.ts` ya cubría la transición NOT_DONE → `closeTicket`, fallará en Step 2 de Task 2 hasta que se implemente el refactor. Eso es correcto — es el comportamiento TDD esperado.
