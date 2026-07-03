# Odoo Timesheet al Cerrar Tarea — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al cerrar una tarea (DONE o NOT_DONE), imputar las horas trabajadas como timesheet en Odoo, y al crear tickets setear el `sale_line_id` correspondiente a "Hora Única" del cliente.

**Architecture:** Backend: nuevos campos en entidades + tres nuevos métodos en OdooService (resolveEmployeeId, resolveSaleLineId, logTimesheet) + closeTicket extendido + DTO/service/controller actualizados. Frontend: nuevo TimeSpentDialogComponent + TaskDrawerComponent actualizado para pedir tiempo antes de cerrar.

**Tech Stack:** NestJS · TypeORM · PostgreSQL · class-validator · Angular · Angular Material

---

## Mapa de archivos

| Archivo | Acción |
|---|---|
| `backend/src/users/user.entity.ts` | Agregar `odooEmployeeId` |
| `backend/src/clients/client.entity.ts` | Agregar `odooSaleLineId` |
| `backend/src/migrations/<timestamp>-AddOdooTimesheetFields.ts` | Crear (auto-generada) |
| `backend/src/integrations/odoo/odoo.service.ts` | Nuevos métodos + updates |
| `backend/src/integrations/odoo/odoo.service.spec.ts` | Tests nuevos + actualizados |
| `backend/src/tasks/dto/update-task-status.dto.ts` | Agregar `timeSpentMinutes` |
| `backend/src/tasks/tasks.service.ts` | `updateStatus` orquestado |
| `backend/src/tasks/tasks.service.spec.ts` | Tests actualizados |
| `backend/src/tasks/tasks.controller.ts` | Pasar `timeSpentMinutes` |
| `frontend/src/app/core/models/task.models.ts` | Agregar campo a payload |
| `frontend/src/app/features/technician/task-drawer/time-spent-dialog/time-spent-dialog.component.ts` | Crear |
| `frontend/src/app/features/technician/task-drawer/time-spent-dialog/time-spent-dialog.component.html` | Crear |
| `frontend/src/app/features/technician/technician.module.ts` | Registrar componente |
| `frontend/src/app/features/technician/task-drawer/task-drawer.component.ts` | Wiring del diálogo |
| `frontend/src/app/features/technician/task-drawer/task-drawer.component.spec.ts` | Tests actualizados |

---

## Task 1: DB — odooEmployeeId en User + odooSaleLineId en Client + migración

**Files:**
- Modify: `backend/src/users/user.entity.ts`
- Modify: `backend/src/clients/client.entity.ts`
- Create: migración (auto-generada)

- [ ] **Step 1: Agregar odooEmployeeId a User entity**

En `backend/src/users/user.entity.ts`, agregar después de `odooSyncedAt`:

```typescript
@Column({ name: 'odoo_employee_id', type: 'int', nullable: true, default: null })
odooEmployeeId: number | null;
```

- [ ] **Step 2: Agregar odooSaleLineId a Client entity**

En `backend/src/clients/client.entity.ts`, agregar después de `odooSyncedAt`:

```typescript
@Column({ name: 'odoo_sale_line_id', type: 'int', nullable: true, default: null })
odooSaleLineId: number | null;
```

- [ ] **Step 3: Generar migración**

```bash
cd backend && npm run migration:generate -- src/migrations/AddOdooTimesheetFields
```

Expected: `Migration ...AddOdooTimesheetFields.ts has been generated successfully.`

- [ ] **Step 4: Ejecutar migración**

```bash
npm run migration:run
```

Expected: `Migration AddOdooTimesheetFields... has been executed successfully.`

- [ ] **Step 5: Verificar tests siguen pasando**

```bash
npm test
```

Expected: `221 passed` (los tests de entidades no requieren cambios — los campos son nullable).

- [ ] **Step 6: Commit**

```bash
git add backend/src/users/user.entity.ts backend/src/clients/client.entity.ts backend/src/migrations/
git commit -m "feat(db): agregar odooEmployeeId en User y odooSaleLineId en Client"
```

---

## Task 2: OdooService — resolveEmployeeId

**Files:**
- Modify: `backend/src/integrations/odoo/odoo.service.spec.ts`
- Modify: `backend/src/integrations/odoo/odoo.service.ts`

- [ ] **Step 1: Actualizar makeUser factory para incluir odooEmployeeId**

En `odoo.service.spec.ts`, en la función `makeUser`:

```typescript
const makeUser = (override: Partial<User> = {}): User =>
  ({
    id: 'user-uuid-1',
    email: 'tecnico@ondra.com',
    technicianId: 'tech-uuid-1',
    isActive: true,
    odooUserId: null,
    odooSyncedAt: null,
    odooEmployeeId: null,
    ...override,
  }) as User;
```

- [ ] **Step 2: Escribir tests failing para resolveEmployeeId**

Agregar al final del describe raíz en `odoo.service.spec.ts`, antes del `});` de cierre:

```typescript
describe('resolveEmployeeId', () => {
  it('busca en hr.employee por user_id, guarda odooEmployeeId y lo retorna', async () => {
    userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 7, odooEmployeeId: null }));
    odooRpc.callKw.mockResolvedValue([{ id: 22 }]);

    const result = await service.resolveEmployeeId('user-uuid-1');

    expect(odooRpc.callKw).toHaveBeenCalledWith(
      'hr.employee',
      'search_read',
      [[['user_id', '=', 7]]],
      expect.objectContaining({ fields: ['id'], limit: 1 }),
    );
    expect(userRepo.update).toHaveBeenCalledWith('user-uuid-1', { odooEmployeeId: 22 });
    expect(result).toBe(22);
  });

  it('retorna odooEmployeeId cacheado sin consultar Odoo', async () => {
    userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 7, odooEmployeeId: 22 }));

    const result = await service.resolveEmployeeId('user-uuid-1');

    expect(odooRpc.callKw).not.toHaveBeenCalled();
    expect(result).toBe(22);
  });

  it('retorna null si el usuario no tiene odooUserId', async () => {
    userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: null }));

    const result = await service.resolveEmployeeId('user-uuid-1');

    expect(result).toBeNull();
    expect(odooRpc.callKw).not.toHaveBeenCalled();
  });

  it('retorna null si no se encuentra empleado en Odoo', async () => {
    userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 7 }));
    odooRpc.callKw.mockResolvedValue([]);

    const result = await service.resolveEmployeeId('user-uuid-1');

    expect(result).toBeNull();
  });

  it('retorna null si el usuario no existe en InfraOps', async () => {
    userRepo.findOne.mockResolvedValue(null);

    const result = await service.resolveEmployeeId('user-uuid-1');

    expect(result).toBeNull();
  });
});
```

- [ ] **Step 3: Verificar que los tests fallan**

```bash
npm test -- --testPathPattern=odoo.service.spec
```

Expected: FAIL con `service.resolveEmployeeId is not a function`

- [ ] **Step 4: Implementar resolveEmployeeId en OdooService**

En `backend/src/integrations/odoo/odoo.service.ts`, agregar después de `resolveUserId`:

```typescript
async resolveEmployeeId(userId: string): Promise<number | null> {
  const user = await this.userRepo.findOne({ where: { id: userId } });
  if (!user) return null;
  if (user.odooEmployeeId !== null) return user.odooEmployeeId;
  if (user.odooUserId === null) return null;

  const employees = await this.odooRpc.callKw<Array<{ id: number }>>(
    'hr.employee',
    'search_read',
    [[['user_id', '=', user.odooUserId]]],
    { fields: ['id'], limit: 1 },
  );

  if (employees.length === 0) return null;

  await this.userRepo.update(userId, { odooEmployeeId: employees[0].id });
  return employees[0].id;
}
```

- [ ] **Step 5: Verificar que los tests pasan**

```bash
npm test -- --testPathPattern=odoo.service.spec
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/integrations/odoo/odoo.service.ts backend/src/integrations/odoo/odoo.service.spec.ts
git commit -m "feat(odoo): agregar resolveEmployeeId con caché en User.odooEmployeeId"
```

---

## Task 3: OdooService — syncUsers extendido con odooEmployeeId

**Files:**
- Modify: `backend/src/integrations/odoo/odoo.service.spec.ts`
- Modify: `backend/src/integrations/odoo/odoo.service.ts`

- [ ] **Step 1: Escribir test failing**

En el `describe('syncUsers')` existente de `odoo.service.spec.ts`, agregar:

```typescript
it('resuelve odooEmployeeId en hr.employee para los usuarios matcheados', async () => {
  const users = [makeUser({ id: 'user-1', email: 'a@ondra.com', odooUserId: null })];
  const odooUsers = [{ id: 7, login: 'a@ondra.com', name: 'A' }];
  const employees = [{ id: 22, user_id: [7, 'A'] }];

  userRepo.find.mockResolvedValue(users);
  odooRpc.callKw
    .mockResolvedValueOnce(odooUsers)
    .mockResolvedValueOnce(employees);

  await service.syncUsers();

  expect(odooRpc.callKw).toHaveBeenNthCalledWith(
    2,
    'hr.employee',
    'search_read',
    [[['user_id', 'in', [7]]]],
    expect.objectContaining({ fields: ['id', 'user_id'] }),
  );
  const updateCalls = userRepo.update.mock.calls;
  expect(updateCalls[1]).toEqual(['user-1', { odooEmployeeId: 22 }]);
});

it('no consulta hr.employee si no hubo matches', async () => {
  userRepo.find.mockResolvedValue([]);
  odooRpc.callKw.mockResolvedValue([]);

  await service.syncUsers();

  expect(odooRpc.callKw).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Verificar que los tests fallan**

```bash
npm test -- --testPathPattern=odoo.service.spec
```

Expected: FAIL — `syncUsers` no hace la segunda llamada a hr.employee.

- [ ] **Step 3: Actualizar syncUsers para resolver odooEmployeeId**

Reemplazar el método `syncUsers` completo en `odoo.service.ts`:

```typescript
async syncUsers(): Promise<OdooSyncResult> {
  const [odooUsers, localUsers] = await Promise.all([
    this.odooRpc.callKw<OdooUser[]>(
      'res.users',
      'search_read',
      [[['active', '=', true]]],
      { fields: ['id', 'login', 'name'] },
    ),
    this.userRepo.find({ where: { isActive: true } }),
  ]);

  const userByEmail = new Map(localUsers.map((u) => [u.email, u]));
  let matched = 0;
  const unmatched: string[] = [];
  const matchedPairs: Array<{ userId: string; odooUserId: number }> = [];

  for (const odooUser of odooUsers) {
    if (!odooUser.login) continue;
    const login = odooUser.login as string;
    const user = userByEmail.get(login);
    if (user) {
      await this.userRepo.update(user.id, { odooUserId: odooUser.id, odooSyncedAt: new Date() });
      matchedPairs.push({ userId: user.id, odooUserId: odooUser.id });
      matched++;
    } else {
      unmatched.push(login);
    }
  }

  if (matchedPairs.length > 0) {
    const employees = await this.odooRpc.callKw<Array<{ id: number; user_id: [number, string] }>>(
      'hr.employee',
      'search_read',
      [[['user_id', 'in', matchedPairs.map((p) => p.odooUserId)]]],
      { fields: ['id', 'user_id'] },
    );
    const employeeByOdooUserId = new Map(employees.map((e) => [e.user_id[0], e.id]));
    for (const pair of matchedPairs) {
      const employeeId = employeeByOdooUserId.get(pair.odooUserId);
      if (employeeId !== undefined) {
        await this.userRepo.update(pair.userId, { odooEmployeeId: employeeId });
      }
    }
  }

  return { matched, unmatched, total: odooUsers.length };
}
```

- [ ] **Step 4: Verificar que todos los tests pasan**

```bash
npm test -- --testPathPattern=odoo.service.spec
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/integrations/odoo/odoo.service.ts backend/src/integrations/odoo/odoo.service.spec.ts
git commit -m "feat(odoo): syncUsers resuelve y cachea odooEmployeeId via hr.employee"
```

---

## Task 4: OdooService — resolveSaleLineId

**Files:**
- Modify: `backend/src/integrations/odoo/odoo.service.spec.ts`
- Modify: `backend/src/integrations/odoo/odoo.service.ts`

- [ ] **Step 1: Actualizar makeClient factory para incluir odooSaleLineId**

En `odoo.service.spec.ts`, en `makeClient`:

```typescript
const makeClient = (override: Partial<Client> = {}): Client =>
  ({
    id: 'client-uuid-1',
    infradocId: 1,
    name: 'ACME Corp',
    taxIdNumber: '20-12345678-0',
    odooPartnerId: null,
    odooSyncedAt: null,
    odooSaleLineId: null,
    isActive: true,
    ...override,
  }) as Client;
```

- [ ] **Step 2: Escribir tests failing para resolveSaleLineId**

Agregar en `odoo.service.spec.ts`:

```typescript
describe('resolveSaleLineId', () => {
  it('busca sale.order.line por partner_id y producto Hora Única, cachea y retorna', async () => {
    clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: 101, odooSaleLineId: null }));
    odooRpc.callKw.mockResolvedValue([{ id: 55 }]);

    const result = await service.resolveSaleLineId('client-uuid-1');

    expect(odooRpc.callKw).toHaveBeenCalledWith(
      'sale.order.line',
      'search_read',
      [[
        ['order_id.partner_id', '=', 101],
        ['product_id.name', '=', 'Hora Única'],
        ['order_id.state', 'in', ['sale', 'done']],
      ]],
      expect.objectContaining({ fields: ['id'], limit: 1 }),
    );
    expect(clientRepo.update).toHaveBeenCalledWith(
      'client-uuid-1',
      expect.objectContaining({ odooSaleLineId: 55 }),
    );
    expect(result).toBe(55);
  });

  it('retorna odooSaleLineId cacheado sin consultar Odoo', async () => {
    clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: 101, odooSaleLineId: 55 }));

    const result = await service.resolveSaleLineId('client-uuid-1');

    expect(odooRpc.callKw).not.toHaveBeenCalled();
    expect(result).toBe(55);
  });

  it('retorna null si el cliente no tiene odooPartnerId', async () => {
    clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: null }));

    const result = await service.resolveSaleLineId('client-uuid-1');

    expect(result).toBeNull();
    expect(odooRpc.callKw).not.toHaveBeenCalled();
  });

  it('retorna null si no se encuentra línea en Odoo', async () => {
    clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: 101 }));
    odooRpc.callKw.mockResolvedValue([]);

    const result = await service.resolveSaleLineId('client-uuid-1');

    expect(result).toBeNull();
  });

  it('retorna null si el cliente no existe', async () => {
    clientRepo.findOne.mockResolvedValue(null);

    const result = await service.resolveSaleLineId('client-uuid-1');

    expect(result).toBeNull();
  });
});
```

- [ ] **Step 3: Verificar que los tests fallan**

```bash
npm test -- --testPathPattern=odoo.service.spec
```

Expected: FAIL con `service.resolveSaleLineId is not a function`

- [ ] **Step 4: Implementar resolveSaleLineId en OdooService**

Agregar después de `resolveEmployeeId` en `odoo.service.ts`:

```typescript
async resolveSaleLineId(clientId: string): Promise<number | null> {
  const client = await this.clientRepo.findOne({ where: { id: clientId } });
  if (!client) return null;
  if (client.odooSaleLineId !== null) return client.odooSaleLineId;
  if (client.odooPartnerId === null) return null;

  const lines = await this.odooRpc.callKw<Array<{ id: number }>>(
    'sale.order.line',
    'search_read',
    [[
      ['order_id.partner_id', '=', client.odooPartnerId],
      ['product_id.name', '=', 'Hora Única'],
      ['order_id.state', 'in', ['sale', 'done']],
    ]],
    { fields: ['id'], limit: 1 },
  );

  if (lines.length === 0) return null;

  await this.clientRepo.update(clientId, { odooSaleLineId: lines[0].id });
  return lines[0].id;
}
```

- [ ] **Step 5: Verificar que los tests pasan**

```bash
npm test -- --testPathPattern=odoo.service.spec
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/integrations/odoo/odoo.service.ts backend/src/integrations/odoo/odoo.service.spec.ts
git commit -m "feat(odoo): agregar resolveSaleLineId con caché en Client.odooSaleLineId"
```

---

## Task 5: OdooService — logTimesheet

**Files:**
- Modify: `backend/src/integrations/odoo/odoo.service.spec.ts`
- Modify: `backend/src/integrations/odoo/odoo.service.ts`

- [ ] **Step 1: Escribir tests failing para logTimesheet**

Agregar en `odoo.service.spec.ts`:

```typescript
describe('logTimesheet', () => {
  it('crea entrada en account.analytic.line con los campos correctos', async () => {
    odooRpc.callKw.mockResolvedValue(88);

    await service.logTimesheet(42, 22, 1.5);

    expect(odooRpc.callKw).toHaveBeenCalledWith(
      'account.analytic.line',
      'create',
      [expect.objectContaining({
        helpdesk_ticket_id: 42,
        employee_id: 22,
        name: 'Mantenimiento realizado',
        unit_amount: 1.5,
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      })],
      {},
    );
  });

  it('propaga ServiceUnavailableException cuando Odoo falla al crear el timesheet', async () => {
    odooRpc.callKw.mockRejectedValue(new ServiceUnavailableException('Odoo caído'));

    await expect(service.logTimesheet(42, 22, 1.5)).rejects.toThrow(ServiceUnavailableException);
  });
});
```

- [ ] **Step 2: Verificar que los tests fallan**

```bash
npm test -- --testPathPattern=odoo.service.spec
```

Expected: FAIL con `service.logTimesheet is not a function`

- [ ] **Step 3: Implementar logTimesheet en OdooService**

Agregar después de `resolveSaleLineId` en `odoo.service.ts`:

```typescript
async logTimesheet(odooTicketId: number, employeeId: number, unitAmount: number): Promise<void> {
  await this.odooRpc.callKw<number>(
    'account.analytic.line',
    'create',
    [{
      helpdesk_ticket_id: odooTicketId,
      employee_id: employeeId,
      name: 'Mantenimiento realizado',
      unit_amount: unitAmount,
      date: new Date().toISOString().split('T')[0],
    }],
    {},
  );
}
```

- [ ] **Step 4: Verificar que los tests pasan**

```bash
npm test -- --testPathPattern=odoo.service.spec
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/integrations/odoo/odoo.service.ts backend/src/integrations/odoo/odoo.service.spec.ts
git commit -m "feat(odoo): agregar logTimesheet en account.analytic.line"
```

---

## Task 6: OdooService — createTicket incluye sale_line_id

**Files:**
- Modify: `backend/src/integrations/odoo/odoo.service.spec.ts`
- Modify: `backend/src/integrations/odoo/odoo.service.ts`

- [ ] **Step 1: Escribir tests failing**

En el `describe('createTicket')` existente de `odoo.service.spec.ts`, agregar:

```typescript
it('incluye sale_line_id en el payload cuando resolveSaleLineId retorna un id', async () => {
  const technician = makeTechnician();
  clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: 101, odooSaleLineId: 55 }));
  technicianRepo.findOne.mockResolvedValue(technician);
  userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
  odooRpc.callKw.mockResolvedValue(99);

  await service.createTicket('client-uuid-1', 'tech-uuid-1');

  expect(odooRpc.callKw).toHaveBeenCalledWith(
    'helpdesk.ticket',
    'create',
    [expect.objectContaining({ sale_line_id: 55 })],
    {},
  );
});

it('crea el ticket sin sale_line_id cuando resolveSaleLineId retorna null', async () => {
  const technician = makeTechnician();
  clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: 101, odooSaleLineId: null }));
  technicianRepo.findOne.mockResolvedValue(technician);
  userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
  odooRpc.callKw
    .mockResolvedValueOnce([])   // sale.order.line search → sin resultado
    .mockResolvedValueOnce(99);  // helpdesk.ticket create

  await service.createTicket('client-uuid-1', 'tech-uuid-1');

  const createCall = odooRpc.callKw.mock.calls.find(
    (args: unknown[]) => args[0] === 'helpdesk.ticket',
  );
  expect(createCall![2][0]).not.toHaveProperty('sale_line_id');
});
```

- [ ] **Step 2: Verificar que los tests fallan**

```bash
npm test -- --testPathPattern=odoo.service.spec
```

Expected: FAIL — el payload de createTicket no incluye `sale_line_id`.

- [ ] **Step 3: Actualizar createTicket en OdooService**

Reemplazar el método `createTicket` completo en `odoo.service.ts`:

```typescript
async createTicket(clientId: string, technicianId: string): Promise<number> {
  const partnerId = await this.resolvePartnerId(clientId);
  if (partnerId === null) {
    throw new BadRequestException(`Cliente ${clientId} no tiene ID de Odoo`);
  }

  const technician = await this.technicianRepo.findOne({
    where: { id: technicianId },
    relations: ['user'],
  });
  if (!technician) {
    throw new BadRequestException(`Técnico ${technicianId} no encontrado`);
  }
  if (!technician.user) {
    throw new BadRequestException(`Técnico ${technicianId} no tiene usuario asociado`);
  }

  const odooUserId = await this.resolveUserId(technician.user.id);
  if (odooUserId === null) {
    throw new BadRequestException(`Técnico ${technicianId} no tiene ID de Odoo`);
  }

  const teamId = parseInt(
    this.configService.getOrThrow<string>('ODOO_HELPDESK_TEAM_ID'),
    10,
  );
  if (isNaN(teamId)) {
    throw new BadRequestException('ODOO_HELPDESK_TEAM_ID must be a valid integer');
  }

  const saleLineId = await this.resolveSaleLineId(clientId);

  const payload: Record<string, unknown> = {
    team_id: teamId,
    partner_id: partnerId,
    user_id: odooUserId,
    name: 'Mantenimiento de infraestructura',
    description: 'Mantenimiento mensual!',
  };
  if (saleLineId !== null) {
    payload['sale_line_id'] = saleLineId;
  }

  return this.odooRpc.callKw<number>('helpdesk.ticket', 'create', [payload], {});
}
```

- [ ] **Step 4: Verificar que todos los tests pasan**

```bash
npm test -- --testPathPattern=odoo.service.spec
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/integrations/odoo/odoo.service.ts backend/src/integrations/odoo/odoo.service.spec.ts
git commit -m "feat(odoo): createTicket incluye sale_line_id de Hora Única al crear ticket"
```

---

## Task 7: OdooService — closeTicket con logTimesheet integrado

**Files:**
- Modify: `backend/src/integrations/odoo/odoo.service.spec.ts`
- Modify: `backend/src/integrations/odoo/odoo.service.ts`

- [ ] **Step 1: Actualizar tests existentes de closeTicket con nueva firma**

En el `describe('closeTicket')` de `odoo.service.spec.ts`, reemplazar todos los tests existentes:

```typescript
describe('closeTicket', () => {
  it('llama logTimesheet y luego escribe stage_id en el ticket', async () => {
    odooRpc.callKw
      .mockResolvedValueOnce([{ id: 99 }]) // helpdesk.stage search_read
      .mockResolvedValueOnce(88)            // account.analytic.line create
      .mockResolvedValueOnce(true);         // helpdesk.ticket write

    await service.closeTicket(42, 22, 1.5);

    const calls = odooRpc.callKw.mock.calls;
    expect(calls[1][0]).toBe('account.analytic.line');
    expect(calls[1][1]).toBe('create');
    expect(calls[2][0]).toBe('helpdesk.ticket');
    expect(calls[2][1]).toBe('write');
    expect(calls[2][2]).toEqual([[42], { stage_id: 99 }]);
  });

  it('reutiliza el stage cacheado en llamadas subsiguientes sin volver a consultar Odoo', async () => {
    odooRpc.callKw
      .mockResolvedValueOnce([{ id: 99 }]) // primera llamada: resuelve stage
      .mockResolvedValue(true);

    await service.closeTicket(42, 22, 1.5);
    await service.closeTicket(43, 22, 0.5);

    const stageCalls = odooRpc.callKw.mock.calls.filter(
      (args: unknown[]) => args[0] === 'helpdesk.stage',
    );
    expect(stageCalls).toHaveLength(1);
  });

  it('lanza ServiceUnavailableException cuando Odoo no devuelve ningún stage de cierre', async () => {
    odooRpc.callKw.mockResolvedValueOnce([]);

    await expect(service.closeTicket(42, 22, 1.5)).rejects.toThrow(ServiceUnavailableException);
  });

  it('no escribe stage_id si logTimesheet falla', async () => {
    odooRpc.callKw
      .mockResolvedValueOnce([{ id: 99 }])
      .mockRejectedValueOnce(new ServiceUnavailableException('Odoo caído'));

    await expect(service.closeTicket(42, 22, 1.5)).rejects.toThrow(ServiceUnavailableException);

    const writeCalls = odooRpc.callKw.mock.calls.filter(
      (args: unknown[]) => args[0] === 'helpdesk.ticket' && args[1] === 'write',
    );
    expect(writeCalls).toHaveLength(0);
  });

  it('propaga ServiceUnavailableException cuando Odoo falla al ejecutar write', async () => {
    odooRpc.callKw
      .mockResolvedValueOnce([{ id: 99 }])
      .mockResolvedValueOnce(88)
      .mockRejectedValueOnce(new ServiceUnavailableException('Odoo caído'));

    await expect(service.closeTicket(42, 22, 1.5)).rejects.toThrow(ServiceUnavailableException);
  });
});
```

- [ ] **Step 2: Verificar que los tests fallan**

```bash
npm test -- --testPathPattern=odoo.service.spec
```

Expected: FAIL — firma actual no acepta `employeeId` ni `unitAmount`.

- [ ] **Step 3: Actualizar closeTicket en OdooService**

Reemplazar el método `closeTicket` en `odoo.service.ts`:

```typescript
async closeTicket(odooTicketId: number, employeeId: number, unitAmount: number): Promise<void> {
  const stageId = await this.resolveDoneStageId();
  await this.logTimesheet(odooTicketId, employeeId, unitAmount);
  await this.odooRpc.callKw<boolean>(
    'helpdesk.ticket',
    'write',
    [[odooTicketId], { stage_id: stageId }],
    {},
  );
}
```

- [ ] **Step 4: Verificar que todos los tests pasan**

```bash
npm test -- --testPathPattern=odoo.service.spec
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/integrations/odoo/odoo.service.ts backend/src/integrations/odoo/odoo.service.spec.ts
git commit -m "feat(odoo): closeTicket acepta employeeId+unitAmount y llama logTimesheet antes de cerrar stage"
```

---

## Task 8: UpdateTaskStatusDto — agregar timeSpentMinutes

**Files:**
- Modify: `backend/src/tasks/dto/update-task-status.dto.ts`

- [ ] **Step 1: Actualizar el DTO**

Reemplazar el contenido completo de `update-task-status.dto.ts`:

```typescript
import { IsEnum, IsInt, Min, ValidateIf } from 'class-validator';
import { TaskStatus } from '../task-status.enum';

export class UpdateTaskStatusDto {
  @IsEnum(TaskStatus)
  status: TaskStatus;

  @ValidateIf((o) => o.status === TaskStatus.DONE || o.status === TaskStatus.NOT_DONE)
  @IsInt()
  @Min(1)
  timeSpentMinutes?: number;
}
```

- [ ] **Step 2: Verificar que los tests siguen pasando**

```bash
npm test
```

Expected: `221 passed` (el DTO no tiene tests unitarios directos, se valida vía e2e o en el service).

- [ ] **Step 3: Commit**

```bash
git add backend/src/tasks/dto/update-task-status.dto.ts
git commit -m "feat(tasks): UpdateTaskStatusDto requiere timeSpentMinutes al cerrar tarea"
```

---

## Task 9: TasksService — updateStatus orquesta Odoo completo

**Files:**
- Modify: `backend/src/tasks/tasks.service.spec.ts`
- Modify: `backend/src/tasks/tasks.service.ts`

- [ ] **Step 1: Actualizar mocks y mockTask en tasks.service.spec.ts**

Reemplazar los bloques `mockTechnician`, `mockTask` y la declaración de `odooService`:

```typescript
// línea ~31 — tipo de odooService
let odooService: { createTicket: jest.Mock; closeTicket: jest.Mock; resolveEmployeeId: jest.Mock };

// mockClient: agregar campos Odoo (insertar después de lastSyncedAt)
// ...en el objeto mockClient existente, agregar:
odooPartnerId: null,
odooSyncedAt: null,
odooSaleLineId: null,

// mockTechnician: agregar user
const mockTechnician: Technician = {
  id: 'tech-1',
  user: { id: 'user-1' } as User,
  createdAt: new Date('2026-01-01'),
};
```

Agregar import de `User` al inicio si no existe:
```typescript
import { User } from '../users/user.entity';
```

En `beforeEach`, inicializar `odooService`:
```typescript
odooService = { createTicket: jest.fn(), closeTicket: jest.fn(), resolveEmployeeId: jest.fn() };
```

- [ ] **Step 2: Actualizar los tests existentes de closeTicket en tasks.service.spec.ts**

Los tests existentes que llaman `odooService.closeTicket.toHaveBeenCalledWith(42)` deben actualizarse. En cada uno agregar el mock de `resolveEmployeeId` y actualizar la expectativa:

```typescript
// Test "llama closeTicket al transicionar a DONE..."
it('llama closeTicket al transicionar a DONE cuando la tarea tiene odooTicketId', async () => {
  const inProgressTask = {
    ...mockTask,
    status: TaskStatus.IN_PROGRESS,
    odooTicketId: 42,
    technician: { user: { id: 'user-1' } },
  };
  taskRepository.findOne
    .mockResolvedValueOnce(inProgressTask)
    .mockResolvedValueOnce({ ...inProgressTask, status: TaskStatus.DONE });
  odooService.resolveEmployeeId.mockResolvedValue(22);
  odooService.closeTicket.mockResolvedValue(undefined);
  taskRepository.update.mockResolvedValue({ affected: 1 });

  await service.updateStatus('task-1', TaskStatus.DONE, 90);

  expect(odooService.resolveEmployeeId).toHaveBeenCalledWith('user-1');
  expect(odooService.closeTicket).toHaveBeenCalledWith(42, 22, 1.5);
});

// Test "llama closeTicket al transicionar a NOT_DONE..."
it('llama closeTicket al transicionar a NOT_DONE cuando la tarea tiene odooTicketId', async () => {
  const taskWithTicket = {
    ...mockTask,
    status: TaskStatus.PENDING,
    odooTicketId: 55,
    technician: { user: { id: 'user-1' } },
  };
  taskRepository.findOne
    .mockResolvedValueOnce(taskWithTicket)
    .mockResolvedValueOnce({ ...taskWithTicket, status: TaskStatus.NOT_DONE });
  odooService.resolveEmployeeId.mockResolvedValue(22);
  odooService.closeTicket.mockResolvedValue(undefined);
  taskRepository.update.mockResolvedValue({ affected: 1 });

  await service.updateStatus('task-1', TaskStatus.NOT_DONE, 60);

  expect(odooService.closeTicket).toHaveBeenCalledWith(55, 22, 1.0);
});

// Test "no llama closeTicket cuando odooTicketId es null"
it('no llama closeTicket cuando odooTicketId es null', async () => {
  const inProgressTask = { ...mockTask, status: TaskStatus.IN_PROGRESS, odooTicketId: null };
  taskRepository.findOne
    .mockResolvedValueOnce(inProgressTask)
    .mockResolvedValueOnce({ ...inProgressTask, status: TaskStatus.DONE });
  taskRepository.update.mockResolvedValue({ affected: 1 });

  await service.updateStatus('task-1', TaskStatus.DONE, 90);

  expect(odooService.closeTicket).not.toHaveBeenCalled();
  expect(odooService.resolveEmployeeId).not.toHaveBeenCalled();
});

// Test "no llama closeTicket al transicionar a ESCALATED"
it('no llama closeTicket al transicionar a ESCALATED', async () => {
  const inProgressTask = { ...mockTask, status: TaskStatus.IN_PROGRESS, odooTicketId: 42 };
  taskRepository.findOne
    .mockResolvedValueOnce(inProgressTask)
    .mockResolvedValueOnce({ ...inProgressTask, status: TaskStatus.ESCALATED });
  taskRepository.update.mockResolvedValue({ affected: 1 });

  await service.updateStatus('task-1', TaskStatus.ESCALATED);

  expect(odooService.closeTicket).not.toHaveBeenCalled();
});

// Test "propaga el error de Odoo..."
it('propaga el error de Odoo y no actualiza el status en DB cuando closeTicket falla', async () => {
  const inProgressTask = {
    ...mockTask,
    status: TaskStatus.IN_PROGRESS,
    odooTicketId: 42,
    technician: { user: { id: 'user-1' } },
  };
  taskRepository.findOne.mockResolvedValueOnce(inProgressTask);
  odooService.resolveEmployeeId.mockResolvedValue(22);
  odooService.closeTicket.mockRejectedValue(new ServiceUnavailableException('Odoo caído'));

  await expect(service.updateStatus('task-1', TaskStatus.DONE, 90)).rejects.toThrow(
    ServiceUnavailableException,
  );
  expect(taskRepository.update).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Escribir tests nuevos**

Agregar al `describe('updateStatus')`:

```typescript
it('lanza BadRequestException si el técnico no tiene odooEmployeeId y hay ticket', async () => {
  const inProgressTask = {
    ...mockTask,
    status: TaskStatus.IN_PROGRESS,
    odooTicketId: 42,
    technician: { user: { id: 'user-1' } },
  };
  taskRepository.findOne.mockResolvedValueOnce(inProgressTask);
  odooService.resolveEmployeeId.mockResolvedValue(null);

  await expect(service.updateStatus('task-1', TaskStatus.DONE, 90)).rejects.toThrow(
    BadRequestException,
  );
  expect(taskRepository.update).not.toHaveBeenCalled();
});

it('convierte timeSpentMinutes a unitAmount decimal correctamente (90 min → 1.5 h)', async () => {
  const inProgressTask = {
    ...mockTask,
    status: TaskStatus.IN_PROGRESS,
    odooTicketId: 42,
    technician: { user: { id: 'user-1' } },
  };
  taskRepository.findOne
    .mockResolvedValueOnce(inProgressTask)
    .mockResolvedValueOnce({ ...inProgressTask, status: TaskStatus.DONE });
  odooService.resolveEmployeeId.mockResolvedValue(22);
  odooService.closeTicket.mockResolvedValue(undefined);
  taskRepository.update.mockResolvedValue({ affected: 1 });

  await service.updateStatus('task-1', TaskStatus.DONE, 90);

  expect(odooService.closeTicket).toHaveBeenCalledWith(42, 22, 1.5);
});
```

- [ ] **Step 4: Verificar que los tests fallan**

```bash
npm test -- --testPathPattern=tasks.service.spec
```

Expected: FAIL — la firma actual no acepta `timeSpentMinutes`.

- [ ] **Step 5: Actualizar updateStatus en TasksService**

Reemplazar el método `updateStatus` completo en `tasks.service.ts`:

```typescript
async updateStatus(id: string, newStatus: TaskStatus, timeSpentMinutes?: number): Promise<Task> {
  const task = await this.taskRepository.findOne({
    where: { id },
    relations: ['technician', 'technician.user'],
  });
  if (!task) throw new NotFoundException('Tarea no encontrada');

  const allowed = VALID_TRANSITIONS[task.status];
  if (!allowed.includes(newStatus)) {
    throw new BadRequestException(`Transición inválida: ${task.status} → ${newStatus}`);
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

    const unitAmount = (timeSpentMinutes ?? 0) / 60;
    await this.odooService.closeTicket(task.odooTicketId!, employeeId, unitAmount);
  }

  await this.taskRepository.update(id, { status: newStatus, completedDate });
  return this.loadTask(id);
}
```

Agregar `resolveEmployeeId` al tipo de `OdooService` importado (si el módulo usa inyección, esto es automático).

- [ ] **Step 6: Verificar que todos los tests pasan**

```bash
npm test
```

Expected: `todos los tests pass`

- [ ] **Step 7: Commit**

```bash
git add backend/src/tasks/tasks.service.ts backend/src/tasks/tasks.service.spec.ts
git commit -m "feat(tasks): updateStatus pide timeSpentMinutes, resuelve employeeId y orquesta cierre Odoo"
```

---

## Task 10: TasksController — pasar timeSpentMinutes

**Files:**
- Modify: `backend/src/tasks/tasks.controller.ts`

- [ ] **Step 1: Actualizar el método updateStatus del controller**

En `tasks.controller.ts`, reemplazar el método `updateStatus`:

```typescript
@Patch(':id/status')
@Roles(UserRole.ADMIN, UserRole.TL, UserRole.TECHNICIAN, UserRole.COORDINATOR)
updateStatus(
  @Param('id', ParseUUIDPipe) id: string,
  @Body() dto: UpdateTaskStatusDto,
): Promise<Task> {
  return this.tasksService.updateStatus(id, dto.status, dto.timeSpentMinutes);
}
```

- [ ] **Step 2: Verificar que todos los tests pasan**

```bash
npm test
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add backend/src/tasks/tasks.controller.ts
git commit -m "feat(tasks): controller pasa timeSpentMinutes a updateStatus"
```

---

## Task 11: Frontend — UpdateTaskStatusPayload + TimeSpentDialogComponent

**Files:**
- Modify: `frontend/src/app/core/models/task.models.ts`
- Create: `frontend/src/app/features/technician/task-drawer/time-spent-dialog/time-spent-dialog.component.ts`
- Create: `frontend/src/app/features/technician/task-drawer/time-spent-dialog/time-spent-dialog.component.html`
- Modify: `frontend/src/app/features/technician/technician.module.ts`

- [ ] **Step 1: Agregar timeSpentMinutes al payload**

En `frontend/src/app/core/models/task.models.ts`, reemplazar `UpdateTaskStatusPayload`:

```typescript
export interface UpdateTaskStatusPayload {
  status: TaskStatus;
  timeSpentMinutes?: number;
}
```

- [ ] **Step 2: Crear TimeSpentDialogComponent (TypeScript)**

Crear `frontend/src/app/features/technician/task-drawer/time-spent-dialog/time-spent-dialog.component.ts`:

```typescript
import { Component } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-time-spent-dialog',
  templateUrl: './time-spent-dialog.component.html',
})
export class TimeSpentDialogComponent {
  form = new FormGroup({
    timeSpent: new FormControl('', [
      Validators.required,
      Validators.pattern(/^\d+:\d{2}$/),
    ]),
  });

  constructor(private dialogRef: MatDialogRef<TimeSpentDialogComponent>) {}

  confirm(): void {
    if (this.form.invalid) return;
    const [h, m] = this.form.value.timeSpent!.split(':').map(Number);
    this.dialogRef.close(h * 60 + m);
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
```

- [ ] **Step 3: Crear TimeSpentDialogComponent (template)**

Crear `frontend/src/app/features/technician/task-drawer/time-spent-dialog/time-spent-dialog.component.html`:

```html
<h2 mat-dialog-title>Tiempo empleado</h2>

<mat-dialog-content>
  <form [formGroup]="form">
    <mat-form-field appearance="outline" subscriptSizing="dynamic">
      <mat-label>Duración (HH:MM)</mat-label>
      <input matInput formControlName="timeSpent" placeholder="01:30" />
      <mat-error *ngIf="form.controls.timeSpent.hasError('pattern')">
        Formato inválido — usá HH:MM (ej: 01:30)
      </mat-error>
      <mat-error *ngIf="form.controls.timeSpent.hasError('required')">
        El tiempo es obligatorio
      </mat-error>
    </mat-form-field>
  </form>
</mat-dialog-content>

<mat-dialog-actions align="end">
  <button mat-stroked-button (click)="cancel()">Cancelar</button>
  <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="confirm()">
    Confirmar
  </button>
</mat-dialog-actions>
```

- [ ] **Step 4: Registrar en TechnicianModule**

En `technician.module.ts`, agregar el import y la declaración:

```typescript
import { TimeSpentDialogComponent } from './task-drawer/time-spent-dialog/time-spent-dialog.component';

// En @NgModule declarations:
declarations: [TaskListComponent, TaskDrawerComponent, MaintenanceFormComponent, ConfirmMaintenanceDialogComponent, TimeSpentDialogComponent],
```

- [ ] **Step 5: Verificar que compila**

```bash
cd frontend && npx ng build --configuration development 2>&1 | tail -10
```

Expected: sin errores de compilación.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/core/models/task.models.ts frontend/src/app/features/technician/task-drawer/time-spent-dialog/ frontend/src/app/features/technician/technician.module.ts
git commit -m "feat(frontend): TimeSpentDialogComponent pide HH:MM y retorna minutos"
```

---

## Task 12: Frontend — TaskDrawerComponent wires TimeSpentDialog

**Files:**
- Modify: `frontend/src/app/features/technician/task-drawer/task-drawer.component.ts`
- Modify: `frontend/src/app/features/technician/task-drawer/task-drawer.component.spec.ts`

- [ ] **Step 1: Actualizar task-drawer.component.ts**

Agregar import del nuevo diálogo al inicio del archivo:

```typescript
import { TimeSpentDialogComponent } from './time-spent-dialog/time-spent-dialog.component';
```

Agregar el campo `private pendingTimeSpentMinutes: number | null = null;` junto a los otros campos privados.

Reemplazar el método `onRequestComplete`:

```typescript
onRequestComplete(payload: MaintenancePayload): void {
  this.pendingPayload = payload;

  this.dialog.open(TimeSpentDialogComponent, { width: '360px' })
    .afterClosed()
    .subscribe((minutes: number | null) => {
      if (minutes == null) return;
      this.pendingTimeSpentMinutes = minutes;
      const issuesSummary = this.detectIssues(payload);
      const hasAlerts = issuesSummary.dcdiagErrors.length > 0 || issuesSummary.veeamMissing;
      const data: ConfirmMaintenanceDialogData = { issuesSummary, hasAlerts };
      this.dialog.open(ConfirmMaintenanceDialogComponent, { data, width: '420px' })
        .afterClosed()
        .subscribe((confirmed: boolean) => {
          if (confirmed) this.saveAndComplete(this.pendingTimeSpentMinutes!);
        });
    });
}
```

Reemplazar el método `onRequestNotDone`:

```typescript
onRequestNotDone(): void {
  this.dialog.open(TimeSpentDialogComponent, { width: '360px' })
    .afterClosed()
    .subscribe((minutes: number | null) => {
      if (minutes == null) return;
      this.tasksService.updateStatus(this.task.id, { status: 'NOT_DONE', timeSpentMinutes: minutes })
        .subscribe({
          next: () => { this.taskNotDone.emit(); },
          error: () => { this.confirmError = 'No se pudo actualizar el estado de la tarea.'; },
        });
    });
}
```

Reemplazar el método privado `saveAndComplete` para que acepte `timeSpentMinutes`:

```typescript
private saveAndComplete(timeSpentMinutes: number): void {
  if (!this.pendingPayload) return;
  this.confirmError = '';

  let logSaved = false;
  this.upsertLog(this.pendingPayload).pipe(
    tap(() => { logSaved = true; }),
    switchMap(() => this.transitionToDone(timeSpentMinutes))
  ).subscribe({
    next: () => { this.taskCompleted.emit(); },
    error: () => {
      this.confirmError = logSaved
        ? 'Log guardado, pero no se pudo actualizar el estado de la tarea.'
        : 'No se pudo guardar el registro. Intentá de nuevo.';
    },
  });
}
```

Reemplazar el método privado `transitionToDone`:

```typescript
private transitionToDone(timeSpentMinutes: number): Observable<Task> {
  if (this.effectiveStatus === 'PENDING') {
    return this.tasksService.updateStatus(this.task.id, { status: 'IN_PROGRESS' }).pipe(
      tap(() => { this._currentStatus = 'IN_PROGRESS'; }),
      switchMap(() =>
        this.tasksService.updateStatus(this.task.id, { status: 'DONE', timeSpentMinutes }),
      ),
    );
  }
  return this.tasksService.updateStatus(this.task.id, { status: 'DONE', timeSpentMinutes });
}
```

- [ ] **Step 2: Actualizar task-drawer.component.spec.ts**

En los tests de `task-drawer.component.spec.ts` que verifican `onRequestNotDone` o `saveAndComplete`, agregar el mock del `TimeSpentDialogComponent`. El patrón es: `dialog.open` para `TimeSpentDialogComponent` debe retornar un observable que emite `90` (o el valor de test).

Localizar el `beforeEach` donde se configura el mock de `MatDialog` y agregar:

```typescript
// En el mock de dialog, usar un mapa por componente
const dialogRefSpyTime = jasmine.createSpyObj('MatDialogRef', ['afterClosed']);
dialogRefSpyTime.afterClosed.and.returnValue(of(90));

dialogSpy.open.and.callFake((component: unknown) => {
  if (component === TimeSpentDialogComponent) return dialogRefSpyTime;
  return dialogRefSpyConfirm; // el existente para ConfirmMaintenanceDialogComponent
});
```

En cada test que invocaba `onRequestNotDone` directamente, verificar que ahora requiere que el diálogo de tiempo cierre primero.

- [ ] **Step 3: Verificar que la aplicación compila**

```bash
cd frontend && npx ng build --configuration development 2>&1 | tail -10
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/features/technician/task-drawer/task-drawer.component.ts frontend/src/app/features/technician/task-drawer/task-drawer.component.spec.ts
git commit -m "feat(task-drawer): pedir tiempo empleado antes de cerrar tarea (DONE/NOT_DONE)"
```

---

## Verificación final

- [ ] Correr suite completa de tests:

```bash
cd backend && npm test
```

Expected: todos los tests pasan.

- [ ] Build frontend sin errores:

```bash
cd frontend && npx ng build --configuration development
```

- [ ] Commit final si hay algo pendiente:

```bash
git add -p && git commit -m "chore: ajustes finales timesheet Odoo"
```
