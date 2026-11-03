# Code Review Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir los 15 findings del code review de octubre 2026, organizados en tres branches por prioridad: crítico (integridad de datos), alto (seguridad/robustez) y medio (frontend).

**Architecture:** Tres branches independientes sobre `develop`, cada una fusionable por separado. Las correcciones críticas son bugs de integridad de datos en NestJS; las altas son gaps de seguridad y robustez; las medias son memory leaks y violaciones de estado en Angular. No hay dependencias entre branches.

**Tech Stack:** NestJS · TypeORM · PostgreSQL · Angular 19 · Angular Material · Jest · Angular Testing Library

**Spec:** Este documento es su propia especificación. Ver findings originales en la conversación de code review (2026-10-13).

## Global Constraints

- **TDD obligatorio:** test failing antes de cada implementación.
- **Un archivo a la vez:** no generar múltiples archivos en un mismo paso sin confirmación.
- **Sin `any` en TypeScript** salvo casos justificados.
- **Sin standalone components** en Angular.
- **Idioma del código:** inglés. **Commits y docs:** español.
- **Angular Material obligatorio** en todos los elementos interactivos del frontend.
- Tests de backend: `cd backend && npx jest <archivo.spec.ts> --no-coverage`.
- Tests de frontend: `cd frontend && npx ng test --include=<path> --watch=false`.

## Review Focus

- **Race condition + non-atomic en expiration tickets:** dos crons simultáneos pueden crear tickets Odoo huérfanos; la solución correcta invierte el orden (INSERT DB primero, Odoo después).
- **Scoping de la guardia de técnico en tareas:** `NOT_DONE` sin técnico debe ser legal para el cierre automático; si `odooTicketId` es null el bloque Odoo se saltea igual.
- **Timeout en XML-RPC de Odoo:** `xmlrpc` no soporta timeout nativo en `createClient`; hay que envolver la promesa con `Promise.race`.
- **`takeUntilDestroyed` en Angular:** requiere `DestroyRef` inyectado en el constructor; no funciona con `OnDestroy` manual en la misma clase.
- **Mutex de authenticate() en Odoo:** el in-flight guard debe limpiar `authInFlight` en el `finally`, no en el `then`, para evitar que un rechazo deje la referencia colgando.

---

## BRANCH 1: `fix/review-critical`

> `git checkout fix/review-critical`

Archivos a modificar:
- `backend/src/tasks/tasks.service.ts` — relajar guardia de técnico para NOT_DONE
- `backend/src/tasks/tasks.service.spec.ts` — tests para la transición
- `backend/src/notifications/expiration-tickets.service.ts` — invertir orden Odoo/DB
- `backend/src/notifications/expiration-tickets.service.spec.ts` — tests para atomicidad
- `backend/src/schedules/schedules.service.ts` — manejar unique violation en generateMonth
- `backend/src/schedules/schedules.service.spec.ts` — test de idempotencia

---

### Tarea 1 — Permitir `NOT_DONE` en tareas sin técnico asignado

**Contexto:** `updateStatus` tiene la guardia `technicianId === null && newStatus !== PENDING` que rechaza `NOT_DONE`. `closeUnfinishedTasksFromPreviousMonth` llama `updateStatus(id, NOT_DONE)` sobre tareas PENDING sin técnico, el error se swallow, y esas tareas quedan abiertas para siempre.

**Archivos:**
- Modify: `backend/src/tasks/tasks.service.ts:231`
- Test: `backend/src/tasks/tasks.service.spec.ts`

**Interfaces:**
- Consumes: `TaskStatus.NOT_DONE`, `task.technicianId: string | null`, `task.odooTicketId: number | null`
- Produces: ningún cambio de contrato público — sólo amplía qué transiciones son legales

- [ ] **Paso 1: Agregar test que falla**

  En `backend/src/tasks/tasks.service.spec.ts`, dentro del bloque `describe('updateStatus')`, agregar:

  ```typescript
  it('permite NOT_DONE en tarea PENDING sin técnico asignado', async () => {
    const task = {
      id: 'task-no-tech',
      status: TaskStatus.PENDING,
      technicianId: null,
      technician: null,
      odooTicketId: null,
      type: TaskType.SERVER_HOST_MAINTENANCE,
      expirationType: null,
    };
    taskRepository.findOne.mockResolvedValue(task);
    taskRepository.update.mockResolvedValue(undefined);
    taskRepository.findOne.mockResolvedValueOnce(task).mockResolvedValueOnce({ ...task, status: TaskStatus.NOT_DONE });

    await expect(
      service.updateStatus('task-no-tech', TaskStatus.NOT_DONE, { reason: 'Cierre automático' }),
    ).resolves.not.toThrow();
    expect(odooService.markTicketNotDone).not.toHaveBeenCalled();
  });
  ```

- [ ] **Paso 2: Ejecutar y verificar que falla**

  ```bash
  cd backend && npx jest tasks.service.spec.ts --no-coverage -t "permite NOT_DONE en tarea PENDING sin técnico"
  ```
  Esperado: FAIL — `BadRequestException: Asigná un técnico antes de continuar`

- [ ] **Paso 3: Aplicar el fix**

  En `backend/src/tasks/tasks.service.ts`, línea 231, cambiar:

  ```typescript
  // ANTES
  if (task.technicianId === null && newStatus !== TaskStatus.PENDING) {
    throw new BadRequestException('Asigná un técnico antes de continuar');
  }
  ```

  ```typescript
  // DESPUÉS
  if (
    task.technicianId === null &&
    newStatus !== TaskStatus.PENDING &&
    newStatus !== TaskStatus.NOT_DONE
  ) {
    throw new BadRequestException('Asigná un técnico antes de continuar');
  }
  ```

  La transición `PENDING → NOT_DONE` sin técnico es segura porque el bloque Odoo de `NOT_DONE` (línea ~244) está guardado por `task.odooTicketId !== null`, y las tareas PENDING sin técnico tienen `odooTicketId: null`.

- [ ] **Paso 4: Ejecutar y verificar que pasa**

  ```bash
  cd backend && npx jest tasks.service.spec.ts --no-coverage
  ```
  Esperado: todos los tests pasan.

- [ ] **Paso 5: Commit**

  ```bash
  git add backend/src/tasks/tasks.service.ts backend/src/tasks/tasks.service.spec.ts
  git commit -m "fix: permitir NOT_DONE en tareas PENDING sin técnico para cierre mensual automático"
  ```

---

### Tarea 2 — Hacer atómica la creación de tickets de vencimiento (DB-first)

**Contexto:** `createTicketWithTask` llama Odoo primero y guarda en DB después. Si el save falla, el ticket queda huérfano. Dos crons concurrentes ambos pasan el check de `existingKeys` antes de que cualquiera escriba. La solución: insertar la fila de `expiration_tickets` primero (sin `odooTicketId`), y solo si el INSERT triunfa, llamar Odoo. Esto convierte la DB unique constraint en el lock real.

**Archivos:**
- Modify: `backend/src/notifications/expiration-tickets.service.ts`
- Test: `backend/src/notifications/expiration-tickets.service.spec.ts`

**Interfaces:**
- Consumes: `this.ticketRepo` (TypeORM Repository<ExpirationTicket>), `this.odooService.createExpirationTicket()`
- Produces: misma firma `createTicketWithTask(item, clientId, cfg, existingRowId?)` — sin cambios de firma

- [ ] **Paso 1: Agregar test para el caso de fallo de DB post-Odoo**

  En `backend/src/notifications/expiration-tickets.service.spec.ts`, agregar un test que verifica que si el `ticketRepo.save` falla, NO se vuelve a llamar a `odooService.createExpirationTicket` en el siguiente cron (porque la fila ya existe):

  ```typescript
  describe('createTicketWithTask - atomicidad', () => {
    it('no llama Odoo si la fila ya existe en DB (insert retorna 0 affected)', async () => {
      // simular que el insert falla por unique constraint (affected = 0)
      ticketRepo.createQueryBuilder = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        orIgnore: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ identifiers: [], raw: [], affected: 0 }),
      });

      await service['createTicketWithTask'](mockItem, 'client-1', mockCfg);

      expect(odooService.createExpirationTicket).not.toHaveBeenCalled();
    });

    it('llama Odoo y actualiza la fila si el insert triunfa', async () => {
      const savedId = 'new-row-id';
      ticketRepo.createQueryBuilder = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        orIgnore: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ identifiers: [{ id: savedId }], raw: [{ id: savedId }], affected: 1 }),
      });
      ticketRepo.update = jest.fn().mockResolvedValue(undefined);
      odooService.createExpirationTicket = jest.fn().mockResolvedValue(42);

      await service['createTicketWithTask'](mockItem, 'client-1', mockCfg);

      expect(odooService.createExpirationTicket).toHaveBeenCalledTimes(1);
      expect(ticketRepo.update).toHaveBeenCalledWith(savedId, { odooTicketId: 42 });
    });

    it('revierte la fila si Odoo falla (limpieza para retry)', async () => {
      const savedId = 'new-row-id';
      ticketRepo.createQueryBuilder = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        orIgnore: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ identifiers: [{ id: savedId }], raw: [{ id: savedId }], affected: 1 }),
      });
      ticketRepo.delete = jest.fn().mockResolvedValue(undefined);
      odooService.createExpirationTicket = jest.fn().mockRejectedValue(new Error('Odoo timeout'));

      await expect(service['createTicketWithTask'](mockItem, 'client-1', mockCfg)).rejects.toThrow('Odoo timeout');
      expect(ticketRepo.delete).toHaveBeenCalledWith(savedId);
    });
  });
  ```

- [ ] **Paso 2: Ejecutar y verificar que fallan**

  ```bash
  cd backend && npx jest expiration-tickets.service.spec.ts --no-coverage -t "atomicidad"
  ```
  Esperado: FAIL

- [ ] **Paso 3: Refactorizar `createTicketWithTask` — DB-first**

  En `backend/src/notifications/expiration-tickets.service.ts`, reemplazar el método `createTicketWithTask`:

  ```typescript
  private async createTicketWithTask(
    item: ExpirationItemDto,
    clientId: string,
    cfg: TypeConfigEntry,
    existingRowId?: string,
  ): Promise<number> {
    // Caso de backlog pre-sembrado: la fila ya existe, ir directo a Odoo
    if (existingRowId) {
      const odooTicketId = await this.odooService.createExpirationTicket(
        item, clientId, cfg.helpdeskTeamId!, cfg.tagIds, cfg.taskName, cfg.ticketDescription,
      );
      await this.ticketRepo.update(existingRowId, { odooTicketId });
      await this.createTaskForTicket(item, clientId, odooTicketId, existingRowId);
      return odooTicketId;
    }

    // INSERT optimista con ON CONFLICT DO NOTHING — la DB unique constraint es el lock
    const insertResult = await this.ticketRepo
      .createQueryBuilder()
      .insert()
      .into(ExpirationTicket)
      .values({
        type: item.type,
        sourceId: item.sourceId,
        expireDate: item.expireDate,
        clientId,
      })
      .orIgnore()
      .execute();

    // Otro proceso ya insertó esta fila → skip silencioso, no hay duplicado
    if (!insertResult.affected || insertResult.affected === 0) {
      this.logger.debug(`createTicketWithTask: fila ya existente para ${item.type}/${item.sourceId}, skip`);
      return 0;
    }

    const newRowId: string = insertResult.identifiers[0].id;

    // Llamar Odoo sólo si somos el proceso que ganó el INSERT
    let odooTicketId: number;
    try {
      odooTicketId = await this.odooService.createExpirationTicket(
        item, clientId, cfg.helpdeskTeamId!, cfg.tagIds, cfg.taskName, cfg.ticketDescription,
      );
    } catch (err) {
      // Rollback: borrar la fila para que el próximo cron reintente
      await this.ticketRepo.delete(newRowId);
      throw err;
    }

    await this.ticketRepo.update(newRowId, { odooTicketId });

    try {
      await this.appNotificationsService.create('EXPIRATION_TICKET_CREATED', {
        clientName: item.clientName,
        expirationType: item.type,
        itemName: item.itemName,
        daysUntil: item.daysUntil,
        odooTicketId,
      });
    } catch (err: unknown) {
      this.logger.error(`Notificación fallida para ticket ${odooTicketId}: ${(err as Error).message}`);
    }

    await this.createTaskForTicket(item, clientId, odooTicketId, newRowId);

    return odooTicketId;
  }
  ```

  Extraer la lógica de creación de Task a un método privado `createTaskForTicket` para no duplicarla:

  ```typescript
  private async createTaskForTicket(
    item: ExpirationItemDto,
    clientId: string,
    odooTicketId: number,
    ticketRowId: string,
  ): Promise<void> {
    try {
      const task = await this.tasksService.createFromExistingTicket({
        clientId,
        type: TaskType.EXPIRATION_CONTROL,
        odooTicketId,
        expirationType: item.type,
        sourceId: item.sourceId,
        expireDate: item.expireDate,
        itemName: item.itemName,
      });
      await this.ticketRepo.update(ticketRowId, { taskId: task.id });
    } catch (err: unknown) {
      this.logger.error(
        `Error creando Task para ticket ${odooTicketId}: ${(err as Error).message}`,
      );
    }
  }
  ```

  > **Nota:** Verificar que `ExpirationTicket` importa correctamente en el query builder. Si `insertResult.identifiers[0].id` no funciona con el driver PostgreSQL, usar `insertResult.raw[0]?.id` como alternativa.

- [ ] **Paso 4: Ejecutar todos los tests del módulo**

  ```bash
  cd backend && npx jest expiration-tickets.service.spec.ts --no-coverage
  ```
  Esperado: todos pasan.

- [ ] **Paso 5: Commit**

  ```bash
  git add backend/src/notifications/expiration-tickets.service.ts backend/src/notifications/expiration-tickets.service.spec.ts
  git commit -m "fix: hacer atómica la creación de tickets de vencimiento (DB-first, rollback en fallo Odoo)"
  ```

---

### Tarea 3 — Idempotencia en `generateMonth` (TOCTOU)

**Contexto:** `findOne` + `create` no están en transacción. Dos llamadas simultáneas a `POST /schedules/generate` para el mismo mes pueden crear tareas duplicadas. La solución más pragmática: tratar una excepción de unique constraint como "skip" en lugar de "error".

**Archivos:**
- Modify: `backend/src/schedules/schedules.service.ts`
- Test: `backend/src/schedules/schedules.service.spec.ts`

**Interfaces:**
- Consumes: `this.tasksService.create()` — puede lanzar una DB unique violation si se agrega una constraint a la entidad Task
- Produces: `GenerationResultDto` — sin cambios de firma; los skips se suman a `tasksSkipped`

- [ ] **Paso 1: Agregar test de idempotencia**

  En `backend/src/schedules/schedules.service.spec.ts`:

  ```typescript
  it('generateMonth es idempotente: segunda llamada devuelve mismos created=0', async () => {
    // Primera llamada
    taskRepo.findOne.mockResolvedValue(null);
    await service.generateMonth(2026, 10);
    const firstCreated = tasksService.create.mock.calls.length;

    // Segunda llamada — simular que las tareas ya existen
    taskRepo.findOne.mockResolvedValue({ id: 'existing-task' });
    tasksService.create.mockClear();

    const result = await service.generateMonth(2026, 10);
    expect(tasksService.create).not.toHaveBeenCalled();
    expect(result.tasksSkipped).toBeGreaterThan(0);
  });
  ```

- [ ] **Paso 2: Ejecutar y verificar que pasa (ya funciona si `findOne` devuelve la tarea)**

  ```bash
  cd backend && npx jest schedules.service.spec.ts --no-coverage -t "idempotente"
  ```
  Esperado: PASS — el test ya debería pasar porque `findOne` retorna `exists`. El bug real es la race; lo que no está testeado es la concurrencia.

- [ ] **Paso 3: Agregar test de race condition explícito**

  ```typescript
  it('no crea tareas duplicadas si create() lanza QueryFailedError por unique constraint', async () => {
    const { QueryFailedError } = await import('typeorm');
    taskRepo.findOne.mockResolvedValue(null); // ambas llamadas pasan el check
    tasksService.create
      .mockResolvedValueOnce({ id: 'task-1' }) // primera llamada OK
      .mockRejectedValueOnce(Object.assign(new QueryFailedError('INSERT', [], new Error()), {
        code: '23505', // PostgreSQL unique_violation
      }));

    // No debe lanzar — la segunda llamada swallow la unique violation como skip
    await expect(service.generateMonth(2026, 10)).resolves.not.toThrow();
  });
  ```

- [ ] **Paso 4: Verificar que falla (la unique violation no se swallow actualmente)**

  ```bash
  cd backend && npx jest schedules.service.spec.ts --no-coverage -t "unique constraint"
  ```
  Esperado: FAIL

- [ ] **Paso 5: Aplicar el fix en `generateMonth`**

  En `backend/src/schedules/schedules.service.ts`, dentro del loop de creación de tareas, agregar handling de `QueryFailedError`:

  ```typescript
  import { QueryFailedError } from 'typeorm';
  ```

  Reemplazar el bloque `try/catch` dentro del loop de tipos:

  ```typescript
  try {
    await this.tasksService.create({
      clientId: rule.clientId,
      technicianId: rule.technicianId,
      type,
      scheduledDate: firstDay,
    });
    tasksCreated++;
    await new Promise(r => setTimeout(r, THROTTLE_MS));
  } catch (err) {
    if (err instanceof BadRequestException) {
      // InfraDoc: cliente no tiene infra para este tipo → skip silencioso
      tasksSkipped++;
    } else if (
      err instanceof QueryFailedError &&
      (err as QueryFailedError & { code?: string }).code === '23505'
    ) {
      // Race condition: tarea ya creada por llamada concurrente → skip
      this.logger.debug(`generateMonth: tarea duplicada skip (${type} / ${rule.clientId})`);
      tasksSkipped++;
    } else {
      this.logger.error(`Error generando ${type} para ${rule.clientId}: ${(err as Error).message}`);
      errors.push({ clientId: rule.clientId, taskType: type, error: (err as Error).message });
    }
  }
  ```

- [ ] **Paso 6: Ejecutar todos los tests del módulo**

  ```bash
  cd backend && npx jest schedules.service.spec.ts --no-coverage
  ```
  Esperado: todos pasan.

- [ ] **Paso 7: Commit**

  ```bash
  git add backend/src/schedules/schedules.service.ts backend/src/schedules/schedules.service.spec.ts
  git commit -m "fix: swallow unique constraint en generateMonth para evitar duplicados en llamadas concurrentes"
  ```

---

## BRANCH 2: `fix/review-high`

> `git checkout fix/review-high`

Archivos a modificar:
- `backend/src/integration-config/crypto.util.ts` — validar split
- `backend/src/integration-config/crypto.util.spec.ts` — tests
- `backend/src/integrations/odoo/odoo-rpc.helpers.ts` — timeout XML-RPC
- `backend/src/integrations/odoo/odoo-rpc.helpers.spec.ts` — tests
- `backend/src/integrations/odoo/odoo-system-rpc.service.ts` — mutex authenticate
- `backend/src/integrations/odoo/odoo-system-rpc.service.spec.ts` — tests
- `backend/src/integration-config/integration-config.service.ts` — fix testJetbackup
- `backend/src/integration-config/integration-config.service.spec.ts` — test
- `backend/src/backups/backups.cron.ts` — Promise.all en runDailySnapshot
- `backend/src/backups/backups.cron.spec.ts` — test
- `backend/src/auth/strategies/jwt.strategy.ts` — fix <= a comparación por segundo
- `backend/src/auth/strategies/jwt.strategy.spec.ts` — test
- `backend/src/main.ts` — CORS por env + ThrottlerModule

---

### Tarea 4 — Validar formato en `decrypt()`

**Contexto:** `decrypt()` hace destructuring de `stored.split(':')` sin verificar que el resultado tiene exactamente 3 partes. Un valor malformado en DB causa `Buffer.from(undefined)` → `TypeError` no controlado → HTTP 500.

**Archivos:**
- Modify: `backend/src/integration-config/crypto.util.ts:28`
- Test: `backend/src/integration-config/crypto.util.spec.ts` (crear si no existe)

- [ ] **Paso 1: Agregar test que falla**

  ```typescript
  // backend/src/integration-config/crypto.util.spec.ts
  import { encrypt, decrypt } from './crypto.util';

  const TEST_KEY = 'a'.repeat(64); // 64 hex chars = 32 bytes

  describe('decrypt', () => {
    it('lanza error descriptivo si el valor almacenado no tiene formato iv:tag:cipher', () => {
      expect(() => decrypt('valor-sin-colones', TEST_KEY)).toThrow(
        /formato.*inválido/i,
      );
    });

    it('lanza error descriptivo si el valor tiene solo 2 partes', () => {
      expect(() => decrypt('soloun:colon', TEST_KEY)).toThrow(
        /formato.*inválido/i,
      );
    });

    it('round-trip: encrypt/decrypt produce el plaintext original', () => {
      const plaintext = 'supersecret-api-key-123';
      const stored = encrypt(plaintext, TEST_KEY);
      expect(decrypt(stored, TEST_KEY)).toBe(plaintext);
    });
  });
  ```

- [ ] **Paso 2: Ejecutar y verificar que los primeros dos fallan**

  ```bash
  cd backend && npx jest crypto.util.spec.ts --no-coverage
  ```
  Esperado: los dos tests de formato fallan con TypeError, el de round-trip pasa.

- [ ] **Paso 3: Aplicar el fix**

  En `backend/src/integration-config/crypto.util.ts`, reemplazar `decrypt`:

  ```typescript
  export function decrypt(stored: string, keyHex: string): string {
    const parts = stored.split(':');
    if (parts.length !== 3) {
      throw new Error(
        `Credencial cifrada con formato inválido (esperado iv:tag:cipher, se recibieron ${parts.length} partes)`,
      );
    }
    const [ivB64, authTagB64, ciphertextB64] = parts;
    const key = keyBuffer(keyHex);
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const ciphertext = Buffer.from(ciphertextB64, 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }
  ```

- [ ] **Paso 4: Ejecutar y verificar que todos pasan**

  ```bash
  cd backend && npx jest crypto.util.spec.ts --no-coverage
  ```

- [ ] **Paso 5: Commit**

  ```bash
  git add backend/src/integration-config/crypto.util.ts backend/src/integration-config/crypto.util.spec.ts
  git commit -m "fix: validar formato iv:tag:cipher en decrypt() para evitar TypeError en datos malformados"
  ```

---

### Tarea 5 — Timeout en llamadas XML-RPC a Odoo

**Contexto:** `rpcCall` en `odoo-rpc.helpers.ts` no tiene timeout. Una conexión colgada (firewall drop) bloquea el handler de NestJS indefinidamente.

**Archivos:**
- Modify: `backend/src/integrations/odoo/odoo-rpc.helpers.ts`
- Test: crear `backend/src/integrations/odoo/odoo-rpc.helpers.spec.ts`

- [ ] **Paso 1: Agregar test que falla**

  ```typescript
  // backend/src/integrations/odoo/odoo-rpc.helpers.spec.ts
  import { rpcCall } from './odoo-rpc.helpers';
  import * as xmlrpc from 'xmlrpc';

  jest.useFakeTimers();

  describe('rpcCall', () => {
    it('rechaza con timeout si la llamada no responde en el plazo', async () => {
      const client = {
        methodCall: jest.fn(), // nunca llama el callback → simula cuelgue
      } as unknown as xmlrpc.Client;

      const promise = rpcCall(client, 'test', [], 1_000);
      jest.advanceTimersByTime(1_001);

      await expect(promise).rejects.toThrow(/timeout/i);
    });

    it('resuelve el valor si la llamada responde antes del timeout', async () => {
      const client = {
        methodCall: (_m: string, _p: unknown[], cb: (e: null, v: string) => void) => cb(null, 'pong'),
      } as unknown as xmlrpc.Client;

      await expect(rpcCall<string>(client, 'ping', [])).resolves.toBe('pong');
    });
  });
  ```

- [ ] **Paso 2: Ejecutar y verificar que el primer test falla**

  ```bash
  cd backend && npx jest odoo-rpc.helpers.spec.ts --no-coverage
  ```
  Esperado: FAIL en el test de timeout.

- [ ] **Paso 3: Aplicar el fix**

  En `backend/src/integrations/odoo/odoo-rpc.helpers.ts`, reemplazar `rpcCall`:

  ```typescript
  export function rpcCall<T>(
    client: xmlrpc.Client,
    method: string,
    params: unknown[],
    timeoutMs = 15_000,
  ): Promise<T> {
    const rpc = new Promise<T>((resolve, reject) => {
      client.methodCall(method, params as any[], (err: any, value: unknown) => {
        if (err) reject(err);
        else resolve(value as T);
      });
    });

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Odoo RPC '${method}' timeout después de ${timeoutMs}ms`)),
        timeoutMs,
      ),
    );

    return Promise.race([rpc, timeout]);
  }
  ```

- [ ] **Paso 4: Ejecutar todos los tests Odoo para verificar que no hay regresiones**

  ```bash
  cd backend && npx jest odoo-rpc.helpers.spec.ts odoo-system-rpc.service.spec.ts odoo.service.spec.ts --no-coverage
  ```

- [ ] **Paso 5: Commit**

  ```bash
  git add backend/src/integrations/odoo/odoo-rpc.helpers.ts backend/src/integrations/odoo/odoo-rpc.helpers.spec.ts
  git commit -m "fix: agregar timeout de 15s en rpcCall() para evitar cuelgues en conexiones Odoo caídas"
  ```

---

### Tarea 6 — Fix comparación `<=` en JWT logout check

**Contexto:** `payload.iat` tiene granularidad de 1 segundo. Con `<=`, un token emitido en el mismo segundo que el logout (pero técnicamente después del logout) es rechazado con 401 en su primer uso.

**Archivos:**
- Modify: `backend/src/auth/strategies/jwt.strategy.ts:36`
- Test: `backend/src/auth/strategies/jwt.strategy.spec.ts`

- [ ] **Paso 1: Agregar test que falla**

  En `backend/src/auth/strategies/jwt.strategy.spec.ts`:

  ```typescript
  it('acepta token emitido en el mismo segundo que el logout pero 1ms antes del logout exacto', async () => {
    const logoutAt = new Date('2026-10-13T12:00:00.500Z'); // logout a los 500ms
    const user = { ...mockUser, lastLogoutAt: logoutAt, isActive: true };
    userRepository.findOne.mockResolvedValue(user);

    // iat = 1760342400 → representa 12:00:00.000Z (truncado al segundo)
    // iat * 1000 = 12:00:00.000 < 12:00:00.500 → debe ser ACEPTADO (token posterior al logout)
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role, iat: 1760342400 };

    // Con el fix (comparación por segundo), iat=1760342400 < floor(logoutAt/1000)=1760342400 es FALSO → acepta
    await expect(strategy.validate(payload)).resolves.toEqual(payload);
  });

  it('rechaza token emitido en el segundo anterior al logout', async () => {
    const logoutAt = new Date('2026-10-13T12:00:00.500Z');
    const user = { ...mockUser, lastLogoutAt: logoutAt, isActive: true };
    userRepository.findOne.mockResolvedValue(user);

    // iat = 1760342399 → un segundo ANTES del logout → debe ser RECHAZADO
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role, iat: 1760342399 };
    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });
  ```

- [ ] **Paso 2: Ejecutar y verificar que el primero falla**

  ```bash
  cd backend && npx jest jwt.strategy.spec.ts --no-coverage
  ```
  Esperado: FAIL en el primer test nuevo.

- [ ] **Paso 3: Aplicar el fix**

  En `backend/src/auth/strategies/jwt.strategy.ts`, reemplazar la condición de logout:

  ```typescript
  // ANTES
  if (
    user.lastLogoutAt !== null &&
    new Date(payload.iat! * 1000) <= user.lastLogoutAt
  ) {
    throw new UnauthorizedException();
  }
  ```

  ```typescript
  // DESPUÉS — comparar por segundo para evitar rechazo de tokens válidos emitidos
  // en el mismo segundo que el logout pero técnicamente posteriores a él
  if (
    user.lastLogoutAt !== null &&
    payload.iat! <= Math.floor(user.lastLogoutAt.getTime() / 1000)
  ) {
    throw new UnauthorizedException();
  }
  ```

- [ ] **Paso 4: Ejecutar y verificar**

  ```bash
  cd backend && npx jest jwt.strategy.spec.ts --no-coverage
  ```
  Esperado: todos pasan.

- [ ] **Paso 5: Commit**

  ```bash
  git add backend/src/auth/strategies/jwt.strategy.ts backend/src/auth/strategies/jwt.strategy.spec.ts
  git commit -m "fix: comparar JWT iat vs lastLogoutAt por segundo para evitar rechazo de tokens válidos post-logout"
  ```

---

### Tarea 7 — Fix `testJetbackup` — enviar body form-encoded

**Contexto:** `testJetbackup` envía el body como objeto JS plano (JSON). La API WHM espera `application/x-www-form-urlencoded`. El test de conexión siempre reporta fallo incluso con credenciales válidas.

**Archivos:**
- Modify: `backend/src/integration-config/integration-config.service.ts` (bloque `testJetbackup`)
- Test: `backend/src/integration-config/integration-config.service.spec.ts`

- [ ] **Paso 1: Agregar test que verifica el Content-Type**

  En `backend/src/integration-config/integration-config.service.spec.ts`, dentro del bloque de JetBackup:

  ```typescript
  it('testJetbackup envía body como application/x-www-form-urlencoded', async () => {
    jetbackupRepo.findOne.mockResolvedValue({
      id: 1, url: 'https://whm.example.com', username: 'root',
      apiKey: encrypt('test-api-key', TEST_ENCRYPT_KEY),
    });
    httpService.post.mockReturnValue(of({ data: { success: 1 } } as any));

    await service.testJetbackup();

    const [, body, config] = httpService.post.mock.calls[0];
    expect(config?.headers?.['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(typeof body).toBe('string'); // URLSearchParams.toString() devuelve string
    expect(body).toContain('function=listBackupJobs');
  });
  ```

- [ ] **Paso 2: Ejecutar y verificar que falla**

  ```bash
  cd backend && npx jest integration-config.service.spec.ts --no-coverage -t "testJetbackup envía body"
  ```

- [ ] **Paso 3: Aplicar el fix**

  En `backend/src/integration-config/integration-config.service.ts`, reemplazar el bloque de `testJetbackup`:

  ```typescript
  async testJetbackup(): Promise<{ ok: boolean; message: string }> {
    try {
      const cfg = await this.getJetbackupConfigDecrypted();
      if (!cfg.url) return { ok: false, message: 'Falta la URL del servidor WHM' };

      const params = new URLSearchParams();
      params.append('function', 'listBackupJobs');

      const { data } = await firstValueFrom(
        this.httpService.post(
          `${cfg.url.replace(/\/+$/, '')}/cgi/addons/jetbackup5/api.cgi`,
          params.toString(),
          {
            headers: {
              Authorization: `whm ${cfg.username}:${cfg.apiKey}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        ),
      );
      if (data?.success === 1) return { ok: true, message: 'Conexión exitosa' };
      return { ok: false, message: data?.message || 'JetBackup rechazó la solicitud' };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }
  ```

- [ ] **Paso 4: Ejecutar y verificar**

  ```bash
  cd backend && npx jest integration-config.service.spec.ts --no-coverage
  ```

- [ ] **Paso 5: Commit**

  ```bash
  git add backend/src/integration-config/integration-config.service.ts backend/src/integration-config/integration-config.service.spec.ts
  git commit -m "fix: testJetbackup envía body como form-encoded (URLSearchParams) en lugar de JSON"
  ```

---

### Tarea 8 — Mutex en `OdooSystemRpcService.authenticate()`

**Contexto:** Si múltiples requests concurrentes ven `uid === null` simultáneamente, cada uno dispara `authenticate()` en paralelo — N logins simultáneos a Odoo. El mutex previene logins redundantes compartiendo el in-flight promise.

**Archivos:**
- Modify: `backend/src/integrations/odoo/odoo-system-rpc.service.ts`
- Test: `backend/src/integrations/odoo/odoo-system-rpc.service.spec.ts`

- [ ] **Paso 1: Agregar test de concurrencia**

  En `backend/src/integrations/odoo/odoo-system-rpc.service.spec.ts`:

  ```typescript
  it('sólo hace un authenticate() aunque múltiples callKw() lleguen en paralelo con uid=null', async () => {
    let callCount = 0;
    jest.spyOn(service, 'authenticate').mockImplementation(async () => {
      callCount++;
      await new Promise(r => setTimeout(r, 50)); // simular latencia
      (service as any).uid = 42;
      return 42;
    });
    (service as any).uid = null;

    // Disparar 5 callKw simultáneos
    integrationConfigService.getOdooVersion.mockReturnValue(1);
    (service as any).lastSeenVersion = 1;

    await Promise.all([
      service['callKw']('res.partner', 'read', [], {}),
      service['callKw']('res.partner', 'read', [], {}),
      service['callKw']('res.partner', 'read', [], {}),
    ]);

    expect(callCount).toBe(1); // sólo una llamada real a authenticate
  });
  ```

- [ ] **Paso 2: Ejecutar y verificar que falla**

  ```bash
  cd backend && npx jest odoo-system-rpc.service.spec.ts --no-coverage -t "sólo hace un authenticate"
  ```
  Esperado: `callCount` es 3, no 1.

- [ ] **Paso 3: Aplicar el fix**

  En `backend/src/integrations/odoo/odoo-system-rpc.service.ts`:

  ```typescript
  @Injectable()
  export class OdooSystemRpcService {
    private readonly logger = new Logger(OdooSystemRpcService.name);
    private uid: number | null = null;
    private lastSeenVersion = -1;
    private authInFlight: Promise<number> | null = null; // ← nuevo

    invalidateCache(): void {
      this.uid = null;
      this.authInFlight = null; // ← limpiar in-flight al invalidar
    }

    async authenticate(): Promise<number> {
      if (this.authInFlight) return this.authInFlight;
      this.authInFlight = this.doAuthenticate().finally(() => {
        this.authInFlight = null;
      });
      return this.authInFlight;
    }

    private async doAuthenticate(): Promise<number> {
      const cfg = await this.integrationConfigService.getOdooConfigDecrypted();
      const client = buildOdooClient(cfg.url, '/xmlrpc/2/common');
      let uid: number;
      try {
        uid = await rpcCall<number>(client, 'authenticate', [cfg.db, cfg.username, cfg.apiKey, {}]);
      } catch (err) {
        this.logger.error(`Odoo auth failed: ${(err as Error).message}`);
        throw new ServiceUnavailableException(`Odoo auth failed: ${(err as Error).message}`);
      }
      if (!uid) {
        this.logger.error('Odoo auth: uid no recibido');
        throw new ServiceUnavailableException('Odoo auth: uid no recibido');
      }
      this.uid = uid;
      this.lastSeenVersion = this.integrationConfigService.getOdooVersion();
      return uid;
    }

    async callKw<T>(model: string, method: string, args: unknown[], kwargs: Record<string, unknown>): Promise<T> {
      const currentVersion = this.integrationConfigService.getOdooVersion();
      if (this.uid === null || currentVersion !== this.lastSeenVersion) {
        await this.authenticate();
      }
      const cfg = await this.integrationConfigService.getOdooConfigDecrypted();
      const client = buildOdooClient(cfg.url, '/xmlrpc/2/object');
      try {
        return await rpcCall<T>(client, 'execute_kw', [cfg.db, this.uid!, cfg.apiKey, model, method, args, kwargs]);
      } catch (err) {
        this.logger.error(`Odoo RPC ${model}.${method}: ${(err as Error).message}`);
        throw new ServiceUnavailableException(`Odoo RPC ${model}.${method}: ${(err as Error).message}`);
      }
    }
  }
  ```

- [ ] **Paso 4: Ejecutar todos los tests Odoo**

  ```bash
  cd backend && npx jest odoo-system-rpc.service.spec.ts --no-coverage
  ```

- [ ] **Paso 5: Commit**

  ```bash
  git add backend/src/integrations/odoo/odoo-system-rpc.service.ts backend/src/integrations/odoo/odoo-system-rpc.service.spec.ts
  git commit -m "fix: mutex en OdooSystemRpcService.authenticate() para evitar logins paralelos"
  ```

---

### Tarea 9 — Paralelizar providers en `BackupsCron`

**Contexto:** Los tres providers (Veeam, JetBackup, Acronis) se ejecutan en serie. Un provider lento bloquea a los demás. Deben correr en paralelo con `Promise.all`.

**Archivos:**
- Modify: `backend/src/backups/backups.cron.ts:31`
- Test: `backend/src/backups/backups.cron.spec.ts`

- [ ] **Paso 1: Agregar test de paralelismo**

  En `backend/src/backups/backups.cron.spec.ts`:

  ```typescript
  it('runDailySnapshot ejecuta los tres providers en paralelo', async () => {
    const order: string[] = [];
    jest.spyOn(cron as any, 'snapshotVeeam').mockImplementation(async () => {
      await new Promise(r => setTimeout(r, 50));
      order.push('veeam');
    });
    jest.spyOn(cron as any, 'snapshotJetbackup').mockImplementation(async () => {
      order.push('jetbackup');
    });
    jest.spyOn(cron as any, 'snapshotAcronis').mockImplementation(async () => {
      order.push('acronis');
    });

    await cron.runDailySnapshot();

    // Con Promise.all los de corta duración terminan antes que Veeam
    expect(order).toContain('veeam');
    expect(order).toContain('jetbackup');
    expect(order).toContain('acronis');
    // JetBackup y Acronis deben aparecer antes de Veeam (que tiene delay de 50ms)
    expect(order.indexOf('jetbackup')).toBeLessThan(order.indexOf('veeam'));
  });
  ```

- [ ] **Paso 2: Ejecutar y verificar que falla (orden actual: veeam → jetbackup → acronis)**

  ```bash
  cd backend && npx jest backups.cron.spec.ts --no-coverage -t "en paralelo"
  ```

- [ ] **Paso 3: Aplicar el fix**

  En `backend/src/backups/backups.cron.ts`:

  ```typescript
  @Cron('0 7 * * *')
  async runDailySnapshot(): Promise<void> {
    await Promise.all([
      this.snapshotVeeam(),
      this.snapshotJetbackup(),
      this.snapshotAcronis(),
    ]);
  }
  ```

- [ ] **Paso 4: Ejecutar y verificar**

  ```bash
  cd backend && npx jest backups.cron.spec.ts --no-coverage
  ```

- [ ] **Paso 5: Commit**

  ```bash
  git add backend/src/backups/backups.cron.ts backend/src/backups/backups.cron.spec.ts
  git commit -m "fix: ejecutar providers de snapshot en paralelo con Promise.all en BackupsCron"
  ```

---

### Tarea 10 — CORS por variable de entorno + rate limiting en auth

**Contexto:** CORS hardcodeado a `http://localhost:4200` bloquea el frontend en producción. Sin rate limiting, `POST /auth/login` acepta intentos ilimitados.

**Archivos:**
- Modify: `backend/src/main.ts`
- Modify: `backend/src/app.module.ts` — agregar ThrottlerModule
- Modify: `backend/src/auth/auth.module.ts` — aplicar ThrottlerGuard en login

**Prerequisito:**
```bash
cd backend && npm install @nestjs/throttler
```

- [ ] **Paso 1: Instalar @nestjs/throttler**

  ```bash
  cd backend && npm install @nestjs/throttler
  ```

- [ ] **Paso 2: Fix CORS en `main.ts`**

  ```typescript
  // backend/src/main.ts
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:4200',
    credentials: true,
  });
  ```

- [ ] **Paso 3: Agregar ThrottlerModule en `app.module.ts`**

  ```typescript
  import { ThrottlerModule } from '@nestjs/throttler';

  // en imports del AppModule:
  ThrottlerModule.forRoot([
    {
      name: 'short',
      ttl: 60_000,   // ventana de 60 segundos
      limit: 20,     // máx 20 requests/60s en endpoints protegidos
    },
  ]),
  ```

- [ ] **Paso 4: Aplicar ThrottlerGuard solo en el endpoint de login**

  En `backend/src/auth/auth.controller.ts`, agregar el guard solo sobre el método `login`:

  ```typescript
  import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
  import { UseGuards } from '@nestjs/common';

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ short: { ttl: 60_000, limit: 10 } }) // 10 intentos / 60s por IP
  async login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }
  ```

- [ ] **Paso 5: Ejecutar el test suite de auth**

  ```bash
  cd backend && npx jest auth --no-coverage
  ```

- [ ] **Paso 6: Commit**

  ```bash
  git add backend/src/main.ts backend/src/app.module.ts backend/src/auth/auth.controller.ts backend/package.json backend/package-lock.json
  git commit -m "fix: CORS desde env var CORS_ORIGIN y rate limiting 10req/60s en endpoint de login"
  ```

---

## BRANCH 3: `fix/review-medium`

> `git checkout fix/review-medium`

Archivos a modificar:
- `frontend/src/app/features/admin/integraciones/integraciones.component.ts` — OnDestroy + takeUntilDestroyed
- `frontend/src/app/features/admin/backups-config/backups-config.component.ts` — ConfirmDialog + DestroyRef
- `frontend/src/app/features/admin/users/users.component.ts` — local state update
- `frontend/src/app/features/admin/sync/sync.component.ts` — concatMap

---

### Tarea 11 — Cleanup de subscripciones en `IntegracionesComponent`

**Contexto:** El componente tiene 18+ subscripciones sin cleanup. Navegar fuera durante un request asíncrono causa callbacks sobre instancias destruidas.

**Archivos:**
- Modify: `frontend/src/app/features/admin/integraciones/integraciones.component.ts`
- Test: `frontend/src/app/features/admin/integraciones/integraciones.component.spec.ts`

- [ ] **Paso 1: Agregar test que falla**

  En el spec del componente, verificar que el componente implementa `OnDestroy` o tiene `DestroyRef`:

  ```typescript
  it('tiene mecanismo de cleanup de subscripciones (DestroyRef)', () => {
    // El componente debe inyectar DestroyRef en el constructor
    expect((component as any).destroyRef).toBeDefined();
  });
  ```

- [ ] **Paso 2: Ejecutar y verificar que falla**

  ```bash
  cd frontend && npx ng test --include="**/integraciones.component.spec.ts" --watch=false
  ```

- [ ] **Paso 3: Aplicar el fix en `integraciones.component.ts`**

  ```typescript
  import { Component, DestroyRef, inject, OnInit } from '@angular/core';
  import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

  export class IntegracionesComponent implements OnInit {
    private readonly destroyRef = inject(DestroyRef);
    // ... resto del código sin cambios en propiedades

    ngOnInit(): void {
      this.integrationConfigService.getOdoo().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (cfg) => { /* ... */ },
        error: () => { /* ... */ },
      });
      // aplicar takeUntilDestroyed(this.destroyRef) a los otros 5 loads iniciales
    }

    saveOdoo(): void {
      // ...
      this.integrationConfigService.patchOdoo(dto).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        // ...
      });
    }

    // Aplicar .pipe(takeUntilDestroyed(this.destroyRef)) a todos los .subscribe()
    // en saveOdoo, testOdoo, saveInfraDoc, testInfraDoc, saveVmware, testVmware,
    // saveVeeam, testVeeam, saveJetbackup, testJetbackup, saveAcronis, testAcronis
  }
  ```

- [ ] **Paso 4: Ejecutar y verificar**

  ```bash
  cd frontend && npx ng test --include="**/integraciones.component.spec.ts" --watch=false
  ```

- [ ] **Paso 5: Commit**

  ```bash
  git add frontend/src/app/features/admin/integraciones/integraciones.component.ts frontend/src/app/features/admin/integraciones/integraciones.component.spec.ts
  git commit -m "fix: agregar DestroyRef + takeUntilDestroyed en IntegracionesComponent para evitar memory leaks"
  ```

---

### Tarea 12 — Reemplazar `window.confirm()` con `ConfirmDialogComponent` en `BackupsConfigComponent`

**Contexto:** El método `delete()` usa `window.confirm()` (native browser dialog), violando la regla de Angular Material. `ConfirmDialogComponent` ya existe en `shared/`.

**Archivos:**
- Modify: `frontend/src/app/features/admin/backups-config/backups-config.component.ts`
- Test: `frontend/src/app/features/admin/backups-config/backups-config.component.spec.ts`

- [ ] **Paso 1: Agregar test que falla**

  ```typescript
  it('delete() abre ConfirmDialogComponent en lugar de window.confirm()', () => {
    const confirmSpy = jest.spyOn(window, 'confirm');
    const openSpy = jest.spyOn(dialog, 'open').mockReturnValue({
      afterClosed: () => of(true),
    } as any);

    component.delete(mockVeeamConfig);

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalled();
  });
  ```

- [ ] **Paso 2: Ejecutar y verificar que falla**

  ```bash
  cd frontend && npx ng test --include="**/backups-config.component.spec.ts" --watch=false -t "ConfirmDialog"
  ```

- [ ] **Paso 3: Aplicar el fix**

  ```typescript
  import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
  import { DestroyRef, inject } from '@angular/core';
  import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

  export class BackupsConfigComponent implements OnInit {
    private readonly destroyRef = inject(DestroyRef);

    delete(config: BackupConfig): void {
      const message = config.provider === 'JETBACKUP'
        ? `¿Eliminar configuración de ${config.clientName} — ${config.jobName}?`
        : config.provider === 'ACRONIS'
        ? `¿Eliminar configuración de ${config.clientName} — ${config.policyName}?`
        : `¿Eliminar configuración de ${config.clientName || config.host}?`;

      this.dialog
        .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
          data: { title: 'Confirmar eliminación', message },
          width: '360px',
        })
        .afterClosed()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(confirmed => {
          if (!confirmed) return;
          const delete$ =
            config.provider === 'JETBACKUP' ? this.svc.deleteJetbackupConfig(config.id)
            : config.provider === 'ACRONIS'  ? this.svc.deleteAcronisConfig(config.id)
            : this.svc.deleteConfig(config.id);
          delete$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
        });
    }

    // También agregar takeUntilDestroyed a load(), openDialog(), testConnection()
    load(): void {
      this.loading = true;
      this.svc.listConfigs().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: configs => { this.configs = configs; this.loading = false; },
        error: () => { this.loading = false; },
      });
    }

    openDialog(config?: BackupConfig): void {
      this.dialog
        .open(BackupsConfigDialogComponent, { data: config ?? null, width: '520px' })
        .afterClosed()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(saved => { if (saved) this.load(); });
    }

    testConnection(config: VeeamClientConfig): void {
      this.svc.testConnection(config.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next:  result => this.snackBar.open(result.message, 'Cerrar', { duration: 5000 }),
        error: ()     => this.snackBar.open('Error al conectar', 'Cerrar', { duration: 4000 }),
      });
    }
  }
  ```

- [ ] **Paso 4: Ejecutar y verificar**

  ```bash
  cd frontend && npx ng test --include="**/backups-config.component.spec.ts" --watch=false
  ```

- [ ] **Paso 5: Commit**

  ```bash
  git add frontend/src/app/features/admin/backups-config/backups-config.component.ts frontend/src/app/features/admin/backups-config/backups-config.component.spec.ts
  git commit -m "fix: reemplazar window.confirm() con ConfirmDialogComponent y agregar cleanup de subscripciones en BackupsConfigComponent"
  ```

---

### Tarea 13 — Actualización local de estado en `UsersComponent`

**Contexto:** `openCreateDialog`, `openEditDialog` y `toggleStatus` llaman `this.loadUsers()` (full reload) en lugar de mutar el array local. `deleteUser` ya lo hace bien — aplicar el mismo patrón a las otras operaciones.

**Archivos:**
- Modify: `frontend/src/app/features/admin/users/users.component.ts`
- Test: `frontend/src/app/features/admin/users/users.component.spec.ts`

**Nota sobre el dialog:** Para que `openCreateDialog` y `openEditDialog` puedan actualizar localmente, el `UserFormDialogComponent` debe devolver el objeto `User` completo (no solo `{ name, plainPassword }`). Si el dialog ya lo devuelve, esta tarea es directa. Si no, hay que ajustar el dialog primero — verificar antes de implementar.

- [ ] **Paso 1: Verificar qué devuelve `UserFormDialogComponent` en `close`**

  ```bash
  grep -n "dialogRef.close\|this.dialog" frontend/src/app/features/admin/users/user-form-dialog/user-form-dialog.component.ts
  ```

  Si devuelve `{ ...user, plainPassword? }` → proceder.
  Si devuelve solo `{ name, plainPassword }` → agregar el user completo al close en el dialog primero.

- [ ] **Paso 2: Agregar tests para `toggleStatus` — local update**

  ```typescript
  it('toggleStatus actualiza el usuario en el array local sin llamar loadUsers', () => {
    const loadSpy = jest.spyOn(component, 'loadUsers');
    component.users = [{ id: '1', isActive: true, email: 'a@a.com', role: 'ADMIN' } as User];
    usersService.updateStatus.mockReturnValue(of({ id: '1', isActive: false } as User));

    component.toggleStatus(component.users[0]);

    expect(loadSpy).not.toHaveBeenCalled();
    expect(component.users[0].isActive).toBe(false);
  });
  ```

- [ ] **Paso 3: Ejecutar y verificar que falla**

  ```bash
  cd frontend && npx ng test --include="**/users.component.spec.ts" --watch=false -t "loadUsers"
  ```

- [ ] **Paso 4: Aplicar el fix en `toggleStatus`**

  ```typescript
  toggleStatus(user: User): void {
    this.usersService.updateStatus(user.id, !user.isActive)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          const idx = this.users.findIndex(u => u.id === user.id);
          if (idx !== -1) this.users[idx] = { ...this.users[idx], isActive: updated.isActive };
        },
        error: () =>
          this.snackBar.open('No se pudo actualizar el estado.', '', {
            duration: 3000, panelClass: 'snack-error',
          }),
      });
  }
  ```

  Para `openCreateDialog` (si el dialog devuelve el user completo):
  ```typescript
  ref.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
    if (!result) return;
    const { plainPassword, ...newUser } = result;
    this.users = [newUser as User, ...this.users];
    if (plainPassword) {
      this.dialog.open(PasswordDisplayDialogComponent, {
        data: { name: result.name, plainPassword },
        width: '420px',
      });
    }
  });
  ```

  Para `openEditDialog` (si el dialog devuelve el user actualizado):
  ```typescript
  .afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(updated => {
    if (!updated) return;
    const idx = this.users.findIndex(u => u.id === updated.id);
    if (idx !== -1) this.users[idx] = { ...this.users[idx], ...updated };
  });
  ```

- [ ] **Paso 5: Ejecutar y verificar**

  ```bash
  cd frontend && npx ng test --include="**/users.component.spec.ts" --watch=false
  ```

- [ ] **Paso 6: Commit**

  ```bash
  git add frontend/src/app/features/admin/users/users.component.ts frontend/src/app/features/admin/users/users.component.spec.ts
  git commit -m "fix: actualización local de estado en UsersComponent sin recargar desde API"
  ```

---

### Tarea 14 — Eliminar nested subscribe en `SyncComponent`

**Contexto:** `runSync()` anida `syncOdooPartners().subscribe()` dentro del callback `next` de `syncClients()`. La subscripción interna no tiene cleanup path. Reemplazar con `concatMap`.

**Archivos:**
- Modify: `frontend/src/app/features/admin/sync/sync.component.ts`
- Test: `frontend/src/app/features/admin/sync/sync.component.spec.ts`

- [ ] **Paso 1: Agregar test de flujo secuencial con concatMap**

  ```typescript
  it('runSync() encadena las dos llamadas sin anidar subscribes', () => {
    syncService.syncClients.mockReturnValue(of({ created: 1, updated: 0 } as ClientSyncResult));
    syncService.syncOdooPartners.mockReturnValue(of({ synced: 5 } as OdooSyncResult));

    component.runSync();

    expect(syncService.syncClients).toHaveBeenCalledTimes(1);
    expect(syncService.syncOdooPartners).toHaveBeenCalledTimes(1);
    expect(component.loading).toBe(false);
    expect(component.odooResult?.synced).toBe(5);
  });
  ```

- [ ] **Paso 2: Ejecutar y verificar que pasa (el comportamiento es correcto, lo que cambia es la implementación)**

  ```bash
  cd frontend && npx ng test --include="**/sync.component.spec.ts" --watch=false
  ```

- [ ] **Paso 3: Refactorizar con `concatMap`**

  ```typescript
  import { Component } from '@angular/core';
  import { concatMap } from 'rxjs';
  import { ClientSyncResult, OdooSyncResult, SyncService } from '../../../core/services/sync.service';

  @Component({
    selector: 'app-sync',
    templateUrl: './sync.component.html',
    styleUrl: './sync.component.scss',
  })
  export class SyncComponent {
    loading = false;
    currentStep: 'clients' | 'odoo' | null = null;
    clientsResult: ClientSyncResult | null = null;
    odooResult: OdooSyncResult | null = null;
    error = '';

    constructor(private syncService: SyncService) {}

    runSync(): void {
      this.loading = true;
      this.error = '';
      this.clientsResult = null;
      this.odooResult = null;
      this.currentStep = 'clients';

      this.syncService.syncClients().pipe(
        concatMap(result => {
          this.clientsResult = result;
          this.currentStep = 'odoo';
          return this.syncService.syncOdooPartners();
        }),
      ).subscribe({
        next: (odoo) => {
          this.odooResult = odoo;
          this.currentStep = null;
          this.loading = false;
        },
        error: (err) => {
          this.error = err?.error?.message ?? 'Error al sincronizar';
          this.currentStep = null;
          this.loading = false;
        },
      });
    }
  }
  ```

  > **Nota:** Con esta implementación el error de la primera etapa también activa el bloque `error`, por lo que ya no hace falta un handler separado para `syncClients`. Verificar que el mensaje de error sea suficientemente genérico o usar un `catchError` intermedio si se necesita distinguir las etapas.

- [ ] **Paso 4: Ejecutar y verificar**

  ```bash
  cd frontend && npx ng test --include="**/sync.component.spec.ts" --watch=false
  ```

- [ ] **Paso 5: Commit**

  ```bash
  git add frontend/src/app/features/admin/sync/sync.component.ts frontend/src/app/features/admin/sync/sync.component.spec.ts
  git commit -m "fix: reemplazar nested subscribe con concatMap en SyncComponent"
  ```

---

## Resumen de branches y merge order

| Branch | Tareas | Merge cuando |
|---|---|---|
| `fix/review-critical` | 1, 2, 3 | Inmediatamente, mayor riesgo operacional |
| `fix/review-high` | 4, 5, 6, 7, 8, 9, 10 | Después de critical, antes del próximo deploy |
| `fix/review-medium` | 11, 12, 13, 14 | Puede ir al siguiente sprint |

Merge order: `critical → develop → high → develop → medium → develop → main`
