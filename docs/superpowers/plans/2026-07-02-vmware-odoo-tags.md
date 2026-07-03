# VMware Odoo Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al crear tickets Odoo para tareas `SERVER_HOST_MAINTENANCE`, asignar automáticamente los tags "Virtualización" y "Gestión de servidores".

**Architecture:** Replica el patrón existente de `WINDOWS_DOMAIN_MAINTENANCE`: dos campos privados para cachear los IDs de los tags, dos métodos privados de resolución, y un bloque condicional en `createTicket`. Los tests siguen el mismo estilo que los tests existentes de tags Windows y QNAP.

**Tech Stack:** NestJS, Jest, TypeORM, Odoo RPC (helpdesk.tag search_read)

## Global Constraints

- TDD: el test debe fallar antes de escribir la implementación
- Idioma del código: inglés; idioma de mensajes de error y commits: español
- No usar `any` en TypeScript
- Seguir exactamente el patrón de `resolveWindowsAdDomainTagId` / `resolveWindowsServerTagId`
- Nombres exactos de tags en Odoo: `"Virtualización"` (con tilde) y `"Gestión de servidores"` (con tilde, minúscula)

---

### Task 1: Tags VMware en createTicket — tests + implementación

**Files:**
- Modify: `backend/src/integrations/odoo/odoo.service.spec.ts` (agregar 4 tests en el bloque `createTicket`)
- Modify: `backend/src/integrations/odoo/odoo.service.ts` (campos, resolvers, bloque condicional)

**Interfaces:**
- Consumes: `TaskType.SERVER_HOST_MAINTENANCE` (ya existe en `task-type.enum.ts`)
- Consumes: `OdooRpcService.callKw` (ya existe)
- Produces: nada nuevo público — solo comportamiento interno de `createTicket`

---

- [ ] **Step 1: Actualizar el test existente de SERVER_HOST_MAINTENANCE**

El test en línea 679 de `odoo.service.spec.ts` (`crea un ticket SERVER_HOST_MAINTENANCE con descripción de controles ESXi`) actualmente no espera llamadas a `helpdesk.tag`. Después de la implementación, `createTicket` resolverá dos tags antes de crear el ticket, por lo que hay que agregar esos mocks al test existente.

Reemplazar en `odoo.service.spec.ts` (bloque `createTicket`, test de SERVER_HOST_MAINTENANCE):

```typescript
it('crea un ticket SERVER_HOST_MAINTENANCE con descripción de controles ESXi', async () => {
  clientRepo.findOne.mockResolvedValue(
    makeClient({ odooPartnerId: 101, odooSaleLineId: null }),
  );
  technicianRepo.findOne.mockResolvedValue(makeTechnician());
  userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
  odooRpc.callKw
    .mockResolvedValueOnce([])             // sale.order.line
    .mockResolvedValueOnce([{ id: 20 }])  // helpdesk.tag → Virtualización
    .mockResolvedValueOnce([{ id: 21 }])  // helpdesk.tag → Gestión de servidores
    .mockResolvedValueOnce(88);           // helpdesk.ticket create

  const ticketId = await service.createTicket(
    'client-uuid-1',
    'tech-uuid-1',
    TaskType.SERVER_HOST_MAINTENANCE,
  );

  expect(ticketId).toBe(88);
  expect(odooRpc.callKw).toHaveBeenCalledWith(
    'helpdesk.ticket',
    'create',
    [expect.objectContaining({
      name: 'Mantenimiento de hosts VMware/BMC',
      description: expect.stringContaining('Estado de datastores'),
    })],
    {},
  );
});
```

- [ ] **Step 2: Agregar test — incluye tag_ids correctos al crear ticket VMware**

Agregar después del test anterior (dentro del bloque `describe('createTicket')`):

```typescript
it('incluye tag_ids con Virtualización y Gestión de servidores al crear ticket SERVER_HOST_MAINTENANCE', async () => {
  clientRepo.findOne.mockResolvedValue(
    makeClient({ odooPartnerId: 101, odooSaleLineId: null }),
  );
  technicianRepo.findOne.mockResolvedValue(makeTechnician());
  userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
  odooRpc.callKw
    .mockResolvedValueOnce([])             // sale.order.line
    .mockResolvedValueOnce([{ id: 20 }])  // helpdesk.tag → Virtualización
    .mockResolvedValueOnce([{ id: 21 }])  // helpdesk.tag → Gestión de servidores
    .mockResolvedValueOnce(88);           // helpdesk.ticket create

  await service.createTicket('client-uuid-1', 'tech-uuid-1', TaskType.SERVER_HOST_MAINTENANCE);

  expect(odooRpc.callKw).toHaveBeenCalledWith(
    'helpdesk.tag',
    'search_read',
    [[['name', '=', 'Virtualización']]],
    { fields: ['id'], limit: 1 },
  );
  expect(odooRpc.callKw).toHaveBeenCalledWith(
    'helpdesk.tag',
    'search_read',
    [[['name', '=', 'Gestión de servidores']]],
    { fields: ['id'], limit: 1 },
  );
  expect(odooRpc.callKw).toHaveBeenCalledWith(
    'helpdesk.ticket',
    'create',
    [expect.objectContaining({ tag_ids: [[6, 0, [20, 21]]] })],
    {},
  );
});
```

- [ ] **Step 3: Agregar test — cacheo de tags VMware entre llamadas**

```typescript
it('cachea los tag_ids de VMware entre llamadas sucesivas', async () => {
  clientRepo.findOne.mockResolvedValue(
    makeClient({ odooPartnerId: 101, odooSaleLineId: null }),
  );
  technicianRepo.findOne.mockResolvedValue(makeTechnician());
  userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
  odooRpc.callKw
    .mockResolvedValueOnce([])             // sale.order.line (1ra)
    .mockResolvedValueOnce([{ id: 20 }])  // Virtualización (solo 1ra vez)
    .mockResolvedValueOnce([{ id: 21 }])  // Gestión de servidores (solo 1ra vez)
    .mockResolvedValueOnce(88)            // helpdesk.ticket create (1ra)
    .mockResolvedValueOnce([])            // sale.order.line (2da)
    .mockResolvedValueOnce(89);           // helpdesk.ticket create (2da)

  await service.createTicket('client-uuid-1', 'tech-uuid-1', TaskType.SERVER_HOST_MAINTENANCE);
  await service.createTicket('client-uuid-1', 'tech-uuid-1', TaskType.SERVER_HOST_MAINTENANCE);

  const tagCalls = odooRpc.callKw.mock.calls.filter(
    (args: unknown[]) => args[0] === 'helpdesk.tag',
  );
  expect(tagCalls).toHaveLength(2); // 1 por tag, solo en la primera llamada
});
```

- [ ] **Step 4: Agregar test — ServiceUnavailableException cuando no encuentra tag Virtualización**

```typescript
it('lanza ServiceUnavailableException cuando Odoo no encuentra el tag Virtualización', async () => {
  clientRepo.findOne.mockResolvedValue(
    makeClient({ odooPartnerId: 101, odooSaleLineId: null }),
  );
  technicianRepo.findOne.mockResolvedValue(makeTechnician());
  userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
  odooRpc.callKw
    .mockResolvedValueOnce([])  // sale.order.line
    .mockResolvedValueOnce([]); // Virtualización tag → no encontrado

  await expect(
    service.createTicket('client-uuid-1', 'tech-uuid-1', TaskType.SERVER_HOST_MAINTENANCE),
  ).rejects.toThrow(ServiceUnavailableException);
});
```

- [ ] **Step 5: Agregar test — ServiceUnavailableException cuando no encuentra tag Gestión de servidores**

```typescript
it('lanza ServiceUnavailableException cuando Odoo no encuentra el tag Gestión de servidores', async () => {
  clientRepo.findOne.mockResolvedValue(
    makeClient({ odooPartnerId: 101, odooSaleLineId: null }),
  );
  technicianRepo.findOne.mockResolvedValue(makeTechnician());
  userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
  odooRpc.callKw
    .mockResolvedValueOnce([])             // sale.order.line
    .mockResolvedValueOnce([{ id: 20 }])  // Virtualización → encontrado
    .mockResolvedValueOnce([]);            // Gestión de servidores → no encontrado

  await expect(
    service.createTicket('client-uuid-1', 'tech-uuid-1', TaskType.SERVER_HOST_MAINTENANCE),
  ).rejects.toThrow(ServiceUnavailableException);
});
```

- [ ] **Step 6: Correr los tests nuevos para verificar que fallan**

```
cd backend && npx jest odoo.service.spec.ts --no-coverage
```

Esperado: los 4 tests nuevos (Steps 2–5) y el test actualizado (Step 1) deben fallar. Los tests existentes deben seguir pasando.

- [ ] **Step 7: Agregar campos privados en OdooService**

En `backend/src/integrations/odoo/odoo.service.ts`, dentro de la clase `OdooService`, agregar después de `windowsServerTagId`:

```typescript
private virtualizationTagId: number | null = null;
private serverManagementTagId: number | null = null;
```

El bloque de campos queda así:
```typescript
private doneStageId: number | null = null;
private inProgressStageId: number | null = null;
private qnapTagId: number | null = null;
private windowsAdDomainTagId: number | null = null;
private windowsServerTagId: number | null = null;
private virtualizationTagId: number | null = null;
private serverManagementTagId: number | null = null;
```

- [ ] **Step 8: Agregar método resolveVirtualizationTagId**

Agregar en `odoo.service.ts`, después del método `resolveWindowsServerTagId` (línea ~443):

```typescript
private async resolveVirtualizationTagId(): Promise<number> {
  if (this.virtualizationTagId !== null) return this.virtualizationTagId;

  const tags = await this.odooRpc.callKw<Array<{ id: number }>>(
    'helpdesk.tag',
    'search_read',
    [[['name', '=', 'Virtualización']]],
    { fields: ['id'], limit: 1 },
  );

  if (tags.length === 0) {
    throw new ServiceUnavailableException(
      'No se encontró el tag "Virtualización" en Odoo',
    );
  }

  this.virtualizationTagId = tags[0].id;
  return this.virtualizationTagId;
}
```

- [ ] **Step 9: Agregar método resolveServerManagementTagId**

Agregar inmediatamente después del método anterior:

```typescript
private async resolveServerManagementTagId(): Promise<number> {
  if (this.serverManagementTagId !== null) return this.serverManagementTagId;

  const tags = await this.odooRpc.callKw<Array<{ id: number }>>(
    'helpdesk.tag',
    'search_read',
    [[['name', '=', 'Gestión de servidores']]],
    { fields: ['id'], limit: 1 },
  );

  if (tags.length === 0) {
    throw new ServiceUnavailableException(
      'No se encontró el tag "Gestión de servidores" en Odoo',
    );
  }

  this.serverManagementTagId = tags[0].id;
  return this.serverManagementTagId;
}
```

- [ ] **Step 10: Agregar bloque condicional en createTicket**

En `odoo.service.ts`, dentro de `createTicket`, después del bloque `if (taskType === TaskType.WINDOWS_DOMAIN_MAINTENANCE)` (línea ~543) y antes del bloque `if (taskType === TaskType.QNAP_MAINTENANCE)`:

```typescript
if (taskType === TaskType.SERVER_HOST_MAINTENANCE) {
  const virtualizationId = await this.resolveVirtualizationTagId();
  const serverMgmtId = await this.resolveServerManagementTagId();
  payload['tag_ids'] = [[6, 0, [virtualizationId, serverMgmtId]]];
}
```

El bloque de condicionales de tags queda en este orden:
```typescript
if (taskType === TaskType.WINDOWS_DOMAIN_MAINTENANCE) {
  const adDomainTagId = await this.resolveWindowsAdDomainTagId();
  const serverTagId = await this.resolveWindowsServerTagId();
  payload['tag_ids'] = [[6, 0, [adDomainTagId, serverTagId]]];
}
if (taskType === TaskType.SERVER_HOST_MAINTENANCE) {
  const virtualizationId = await this.resolveVirtualizationTagId();
  const serverMgmtId = await this.resolveServerManagementTagId();
  payload['tag_ids'] = [[6, 0, [virtualizationId, serverMgmtId]]];
}
if (taskType === TaskType.QNAP_MAINTENANCE) {
  const tagId = await this.resolveQnapTagId();
  payload['tag_ids'] = [[6, 0, [tagId]]];
}
if (taskType === TaskType.VEEAM_BACKUP) {
  const tagId = await this.resolveQnapTagId();
  payload['tag_ids'] = [[6, 0, [tagId]]];
}
```

- [ ] **Step 11: Correr toda la suite para verificar que pasa**

```
cd backend && npx jest odoo.service.spec.ts --no-coverage
```

Esperado: todos los tests pasan, incluyendo los 4 nuevos y el test actualizado.

- [ ] **Step 12: Commit**

```bash
git add backend/src/integrations/odoo/odoo.service.ts backend/src/integrations/odoo/odoo.service.spec.ts
git commit -m "feat(odoo): agregar tags Virtualización y Gestión de servidores a tickets SERVER_HOST_MAINTENANCE"
```
