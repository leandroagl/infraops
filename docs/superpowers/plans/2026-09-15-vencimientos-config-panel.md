# Vencimientos Config Panel + Cron Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el panel de configuración del módulo Vencimientos (ticketera, días umbral, tags) y el cron que crea automáticamente tickets en Odoo para cada vencimiento dentro del umbral.

**Architecture:** Dos columnas nuevas en `odoo_config` (días umbral + tags). El backend agrega `OdooService.createExpirationTicket` y un cron diario en `ExpirationTicketsService`. El frontend agrega un diálogo de configuración accesible desde un botón engranaje en la navbar del módulo Vencimientos, y elimina el campo `expirationsHelpdeskTeamId` del panel Admin → Integraciones (se gestiona desde Vencimientos).

**Tech Stack:** NestJS (TypeORM, @nestjs/schedule), Angular 19, Angular Material, ReactiveFormsModule, forkJoin.

**Spec:** `docs/superpowers/specs/2026-09-15-vencimientos-config-panel-design.md`

## Global Constraints

- TDD obligatorio: test antes que implementación en cada task
- Idioma del código: inglés; commits y documentación: español
- Angular Material exclusivamente para componentes interactivos — `appearance="outline"` en todos los `mat-form-field`
- Sin standalone components Angular
- No mezclar lógica de negocio en controllers (va en services)
- Los endpoints `GET /admin/odoo/helpdesk-tags` y `OdooService.getHelpdeskTags()` ya existen — no recrear
- `expirationsHelpdeskTeamId` ya existe en entity/DTO/service/frontend — no tocar ese campo
- El campo `expirationsHelpdeskTeamId` sigue existiendo en `OdooConfigDto` y backend — solo se mueve de UI

---

## File Map

| Acción | Archivo |
|---|---|
| Crear | `backend/src/migrations/1789400000000-AddExpirationsTicketFieldsToOdooConfig.ts` |
| Modificar | `backend/src/integration-config/entities/odoo-config.entity.ts` |
| Modificar | `backend/src/integration-config/dto/odoo-config.dto.ts` |
| Modificar | `backend/src/integration-config/integration-config.service.ts` |
| Modificar | `backend/src/integration-config/integration-config.service.spec.ts` |
| Modificar | `backend/src/integrations/odoo/odoo.service.ts` |
| Modificar | `backend/src/integrations/odoo/odoo.service.spec.ts` |
| Modificar | `backend/src/notifications/expiration-tickets.service.ts` |
| Modificar | `backend/src/notifications/expiration-tickets.service.spec.ts` |
| Modificar | `backend/src/notifications/notifications.module.ts` |
| Modificar | `frontend/src/app/core/services/integration-config.service.ts` |
| Modificar | `frontend/src/app/features/admin/integraciones/integraciones.component.ts` |
| Modificar | `frontend/src/app/features/admin/integraciones/integraciones.component.html` |
| Modificar | `frontend/src/app/features/admin/integraciones/integraciones.component.spec.ts` |
| Crear | `frontend/src/app/features/notifications/config-dialog/notifications-config-dialog.component.ts` |
| Crear | `frontend/src/app/features/notifications/config-dialog/notifications-config-dialog.component.html` |
| Crear | `frontend/src/app/features/notifications/config-dialog/notifications-config-dialog.component.scss` |
| Crear | `frontend/src/app/features/notifications/config-dialog/notifications-config-dialog.component.spec.ts` |
| Modificar | `frontend/src/app/features/notifications/notifications.component.ts` |
| Modificar | `frontend/src/app/features/notifications/notifications.component.html` |
| Modificar | `frontend/src/app/features/notifications/notifications.component.spec.ts` |
| Modificar | `frontend/src/app/features/notifications/notifications.module.ts` |

---

### Task 1: Migration + Entity/DTO — nuevas columnas en odoo_config

**Files:**
- Create: `backend/src/migrations/1789400000000-AddExpirationsTicketFieldsToOdooConfig.ts`
- Modify: `backend/src/integration-config/entities/odoo-config.entity.ts`
- Modify: `backend/src/integration-config/dto/odoo-config.dto.ts`

**Interfaces:**
- Produces: columnas `expirations_ticket_days_ahead` y `expirations_tag_ids` en DB; campos `expirationsTicketDaysAhead: number | null` y `expirationsTagIds: number[] | null` en la entidad; `expirationsTicketDaysAhead?: number` y `expirationsTagIds?: number[]` en `PatchOdooConfigDto`; `expirationsTicketDaysAhead: number` y `expirationsTagIds: number[]` en `OdooConfigResponseDto`.

- [ ] **Step 1: Crear migración**

```typescript
// backend/src/migrations/1789400000000-AddExpirationsTicketFieldsToOdooConfig.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExpirationsTicketFieldsToOdooConfig1789400000000 implements MigrationInterface {
  name = 'AddExpirationsTicketFieldsToOdooConfig1789400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "odoo_config" ADD COLUMN IF NOT EXISTS "expirations_ticket_days_ahead" integer DEFAULT 30`);
    await queryRunner.query(`ALTER TABLE "odoo_config" ADD COLUMN IF NOT EXISTS "expirations_tag_ids" text DEFAULT '[]'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "odoo_config" DROP COLUMN IF EXISTS "expirations_ticket_days_ahead"`);
    await queryRunner.query(`ALTER TABLE "odoo_config" DROP COLUMN IF EXISTS "expirations_tag_ids"`);
  }
}
```

- [ ] **Step 2: Actualizar entidad** — agregar campos en `odoo-config.entity.ts` después de `expirationsHelpdeskTeamId`:

```typescript
@Column({ name: 'expirations_ticket_days_ahead', type: 'int', nullable: true, default: 30 })
expirationsTicketDaysAhead: number | null = null;

@Column({ name: 'expirations_tag_ids', type: 'simple-json', nullable: true })
expirationsTagIds: number[] | null = null;
```

- [ ] **Step 3: Actualizar DTOs** — en `odoo-config.dto.ts`:

En `PatchOdooConfigDto`, agregar después de `expirationsHelpdeskTeamId`:
```typescript
@IsOptional()
@IsInt()
@Min(1)
expirationsTicketDaysAhead?: number;

@IsOptional()
@IsArray()
@IsInt({ each: true })
expirationsTagIds?: number[];
```

Agregar imports faltantes en `PatchOdooConfigDto`:
```typescript
import { IsString, IsOptional, IsInt, Min, IsArray } from 'class-validator';
```

En `OdooConfigResponseDto`, agregar:
```typescript
expirationsTicketDaysAhead: number;
expirationsTagIds: number[];
```

- [ ] **Step 4: Verificar compilación TypeScript**

```bash
cd backend && npx tsc --noEmit
```
Expected: sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add backend/src/migrations/1789400000000-AddExpirationsTicketFieldsToOdooConfig.ts \
        backend/src/integration-config/entities/odoo-config.entity.ts \
        backend/src/integration-config/dto/odoo-config.dto.ts
git commit -m "feat(integration-config): agregar expirationsTicketDaysAhead y expirationsTagIds a OdooConfig"
```

---

### Task 2: IntegrationConfigService — leer y escribir nuevos campos

**Files:**
- Modify: `backend/src/integration-config/integration-config.service.ts`
- Modify: `backend/src/integration-config/integration-config.service.spec.ts`

**Interfaces:**
- Consumes: `OdooConfig.expirationsTicketDaysAhead`, `OdooConfig.expirationsTagIds`, `PatchOdooConfigDto.expirationsTicketDaysAhead`, `PatchOdooConfigDto.expirationsTagIds`
- Produces: `getOdoo()` retorna los nuevos campos; `patchOdoo()` los guarda; `getOdooConfigDecrypted()` los incluye en el retorno (usado por `OdooService` en Task 3 y `ExpirationTicketsService` en Task 4)

- [ ] **Step 1: Escribir tests que fallan**

En `integration-config.service.spec.ts`, agregar dentro de `describe('getOdoo', ...)`:

```typescript
it('devuelve expirationsTicketDaysAhead desde la fila', async () => {
  odooRepo.findOne.mockResolvedValue({
    id: 1, url: 'u', db: 'd', username: 'u', apiKey: null,
    helpdeskTeamId: 7, expirationsHelpdeskTeamId: 9,
    expirationsTicketDaysAhead: 14, expirationsTagIds: [3, 5],
    stageInProgressName: 'En curso', stageNotDoneName: 'No realizadas', stageDoneName: 'Hecho',
    updatedAt: new Date(), updatedBy: null,
  });
  const result = await service.getOdoo();
  expect(result.expirationsTicketDaysAhead).toBe(14);
  expect(result.expirationsTagIds).toEqual([3, 5]);
});

it('devuelve defaults cuando los nuevos campos son null en la fila', async () => {
  odooRepo.findOne.mockResolvedValue({
    id: 1, url: 'u', db: 'd', username: 'u', apiKey: null,
    helpdeskTeamId: 7, expirationsHelpdeskTeamId: 9,
    expirationsTicketDaysAhead: null, expirationsTagIds: null,
    stageInProgressName: '', stageNotDoneName: '', stageDoneName: '',
    updatedAt: null, updatedBy: null,
  });
  const result = await service.getOdoo();
  expect(result.expirationsTicketDaysAhead).toBe(30);
  expect(result.expirationsTagIds).toEqual([]);
});
```

Agregar dentro de `describe('patchOdoo', ...)` (o crear el describe si no existe):

```typescript
it('actualiza expirationsTicketDaysAhead y expirationsTagIds', async () => {
  odooRepo.findOne.mockResolvedValue(null);
  odooRepo.save.mockImplementation(async (e) => e);
  await service.patchOdoo({ expirationsTicketDaysAhead: 14, expirationsTagIds: [3, 5] }, 'admin');
  expect(odooRepo.save).toHaveBeenCalledWith(
    expect.objectContaining({ expirationsTicketDaysAhead: 14, expirationsTagIds: [3, 5] }),
  );
});
```

Agregar dentro de `describe('getOdooConfigDecrypted', ...)`:

```typescript
it('retorna expirationsTicketDaysAhead y expirationsTagIds', async () => {
  odooRepo.findOne.mockResolvedValue({
    id: 1, url: 'u', db: 'd', username: 'u', apiKey: null,
    helpdeskTeamId: 7, expirationsHelpdeskTeamId: 9,
    expirationsTicketDaysAhead: 20, expirationsTagIds: [1, 2],
    stageInProgressName: 'En curso', stageNotDoneName: 'No realizadas', stageDoneName: 'Hecho',
    updatedAt: null, updatedBy: null,
  });
  const result = await service.getOdooConfigDecrypted();
  expect(result.expirationsTicketDaysAhead).toBe(20);
  expect(result.expirationsTagIds).toEqual([1, 2]);
});
```

- [ ] **Step 2: Ejecutar tests para confirmar que fallan**

```bash
cd backend && npx jest integration-config.service.spec --no-coverage
```
Expected: fallan los nuevos tests.

- [ ] **Step 3: Actualizar `integration-config.service.ts`**

En `getOdoo()`, actualizar el bloque de retorno cuando `row` existe:
```typescript
return {
  url: row.url ?? '', db: row.db ?? '', username: row.username ?? '',
  apiKey: MASK, helpdeskTeamId: row.helpdeskTeamId ?? 0,
  expirationsHelpdeskTeamId: row.expirationsHelpdeskTeamId ?? 0,
  expirationsTicketDaysAhead: row.expirationsTicketDaysAhead ?? 30,
  expirationsTagIds: row.expirationsTagIds ?? [],
  stageInProgressName: row.stageInProgressName ?? '',
  stageNotDoneName: row.stageNotDoneName ?? '',
  stageDoneName: row.stageDoneName ?? '',
  updatedAt: row.updatedAt, updatedBy: row.updatedBy,
};
```

En el bloque fallback (sin fila en DB):
```typescript
expirationsTicketDaysAhead: 30,
expirationsTagIds: [],
```

En `patchOdoo()`, agregar después del bloque de `expirationsHelpdeskTeamId`:
```typescript
if (dto.expirationsTicketDaysAhead !== undefined) existing.expirationsTicketDaysAhead = dto.expirationsTicketDaysAhead;
if (dto.expirationsTagIds !== undefined) existing.expirationsTagIds = dto.expirationsTagIds;
```

En `getOdooConfigDecrypted()`, actualizar el tipo de retorno e incluir nuevos campos:
- En la firma del método, agregar `expirationsTicketDaysAhead: number; expirationsTagIds: number[]` al tipo de retorno.
- En el bloque fallback (sin fila en DB), agregar: `expirationsTicketDaysAhead: 30, expirationsTagIds: [],`
- En el retorno con fila: `expirationsTicketDaysAhead: row.expirationsTicketDaysAhead ?? 30, expirationsTagIds: row.expirationsTagIds ?? [],`

- [ ] **Step 4: Ejecutar tests**

```bash
cd backend && npx jest integration-config.service.spec --no-coverage
```
Expected: todos los tests pasan.

- [ ] **Step 5: Commit**

```bash
git add backend/src/integration-config/integration-config.service.ts \
        backend/src/integration-config/integration-config.service.spec.ts
git commit -m "feat(integration-config): expirationsTicketDaysAhead y expirationsTagIds en getOdoo/patchOdoo/getDecrypted"
```

---

### Task 3: OdooService.createExpirationTicket

**Files:**
- Modify: `backend/src/integrations/odoo/odoo.service.ts`
- Modify: `backend/src/integrations/odoo/odoo.service.spec.ts`

**Interfaces:**
- Consumes: `getOdooConfigDecrypted()` retorna `expirationsHelpdeskTeamId`, `expirationsTicketDaysAhead`, `expirationsTagIds`; `ExpirationItemDto` de `notifications/dto/expiration-item.dto`; `resolvePartnerId(infraopsClientId)` y `resolveSaleLineId(infraopsClientId)` ya existentes
- Produces: `OdooService.createExpirationTicket(item: ExpirationItemDto, infraopsClientId: string): Promise<number>` — retorna el ID del ticket Odoo creado; lanza `BadRequestException` si no hay `expirationsHelpdeskTeamId` o no hay partnerId; lanza `ServiceUnavailableException` si Odoo retorna false

- [ ] **Step 1: Escribir tests que fallan**

En `odoo.service.spec.ts`, actualizar el mock de `integrationConfigServiceMock` para incluir los nuevos campos:

```typescript
integrationConfigServiceMock = {
  getOdooConfigDecrypted: jest.fn().mockResolvedValue({
    url: 'u', db: 'd', username: 'u', apiKey: 'k',
    helpdeskTeamId: 7, expirationsHelpdeskTeamId: 9,
    expirationsTicketDaysAhead: 30, expirationsTagIds: [],
    stageInProgressName: 'En curso', stageNotDoneName: 'No realizadas', stageDoneName: 'Hecho',
  }),
};
```

Agregar al final del archivo el siguiente `describe`:

```typescript
describe('createExpirationTicket', () => {
  const makeExpItem = (overrides = {}): ExpirationItemDto => ({
    sourceId: 'd1', type: 'domain', clientId: 1, clientName: 'Acme',
    itemName: 'acme.com', expireDate: '2026-10-15', daysUntil: 20,
    ...overrides,
  });

  beforeEach(() => {
    clientRepo.findOne.mockResolvedValue(
      makeClient({ id: 'client-uuid-1', odooPartnerId: 101, taxIdNumber: '20-12345678-0' })
    );
    odooRpc.callKw.mockResolvedValue(999); // Odoo ticket ID
  });

  it('construye payload con team_id, partner_id, name con typeLabel, sin user_id', async () => {
    await service.createExpirationTicket(makeExpItem({ type: 'domain', itemName: 'acme.com', clientName: 'Acme' }), 'client-uuid-1');
    expect(odooRpc.callKw).toHaveBeenCalledWith(
      'helpdesk.ticket', 'create',
      [expect.objectContaining({
        team_id: 9,
        partner_id: 101,
        name: 'Vencimiento: Dominio – Acme – acme.com',
      })],
      {},
    );
    expect(odooRpc.callKw).toHaveBeenCalledWith(
      'helpdesk.ticket', 'create',
      [expect.not.objectContaining({ user_id: expect.anything() })],
      {},
    );
  });

  it('incluye sale_line_id si el cliente tiene mapeo', async () => {
    clientRepo.findOne
      .mockResolvedValueOnce(makeClient({ id: 'client-uuid-1', odooPartnerId: 101 }))
      .mockResolvedValueOnce(makeClient({ id: 'client-uuid-1', odooPartnerId: 101, odooSaleLineId: 55 }));
    await service.createExpirationTicket(makeExpItem(), 'client-uuid-1');
    expect(odooRpc.callKw).toHaveBeenCalledWith(
      'helpdesk.ticket', 'create',
      [expect.objectContaining({ sale_line_id: 55 })],
      {},
    );
  });

  it('omite sale_line_id si el cliente no tiene mapeo', async () => {
    clientRepo.findOne
      .mockResolvedValueOnce(makeClient({ id: 'client-uuid-1', odooPartnerId: 101 }))
      .mockResolvedValueOnce(makeClient({ id: 'client-uuid-1', odooPartnerId: 101, odooSaleLineId: null }));
    odooRpc.callKw.mockResolvedValue(null);
    odooRpc.callKw.mockResolvedValue(999);
    await service.createExpirationTicket(makeExpItem(), 'client-uuid-1');
    const callArg = odooRpc.callKw.mock.calls[0][2][0] as Record<string, unknown>;
    expect(callArg['sale_line_id']).toBeUndefined();
  });

  it('incluye tag_ids si hay tags configurados', async () => {
    integrationConfigServiceMock.getOdooConfigDecrypted.mockResolvedValue({
      url: 'u', db: 'd', username: 'u', apiKey: 'k',
      helpdeskTeamId: 7, expirationsHelpdeskTeamId: 9,
      expirationsTicketDaysAhead: 30, expirationsTagIds: [3, 5],
      stageInProgressName: 'En curso', stageNotDoneName: 'No realizadas', stageDoneName: 'Hecho',
    });
    await service.createExpirationTicket(makeExpItem(), 'client-uuid-1');
    expect(odooRpc.callKw).toHaveBeenCalledWith(
      'helpdesk.ticket', 'create',
      [expect.objectContaining({ tag_ids: [[6, 0, [3, 5]]] })],
      {},
    );
  });

  it('omite tag_ids si expirationsTagIds está vacío', async () => {
    await service.createExpirationTicket(makeExpItem(), 'client-uuid-1');
    const callArg = odooRpc.callKw.mock.calls[0][2][0] as Record<string, unknown>;
    expect(callArg['tag_ids']).toBeUndefined();
  });

  it('lanza BadRequestException si expirationsHelpdeskTeamId es null', async () => {
    integrationConfigServiceMock.getOdooConfigDecrypted.mockResolvedValue({
      url: 'u', db: 'd', username: 'u', apiKey: 'k',
      helpdeskTeamId: 7, expirationsHelpdeskTeamId: null,
      expirationsTicketDaysAhead: 30, expirationsTagIds: [],
      stageInProgressName: 'En curso', stageNotDoneName: 'No realizadas', stageDoneName: 'Hecho',
    });
    await expect(service.createExpirationTicket(makeExpItem(), 'client-uuid-1'))
      .rejects.toThrow(BadRequestException);
  });

  it('lanza BadRequestException si partnerId no resuelto', async () => {
    clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: null, taxIdNumber: null }));
    await expect(service.createExpirationTicket(makeExpItem(), 'client-uuid-1'))
      .rejects.toThrow(BadRequestException);
  });

  it('lanza ServiceUnavailableException si Odoo devuelve false', async () => {
    odooRpc.callKw.mockResolvedValue(false);
    await expect(service.createExpirationTicket(makeExpItem(), 'client-uuid-1'))
      .rejects.toThrow(ServiceUnavailableException);
  });

  it('usa typeLabel correcto para cada ExpirationType', async () => {
    const cases: Array<[string, string]> = [
      ['domain', 'Dominio'],
      ['certificate', 'Certificado'],
      ['software', 'Licencia'],
      ['asset_warranty', 'Garantía'],
    ];
    for (const [type, label] of cases) {
      odooRpc.callKw.mockResolvedValue(999);
      clientRepo.findOne.mockResolvedValue(makeClient({ id: 'client-uuid-1', odooPartnerId: 101 }));
      await service.createExpirationTicket(makeExpItem({ type }), 'client-uuid-1');
      const callArg = odooRpc.callKw.mock.calls[odooRpc.callKw.mock.calls.length - 1][2][0] as Record<string, unknown>;
      expect(callArg['name']).toContain(label);
    }
  });
});
```

Agregar también al inicio del archivo el import de `ExpirationItemDto`:
```typescript
import { ExpirationItemDto } from '../../notifications/dto/expiration-item.dto';
```

- [ ] **Step 2: Ejecutar tests para confirmar que fallan**

```bash
cd backend && npx jest odoo.service.spec --no-coverage
```
Expected: nuevos tests fallan con "createExpirationTicket is not a function".

- [ ] **Step 3: Implementar `createExpirationTicket` en `odoo.service.ts`**

Agregar import al inicio:
```typescript
import { ExpirationItemDto, ExpirationType } from '../../notifications/dto/expiration-item.dto';
```

Agregar constante después de `TICKET_META`:
```typescript
const EXPIRATION_TYPE_LABELS: Record<ExpirationType, string> = {
  asset_warranty: 'Garantía',
  certificate:    'Certificado',
  domain:         'Dominio',
  software:       'Licencia',
};
```

Agregar método en la clase `OdooService` (antes de `closeTicket`):
```typescript
async createExpirationTicket(
  item: ExpirationItemDto,
  infraopsClientId: string,
): Promise<number> {
  const config = await this.integrationConfigService.getOdooConfigDecrypted();

  if (!config.expirationsHelpdeskTeamId) {
    throw new BadRequestException('expirationsHelpdeskTeamId no está configurado');
  }

  const partnerId = await this.resolvePartnerId(infraopsClientId);
  if (partnerId === null) {
    this.logger.warn(`Cliente ${infraopsClientId} sin mapeo en Odoo — omitiendo ticket de vencimiento`);
    throw new BadRequestException(`Cliente ${infraopsClientId} no tiene ID de Odoo`);
  }

  const saleLineId = await this.resolveSaleLineId(infraopsClientId);
  const typeLabel = EXPIRATION_TYPE_LABELS[item.type];
  const name = `Vencimiento: ${typeLabel} – ${item.clientName} – ${item.itemName}`;
  const description = `<p>Fecha de vencimiento: <strong>${item.expireDate}</strong></p><p>Días restantes: ${item.daysUntil}</p>`;

  const payload: Record<string, unknown> = {
    team_id: config.expirationsHelpdeskTeamId,
    partner_id: partnerId,
    name,
    description,
  };

  if (saleLineId !== null) {
    payload['sale_line_id'] = saleLineId;
  }

  if (config.expirationsTagIds && config.expirationsTagIds.length > 0) {
    payload['tag_ids'] = [[6, 0, config.expirationsTagIds]];
  }

  const ticketId = await this.systemRpc.callKw<number>(
    'helpdesk.ticket',
    'create',
    [payload],
    {},
  );

  if (!ticketId) {
    throw new ServiceUnavailableException(
      'Odoo devolvió false al crear ticket de vencimiento',
    );
  }

  return ticketId;
}
```

- [ ] **Step 4: Ejecutar todos los tests de OdooService**

```bash
cd backend && npx jest odoo.service.spec --no-coverage
```
Expected: todos los tests pasan.

- [ ] **Step 5: Agregar tests de controller para `getHelpdeskTags`**

En `odoo.controller.spec.ts`, actualizar el mock de `odooService` para incluir los nuevos métodos y agregar los describes:

```typescript
odooService = {
  syncPartners: jest.fn().mockResolvedValue(mockSyncResult),
  syncUsers: jest.fn().mockResolvedValue(mockSyncResult),
  getSyncStatus: jest.fn().mockResolvedValue(mockStatus),
  getHelpdeskTeams: jest.fn().mockResolvedValue([{ id: 7, name: 'Mantenimientos' }]),
  getHelpdeskTags: jest.fn().mockResolvedValue([{ id: 3, name: 'Urgente' }]),
};
```

Agregar al final del archivo:
```typescript
describe('getHelpdeskTeams', () => {
  it('delega en odooService.getHelpdeskTeams y retorna los equipos', async () => {
    const result = await controller.getHelpdeskTeams();
    expect(odooService.getHelpdeskTeams).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ id: 7, name: 'Mantenimientos' }]);
  });
});

describe('getHelpdeskTags', () => {
  it('delega en odooService.getHelpdeskTags y retorna los tags', async () => {
    const result = await controller.getHelpdeskTags();
    expect(odooService.getHelpdeskTags).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ id: 3, name: 'Urgente' }]);
  });
});
```

```bash
cd backend && npx jest odoo.controller.spec odoo.service.spec --no-coverage
```
Expected: todos los tests pasan.

- [ ] **Step 6: Commit**

```bash
git add backend/src/integrations/odoo/odoo.service.ts \
        backend/src/integrations/odoo/odoo.service.spec.ts \
        backend/src/integrations/odoo/odoo.controller.spec.ts
git commit -m "feat(odoo): agregar createExpirationTicket + tests de helpdesk-tags controller"
```

---

### Task 4: ExpirationTicketsService cron + wiring del módulo

**Files:**
- Modify: `backend/src/notifications/expiration-tickets.service.ts`
- Modify: `backend/src/notifications/expiration-tickets.service.spec.ts`
- Modify: `backend/src/notifications/notifications.module.ts`

**Interfaces:**
- Consumes: `OdooService.createExpirationTicket(item, infraopsClientId)` (Task 3); `IntegrationConfigService.getOdooConfigDecrypted()` (Task 2); `@InjectRepository(Client)` de `ClientsModule`; `NotificationsService.getExpirations(days)` (ya existe); `ExpirationTicket` repo (ya existe)
- Produces: cron `@Cron('0 8 * * *') createPendingExpirationTickets()` que crea tickets diariamente

- [ ] **Step 1: Escribir tests que fallan**

En `expiration-tickets.service.spec.ts`, actualizar la suite para incluir los nuevos providers y agregar `describe('createPendingExpirationTickets', ...)`:

Reemplazar el `beforeEach` completo para agregar los nuevos mocks:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ExpirationTicketsService } from './expiration-tickets.service';
import { NotificationsService } from './notifications.service';
import { ExpirationTicket } from './expiration-ticket.entity';
import { ExpirationItemDto } from './dto/expiration-item.dto';
import { OdooService } from '../integrations/odoo/odoo.service';
import { IntegrationConfigService } from '../integration-config/integration-config.service';
import { Client } from '../clients/client.entity';

describe('ExpirationTicketsService', () => {
  let service: ExpirationTicketsService;
  let notificationsService: { getExpirations: jest.Mock };
  let ticketRepo: { find: jest.Mock; save: jest.Mock };
  let odooService: { createExpirationTicket: jest.Mock };
  let integrationConfigService: { getOdooConfigDecrypted: jest.Mock };
  let clientRepo: { findOne: jest.Mock };

  const makeItem = (overrides: Partial<ExpirationItemDto> = {}): ExpirationItemDto => ({
    sourceId: 'd1', type: 'domain', clientId: 1, clientName: 'Acme',
    itemName: 'acme.com', expireDate: '2026-07-15', daysUntil: 17,
    ...overrides,
  });

  const defaultConfig = {
    url: 'u', db: 'd', username: 'u', apiKey: 'k',
    helpdeskTeamId: 7, expirationsHelpdeskTeamId: 9,
    expirationsTicketDaysAhead: 30, expirationsTagIds: [],
    stageInProgressName: 'En curso', stageNotDoneName: 'No realizadas', stageDoneName: 'Hecho',
  };

  beforeEach(async () => {
    notificationsService = { getExpirations: jest.fn() };
    ticketRepo = { find: jest.fn().mockResolvedValue([]), save: jest.fn().mockResolvedValue(undefined) };
    odooService = { createExpirationTicket: jest.fn() };
    integrationConfigService = { getOdooConfigDecrypted: jest.fn().mockResolvedValue(defaultConfig) };
    clientRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpirationTicketsService,
        { provide: NotificationsService,      useValue: notificationsService },
        { provide: getRepositoryToken(ExpirationTicket), useValue: ticketRepo },
        { provide: OdooService,               useValue: odooService },
        { provide: IntegrationConfigService,  useValue: integrationConfigService },
        { provide: getRepositoryToken(Client), useValue: clientRepo },
      ],
    }).compile();

    service = module.get<ExpirationTicketsService>(ExpirationTicketsService);
  });

  // ── Tests existentes (getExpirationsWithTickets) ── conservar todos los tests ya existentes aquí

  describe('createPendingExpirationTickets', () => {
    it('retorna sin hacer nada si expirationsHelpdeskTeamId no está configurado', async () => {
      integrationConfigService.getOdooConfigDecrypted.mockResolvedValue({
        ...defaultConfig, expirationsHelpdeskTeamId: null,
      });
      await service.createPendingExpirationTickets();
      expect(notificationsService.getExpirations).not.toHaveBeenCalled();
      expect(odooService.createExpirationTicket).not.toHaveBeenCalled();
    });

    it('no procesa items con daysUntil > daysAhead', async () => {
      notificationsService.getExpirations.mockResolvedValue([makeItem({ daysUntil: 31 })]);
      // getExpirations ya filtra por daysAhead al ser llamado con el parámetro
      // Este test verifica que getExpirations se llama con el valor correcto
      await service.createPendingExpirationTickets();
      expect(notificationsService.getExpirations).toHaveBeenCalledWith(30);
    });

    it('crea ticket y persiste para item dentro del umbral sin ticket existente', async () => {
      notificationsService.getExpirations.mockResolvedValue([makeItem()]);
      ticketRepo.find.mockResolvedValue([]);
      clientRepo.findOne.mockResolvedValue({ id: 'client-uuid-1' });
      odooService.createExpirationTicket.mockResolvedValue(500);

      await service.createPendingExpirationTickets();

      expect(odooService.createExpirationTicket).toHaveBeenCalledWith(
        expect.objectContaining({ sourceId: 'd1', type: 'domain' }),
        'client-uuid-1',
      );
      expect(ticketRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'domain', sourceId: 'd1',
          expireDate: '2026-07-15', odooTicketId: 500,
          clientId: 'client-uuid-1',
        }),
      );
    });

    it('skippea item que ya tiene registro en expiration_tickets', async () => {
      notificationsService.getExpirations.mockResolvedValue([makeItem()]);
      ticketRepo.find.mockResolvedValue([
        { type: 'domain', sourceId: 'd1', expireDate: '2026-07-15', odooTicketId: 100 },
      ]);

      await service.createPendingExpirationTickets();

      expect(odooService.createExpirationTicket).not.toHaveBeenCalled();
    });

    it('error en un item no aborta el batch — continúa con el siguiente', async () => {
      notificationsService.getExpirations.mockResolvedValue([
        makeItem({ sourceId: 'd1' }),
        makeItem({ sourceId: 'd2', itemName: 'otro.com' }),
      ]);
      ticketRepo.find.mockResolvedValue([]);
      clientRepo.findOne.mockResolvedValue({ id: 'client-uuid-1' });
      odooService.createExpirationTicket
        .mockRejectedValueOnce(new Error('Odoo error'))
        .mockResolvedValueOnce(501);

      await service.createPendingExpirationTickets();

      expect(odooService.createExpirationTicket).toHaveBeenCalledTimes(2);
      expect(ticketRepo.save).toHaveBeenCalledTimes(1);
    });

    it('skippea item cuando el cliente InfraDoc no existe en InfraOps', async () => {
      notificationsService.getExpirations.mockResolvedValue([makeItem({ clientId: 999 })]);
      ticketRepo.find.mockResolvedValue([]);
      clientRepo.findOne.mockResolvedValue(null);

      await service.createPendingExpirationTickets();

      expect(odooService.createExpirationTicket).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Ejecutar tests para confirmar que fallan**

```bash
cd backend && npx jest expiration-tickets.service.spec --no-coverage
```
Expected: nuevos tests fallan.

- [ ] **Step 3: Actualizar `expiration-tickets.service.ts`**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from './notifications.service';
import { ExpirationTicket } from './expiration-ticket.entity';
import { ExpirationItemDto } from './dto/expiration-item.dto';
import { OdooService } from '../integrations/odoo/odoo.service';
import { IntegrationConfigService } from '../integration-config/integration-config.service';
import { Client } from '../clients/client.entity';

@Injectable()
export class ExpirationTicketsService {
  private readonly logger = new Logger(ExpirationTicketsService.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly odooService: OdooService,
    private readonly integrationConfigService: IntegrationConfigService,
    @InjectRepository(ExpirationTicket)
    private readonly ticketRepo: Repository<ExpirationTicket>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  async getExpirationsWithTickets(days?: number): Promise<ExpirationItemDto[]> {
    const items = await this.notificationsService.getExpirations(days);
    if (items.length === 0) return items;

    const rows = await this.ticketRepo.find();
    const byKey = new Map(
      rows.map((r) => [this.key(r.type, r.sourceId, r.expireDate), r]),
    );

    return items.map((item) => {
      const row = byKey.get(this.key(item.type, item.sourceId, item.expireDate));
      return row?.odooTicketId != null
        ? { ...item, odooTicketId: row.odooTicketId }
        : item;
    });
  }

  @Cron('0 8 * * *')
  async createPendingExpirationTickets(): Promise<void> {
    const config = await this.integrationConfigService.getOdooConfigDecrypted();

    if (!config.expirationsHelpdeskTeamId) {
      this.logger.warn('createPendingExpirationTickets: expirationsHelpdeskTeamId no configurado, omitiendo');
      return;
    }

    const daysAhead = config.expirationsTicketDaysAhead ?? 30;
    const items = await this.notificationsService.getExpirations(daysAhead);

    const existingRows = await this.ticketRepo.find();
    const existingKeys = new Set(
      existingRows.map((r) => this.key(r.type, r.sourceId, r.expireDate)),
    );

    let created = 0;
    let errors = 0;

    for (const item of items) {
      if (existingKeys.has(this.key(item.type, item.sourceId, item.expireDate))) continue;

      const client = await this.clientRepo.findOne({ where: { infradocId: item.clientId } });
      if (!client) {
        this.logger.warn(`Cliente InfraDoc ${item.clientId} no encontrado en InfraOps — omitiendo`);
        errors++;
        continue;
      }

      try {
        const odooTicketId = await this.odooService.createExpirationTicket(item, client.id);
        await this.ticketRepo.save({
          type: item.type,
          sourceId: item.sourceId,
          expireDate: item.expireDate,
          clientId: client.id,
          odooTicketId,
        });
        created++;
      } catch (err: unknown) {
        this.logger.error(
          `Error creando ticket para ${item.type} ${item.sourceId}: ${(err as Error).message}`,
        );
        errors++;
      }
    }

    this.logger.log(`createPendingExpirationTickets: ${created} creados, ${errors} errores`);
  }

  private key(type: string, sourceId: string, expireDate: string): string {
    return `${type}|${sourceId}|${expireDate}`;
  }
}
```

- [ ] **Step 4: Actualizar `notifications.module.ts`**

```typescript
import * as https from 'https';
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ExpirationTicketsService } from './expiration-tickets.service';
import { ExpirationTicket } from './expiration-ticket.entity';
import { OdooIntegrationModule } from '../integrations/odoo/odoo-integration.module';
import { IntegrationConfigModule } from '../integration-config/integration-config.module';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports: [
    HttpModule.register({
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    }),
    TypeOrmModule.forFeature([ExpirationTicket]),
    OdooIntegrationModule,
    IntegrationConfigModule,
    ClientsModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, ExpirationTicketsService],
})
export class NotificationsModule {}
```

- [ ] **Step 5: Ejecutar todos los tests de notifications**

```bash
cd backend && npx jest expiration-tickets.service.spec --no-coverage
```
Expected: todos los tests pasan.

- [ ] **Step 6: Ejecutar suite completa backend**

```bash
cd backend && npx jest --no-coverage
```
Expected: todos los tests pasan.

- [ ] **Step 7: Commit**

```bash
git add backend/src/notifications/expiration-tickets.service.ts \
        backend/src/notifications/expiration-tickets.service.spec.ts \
        backend/src/notifications/notifications.module.ts
git commit -m "feat(notifications): cron diario de creación automática de tickets de vencimientos en Odoo"
```

---

### Task 5: Frontend — IntegrationConfigService update

**Files:**
- Modify: `frontend/src/app/core/services/integration-config.service.ts`

**Interfaces:**
- Produces: `OdooConfigDto` con `expirationsTicketDaysAhead: number` y `expirationsTagIds: number[]`; `HelpdeskTagDto { id: number; name: string }`; método `getHelpdeskTags(): Observable<HelpdeskTagDto[]>`

- [ ] **Step 1: Actualizar `integration-config.service.ts`**

Agregar `HelpdeskTagDto` al final de las interfaces (se puede colocar después de `HelpdeskTeamDto`):
```typescript
export interface HelpdeskTagDto { id: number; name: string; }
```

En `OdooConfigDto`, agregar después de `expirationsHelpdeskTeamId`:
```typescript
expirationsTicketDaysAhead: number;
expirationsTagIds: number[];
```

En la clase `IntegrationConfigService`, agregar después de `getHelpdeskTeams()`:
```typescript
getHelpdeskTags(): Observable<HelpdeskTagDto[]> {
  return this.http.get<HelpdeskTagDto[]>(`${this.odooBase}/helpdesk-tags`);
}
```

- [ ] **Step 2: Verificar compilación TypeScript**

```bash
cd frontend && npx tsc --noEmit
```
Expected: sin errores de tipos. Si hay errores en `integraciones.component.spec.ts` por el mock de `OdooConfigDto`, actualizar el mock en el siguiente task.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/core/services/integration-config.service.ts
git commit -m "feat(frontend): agregar HelpdeskTagDto, getHelpdeskTags y nuevos campos a OdooConfigDto"
```

---

### Task 6: Frontend — Admin integraciones cleanup

**Files:**
- Modify: `frontend/src/app/features/admin/integraciones/integraciones.component.ts`
- Modify: `frontend/src/app/features/admin/integraciones/integraciones.component.html`
- Modify: `frontend/src/app/features/admin/integraciones/integraciones.component.spec.ts`

**Interfaces:**
- Consumes: `OdooConfigDto` ya sin gestión de `expirationsHelpdeskTeamId` en el formulario (el campo sigue en el DTO, no se parchea desde aquí)
- Produces: formulario Odoo sin `expirationsHelpdeskTeamId`; `buildOdooPatchDto()` no incluye `expirationsHelpdeskTeamId`

- [ ] **Step 1: Actualizar tests** — en `integraciones.component.spec.ts`, eliminar los dos tests que referencian `expirationsHelpdeskTeamId` en el formulario. También actualizar los mocks del `OdooConfigDto` para incluir los nuevos campos. Buscar y eliminar:
  - `it('buildOdooPatchDto incluye expirationsHelpdeskTeamId del form', ...)`
  - `it('carga expirationsHelpdeskTeamId en el form al iniciar', ...)`

  Actualizar todos los `mockService.getOdoo.and.returnValue(of({...}))` y `mockService.patchOdoo.and.returnValue(of({...} as OdooConfigDto))` para incluir:
  ```typescript
  expirationsTicketDaysAhead: 30, expirationsTagIds: [],
  ```

- [ ] **Step 2: Verificar que los tests que se eliminaron realmente fallan ahora**

```bash
cd frontend && npx ng test --include="**/integraciones.component.spec.ts" --watch=false --browsers=ChromeHeadless
```
Expected: los tests referentes a `expirationsHelpdeskTeamId` fallan (el control ya no existe).

- [ ] **Step 3: Actualizar `integraciones.component.ts`**

En el constructor, reemplazar el `odooForm` group:
```typescript
this.odooForm = this.fb.group({
  url: [''], db: [''], username: [''], apiKey: [MASK], helpdeskTeamId: [null],
  stageInProgressName: [''], stageNotDoneName: [''], stageDoneName: [''],
});
```

En `buildOdooPatchDto()`, reemplazar el tipo inline y el objeto `dto`:
```typescript
buildOdooPatchDto(): Partial<OdooConfigDto> {
  const v = this.odooForm.value as {
    url: string; db: string; username: string; apiKey: string; helpdeskTeamId: number;
    stageInProgressName: string; stageNotDoneName: string; stageDoneName: string;
  };
  const dto: Partial<OdooConfigDto> = {
    url: v.url, db: v.db, username: v.username, helpdeskTeamId: v.helpdeskTeamId,
    stageInProgressName: v.stageInProgressName,
    stageNotDoneName: v.stageNotDoneName,
    stageDoneName: v.stageDoneName,
  };
  if (v.apiKey && v.apiKey !== MASK) dto.apiKey = v.apiKey;
  return dto;
}
```

- [ ] **Step 4: Actualizar `integraciones.component.html`**

Eliminar el bloque entero que empieza en la línea que contiene `Ticketera Vencimientos` (el `<div class="field-row">` que contiene el `mat-select formControlName="expirationsHelpdeskTeamId"`). El bloque a eliminar es:
```html
<div class="field-row">
  <div class="field">
    <label class="field-label">Ticketera Vencimientos <span class="req">*</span></label>
    <mat-form-field appearance="outline" subscriptSizing="dynamic">
      <mat-select formControlName="expirationsHelpdeskTeamId">
        <mat-option *ngFor="let t of helpdeskTeams" [value]="t.id">{{ t.name }}</mat-option>
      </mat-select>
    </mat-form-field>
    <span class="field-hint" *ngIf="!helpdeskTeamsError">Equipo de Odoo donde InfraOps crea automáticamente los tickets de vencimientos. Debe ser distinto al de mantenimientos.</span>
    <span class="field-hint field-hint--warn" *ngIf="helpdeskTeamsError">No se pudo cargar la lista desde Odoo. Guardá la configuración de credenciales primero.</span>
  </div>
</div>
```

- [ ] **Step 5: Ejecutar tests**

```bash
cd frontend && npx ng test --include="**/integraciones.component.spec.ts" --watch=false --browsers=ChromeHeadless
```
Expected: todos los tests pasan.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/features/admin/integraciones/integraciones.component.ts \
        frontend/src/app/features/admin/integraciones/integraciones.component.html \
        frontend/src/app/features/admin/integraciones/integraciones.component.spec.ts
git commit -m "refactor(admin): mover configuración de ticketera de vencimientos al módulo Vencimientos"
```

---

### Task 7: NotificationsConfigDialogComponent

**Files:**
- Create: `frontend/src/app/features/notifications/config-dialog/notifications-config-dialog.component.ts`
- Create: `frontend/src/app/features/notifications/config-dialog/notifications-config-dialog.component.html`
- Create: `frontend/src/app/features/notifications/config-dialog/notifications-config-dialog.component.scss`
- Create: `frontend/src/app/features/notifications/config-dialog/notifications-config-dialog.component.spec.ts`

**Interfaces:**
- Consumes: `IntegrationConfigService.getOdoo()`, `getHelpdeskTeams()`, `getHelpdeskTags()`, `patchOdoo(dto)` — todos de Task 5; `MatDialogRef<NotificationsConfigDialogComponent>` para cerrarse
- Produces: componente declarable en `NotificationsModule` que gestiona la config de vencimientos

- [ ] **Step 1: Escribir tests que fallan**

```typescript
// notifications-config-dialog.component.spec.ts
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { NotificationsConfigDialogComponent } from './notifications-config-dialog.component';
import { IntegrationConfigService } from '../../../core/services/integration-config.service';

const MOCK_TEAMS = [{ id: 9, name: 'Vencimientos' }, { id: 7, name: 'Mantenimientos' }];
const MOCK_TAGS  = [{ id: 3, name: 'Urgente' }, { id: 5, name: 'Garantía' }];
const MOCK_CONFIG = {
  url: 'u', db: 'd', username: 'u', apiKey: '••••••••',
  helpdeskTeamId: 7, expirationsHelpdeskTeamId: 9,
  expirationsTicketDaysAhead: 30, expirationsTagIds: [3],
  stageInProgressName: '', stageNotDoneName: '', stageDoneName: '',
  updatedAt: null, updatedBy: null,
};

describe('NotificationsConfigDialogComponent', () => {
  let fixture: ComponentFixture<NotificationsConfigDialogComponent>;
  let comp: NotificationsConfigDialogComponent;
  let svc: jasmine.SpyObj<IntegrationConfigService>;
  let dialogRef: jasmine.SpyObj<MatDialogRef<NotificationsConfigDialogComponent>>;

  beforeEach(async () => {
    svc = jasmine.createSpyObj('IntegrationConfigService', ['getOdoo', 'getHelpdeskTeams', 'getHelpdeskTags', 'patchOdoo']);
    svc.getOdoo.and.returnValue(of(MOCK_CONFIG));
    svc.getHelpdeskTeams.and.returnValue(of(MOCK_TEAMS));
    svc.getHelpdeskTags.and.returnValue(of(MOCK_TAGS));
    svc.patchOdoo.and.returnValue(of(MOCK_CONFIG));

    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);

    await TestBed.configureTestingModule({
      declarations: [NotificationsConfigDialogComponent],
      imports: [
        NoopAnimationsModule, ReactiveFormsModule, MatDialogModule,
        MatFormFieldModule, MatInputModule, MatSelectModule,
        MatButtonModule, MatProgressSpinnerModule,
      ],
      providers: [
        { provide: IntegrationConfigService, useValue: svc },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationsConfigDialogComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carga config, teams y tags al inicializar', fakeAsync(() => {
    tick();
    expect(svc.getOdoo).toHaveBeenCalled();
    expect(svc.getHelpdeskTeams).toHaveBeenCalled();
    expect(svc.getHelpdeskTags).toHaveBeenCalled();
    expect(comp.loading).toBe(false);
  }));

  it('popula el form con los valores de la config', fakeAsync(() => {
    tick();
    expect(comp.form.get('expirationsHelpdeskTeamId')?.value).toBe(9);
    expect(comp.form.get('expirationsTicketDaysAhead')?.value).toBe(30);
    expect(comp.form.get('expirationsTagIds')?.value).toEqual([3]);
  }));

  it('muestra advertencia de teams si getHelpdeskTeams falla pero sigue cargando', fakeAsync(() => {
    svc.getHelpdeskTeams.and.returnValue(throwError(() => new Error('timeout')));
    const f = TestBed.createComponent(NotificationsConfigDialogComponent);
    f.componentInstance.ngOnInit();
    tick();
    expect(f.componentInstance.teamsError).toBe(true);
    expect(f.componentInstance.loading).toBe(false);
  }));

  it('llama patchOdoo con los tres campos al guardar', fakeAsync(() => {
    tick();
    comp.form.setValue({
      expirationsHelpdeskTeamId: 9,
      expirationsTicketDaysAhead: 14,
      expirationsTagIds: [3, 5],
    });
    comp.save();
    tick();
    expect(svc.patchOdoo).toHaveBeenCalledWith({
      expirationsHelpdeskTeamId: 9,
      expirationsTicketDaysAhead: 14,
      expirationsTagIds: [3, 5],
    });
  }));

  it('cierra el diálogo con true al guardar con éxito', fakeAsync(() => {
    tick();
    comp.form.setValue({
      expirationsHelpdeskTeamId: 9,
      expirationsTicketDaysAhead: 14,
      expirationsTagIds: [],
    });
    comp.save();
    tick();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  }));

  it('deshabilita el botón guardar mientras está en progreso', fakeAsync(() => {
    tick();
    comp.form.setValue({ expirationsHelpdeskTeamId: 9, expirationsTicketDaysAhead: 14, expirationsTagIds: [] });
    svc.patchOdoo.and.returnValue(new Promise(() => {})); // never resolves
    comp.save();
    expect(comp.saving).toBe(true);
    expect(comp.form.disabled).toBe(true);
  }));
});
```

- [ ] **Step 2: Ejecutar tests para confirmar que fallan**

```bash
cd frontend && npx ng test --include="**/notifications-config-dialog.component.spec.ts" --watch=false --browsers=ChromeHeadless
```
Expected: fallan con "cannot find module".

- [ ] **Step 3: Crear `notifications-config-dialog.component.ts`**

```typescript
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { catchError, forkJoin, of } from 'rxjs';
import {
  IntegrationConfigService, HelpdeskTeamDto, HelpdeskTagDto,
} from '../../../core/services/integration-config.service';

@Component({
  selector: 'app-notifications-config-dialog',
  templateUrl: './notifications-config-dialog.component.html',
  styleUrl: './notifications-config-dialog.component.scss',
})
export class NotificationsConfigDialogComponent implements OnInit {
  form: FormGroup;
  loading = true;
  saving = false;
  teams: HelpdeskTeamDto[] = [];
  tags: HelpdeskTagDto[] = [];
  teamsError = false;
  tagsError = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly svc: IntegrationConfigService,
    private readonly dialogRef: MatDialogRef<NotificationsConfigDialogComponent>,
  ) {
    this.form = this.fb.group({
      expirationsHelpdeskTeamId: [null, Validators.required],
      expirationsTicketDaysAhead: [30, [Validators.required, Validators.min(1)]],
      expirationsTagIds: [[]],
    });
    this.form.disable();
  }

  ngOnInit(): void {
    forkJoin({
      config: this.svc.getOdoo(),
      teams: this.svc.getHelpdeskTeams().pipe(catchError(() => {
        this.teamsError = true; return of([]);
      })),
      tags: this.svc.getHelpdeskTags().pipe(catchError(() => {
        this.tagsError = true; return of([]);
      })),
    }).subscribe({
      next: ({ config, teams, tags }) => {
        this.teams = teams;
        this.tags = tags;
        this.form.patchValue({
          expirationsHelpdeskTeamId: config.expirationsHelpdeskTeamId || null,
          expirationsTicketDaysAhead: config.expirationsTicketDaysAhead || 30,
          expirationsTagIds: config.expirationsTagIds || [],
        });
        this.form.enable();
        this.loading = false;
      },
      error: () => {
        this.form.enable();
        this.loading = false;
      },
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving = true;
    this.form.disable();
    const v = this.form.getRawValue() as {
      expirationsHelpdeskTeamId: number;
      expirationsTicketDaysAhead: number;
      expirationsTagIds: number[];
    };
    this.svc.patchOdoo({
      expirationsHelpdeskTeamId: v.expirationsHelpdeskTeamId,
      expirationsTicketDaysAhead: v.expirationsTicketDaysAhead,
      expirationsTagIds: v.expirationsTagIds,
    }).subscribe({
      next: () => this.dialogRef.close(true),
      error: () => {
        this.saving = false;
        this.form.enable();
      },
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
```

- [ ] **Step 4: Crear `notifications-config-dialog.component.html`**

```html
<h2 mat-dialog-title>Configuración de vencimientos</h2>

<mat-dialog-content>
  <div *ngIf="loading" class="dialog-spinner">
    <mat-spinner diameter="32"></mat-spinner>
  </div>

  <form [formGroup]="form" *ngIf="!loading">

    <div class="field">
      <label class="field-label">Ticketera <span class="req">*</span></label>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Equipo de Odoo</mat-label>
        <mat-select formControlName="expirationsHelpdeskTeamId">
          <mat-option *ngFor="let t of teams" [value]="t.id">{{ t.name }}</mat-option>
        </mat-select>
      </mat-form-field>
      <span class="field-hint field-hint--warn" *ngIf="teamsError">
        No se pudo cargar la lista desde Odoo. Guardá las credenciales primero.
      </span>
    </div>

    <div class="field">
      <label class="field-label">Días de anticipación <span class="req">*</span></label>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <input matInput type="number" formControlName="expirationsTicketDaysAhead" min="1" />
      </mat-form-field>
      <span class="field-hint">Días antes del vencimiento en que se crea el ticket automáticamente.</span>
    </div>

    <div class="field">
      <label class="field-label">Tags de Odoo</label>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Tags</mat-label>
        <mat-select multiple formControlName="expirationsTagIds">
          <mat-option *ngFor="let tag of tags" [value]="tag.id">{{ tag.name }}</mat-option>
        </mat-select>
      </mat-form-field>
      <span class="field-hint field-hint--warn" *ngIf="tagsError">
        No se pudo cargar los tags desde Odoo.
      </span>
    </div>

  </form>
</mat-dialog-content>

<mat-dialog-actions align="end">
  <button mat-stroked-button (click)="cancel()" [disabled]="saving">Cancelar</button>
  <button mat-flat-button color="primary"
          [disabled]="form.invalid || saving || loading"
          (click)="save()">
    <mat-spinner *ngIf="saving" diameter="14"></mat-spinner>
    <span *ngIf="!saving">Guardar</span>
  </button>
</mat-dialog-actions>
```

- [ ] **Step 5: Crear `notifications-config-dialog.component.scss`**

```scss
.dialog-spinner {
  display: flex;
  justify-content: center;
  padding: 24px 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 16px;

  mat-form-field {
    width: 100%;
  }
}

.field-label {
  font-size: 11px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--tx-lo);

  .req { color: var(--crit); }
}

.field-hint {
  font-size: 11px;
  color: var(--tx-lo);

  &--warn { color: var(--warn); }
}
```

- [ ] **Step 6: Ejecutar tests**

```bash
cd frontend && npx ng test --include="**/notifications-config-dialog.component.spec.ts" --watch=false --browsers=ChromeHeadless
```
Expected: todos los tests pasan.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/features/notifications/config-dialog/
git commit -m "feat(notifications): crear NotificationsConfigDialogComponent para configurar ticketera de vencimientos"
```

---

### Task 8: NotificationsComponent + Module — botón engranaje y carga de config

**Files:**
- Modify: `frontend/src/app/features/notifications/notifications.component.ts`
- Modify: `frontend/src/app/features/notifications/notifications.component.html`
- Modify: `frontend/src/app/features/notifications/notifications.component.spec.ts`
- Modify: `frontend/src/app/features/notifications/notifications.module.ts`

**Interfaces:**
- Consumes: `AuthService.getCurrentUser()` para `isAdmin`; `MatDialog.open(NotificationsConfigDialogComponent)`; `IntegrationConfigService.getOdoo()` para cargar `expirationsTicketDaysAhead`
- Produces: `NotificationsComponent` con botón engranaje visible solo para ADMIN; `ticketWindowDays` dinámico; módulo completo con todas las declaraciones e imports

- [ ] **Step 1: Actualizar tests de `NotificationsComponent`** en `notifications.component.spec.ts`

Agregar al `TestBed`:
```typescript
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../core/services/auth.service';
import { IntegrationConfigService } from '../../core/services/integration-config.service';
```

En `beforeEach`, agregar providers:
```typescript
const mockDialog = jasmine.createSpyObj('MatDialog', ['open']);
const mockAuth   = jasmine.createSpyObj('AuthService', ['getCurrentUser']);
const mockIntegrationConfig = jasmine.createSpyObj('IntegrationConfigService', ['getOdoo']);
mockAuth.getCurrentUser.and.returnValue({ id: '1', name: 'Admin', email: 'a@a.com', role: 'ADMIN', avatarUrl: null });
mockIntegrationConfig.getOdoo.and.returnValue(of({ expirationsTicketDaysAhead: 20, expirationsTagIds: [], helpdeskTeamId: 7, expirationsHelpdeskTeamId: 9, url: '', db: '', username: '', apiKey: '', stageInProgressName: '', stageNotDoneName: '', stageDoneName: '', updatedAt: null, updatedBy: null }));

providers: [
  { provide: NotificationsService, useValue: serviceSpy },
  { provide: MatDialog, useValue: mockDialog },
  { provide: AuthService, useValue: mockAuth },
  { provide: IntegrationConfigService, useValue: mockIntegrationConfig },
]
```

Agregar tests:
```typescript
it('isAdmin es true cuando el usuario tiene role ADMIN', () => {
  expect(comp.isAdmin).toBe(true);
});

it('isAdmin es false cuando el usuario tiene role TECHNICIAN', () => {
  mockAuth.getCurrentUser.and.returnValue({ id: '2', name: 'Tec', email: 't@t.com', role: 'TECHNICIAN', avatarUrl: null });
  const f = TestBed.createComponent(NotificationsComponent);
  f.detectChanges();
  expect(f.componentInstance.isAdmin).toBe(false);
});

it('carga ticketWindowDays desde la config al inicializar', () => {
  expect(comp.ticketWindowDays).toBe(20);
});
```

- [ ] **Step 2: Ejecutar tests para confirmar que los nuevos fallan**

```bash
cd frontend && npx ng test --include="**/notifications.component.spec.ts" --watch=false --browsers=ChromeHeadless
```
Expected: nuevos tests fallan.

- [ ] **Step 3: Actualizar `notifications.component.ts`**

Reemplazar el archivo completo con la versión actualizada. Los cambios clave son:

- Agregar imports: `MatDialog`, `AuthService`, `IntegrationConfigService`, `NotificationsConfigDialogComponent`
- Reemplazar `const TICKET_WINDOW_DAYS = 30` con la propiedad `ticketWindowDays = 30`
- Agregar `isAdmin: boolean` getter
- Agregar `openConfig()` method
- En `ngOnInit()`, cargar `ticketWindowDays` desde config

```typescript
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { ExpirationItem, ExpirationType } from '../../core/models/notification.models';
import { NotificationsService } from '../../core/services/notifications.service';
import { AuthService } from '../../core/services/auth.service';
import { IntegrationConfigService } from '../../core/services/integration-config.service';
import { formatOdooTicketId, odooTicketUrl } from '../../shared/utils/odoo';
import { NotificationsConfigDialogComponent } from './config-dialog/notifications-config-dialog.component';

export type UrgencyZone = 'expired' | 'week' | 'soon' | 'attention';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
})
export class NotificationsComponent implements OnInit {
  items: ExpirationItem[] = [];
  loading = false;
  error = '';
  ticketWindowDays = 30;
  clientFilter: number | null = null;
  filterType: ExpirationType | '' = '';
  selectedUrgency: UrgencyZone | null = null;
  sortCol: 'client' | 'expireDate' = 'client';
  sortDir: 'asc' | 'desc' = 'asc';

  private readonly destroyRef = inject(DestroyRef);
  private loadSub?: Subscription;

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly authService: AuthService,
    private readonly integrationConfigService: IntegrationConfigService,
    private readonly dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.integrationConfigService.getOdoo().subscribe({
      next: (config) => {
        this.ticketWindowDays = config.expirationsTicketDaysAhead || 30;
      },
    });
    this.load();
  }

  get isAdmin(): boolean {
    return this.authService.getCurrentUser()?.role === 'ADMIN';
  }

  openConfig(): void {
    this.dialog.open(NotificationsConfigDialogComponent, { width: '480px' })
      .afterClosed().subscribe((saved: boolean | undefined) => {
        if (saved) {
          this.integrationConfigService.getOdoo().subscribe({
            next: (config) => {
              this.ticketWindowDays = config.expirationsTicketDaysAhead || 30;
            },
          });
        }
      });
  }

  load(): void {
    this.loadSub?.unsubscribe();
    this.loading = true;
    this.error = '';
    this.loadSub = this.notificationsService.getExpirations(undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: items => { this.items = items; this.loading = false; },
        error: () => { this.error = 'No se pudo cargar los vencimientos'; this.loading = false; },
      });
  }

  // ... todos los demás métodos se conservan igual (uniqueClients, filteredItems, getters de conteo, etc.)
  // Copiar íntegramente del archivo actual: get uniqueClients, get filteredItems,
  // get expiredCount, get weekCount, get soonCount, get attentionCount, get totalShown,
  // zonePct, toggleUrgency, setClientFilter, setSort, urgencyClass, urgencyLabel,
  // typeClass, typeLabel, itemMeta, ticketLabel, ticketLink

  ticketPending(item: ExpirationItem): boolean {
    return item.odooTicketId == null && item.daysUntil <= this.ticketWindowDays;
  }
  // Nota: ticketPending usa this.ticketWindowDays en vez de la constante
}
```

**IMPORTANTE:** copiar todos los métodos existentes desde el archivo actual — no omitirlos. Solo `ticketPending` cambia (`TICKET_WINDOW_DAYS` → `this.ticketWindowDays`).

- [ ] **Step 4: Actualizar `notifications.component.html`**

En el `<div class="nav-bar">`, agregar el botón engranaje después de `Actualizar`, antes del cierre del div:

```html
<button mat-icon-button *ngIf="isAdmin" (click)="openConfig()" matTooltip="Configuración de vencimientos">
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
</button>
```

- [ ] **Step 5: Actualizar `notifications.module.ts`**

```typescript
import * as https from 'https';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NotificationsRoutingModule } from './notifications-routing.module';
import { NotificationsComponent } from './notifications.component';
import { NotificationsConfigDialogComponent } from './config-dialog/notifications-config-dialog.component';

@NgModule({
  declarations: [NotificationsComponent, NotificationsConfigDialogComponent],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTooltipModule,
    NotificationsRoutingModule,
  ],
})
export class NotificationsModule {}
```

- [ ] **Step 6: Ejecutar todos los tests del módulo**

```bash
cd frontend && npx ng test --include="**/notifications*spec.ts" --watch=false --browsers=ChromeHeadless
```
Expected: todos los tests pasan.

- [ ] **Step 7: Ejecutar suite completa frontend**

```bash
cd frontend && npx ng test --watch=false --browsers=ChromeHeadless
```
Expected: todos los tests pasan.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/features/notifications/notifications.component.ts \
        frontend/src/app/features/notifications/notifications.component.html \
        frontend/src/app/features/notifications/notifications.component.spec.ts \
        frontend/src/app/features/notifications/notifications.module.ts
git commit -m "feat(notifications): botón configuración de vencimientos (solo ADMIN) y ticketWindowDays dinámico"
```

---

## Post-implementation checklist

- [ ] Ejecutar migración en local: `npm run migration:run` (o el script de migración configurado)
- [ ] Verificar que el cron no falla en startup (sin `expirationsHelpdeskTeamId` configurado)
- [ ] Verificar visualmente el botón engranaje en el módulo Vencimientos (solo visible con rol ADMIN)
- [ ] Abrir el dialog de config, verificar que carga teams y tags de Odoo
- [ ] Guardar config y verificar que `ticketWindowDays` se actualiza en la vista
