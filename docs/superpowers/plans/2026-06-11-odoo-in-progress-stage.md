# Odoo "En Curso" al pasar tarea a IN_PROGRESS — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al transicionar una tarea a `IN_PROGRESS`, mover el ticket de Odoo asociado al stage "En Curso" (fire-and-forget), cerrando el primer SLA del equipo de helpdesk.

**Architecture:** Dos métodos nuevos en `OdooService` (`resolveInProgressStageId` privado + `markTicketInProgress` público) siguiendo el patrón de caché existente en `resolveDoneStageId`. En `TasksService.updateStatus`, un bloque fire-and-forget que llama `markTicketInProgress` sin await y traga el error con `Logger`. No hay cambios en frontend ni en DTOs.

**Tech Stack:** NestJS · TypeORM · Jest

---

## Mapa de archivos

| Archivo | Acción |
|---|---|
| `backend/src/integrations/odoo/odoo.service.ts` | Agregar campo `inProgressStageId`, métodos `resolveInProgressStageId` y `markTicketInProgress` |
| `backend/src/integrations/odoo/odoo.service.spec.ts` | Agregar `describe('markTicketInProgress', ...)` |
| `backend/src/tasks/tasks.service.ts` | Agregar `Logger`, bloque fire-and-forget en `updateStatus` |
| `backend/src/tasks/tasks.service.spec.ts` | Agregar `markTicketInProgress` al mock, agregar tests de la nueva lógica |

---

## Task 1: OdooService — markTicketInProgress

**Files:**
- Modify: `backend/src/integrations/odoo/odoo.service.spec.ts`
- Modify: `backend/src/integrations/odoo/odoo.service.ts`

- [ ] **Step 1: Escribir tests failing para markTicketInProgress**

Agregar al final de `odoo.service.spec.ts`, antes del `});` de cierre del `describe('OdooService', ...)`:

```typescript
describe('markTicketInProgress', () => {
  it('resuelve stage "En Curso" por nombre y escribe stage_id en el ticket', async () => {
    odooRpc.callKw
      .mockResolvedValueOnce([{ id: 77 }]) // helpdesk.stage search_read → "En Curso"
      .mockResolvedValueOnce(true);         // helpdesk.ticket write

    await service.markTicketInProgress(42);

    const calls = odooRpc.callKw.mock.calls;
    expect(calls[0]).toEqual([
      'helpdesk.stage',
      'search_read',
      [[['team_ids', 'in', [5]], ['name', '=', 'En Curso']]],
      { fields: ['id'], limit: 1 },
    ]);
    expect(calls[1]).toEqual([
      'helpdesk.ticket',
      'write',
      [[42], { stage_id: 77 }],
      {},
    ]);
  });

  it('reutiliza el stage cacheado en llamadas subsiguientes sin volver a consultar Odoo', async () => {
    odooRpc.callKw
      .mockResolvedValueOnce([{ id: 77 }]) // primera llamada: resuelve stage
      .mockResolvedValue(true);             // subsiguientes: write

    await service.markTicketInProgress(42);
    await service.markTicketInProgress(43);

    const stageCalls = odooRpc.callKw.mock.calls.filter(
      (args: unknown[]) => args[0] === 'helpdesk.stage',
    );
    expect(stageCalls).toHaveLength(1);
  });

  it('lanza ServiceUnavailableException cuando Odoo no devuelve ningún stage "En Curso"', async () => {
    odooRpc.callKw.mockResolvedValueOnce([]);

    await expect(service.markTicketInProgress(42)).rejects.toThrow(ServiceUnavailableException);
  });

  it('propaga ServiceUnavailableException cuando Odoo falla al ejecutar write', async () => {
    odooRpc.callKw
      .mockResolvedValueOnce([{ id: 77 }])
      .mockRejectedValueOnce(new ServiceUnavailableException('Odoo caído'));

    await expect(service.markTicketInProgress(42)).rejects.toThrow(ServiceUnavailableException);
  });
});
```

- [ ] **Step 2: Verificar que los tests fallan**

```bash
cd backend && npm test -- --testPathPattern=odoo.service.spec
```

Expected: FAIL con `service.markTicketInProgress is not a function`

- [ ] **Step 3: Agregar campo y métodos en OdooService**

En `backend/src/integrations/odoo/odoo.service.ts`, agregar el campo `inProgressStageId` junto a `doneStageId` (línea 16):

```typescript
private doneStageId: number | null = null;
private inProgressStageId: number | null = null;
```

Agregar el método privado `resolveInProgressStageId` justo antes de `resolveDoneStageId`:

```typescript
private async resolveInProgressStageId(): Promise<number> {
  if (this.inProgressStageId !== null) return this.inProgressStageId;

  const teamId = parseInt(
    this.configService.getOrThrow<string>('ODOO_HELPDESK_TEAM_ID'),
    10,
  );

  const stages = await this.odooRpc.callKw<Array<{ id: number }>>(
    'helpdesk.stage',
    'search_read',
    [[['team_ids', 'in', [teamId]], ['name', '=', 'En Curso']]],
    { fields: ['id'], limit: 1 },
  );

  if (stages.length === 0) {
    throw new ServiceUnavailableException(
      'No se encontró stage "En Curso" en Odoo para el equipo configurado',
    );
  }

  this.inProgressStageId = stages[0].id;
  return this.inProgressStageId;
}
```

Agregar el método público `markTicketInProgress` justo después de `resolveInProgressStageId`:

```typescript
async markTicketInProgress(odooTicketId: number): Promise<void> {
  const stageId = await this.resolveInProgressStageId();
  await this.odooRpc.callKw<boolean>(
    'helpdesk.ticket',
    'write',
    [[odooTicketId], { stage_id: stageId }],
    {},
  );
}
```

- [ ] **Step 4: Verificar que los tests pasan**

```bash
npm test -- --testPathPattern=odoo.service.spec
```

Expected: PASS — todos los tests de `OdooService` en verde.

- [ ] **Step 5: Commit**

```bash
git add backend/src/integrations/odoo/odoo.service.ts backend/src/integrations/odoo/odoo.service.spec.ts
git commit -m "feat(odoo): markTicketInProgress mueve ticket a stage En Curso con caché"
```

---

## Task 2: TasksService — fire-and-forget al transicionar a IN_PROGRESS

**Files:**
- Modify: `backend/src/tasks/tasks.service.spec.ts`
- Modify: `backend/src/tasks/tasks.service.ts`

- [ ] **Step 1: Agregar markTicketInProgress al mock de odooService en tasks.service.spec.ts**

En `tasks.service.spec.ts`, reemplazar la declaración de tipo de `odooService` (línea 32):

```typescript
let odooService: {
  createTicket: jest.Mock;
  closeTicket: jest.Mock;
  resolveEmployeeId: jest.Mock;
  markTicketInProgress: jest.Mock;
};
```

En el `beforeEach`, reemplazar la inicialización de `odooService` (línea 89):

```typescript
odooService = {
  createTicket: jest.fn(),
  closeTicket: jest.fn(),
  resolveEmployeeId: jest.fn(),
  markTicketInProgress: jest.fn(),
};
```

- [ ] **Step 2: Escribir tests failing**

Agregar al `describe('updateStatus', ...)`, antes del `});` de cierre:

```typescript
it('llama markTicketInProgress al transicionar a IN_PROGRESS cuando la tarea tiene odooTicketId', async () => {
  const pendingTaskWithTicket = { ...mockTask, status: TaskStatus.PENDING, odooTicketId: 42 };
  taskRepository.findOne
    .mockResolvedValueOnce(pendingTaskWithTicket)
    .mockResolvedValueOnce({ ...pendingTaskWithTicket, status: TaskStatus.IN_PROGRESS });
  odooService.markTicketInProgress.mockResolvedValue(undefined);
  taskRepository.update.mockResolvedValue({ affected: 1 });

  await service.updateStatus('task-1', TaskStatus.IN_PROGRESS);

  expect(odooService.markTicketInProgress).toHaveBeenCalledWith(42);
});

it('no llama markTicketInProgress al transicionar a IN_PROGRESS cuando odooTicketId es null', async () => {
  taskRepository.findOne
    .mockResolvedValueOnce(mockTask) // mockTask ya tiene odooTicketId: null
    .mockResolvedValueOnce({ ...mockTask, status: TaskStatus.IN_PROGRESS });
  taskRepository.update.mockResolvedValue({ affected: 1 });

  await service.updateStatus('task-1', TaskStatus.IN_PROGRESS);

  expect(odooService.markTicketInProgress).not.toHaveBeenCalled();
});

it('no llama markTicketInProgress al transicionar a DONE', async () => {
  const inProgressTask = { ...mockTask, status: TaskStatus.IN_PROGRESS, odooTicketId: 42, technician: { user: { id: 'user-1' } } };
  taskRepository.findOne
    .mockResolvedValueOnce(inProgressTask)
    .mockResolvedValueOnce({ ...inProgressTask, status: TaskStatus.DONE });
  odooService.resolveEmployeeId.mockResolvedValue(22);
  odooService.closeTicket.mockResolvedValue(undefined);
  taskRepository.update.mockResolvedValue({ affected: 1 });

  await service.updateStatus('task-1', TaskStatus.DONE, 90);

  expect(odooService.markTicketInProgress).not.toHaveBeenCalled();
});

it('taskRepository.update se llama igual si markTicketInProgress falla (fire-and-forget)', async () => {
  const pendingTaskWithTicket = { ...mockTask, status: TaskStatus.PENDING, odooTicketId: 42 };
  taskRepository.findOne
    .mockResolvedValueOnce(pendingTaskWithTicket)
    .mockResolvedValueOnce({ ...pendingTaskWithTicket, status: TaskStatus.IN_PROGRESS });
  odooService.markTicketInProgress.mockRejectedValue(new Error('Odoo caído'));
  taskRepository.update.mockResolvedValue({ affected: 1 });

  await service.updateStatus('task-1', TaskStatus.IN_PROGRESS);

  expect(taskRepository.update).toHaveBeenCalledWith('task-1', {
    status: TaskStatus.IN_PROGRESS,
    completedDate: null,
  });
});
```

- [ ] **Step 3: Verificar que los tests fallan**

```bash
npm test -- --testPathPattern=tasks.service.spec
```

Expected: FAIL — `markTicketInProgress` no es llamado porque la implementación actual no lo invoca.

- [ ] **Step 4: Agregar Logger y bloque fire-and-forget en TasksService**

En `backend/src/tasks/tasks.service.ts`, actualizar el import de `@nestjs/common` agregando `Logger`:

```typescript
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
```

Agregar el campo `logger` en la clase, justo antes del constructor:

```typescript
private readonly logger = new Logger(TasksService.name);
```

En el método `updateStatus`, agregar el bloque fire-and-forget inmediatamente antes de la línea `const shouldCloseTicket`:

```typescript
if (newStatus === TaskStatus.IN_PROGRESS && task.odooTicketId !== null) {
  this.odooService.markTicketInProgress(task.odooTicketId).catch((err: unknown) => {
    this.logger.error(
      `Error al marcar ticket ${task.odooTicketId} en curso en Odoo`,
      err,
    );
  });
}
```

El método `updateStatus` completo queda así:

```typescript
async updateStatus(id: string, newStatus: TaskStatus, timeSpentMinutes?: number): Promise<Task> {
  const task = await this.taskRepository.findOne({
    where: { id },
    relations: ['technician', 'technician.user'],
  });
  if (!task) throw new NotFoundException('Tarea no encontrada');

  const allowed = VALID_TRANSITIONS[task.status];
  if (!allowed.includes(newStatus)) {
    throw new BadRequestException(
      `Transición inválida: ${task.status} → ${newStatus}`,
    );
  }

  if (newStatus === TaskStatus.IN_PROGRESS && task.odooTicketId !== null) {
    this.odooService.markTicketInProgress(task.odooTicketId).catch((err: unknown) => {
      this.logger.error(
        `Error al marcar ticket ${task.odooTicketId} en curso en Odoo`,
        err,
      );
    });
  }

  const isTerminal = VALID_TRANSITIONS[newStatus].length === 0;
  const completedDate = isTerminal ? new Date() : null;

  const shouldCloseTicket =
    (newStatus === TaskStatus.DONE || newStatus === TaskStatus.NOT_DONE) &&
    task.odooTicketId !== null;

  if (shouldCloseTicket) {
    const userId = task.technician?.user?.id;
    if (!userId) throw new BadRequestException('La tarea no tiene técnico con usuario asociado');

    const employeeId = await this.odooService.resolveEmployeeId(userId);
    if (employeeId === null) {
      throw new BadRequestException('El técnico no tiene odooEmployeeId sincronizado');
    }

    if (newStatus === TaskStatus.DONE && !timeSpentMinutes) {
      throw new BadRequestException('Se requiere timeSpentMinutes para marcar una tarea como DONE');
    }
    const unitAmount = (timeSpentMinutes ?? 0) / 60;
    await this.odooService.closeTicket(task.odooTicketId!, employeeId, unitAmount);
  }

  await this.taskRepository.update(id, { status: newStatus, completedDate });
  return this.loadTask(id);
}
```

- [ ] **Step 5: Verificar que todos los tests pasan**

```bash
npm test
```

Expected: PASS — suite completa en verde.

- [ ] **Step 6: Commit**

```bash
git add backend/src/tasks/tasks.service.ts backend/src/tasks/tasks.service.spec.ts
git commit -m "feat(tasks): marcar ticket Odoo En Curso al transicionar a IN_PROGRESS (fire-and-forget)"
```

---

## Verificación final

- [ ] Correr suite completa:

```bash
cd backend && npm test
```

Expected: todos los tests pasan.
