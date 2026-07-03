# QNAP Domain Task Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extraer `QNAP_MAINTENANCE` de `SERVER_MAINTENANCE` como `TaskType` propio, con su formulario Angular, ticket Odoo con título y descripción específicos, y limpiar el `MaintenanceFormComponent` de toda lógica QNAP.

**Architecture:** El backend agrega `QNAP_MAINTENANCE` al enum de base de datos y actualiza `OdooService.createTicket` para aceptar `taskType` y usar metadatos de ticket por tipo. El frontend crea `QnapFormComponent` extrayendo la lógica QNAP de `MaintenanceFormComponent`, actualiza `TaskDrawerComponent` para enrutar el form correcto según `task.type`, y limpia `MaintenanceFormComponent`.

**Tech Stack:** NestJS · TypeORM migrations · Angular 19 · Angular Material · Reactive Forms · Jest (backend) · Angular TestBed/Karma (frontend)

## Global Constraints

- TDD obligatorio: test fallando → implementación → test verde → commit
- Sin standalone components Angular
- Solo `appearance="outline"` en `mat-form-field`
- Sin `::ng-deep` — usar CSS custom properties
- Un archivo modificado por commit
- Idioma código: inglés — idioma commits: español
- Sin `any` en TypeScript

---

## File Map

**Backend — modificar:**
- `backend/src/tasks/task-type.enum.ts` — agregar `QNAP_MAINTENANCE`
- `backend/src/integrations/odoo/odoo.service.ts` — agregar param `taskType` a `createTicket` + mapa de metadatos por tipo
- `backend/src/integrations/odoo/odoo.service.spec.ts` — actualizar tests de `createTicket`
- `backend/src/tasks/tasks.service.ts` — pasar `dto.type` a `createTicket`
- `backend/src/tasks/tasks.service.spec.ts` — actualizar assertion de `createTicket`

**Backend — crear:**
- `backend/src/migrations/1782172800000-AddQnapMaintenanceTaskType.ts` — `ALTER TYPE task_type_enum ADD VALUE`

**Frontend — modificar:**
- `frontend/src/app/core/models/task.models.ts` — agregar `QNAP_MAINTENANCE` al union type
- `frontend/src/app/core/models/maintenance-log.models.ts` — agregar `QnapPayload`, actualizar `MaintenancePayload`
- `frontend/src/app/core/models/maintenance-log.models.spec.ts` — tests de `QnapPayload`
- `frontend/src/app/shared/utils/task-labels.ts` — agregar QNAP_MAINTENANCE a los tres Records
- `frontend/src/app/features/technician/technician.module.ts` — declarar `QnapFormComponent`
- `frontend/src/app/features/technician/task-drawer/task-drawer.component.ts` — ViewChild + triggerFormComplete actualizado
- `frontend/src/app/features/technician/task-drawer/task-drawer.component.html` — routing y footer QNAP_MAINTENANCE
- `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.ts` — eliminar lógica QNAP
- `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.html` — eliminar sección QNAP
- `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.spec.ts` — eliminar tests QNAP

**Frontend — crear:**
- `frontend/src/app/features/technician/task-drawer/qnap-form/qnap-form.component.ts`
- `frontend/src/app/features/technician/task-drawer/qnap-form/qnap-form.component.html`
- `frontend/src/app/features/technician/task-drawer/qnap-form/qnap-form.component.scss`
- `frontend/src/app/features/technician/task-drawer/qnap-form/qnap-form.component.spec.ts`

---

## Task 1: Backend — TaskType enum + migración SQL

**Files:**
- Modify: `backend/src/tasks/task-type.enum.ts`
- Create: `backend/src/migrations/1782172800000-AddQnapMaintenanceTaskType.ts`

**Interfaces:**
- Produces: `TaskType.QNAP_MAINTENANCE = 'QNAP_MAINTENANCE'` — usado en Tasks 2, 3 y todos los frontend tasks

- [ ] **Step 1: Agregar `QNAP_MAINTENANCE` al enum**

En `backend/src/tasks/task-type.enum.ts`, reemplazar el contenido:

```typescript
export enum TaskType {
  SERVER_MAINTENANCE    = 'SERVER_MAINTENANCE',
  QNAP_MAINTENANCE      = 'QNAP_MAINTENANCE',
  TERMINAL_MAINTENANCE  = 'TERMINAL_MAINTENANCE',
  SITE_VISIT            = 'SITE_VISIT',
  AV_CONTROL            = 'AV_CONTROL',
  UPS_CONTROL           = 'UPS_CONTROL',
  ENDPOINT_INVENTORY    = 'ENDPOINT_INVENTORY',
}
```

- [ ] **Step 2: Crear la migración TypeORM**

Crear `backend/src/migrations/1782172800000-AddQnapMaintenanceTaskType.ts`:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQnapMaintenanceTaskType1782172800000 implements MigrationInterface {
  name = 'AddQnapMaintenanceTaskType1782172800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."tasks_type_enum" ADD VALUE IF NOT EXISTS 'QNAP_MAINTENANCE'`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL no soporta eliminar valores de un enum sin recrearlo.
    // El down se deja vacío intencionalmente.
  }
}
```

- [ ] **Step 3: Verificar que el backend compila**

```bash
cd backend && npx tsc --noEmit
```

Expected: sin errores

- [ ] **Step 4: Correr suite completa del backend**

```bash
cd backend && npx jest --no-coverage
```

Expected: todos los tests pasan (el enum aún no se usa en tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/tasks/task-type.enum.ts backend/src/migrations/1782172800000-AddQnapMaintenanceTaskType.ts
git commit -m "feat(tasks): agregar QNAP_MAINTENANCE al enum TaskType y migración SQL"
```

---

## Task 2: Backend — OdooService.createTicket con parámetro TaskType

**Files:**
- Modify: `backend/src/integrations/odoo/odoo.service.ts`
- Modify: `backend/src/integrations/odoo/odoo.service.spec.ts`

**Interfaces:**
- Consumes: `TaskType` de `../../tasks/task-type.enum`
- Produces: `OdooService.createTicket(clientId: string, technicianId: string, taskType: TaskType): Promise<number>` — usado en Task 3

- [ ] **Step 1: Escribir tests fallando — firma nueva y mapa de metadatos**

En `backend/src/integrations/odoo/odoo.service.spec.ts`, dentro del bloque `describe('createTicket', ...)`, reemplazar **todos** los tests existentes por los siguientes:

Primero, agregar el import de `TaskType` al inicio del archivo (junto a los otros imports):

```typescript
import { TaskType } from '../../tasks/task-type.enum';
```

Luego reemplazar todo el bloque `describe('createTicket', () => { ... })` con:

```typescript
describe('createTicket', () => {
  it('crea un ticket SERVER_MAINTENANCE con título y descripción correctos', async () => {
    clientRepo.findOne.mockResolvedValue(
      makeClient({ odooPartnerId: 101, odooSaleLineId: null }),
    );
    technicianRepo.findOne.mockResolvedValue(makeTechnician());
    userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
    odooRpc.callKw
      .mockResolvedValueOnce([])  // sale.order.line search → sin resultado
      .mockResolvedValueOnce(42); // helpdesk.ticket create

    const ticketId = await service.createTicket(
      'client-uuid-1',
      'tech-uuid-1',
      TaskType.SERVER_MAINTENANCE,
    );

    expect(ticketId).toBe(42);
    expect(odooRpc.callKw).toHaveBeenCalledWith(
      'helpdesk.ticket',
      'create',
      [
        expect.objectContaining({
          name: 'Mantenimiento de infraestructura',
          description: 'Mantenimiento mensual de infraestructura.',
        }),
      ],
      {},
    );
  });

  it('crea un ticket QNAP_MAINTENANCE con título y descripción correctos', async () => {
    clientRepo.findOne.mockResolvedValue(
      makeClient({ odooPartnerId: 101, odooSaleLineId: null }),
    );
    technicianRepo.findOne.mockResolvedValue(makeTechnician());
    userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
    odooRpc.callKw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(55);

    const ticketId = await service.createTicket(
      'client-uuid-1',
      'tech-uuid-1',
      TaskType.QNAP_MAINTENANCE,
    );

    expect(ticketId).toBe(55);
    expect(odooRpc.callKw).toHaveBeenCalledWith(
      'helpdesk.ticket',
      'create',
      [
        expect.objectContaining({
          name: 'Mantenimiento repositorio de backups QNAP/NAS',
          description: 'Control de estado de discos, volumen y actualizaciones',
        }),
      ],
      {},
    );
  });

  it('incluye sale_line_id en el payload cuando el cliente tiene odooSaleLineId', async () => {
    clientRepo.findOne.mockResolvedValue(
      makeClient({ odooPartnerId: 101, odooSaleLineId: 77 }),
    );
    technicianRepo.findOne.mockResolvedValue(makeTechnician());
    userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
    odooRpc.callKw.mockResolvedValue(99);

    await service.createTicket('client-uuid-1', 'tech-uuid-1', TaskType.SERVER_MAINTENANCE);

    expect(odooRpc.callKw).toHaveBeenCalledWith(
      'helpdesk.ticket',
      'create',
      [expect.objectContaining({ sale_line_id: 77 })],
      {},
    );
  });

  it('NO incluye sale_line_id cuando el cliente no tiene odooSaleLineId', async () => {
    clientRepo.findOne.mockResolvedValue(
      makeClient({ odooPartnerId: 101, odooSaleLineId: null }),
    );
    technicianRepo.findOne.mockResolvedValue(makeTechnician());
    userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
    odooRpc.callKw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(99);

    await service.createTicket('client-uuid-1', 'tech-uuid-1', TaskType.SERVER_MAINTENANCE);

    const createCall = odooRpc.callKw.mock.calls.find(
      (args: unknown[]) => args[0] === 'helpdesk.ticket',
    );
    expect(createCall![2][0]).not.toHaveProperty('sale_line_id');
  });

  it('lanza BadRequestException cuando el cliente no tiene ID de Odoo', async () => {
    clientRepo.findOne.mockResolvedValue(
      makeClient({ odooPartnerId: null, taxIdNumber: null }),
    );

    await expect(
      service.createTicket('client-uuid-1', 'tech-uuid-1', TaskType.SERVER_MAINTENANCE),
    ).rejects.toThrow(BadRequestException);
    expect(odooRpc.callKw).not.toHaveBeenCalled();
  });

  it('lanza BadRequestException cuando el técnico no tiene ID de Odoo', async () => {
    clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: 101 }));
    technicianRepo.findOne.mockResolvedValue(makeTechnician());
    userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: null }));
    odooRpc.callKw.mockResolvedValue([]);

    await expect(
      service.createTicket('client-uuid-1', 'tech-uuid-1', TaskType.SERVER_MAINTENANCE),
    ).rejects.toThrow(BadRequestException);
  });

  it('propaga ServiceUnavailableException cuando Odoo falla al crear el ticket', async () => {
    clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: 101 }));
    technicianRepo.findOne.mockResolvedValue(makeTechnician());
    userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
    odooRpc.callKw.mockRejectedValue(
      new ServiceUnavailableException('Odoo caído'),
    );

    await expect(
      service.createTicket('client-uuid-1', 'tech-uuid-1', TaskType.SERVER_MAINTENANCE),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('lanza ServiceUnavailableException cuando Odoo devuelve false al crear el ticket', async () => {
    clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: 101 }));
    technicianRepo.findOne.mockResolvedValue(makeTechnician());
    userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
    odooRpc.callKw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(false);

    await expect(
      service.createTicket('client-uuid-1', 'tech-uuid-1', TaskType.SERVER_MAINTENANCE),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('lanza error cuando ODOO_HELPDESK_TEAM_ID no es un entero válido', async () => {
    configService.getOrThrow.mockReturnValue('no-es-numero');
    technicianRepo.findOne.mockResolvedValue(makeTechnician());
    userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));

    await expect(
      service.createTicket('client-uuid-1', 'tech-uuid-1', TaskType.SERVER_MAINTENANCE),
    ).rejects.toThrow('ODOO_HELPDESK_TEAM_ID must be a valid integer');
    expect(odooRpc.callKw).not.toHaveBeenCalled();
  });

  it('lanza BadRequestException cuando el técnico no tiene usuario asociado', async () => {
    clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: 101 }));
    const technicianSinUsuario: Technician = {
      id: 'tech-uuid-1',
      user: undefined as unknown as User,
      createdAt: new Date('2026-01-01'),
    };
    technicianRepo.findOne.mockResolvedValue(technicianSinUsuario);

    await expect(
      service.createTicket('client-uuid-1', 'tech-uuid-1', TaskType.SERVER_MAINTENANCE),
    ).rejects.toThrow(BadRequestException);
    expect(odooRpc.callKw).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr tests y verificar que fallan**

```bash
cd backend && npx jest odoo.service.spec.ts --no-coverage
```

Expected: fallan los tests con `Expected 3 arguments, but got 2` (en el impl) o `Expected "Mantenimiento mensual!" to equal "Mantenimiento mensual de infraestructura."`

- [ ] **Step 3: Implementar — agregar TICKET_META y actualizar createTicket**

En `backend/src/integrations/odoo/odoo.service.ts`:

**3a. Agregar import de TaskType** al inicio del archivo (junto a los otros imports):

```typescript
import { TaskType } from '../../tasks/task-type.enum';
```

**3b. Agregar constante TICKET_META** justo antes de la declaración de la clase `@Injectable()`:

```typescript
const TICKET_META: Record<TaskType, { name: string; description: string }> = {
  [TaskType.SERVER_MAINTENANCE]:   { name: 'Mantenimiento de infraestructura',            description: 'Mantenimiento mensual de infraestructura.' },
  [TaskType.QNAP_MAINTENANCE]:     { name: 'Mantenimiento repositorio de backups QNAP/NAS', description: 'Control de estado de discos, volumen y actualizaciones' },
  [TaskType.TERMINAL_MAINTENANCE]: { name: 'Mantenimiento de terminales',                  description: 'Mantenimiento mensual de terminales.' },
  [TaskType.SITE_VISIT]:           { name: 'Visita técnica presencial',                    description: 'Visita técnica al cliente.' },
  [TaskType.AV_CONTROL]:           { name: 'Control de antivirus',                         description: 'Control mensual de antivirus.' },
  [TaskType.UPS_CONTROL]:          { name: 'Control de UPS',                               description: 'Control mensual de equipos UPS.' },
  [TaskType.ENDPOINT_INVENTORY]:   { name: 'Inventario de endpoints',                      description: 'Relevamiento de endpoints.' },
};
```

**3c. Actualizar la firma y el body de `createTicket`**

Reemplazar el método `createTicket` completo (actualmente en línea ~351):

```typescript
async createTicket(
  clientId: string,
  technicianId: string,
  taskType: TaskType,
): Promise<number> {
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
    throw new BadRequestException(
      `Técnico ${technicianId} no tiene usuario asociado`,
    );
  }

  const odooUserId = await this.resolveUserId(technician.user.id);
  if (odooUserId === null) {
    throw new BadRequestException(
      `Técnico ${technicianId} no tiene ID de Odoo`,
    );
  }

  const teamId = parseInt(
    this.configService.getOrThrow<string>('ODOO_HELPDESK_TEAM_ID'),
    10,
  );
  if (isNaN(teamId)) {
    throw new BadRequestException(
      'ODOO_HELPDESK_TEAM_ID must be a valid integer',
    );
  }

  const saleLineId = await this.resolveSaleLineId(clientId);
  const meta = TICKET_META[taskType];

  const payload: Record<string, unknown> = {
    team_id: teamId,
    partner_id: partnerId,
    user_id: odooUserId,
    name: meta.name,
    description: meta.description,
  };
  if (saleLineId !== null) {
    payload['sale_line_id'] = saleLineId;
  }

  const ticketId = await this.odooRpc.callKw<number>(
    'helpdesk.ticket',
    'create',
    [payload],
    {},
  );
  if (!ticketId) {
    throw new ServiceUnavailableException(
      'Odoo devolvió false al crear el ticket — verificar sale_line_id y permisos del equipo',
    );
  }
  return ticketId;
}
```

- [ ] **Step 4: Correr tests y verificar que pasan**

```bash
cd backend && npx jest odoo.service.spec.ts --no-coverage
```

Expected: todos los tests pasan

- [ ] **Step 5: Verificar compilación**

```bash
cd backend && npx tsc --noEmit
```

Expected: sin errores

- [ ] **Step 6: Commit**

```bash
git add backend/src/integrations/odoo/odoo.service.ts backend/src/integrations/odoo/odoo.service.spec.ts
git commit -m "feat(odoo): agregar taskType a createTicket con metadatos de ticket por tipo de tarea"
```

---

## Task 3: Backend — TasksService pasa taskType a createTicket

**Files:**
- Modify: `backend/src/tasks/tasks.service.ts`
- Modify: `backend/src/tasks/tasks.service.spec.ts`

**Interfaces:**
- Consumes: `OdooService.createTicket(clientId, technicianId, taskType)` (Task 2)

- [ ] **Step 1: Escribir test fallando — assertion de createTicket actualizada**

En `backend/src/tasks/tasks.service.spec.ts`, dentro del bloque `describe('create', ...)`, buscar el test `'crea y devuelve la tarea con cliente y técnico cargados'` y reemplazar la assertion de `createTicket`:

```typescript
// ANTES:
expect(odooService.createTicket).toHaveBeenCalledWith(
  'client-1',
  'tech-1',
);

// DESPUÉS:
expect(odooService.createTicket).toHaveBeenCalledWith(
  'client-1',
  'tech-1',
  TaskType.SERVER_MAINTENANCE,
);
```

El `createDto` del test ya tiene `type: TaskType.SERVER_MAINTENANCE`. Solo hay que actualizar la assertion.

- [ ] **Step 2: Correr test y verificar que falla**

```bash
cd backend && npx jest tasks.service.spec.ts --no-coverage
```

Expected: falla con `Expected: ["client-1", "tech-1", "SERVER_MAINTENANCE"] / Received: ["client-1", "tech-1"]`

- [ ] **Step 3: Implementar — pasar dto.type a createTicket**

En `backend/src/tasks/tasks.service.ts`, en el método `create`, reemplazar la llamada a `createTicket`:

```typescript
// ANTES:
const odooTicketId = await this.odooService.createTicket(
  dto.clientId,
  dto.technicianId,
);

// DESPUÉS:
const odooTicketId = await this.odooService.createTicket(
  dto.clientId,
  dto.technicianId,
  dto.type,
);
```

- [ ] **Step 4: Correr tests y verificar que pasan**

```bash
cd backend && npx jest tasks.service.spec.ts --no-coverage
```

Expected: todos los tests pasan

- [ ] **Step 5: Correr suite completa del backend**

```bash
cd backend && npx jest --no-coverage
```

Expected: todos los tests pasan

- [ ] **Step 6: Commit**

```bash
git add backend/src/tasks/tasks.service.ts backend/src/tasks/tasks.service.spec.ts
git commit -m "feat(tasks): pasar taskType a OdooService.createTicket al crear una tarea"
```

---

## Task 4: Frontend — modelos TypeScript

**Files:**
- Modify: `frontend/src/app/core/models/task.models.ts`
- Modify: `frontend/src/app/core/models/maintenance-log.models.ts`
- Modify: `frontend/src/app/core/models/maintenance-log.models.spec.ts`

**Interfaces:**
- Produces:
  - `TaskType` union con `'QNAP_MAINTENANCE'` — usado por todos los componentes
  - `QnapPayload` con `type: 'QNAP_MAINTENANCE'`, `qnap: QNAPSection[]`, `notes?: string`
  - `MaintenancePayload` = `ServerMaintenancePayload | TerminalPayload | QnapPayload`

- [ ] **Step 1: Escribir tests fallando en maintenance-log.models.spec.ts**

En `frontend/src/app/core/models/maintenance-log.models.spec.ts`, agregar al final del archivo (fuera de cualquier describe existente):

```typescript
describe('QnapPayload', () => {
  it('acepta type QNAP_MAINTENANCE con array de qnap', () => {
    const payload: QnapPayload = {
      type: 'QNAP_MAINTENANCE',
      qnap: [{
        deviceId: 10,
        deviceName: 'QNAP-01',
        diskCount: 4,
        totalSpaceGB: 16000,
        usedSpaceGB: 11200,
        disksWithError: [],
        raidStatus: 'ok',
        firmwareVersion: '5.1.0.2566',
        firmwareUpdated: false,
      }],
    };
    expect(payload.type).toBe('QNAP_MAINTENANCE');
    expect(payload.qnap.length).toBe(1);
    expect(payload.qnap[0].diskCount).toBe(4);
  });

  it('acepta notes opcional', () => {
    const payload: QnapPayload = {
      type: 'QNAP_MAINTENANCE',
      qnap: [],
      notes: 'revisado',
    };
    expect(payload.notes).toBe('revisado');
  });

  it('acepta QnapPayload como MaintenancePayload', () => {
    const payload: MaintenancePayload = {
      type: 'QNAP_MAINTENANCE',
      qnap: [],
    };
    expect(payload.type).toBe('QNAP_MAINTENANCE');
  });
});
```

También agregar `QnapPayload` al import al inicio del spec (si no está ya):

```typescript
import {
  BmcAlertCategory,
  MaintenancePayload,
  QnapPayload,
  QNAPSection,
  ServerMaintenancePayload,
  TerminalPayload,
} from './maintenance-log.models';
```

- [ ] **Step 2: Correr tests y verificar que fallan**

```bash
cd frontend && npx ng test --include="**/maintenance-log.models.spec.ts" --watch=false --browsers=ChromeHeadless
```

Expected: error de compilación TypeScript — `QnapPayload` no existe

- [ ] **Step 3: Actualizar task.models.ts**

En `frontend/src/app/core/models/task.models.ts`, reemplazar el tipo `TaskType`:

```typescript
export type TaskType =
  | 'SERVER_MAINTENANCE'
  | 'QNAP_MAINTENANCE'
  | 'TERMINAL_MAINTENANCE'
  | 'SITE_VISIT'
  | 'AV_CONTROL'
  | 'UPS_CONTROL'
  | 'ENDPOINT_INVENTORY';
```

- [ ] **Step 4: Actualizar maintenance-log.models.ts**

En `frontend/src/app/core/models/maintenance-log.models.ts`, agregar `QnapPayload` y actualizar `MaintenancePayload`. Reemplazar las últimas dos líneas del archivo:

```typescript
// ANTES:
export type MaintenancePayload = ServerMaintenancePayload | TerminalPayload;

// DESPUÉS — agregar interfaz QnapPayload primero, luego actualizar el union:
export interface QnapPayload {
  type: 'QNAP_MAINTENANCE';
  qnap: QNAPSection[];
  notes?: string;
}

export type MaintenancePayload = ServerMaintenancePayload | TerminalPayload | QnapPayload;
```

- [ ] **Step 5: Correr tests y verificar que pasan**

```bash
cd frontend && npx ng test --include="**/maintenance-log.models.spec.ts" --watch=false --browsers=ChromeHeadless
```

Expected: todos los tests pasan

- [ ] **Step 6: Verificar compilación TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Expected: puede haber errores en `task-labels.ts` por `Record<TaskType, ...>` — se corrigen en el siguiente commit.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/core/models/task.models.ts frontend/src/app/core/models/maintenance-log.models.ts frontend/src/app/core/models/maintenance-log.models.spec.ts
git commit -m "feat(models): agregar QNAP_MAINTENANCE a TaskType, QnapPayload e interfaz y actualizar MaintenancePayload"
```

---

## Task 5: Frontend — task-labels.ts

**Files:**
- Modify: `frontend/src/app/shared/utils/task-labels.ts`

**Interfaces:**
- Consumes: `TaskType` actualizado (Task 4) — ahora `Record<TaskType, ...>` requiere entrada QNAP_MAINTENANCE
- Produces: `typeLabel('QNAP_MAINTENANCE') → 'QNAP/NAS'`, `typeLabelLong('QNAP_MAINTENANCE') → 'Mantenimiento QNAP/NAS'`

No hay test unitario dedicado para estas funciones. La verificación es que el proyecto compila sin errores.

- [ ] **Step 1: Actualizar los Records en task-labels.ts**

Reemplazar el contenido completo de `frontend/src/app/shared/utils/task-labels.ts`:

```typescript
import { TaskStatus, TaskType } from '../../core/models/task.models';

/** Texto legible en español para un TaskStatus. */
export function statusLabel(status: TaskStatus): string {
  const labels: Record<TaskStatus, string> = {
    PENDING:     'Pendiente',
    IN_PROGRESS: 'En curso',
    DONE:        'Listo',
    ESCALATED:   'Escalado',
    NOT_DONE:    'No hecho',
  };
  return labels[status] ?? status;
}

/** Clase CSS badge para un TaskStatus. */
export function statusBadge(status: TaskStatus): string {
  const map: Record<TaskStatus, string> = {
    PENDING:     'badge--neutral',
    IN_PROGRESS: 'badge--accent',
    DONE:        'badge--ok',
    ESCALATED:   'badge--warn',
    NOT_DONE:    'badge--crit',
  };
  return map[status] ?? 'badge--neutral';
}

/** Label corta en español para un TaskType (uso en tablas). */
export function typeLabel(type: TaskType): string {
  const labels: Record<TaskType, string> = {
    SERVER_MAINTENANCE:   'Servidores',
    QNAP_MAINTENANCE:     'QNAP/NAS',
    TERMINAL_MAINTENANCE: 'Terminales',
    SITE_VISIT:           'Visita',
    AV_CONTROL:           'Antivirus',
    UPS_CONTROL:          'UPS',
    ENDPOINT_INVENTORY:   'Inventario',
  };
  return labels[type];
}

/** Label larga en español para un TaskType (uso en drawers y listas). */
export function typeLabelLong(type: TaskType): string {
  const labels: Record<TaskType, string> = {
    SERVER_MAINTENANCE:   'Mantenimiento de servidores',
    QNAP_MAINTENANCE:     'Mantenimiento QNAP/NAS',
    TERMINAL_MAINTENANCE: 'Visita de terminales',
    SITE_VISIT:           'Visita presencial',
    AV_CONTROL:           'Control antivirus',
    UPS_CONTROL:          'Control UPS',
    ENDPOINT_INVENTORY:   'Inventario',
  };
  return labels[type];
}

/** Clase CSS badge para un TaskType según si es visita o servicio. */
export function typeBadge(type: TaskType): string {
  return type === 'TERMINAL_MAINTENANCE' || type === 'SITE_VISIT'
    ? 'badge--purple'
    : 'badge--srv';
}
```

- [ ] **Step 2: Verificar compilación TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Expected: sin errores

- [ ] **Step 3: Correr suite completa del frontend**

```bash
cd frontend && npx ng test --watch=false --browsers=ChromeHeadless
```

Expected: todos los tests existentes pasan

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/shared/utils/task-labels.ts
git commit -m "feat(labels): agregar QNAP_MAINTENANCE a typeLabel, typeLabelLong y typeBadge"
```

---

## Task 6: Frontend — QnapFormComponent

**Files:**
- Create: `frontend/src/app/features/technician/task-drawer/qnap-form/qnap-form.component.spec.ts`
- Create: `frontend/src/app/features/technician/task-drawer/qnap-form/qnap-form.component.ts`
- Create: `frontend/src/app/features/technician/task-drawer/qnap-form/qnap-form.component.html`
- Create: `frontend/src/app/features/technician/task-drawer/qnap-form/qnap-form.component.scss`

**Interfaces:**
- Consumes: `QnapPayload`, `QNAPSection`, `MaintenancePayload` (Task 4) · `ClientInfrastructure` · `Task`
- Produces:
  - `QnapFormComponent` con selector `app-qnap-form`
  - `@Input() task: Task`, `infrastructure: ClientInfrastructure`, `savedPayload: MaintenancePayload | null`, `readOnly: boolean`
  - `@Output() requestComplete: EventEmitter<QnapPayload>`, `requestNotDone: EventEmitter<void>`
  - `submit()`, `submitNotDone()` — llamados desde `TaskDrawerComponent` (Task 7)
  - `form: FormGroup`, `qnapDeviceControls: FormArray`
  - Helpers públicos: `getQnapGroup(i)`, `diskSlotOptions(i)`, `qnapFirmwareUpdated(i)`, `spaceRatio(i)`, `qnapCardHealth(i)`, `selectClass(value)`, `metricClass(value, warn, crit)`, `buildPayload()`

- [ ] **Step 1: Crear el spec con todos los tests**

Crear `frontend/src/app/features/technician/task-drawer/qnap-form/qnap-form.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, SimpleChange } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { QnapFormComponent } from './qnap-form.component';
import { Task } from '../../../../core/models/task.models';
import { ClientInfrastructure } from '../../../../core/models/infradoc.models';
import { QnapPayload } from '../../../../core/models/maintenance-log.models';

const makeTask = (): Task => ({
  id: '1',
  clientId: '10',
  technicianId: '2',
  type: 'QNAP_MAINTENANCE',
  status: 'PENDING',
  scheduledDate: '2026-06-01T00:00:00.000Z',
  completedDate: null,
  odooTicketId: null,
  createdAt: '2026-05-01T00:00:00.000Z',
});

const makeInfra = (): ClientInfrastructure => ({
  esxiHosts: [],
  windowsVMs: [],
  domainControllers: [],
  nas: [
    { assetId: 10, name: 'QNAP-01', ip: '192.168.1.21', bmcIp: null, bmcType: null, os: null, model: 'QNAP TS-453D' },
    { assetId: 11, name: 'QNAP-02', ip: '192.168.1.22', bmcIp: null, bmcType: null, os: null, model: 'QNAP TS-653D' },
  ],
  routers: [],
});

const makeSingleNasInfra = (): ClientInfrastructure => ({
  ...makeInfra(),
  nas: [{ assetId: 10, name: 'QNAP-01', ip: '192.168.1.21', bmcIp: null, bmcType: null, os: null, model: 'QNAP TS-453D' }],
});

describe('QnapFormComponent', () => {
  let component: QnapFormComponent;
  let fixture: ComponentFixture<QnapFormComponent>;

  function init(infra = makeInfra(), savedPayload: QnapPayload | null = null): void {
    fixture = TestBed.createComponent(QnapFormComponent);
    component = fixture.componentInstance;
    component.task = makeTask();
    component.infrastructure = infra;
    component.savedPayload = savedPayload;
    component.ngOnChanges({
      infrastructure: new SimpleChange(undefined, infra, true),
    });
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [QnapFormComponent],
      imports: [
        ReactiveFormsModule,
        NoopAnimationsModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatSelectModule,
        MatInputModule,
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  describe('form initialization', () => {
    it('crea un FormGroup por cada NAS en infrastructure', () => {
      init();
      expect(component.qnapDeviceControls.length).toBe(2);
    });

    it('cada FormGroup tiene los controles esperados', () => {
      init();
      const group = component.qnapDeviceControls.at(0);
      expect(group.get('diskCount')).not.toBeNull();
      expect(group.get('totalSpaceGB')).not.toBeNull();
      expect(group.get('totalSpaceUnit')).not.toBeNull();
      expect(group.get('usedSpaceGB')).not.toBeNull();
      expect(group.get('usedSpaceUnit')).not.toBeNull();
      expect(group.get('disksWithError')).not.toBeNull();
      expect(group.get('raidStatus')).not.toBeNull();
      expect(group.get('firmwareVersion')).not.toBeNull();
      expect(group.get('firmwareUpdated')).not.toBeNull();
      expect(group.get('firmwareNewVersion')).not.toBeNull();
    });

    it('totalSpaceUnit y usedSpaceUnit default a "GB"', () => {
      init();
      expect(component.qnapDeviceControls.at(0).get('totalSpaceUnit')?.value).toBe('GB');
      expect(component.qnapDeviceControls.at(0).get('usedSpaceUnit')?.value).toBe('GB');
    });

    it('raidStatus default a "ok"', () => {
      init();
      expect(component.qnapDeviceControls.at(0).get('raidStatus')?.value).toBe('ok');
    });
  });

  describe('diskSlotOptions', () => {
    it('retorna [] cuando diskCount es null', () => {
      init();
      component.qnapDeviceControls.at(0).patchValue({ diskCount: null });
      expect(component.diskSlotOptions(0)).toEqual([]);
    });

    it('retorna ["Disk 1".."Disk 4"] cuando diskCount es 4', () => {
      init();
      component.qnapDeviceControls.at(0).patchValue({ diskCount: 4 });
      expect(component.diskSlotOptions(0)).toEqual(['Disk 1', 'Disk 2', 'Disk 3', 'Disk 4']);
    });

    it('retorna [] cuando diskCount es 0', () => {
      init();
      component.qnapDeviceControls.at(0).patchValue({ diskCount: 0 });
      expect(component.diskSlotOptions(0)).toEqual([]);
    });
  });

  describe('qnapFirmwareUpdated', () => {
    it('retorna false cuando firmwareUpdated es false', () => {
      init();
      component.qnapDeviceControls.at(0).patchValue({ firmwareUpdated: false });
      expect(component.qnapFirmwareUpdated(0)).toBe(false);
    });

    it('retorna true cuando firmwareUpdated es true', () => {
      init();
      component.qnapDeviceControls.at(0).patchValue({ firmwareUpdated: true });
      expect(component.qnapFirmwareUpdated(0)).toBe(true);
    });
  });

  describe('spaceRatio', () => {
    it('retorna 0 cuando totalSpaceGB es 0', () => {
      init();
      component.qnapDeviceControls.at(0).patchValue({ totalSpaceGB: 0, usedSpaceGB: 0, totalSpaceUnit: 'GB', usedSpaceUnit: 'GB' });
      expect(component.spaceRatio(0)).toBe(0);
    });

    it('retorna 50 cuando used es la mitad del total (GB)', () => {
      init();
      component.qnapDeviceControls.at(0).patchValue({ totalSpaceGB: 1000, usedSpaceGB: 500, totalSpaceUnit: 'GB', usedSpaceUnit: 'GB' });
      expect(component.spaceRatio(0)).toBe(50);
    });

    it('normaliza cross-unit: 512 GB usados / 1 TB total = 50%', () => {
      init();
      component.qnapDeviceControls.at(0).patchValue({ totalSpaceGB: 1, usedSpaceGB: 512, totalSpaceUnit: 'TB', usedSpaceUnit: 'GB' });
      expect(component.spaceRatio(0)).toBe(50);
    });
  });

  describe('qnapCardHealth', () => {
    it('retorna "ok" cuando no hay errores', () => {
      init();
      component.qnapDeviceControls.at(0).patchValue({
        disksWithError: [], raidStatus: 'ok',
        totalSpaceGB: 1000, usedSpaceGB: 500, totalSpaceUnit: 'GB', usedSpaceUnit: 'GB',
      });
      expect(component.qnapCardHealth(0)).toBe('ok');
    });

    it('retorna "crit" cuando hay discos con error', () => {
      init();
      component.qnapDeviceControls.at(0).patchValue({
        disksWithError: ['Disk 1'], raidStatus: 'ok',
        totalSpaceGB: 1000, usedSpaceGB: 500, totalSpaceUnit: 'GB', usedSpaceUnit: 'GB',
      });
      expect(component.qnapCardHealth(0)).toBe('crit');
    });

    it('retorna "crit" cuando raidStatus es "failed"', () => {
      init();
      component.qnapDeviceControls.at(0).patchValue({
        disksWithError: [], raidStatus: 'failed',
        totalSpaceGB: 1000, usedSpaceGB: 500, totalSpaceUnit: 'GB', usedSpaceUnit: 'GB',
      });
      expect(component.qnapCardHealth(0)).toBe('crit');
    });

    it('retorna "crit" cuando espacio usado supera 85%', () => {
      init();
      component.qnapDeviceControls.at(0).patchValue({
        disksWithError: [], raidStatus: 'ok',
        totalSpaceGB: 100, usedSpaceGB: 90, totalSpaceUnit: 'GB', usedSpaceUnit: 'GB',
      });
      expect(component.qnapCardHealth(0)).toBe('crit');
    });

    it('retorna "warn" cuando raidStatus es "degraded"', () => {
      init();
      component.qnapDeviceControls.at(0).patchValue({
        disksWithError: [], raidStatus: 'degraded',
        totalSpaceGB: 1000, usedSpaceGB: 500, totalSpaceUnit: 'GB', usedSpaceUnit: 'GB',
      });
      expect(component.qnapCardHealth(0)).toBe('warn');
    });

    it('retorna "warn" cuando espacio usado supera 70% pero no 85%', () => {
      init();
      component.qnapDeviceControls.at(0).patchValue({
        disksWithError: [], raidStatus: 'ok',
        totalSpaceGB: 100, usedSpaceGB: 75, totalSpaceUnit: 'GB', usedSpaceUnit: 'GB',
      });
      expect(component.qnapCardHealth(0)).toBe('warn');
    });
  });

  describe('buildPayload', () => {
    it('retorna QnapPayload con type QNAP_MAINTENANCE', () => {
      init(makeSingleNasInfra());
      expect(component.buildPayload().type).toBe('QNAP_MAINTENANCE');
    });

    it('mapea deviceId y deviceName desde infrastructure.nas', () => {
      init(makeSingleNasInfra());
      const payload = component.buildPayload();
      expect(payload.qnap[0].deviceId).toBe(10);
      expect(payload.qnap[0].deviceName).toBe('QNAP-01');
    });

    it('incluye firmwareNewVersion cuando firmwareUpdated es true', () => {
      init(makeSingleNasInfra());
      component.qnapDeviceControls.at(0).patchValue({ firmwareUpdated: true, firmwareNewVersion: '5.2.0.2800' });
      const payload = component.buildPayload();
      expect(payload.qnap[0].firmwareUpdated).toBe(true);
      expect(payload.qnap[0].firmwareNewVersion).toBe('5.2.0.2800');
    });

    it('NO incluye firmwareNewVersion cuando firmwareUpdated es false', () => {
      init(makeSingleNasInfra());
      component.qnapDeviceControls.at(0).patchValue({ firmwareUpdated: false, firmwareNewVersion: '5.2.0.2800' });
      expect(component.buildPayload().qnap[0].firmwareNewVersion).toBeUndefined();
    });

    it('incluye notes cuando está presente', () => {
      init(makeSingleNasInfra());
      component.form.patchValue({ notes: 'revisado' });
      expect(component.buildPayload().notes).toBe('revisado');
    });

    it('omite notes cuando está vacío', () => {
      init(makeSingleNasInfra());
      component.form.patchValue({ notes: '' });
      expect(component.buildPayload().notes).toBeUndefined();
    });

    it('incluye todos los dispositivos NAS', () => {
      init();
      expect(component.buildPayload().qnap.length).toBe(2);
    });

    it('preserva totalSpaceUnit y usedSpaceUnit en el payload', () => {
      init(makeSingleNasInfra());
      component.qnapDeviceControls.at(0).patchValue({ totalSpaceUnit: 'TB', usedSpaceUnit: 'TB' });
      const payload = component.buildPayload();
      expect(payload.qnap[0].totalSpaceUnit).toBe('TB');
      expect(payload.qnap[0].usedSpaceUnit).toBe('TB');
    });
  });

  describe('patchFormFromPayload via savedPayload en ngOnChanges', () => {
    it('parchea diskCount, raidStatus, disksWithError desde savedPayload', () => {
      const saved: QnapPayload = {
        type: 'QNAP_MAINTENANCE',
        qnap: [{
          deviceId: 10, deviceName: 'QNAP-01',
          diskCount: 4, totalSpaceGB: 16000, usedSpaceGB: 11200,
          totalSpaceUnit: 'GB', usedSpaceUnit: 'GB',
          disksWithError: ['Disk 2'], raidStatus: 'degraded',
          firmwareVersion: '5.1.0.2566', firmwareUpdated: false,
        }],
      };
      init(makeSingleNasInfra(), saved);

      expect(component.qnapDeviceControls.at(0).get('diskCount')?.value).toBe(4);
      expect(component.qnapDeviceControls.at(0).get('raidStatus')?.value).toBe('degraded');
      expect(component.qnapDeviceControls.at(0).get('disksWithError')?.value).toEqual(['Disk 2']);
    });

    it('parchea firmwareNewVersion cuando está en el payload', () => {
      const saved: QnapPayload = {
        type: 'QNAP_MAINTENANCE',
        qnap: [{
          deviceId: 10, deviceName: 'QNAP-01',
          diskCount: 4, totalSpaceGB: 8, totalSpaceUnit: 'TB',
          usedSpaceGB: 5, usedSpaceUnit: 'TB',
          disksWithError: [], raidStatus: 'ok',
          firmwareVersion: '5.1.0.2400',
          firmwareUpdated: true, firmwareNewVersion: '5.2.0.2800',
        }],
      };
      init(makeSingleNasInfra(), saved);

      expect(component.qnapDeviceControls.at(0).get('firmwareUpdated')?.value).toBe(true);
      expect(component.qnapDeviceControls.at(0).get('firmwareNewVersion')?.value).toBe('5.2.0.2800');
    });

    it('parchea totalSpaceUnit y usedSpaceUnit', () => {
      const saved: QnapPayload = {
        type: 'QNAP_MAINTENANCE',
        qnap: [{
          deviceId: 10, deviceName: 'QNAP-01',
          diskCount: 4, totalSpaceGB: 8, totalSpaceUnit: 'TB',
          usedSpaceGB: 5, usedSpaceUnit: 'TB',
          disksWithError: [], raidStatus: 'ok',
          firmwareVersion: '5.1.0', firmwareUpdated: false,
        }],
      };
      init(makeSingleNasInfra(), saved);

      expect(component.qnapDeviceControls.at(0).get('totalSpaceUnit')?.value).toBe('TB');
      expect(component.qnapDeviceControls.at(0).get('usedSpaceUnit')?.value).toBe('TB');
    });

    it('defaultea totalSpaceUnit a GB cuando el payload no tiene units (logs viejos)', () => {
      const saved: QnapPayload = {
        type: 'QNAP_MAINTENANCE',
        qnap: [{
          deviceId: 10, deviceName: 'QNAP-01',
          diskCount: 4, totalSpaceGB: 16000, usedSpaceGB: 11200,
          disksWithError: [], raidStatus: 'ok',
          firmwareVersion: '5.1.0', firmwareUpdated: false,
        }],
      };
      init(makeSingleNasInfra(), saved);

      expect(component.qnapDeviceControls.at(0).get('totalSpaceUnit')?.value).toBe('GB');
    });

    it('matchea por deviceId, ignora entries que no están en infrastructure', () => {
      const saved: QnapPayload = {
        type: 'QNAP_MAINTENANCE',
        qnap: [
          { deviceId: 99, deviceName: 'OTRO', diskCount: 2, totalSpaceGB: 100, usedSpaceGB: 50, disksWithError: [], raidStatus: 'ok', firmwareVersion: '1.0', firmwareUpdated: false },
          { deviceId: 10, deviceName: 'QNAP-01', diskCount: 4, totalSpaceGB: 16000, usedSpaceGB: 11200, disksWithError: [], raidStatus: 'ok', firmwareVersion: '5.1.0', firmwareUpdated: false },
        ],
      };
      init(makeSingleNasInfra(), saved);

      expect(component.qnapDeviceControls.at(0).get('diskCount')?.value).toBe(4);
    });
  });

  describe('readOnly', () => {
    it('deshabilita el formulario cuando readOnly es true', () => {
      fixture = TestBed.createComponent(QnapFormComponent);
      component = fixture.componentInstance;
      component.task = makeTask();
      component.infrastructure = makeSingleNasInfra();
      component.readOnly = true;
      component.ngOnChanges({ infrastructure: new SimpleChange(undefined, makeSingleNasInfra(), true) });
      fixture.detectChanges();

      expect(component.form.disabled).toBe(true);
    });
  });

  describe('submit', () => {
    it('emite requestComplete con el payload del formulario', () => {
      init(makeSingleNasInfra());
      const emitted: QnapPayload[] = [];
      component.requestComplete.subscribe((p: QnapPayload) => emitted.push(p));

      component.submit();

      expect(emitted.length).toBe(1);
      expect(emitted[0].type).toBe('QNAP_MAINTENANCE');
    });
  });

  describe('submitNotDone', () => {
    it('emite requestNotDone', () => {
      init(makeSingleNasInfra());
      let emitted = false;
      component.requestNotDone.subscribe(() => { emitted = true; });

      component.submitNotDone();

      expect(emitted).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Correr tests y verificar que fallan**

```bash
cd frontend && npx ng test --include="**/qnap-form.component.spec.ts" --watch=false --browsers=ChromeHeadless
```

Expected: falla con `Cannot find module './qnap-form.component'`

- [ ] **Step 3: Crear qnap-form.component.ts**

Crear `frontend/src/app/features/technician/task-drawer/qnap-form/qnap-form.component.ts`:

```typescript
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormArray, FormBuilder, FormGroup } from '@angular/forms';
import { Task } from '../../../../core/models/task.models';
import { ClientInfrastructure } from '../../../../core/models/infradoc.models';
import {
  MaintenancePayload,
  QNAPSection,
  QnapPayload,
} from '../../../../core/models/maintenance-log.models';

@Component({
  selector: 'app-qnap-form',
  templateUrl: './qnap-form.component.html',
  styleUrl: './qnap-form.component.scss',
})
export class QnapFormComponent implements OnChanges {
  @Input() task!: Task;
  @Input() infrastructure!: ClientInfrastructure;
  @Input() savedPayload: MaintenancePayload | null = null;
  @Input() readOnly = false;

  @Output() requestComplete = new EventEmitter<QnapPayload>();
  @Output() requestNotDone  = new EventEmitter<void>();

  form!: FormGroup;

  constructor(private fb: FormBuilder) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['infrastructure'] && this.infrastructure) {
      this.buildForm();
      if (this.savedPayload) {
        this.patchFormFromPayload(this.savedPayload);
      }
      this.applyReadOnlyState();
    } else if (changes['savedPayload'] && this.savedPayload && this.form) {
      this.patchFormFromPayload(this.savedPayload);
    } else if (changes['readOnly'] && this.form) {
      this.applyReadOnlyState();
    }
  }

  get qnapDeviceControls(): FormArray {
    return this.form.get('qnapDevices') as FormArray;
  }

  private applyReadOnlyState(): void {
    if (!this.form) return;
    if (this.readOnly) {
      this.form.disable({ emitEvent: false });
    } else {
      this.form.enable({ emitEvent: false });
    }
  }

  private buildForm(): void {
    this.form = this.fb.group({
      qnapDevices: this.fb.array(
        this.infrastructure.nas.map(() => this.fb.group({
          diskCount:          [null as number | null],
          totalSpaceGB:       [null as number | null],
          totalSpaceUnit:     ['GB' as 'GB' | 'TB'],
          usedSpaceGB:        [null as number | null],
          usedSpaceUnit:      ['GB' as 'GB' | 'TB'],
          disksWithError:     [[] as string[]],
          raidStatus:         ['ok'],
          firmwareVersion:    [''],
          firmwareUpdated:    [false],
          firmwareNewVersion: [''],
        }))
      ),
      notes: [''],
    });
  }

  getQnapGroup(index: number): FormGroup {
    return this.qnapDeviceControls.at(index) as FormGroup;
  }

  diskSlotOptions(index: number): string[] {
    const count = Number(this.qnapDeviceControls.at(index).get('diskCount')?.value);
    if (!count || isNaN(count) || count <= 0) return [];
    return Array.from({ length: count }, (_, k) => `Disk ${k + 1}`);
  }

  qnapFirmwareUpdated(index: number): boolean {
    return this.qnapDeviceControls.at(index).get('firmwareUpdated')?.value === true;
  }

  spaceRatio(index: number): number {
    const g = this.getQnapGroup(index).value;
    const total = Number(g.totalSpaceGB) * (g.totalSpaceUnit === 'TB' ? 1024 : 1);
    const used  = Number(g.usedSpaceGB)  * (g.usedSpaceUnit  === 'TB' ? 1024 : 1);
    return total ? (used / total) * 100 : 0;
  }

  qnapCardHealth(index: number): 'ok' | 'warn' | 'crit' {
    const g = this.getQnapGroup(index).value;
    const ratio = this.spaceRatio(index);
    if (g.disksWithError?.length || g.raidStatus === 'failed' || ratio > 85) return 'crit';
    if (g.raidStatus === 'degraded' || ratio > 70) return 'warn';
    return 'ok';
  }

  selectClass(value: string): string {
    if (!value) return 'mf-sel--na';
    if (value === 'ok') return 'mf-sel--ok';
    if (value === 'degraded') return 'mf-sel--warn';
    if (value === 'failed') return 'mf-sel--crit';
    return 'mf-sel--na';
  }

  metricClass(value: number | null, warnThreshold: number, critThreshold: number): string {
    if (value === null || value === undefined || isNaN(value)) return '';
    if (value >= critThreshold) return 'mf-inp--crit';
    if (value >= warnThreshold) return 'mf-inp--warn';
    return 'mf-inp--ok';
  }

  buildPayload(): QnapPayload {
    const v = this.form.value;
    return {
      type: 'QNAP_MAINTENANCE',
      qnap: this.infrastructure.nas.map((nas, i) => {
        const ctrl = this.qnapDeviceControls.at(i).value;
        const result: QNAPSection = {
          deviceId:        nas.assetId,
          deviceName:      nas.name,
          diskCount:       Number(ctrl.diskCount),
          totalSpaceGB:    Number(ctrl.totalSpaceGB),
          totalSpaceUnit:  ctrl.totalSpaceUnit ?? 'GB',
          usedSpaceGB:     Number(ctrl.usedSpaceGB),
          usedSpaceUnit:   ctrl.usedSpaceUnit ?? 'GB',
          disksWithError:  ctrl.disksWithError ?? [],
          raidStatus:      ctrl.raidStatus,
          firmwareVersion: ctrl.firmwareVersion ?? '',
          firmwareUpdated: ctrl.firmwareUpdated,
        };
        if (ctrl.firmwareUpdated && ctrl.firmwareNewVersion) {
          result.firmwareNewVersion = ctrl.firmwareNewVersion;
        }
        return result;
      }),
      notes: v.notes || undefined,
    };
  }

  private patchFormFromPayload(payload: MaintenancePayload): void {
    if (payload.type !== 'QNAP_MAINTENANCE') return;
    const qnap = payload as QnapPayload;

    this.form.patchValue({ notes: qnap.notes ?? '' });

    if (qnap.qnap?.length) {
      this.infrastructure.nas.forEach((nas, i) => {
        const saved = qnap.qnap.find(d => d.deviceId === nas.assetId);
        if (saved) {
          this.qnapDeviceControls.at(i).patchValue({
            diskCount:          saved.diskCount,
            totalSpaceGB:       saved.totalSpaceGB,
            totalSpaceUnit:     saved.totalSpaceUnit ?? 'GB',
            usedSpaceGB:        saved.usedSpaceGB,
            usedSpaceUnit:      saved.usedSpaceUnit ?? 'GB',
            disksWithError:     saved.disksWithError,
            raidStatus:         saved.raidStatus,
            firmwareVersion:    saved.firmwareVersion,
            firmwareUpdated:    saved.firmwareUpdated,
            firmwareNewVersion: saved.firmwareNewVersion ?? '',
          });
        }
      });
    }
  }

  submit(): void {
    this.requestComplete.emit(this.buildPayload());
  }

  submitNotDone(): void {
    this.requestNotDone.emit();
  }
}
```

- [ ] **Step 4: Correr tests y verificar que pasan**

```bash
cd frontend && npx ng test --include="**/qnap-form.component.spec.ts" --watch=false --browsers=ChromeHeadless
```

Expected: todos los tests pasan

- [ ] **Step 5: Crear qnap-form.component.html**

Crear `frontend/src/app/features/technician/task-drawer/qnap-form/qnap-form.component.html`:

```html
<form [formGroup]="form">

  <div class="mf-vmware-grid" formArrayName="qnapDevices">
    <div *ngFor="let _ of qnapDeviceControls.controls; let i = index"
         [formGroupName]="i"
         class="mf-cl-rpt mf-vmware-card">

      <div class="mf-cl-rpt-hdr">
        <div class="mf-cl-rpt-dot"
             [ngClass]="'mf-cl-rpt-dot--' + qnapCardHealth(i)"></div>
        <div class="mf-vmware-name-block">
          <span class="mf-cl-rpt-label">{{ infrastructure.nas[i].name }}</span>
          <span class="mono mf-host-ip">{{ infrastructure.nas[i].ip ?? '—' }}</span>
        </div>
      </div>

      <!-- Discos -->
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="mf-metric-ff">
        <mat-label>Cantidad de discos</mat-label>
        <input matInput formControlName="diskCount" type="number" min="1" placeholder="0" />
      </mat-form-field>

      <!-- Espacio total -->
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="mf-metric-ff">
        <mat-label>Espacio total</mat-label>
        <input matInput formControlName="totalSpaceGB" type="number" min="0" placeholder="0" />
        <mat-select matSuffix formControlName="totalSpaceUnit" style="width:55px">
          <mat-option value="GB">GB</mat-option>
          <mat-option value="TB">TB</mat-option>
        </mat-select>
      </mat-form-field>

      <!-- Espacio utilizado -->
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="mf-metric-ff"
                      [ngClass]="metricClass(spaceRatio(i), 70, 85)">
        <mat-label>Espacio utilizado</mat-label>
        <input matInput formControlName="usedSpaceGB" type="number" min="0" placeholder="0" />
        <mat-select matSuffix formControlName="usedSpaceUnit" style="width:55px">
          <mat-option value="GB">GB</mat-option>
          <mat-option value="TB">TB</mat-option>
        </mat-select>
      </mat-form-field>

      <!-- Badge porcentaje de espacio -->
      <span *ngIf="spaceRatio(i) > 0"
            class="qnap-space-pct"
            [ngClass]="metricClass(spaceRatio(i), 70, 85)">
        {{ spaceRatio(i) | number:'1.0-0' }}%
      </span>

      <!-- Discos con error -->
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="mf-form-field"
                      [ngClass]="getQnapGroup(i).get('disksWithError')?.value?.length ? 'mf-sel--crit' : ''">
        <mat-label>Discos con error</mat-label>
        <mat-select formControlName="disksWithError" multiple>
          <mat-option *ngFor="let slot of diskSlotOptions(i)" [value]="slot">{{ slot }}</mat-option>
        </mat-select>
      </mat-form-field>

      <!-- Chips de discos con error -->
      <div *ngIf="getQnapGroup(i).get('disksWithError')?.value?.length"
           class="qnap-disk-error-chips">
        <span *ngFor="let disk of getQnapGroup(i).get('disksWithError')?.value"
              class="qnap-disk-chip">{{ disk }}</span>
      </div>

      <!-- Estado RAID -->
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="mf-form-field"
                      [ngClass]="selectClass(getQnapGroup(i).get('raidStatus')?.value)">
        <mat-label>Estado RAID</mat-label>
        <mat-select formControlName="raidStatus">
          <mat-option value="ok">OK — saludable</mat-option>
          <mat-option value="degraded">Degradado</mat-option>
          <mat-option value="failed">Error</mat-option>
        </mat-select>
      </mat-form-field>

      <!-- Versión firmware instalada -->
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="mf-form-field">
        <mat-label>Versión firmware instalada</mat-label>
        <input matInput formControlName="firmwareVersion" placeholder="Ej: 5.1.0.2566" />
      </mat-form-field>

      <!-- Checkbox firmware actualizado -->
      <mat-checkbox formControlName="firmwareUpdated" class="mf-cl-mat">
        Se actualizó el firmware
      </mat-checkbox>

      <!-- Versión nueva (condicional) -->
      <mat-form-field *ngIf="qnapFirmwareUpdated(i)"
                      appearance="outline" subscriptSizing="dynamic" class="mf-form-field">
        <mat-label>Nueva versión aplicada</mat-label>
        <input matInput formControlName="firmwareNewVersion" placeholder="Ej: 5.2.0.2800" />
      </mat-form-field>

    </div>
  </div>

  <!-- Notas globales -->
  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="mf-form-field" style="margin-top:12px">
    <mat-label>Notas</mat-label>
    <textarea matInput formControlName="notes" placeholder="Observaciones generales..."></textarea>
  </mat-form-field>

</form>
```

- [ ] **Step 6: Crear qnap-form.component.scss**

Crear `frontend/src/app/features/technician/task-drawer/qnap-form/qnap-form.component.scss`:

```scss
.mf-cl-rpt-dot--ok   { background: var(--ok); }
.mf-cl-rpt-dot--warn { background: var(--warn); }
.mf-cl-rpt-dot--crit { background: var(--crit); }

.qnap-space-pct {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 3px;
  align-self: flex-start;

  &.mf-inp--ok   { background: var(--ok-bg);   color: var(--ok);   }
  &.mf-inp--warn { background: var(--warn-bg);  color: var(--warn); }
  &.mf-inp--crit { background: var(--crit-bg);  color: var(--crit); }
}

.qnap-disk-error-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: -4px;
}

.qnap-disk-chip {
  font-size: 11px;
  font-family: var(--font-mono);
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--crit-bg);
  color: var(--crit);
}
```

- [ ] **Step 7: Correr la suite completa de tests del frontend**

```bash
cd frontend && npx ng test --watch=false --browsers=ChromeHeadless
```

Expected: todos los tests pasan

- [ ] **Step 8: Verificar compilación TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Expected: sin errores

- [ ] **Step 9: Commit**

```bash
git add frontend/src/app/features/technician/task-drawer/qnap-form/
git commit -m "feat(qnap): crear QnapFormComponent como formulario independiente para tareas QNAP_MAINTENANCE"
```

---

## Task 7: Frontend — TechnicianModule + routing en TaskDrawerComponent

**Files:**
- Modify: `frontend/src/app/features/technician/technician.module.ts`
- Modify: `frontend/src/app/features/technician/task-drawer/task-drawer.component.ts`
- Modify: `frontend/src/app/features/technician/task-drawer/task-drawer.component.html`

**Interfaces:**
- Consumes: `QnapFormComponent` (Task 6) · `QnapPayload` (Task 4)

- [ ] **Step 1: Declarar QnapFormComponent en TechnicianModule**

En `frontend/src/app/features/technician/technician.module.ts`, agregar import y declaración:

```typescript
// Agregar al bloque de imports al inicio del archivo:
import { QnapFormComponent } from './task-drawer/qnap-form/qnap-form.component';

// En el array declarations, agregar QnapFormComponent junto a los existentes:
declarations: [
  TaskListComponent,
  TaskDrawerComponent,
  MaintenanceFormComponent,
  ConfirmMaintenanceDialogComponent,
  TimeSpentDialogComponent,
  DcHealthCardComponent,
  QnapFormComponent,
],
```

- [ ] **Step 2: Verificar compilación**

```bash
cd frontend && npx tsc --noEmit
```

Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/features/technician/technician.module.ts
git commit -m "feat(technician): declarar QnapFormComponent en TechnicianModule"
```

- [ ] **Step 4: Actualizar task-drawer.component.ts**

En `frontend/src/app/features/technician/task-drawer/task-drawer.component.ts`:

**4a. Agregar imports** (junto a los existentes):

```typescript
import { QnapFormComponent } from './qnap-form/qnap-form.component';
```

**4b. Agregar ViewChild** (junto al `@ViewChild(MaintenanceFormComponent)` existente):

```typescript
@ViewChild(QnapFormComponent) qnapForm?: QnapFormComponent;
```

**4c. Actualizar `triggerFormComplete`**:

```typescript
triggerFormComplete(): void {
  this.maintenanceForm?.submit();
  this.qnapForm?.submit();
}
```

- [ ] **Step 5: Actualizar task-drawer.component.html — body**

En `task-drawer.component.html`, reemplazar el bloque `<app-maintenance-form ... >` dentro del `<div class="d-body">`:

```html
  <!-- Formulario QNAP -->
  <app-qnap-form
    *ngIf="infrastructure && task.type === 'QNAP_MAINTENANCE'"
    [task]="task"
    [infrastructure]="infrastructure"
    [savedPayload]="savedPayload"
    [readOnly]="!isActiveTask"
    (requestComplete)="onRequestComplete($event)"
    (requestNotDone)="onRequestNotDone()">
  </app-qnap-form>

  <!-- Formulario de mantenimiento (todos los tipos menos QNAP) -->
  <app-maintenance-form
    *ngIf="infrastructure && task.type !== 'QNAP_MAINTENANCE'"
    [task]="task"
    [infrastructure]="infrastructure"
    [savedPayload]="savedPayload"
    [readOnly]="!isActiveTask"
    (requestComplete)="onRequestComplete($event)"
    (requestSave)="onRequestSave($event)"
    (requestNotDone)="onRequestNotDone()">
  </app-maintenance-form>
```

- [ ] **Step 6: Actualizar task-drawer.component.html — footer activo**

En el bloque `<div class="d-footer" *ngIf="isActiveTask">`, agregar el bloque QNAP_MAINTENANCE junto a los otros `<ng-container>`:

```html
    <!-- QNAP_MAINTENANCE -->
    <ng-container *ngIf="task.type === 'QNAP_MAINTENANCE'">
      <button mat-flat-button color="primary" (click)="triggerFormComplete()">Completar mantenimiento</button>
      <button mat-stroked-button (click)="drawerClosed.emit()">Cerrar</button>
    </ng-container>
```

Agregar este bloque **antes** del bloque `<!-- Tipos sin formulario -->`.

- [ ] **Step 7: Verificar compilación TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Expected: sin errores

- [ ] **Step 8: Correr suite completa de tests**

```bash
cd frontend && npx ng test --watch=false --browsers=ChromeHeadless
```

Expected: todos los tests pasan

- [ ] **Step 9: Commit**

```bash
git add frontend/src/app/features/technician/task-drawer/task-drawer.component.ts \
        frontend/src/app/features/technician/task-drawer/task-drawer.component.html
git commit -m "feat(drawer): enrutar QNAP_MAINTENANCE a QnapFormComponent y agregar footer"
```

---

## Task 8: Frontend — MaintenanceFormComponent cleanup

**Files:**
- Modify: `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.ts`
- Modify: `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.html`
- Modify: `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.spec.ts`

**Interfaces:**
- No produce nuevas interfaces — limpieza de código

- [ ] **Step 1: Eliminar tests QNAP del spec**

En `maintenance-form.component.spec.ts`, eliminar **todos** los tests que referencian funcionalidad QNAP. Son los siguientes bloques (buscarlos con Grep y eliminar):

- El test `'should include qnap section as array when hasQNAP is true'` (dentro de `describe('buildPayload')`).
- El test `'parchea sección QNAP usando deviceId'` (dentro de `describe('patchFormFromPayload')`).
- El `describe('QNAP controls', () => { ... })` completo.
- El `describe('buildPayload — QNAP section (nuevos campos)', () => { ... })` completo.
- El `describe('patchFormFromPayload — QNAP nuevos campos', () => { ... })` completo.
- El `describe('spaceRatio', () => { ... })` completo.
- El `describe('buildPayload — QNAP unit fields', () => { ... })` completo.
- El `describe('patchFormFromPayload — QNAP unit fields', () => { ... })` completo.

También actualizar el import al inicio del spec para quitar `QnapSnapshot` si estuviera presente.

- [ ] **Step 2: Correr tests para verificar que los tests restantes aún pasan**

```bash
cd frontend && npx ng test --include="**/maintenance-form.component.spec.ts" --watch=false --browsers=ChromeHeadless
```

Expected: los tests que sobreviven (Windows, VMware, Veeam, Router, Terminal) pasan. Pueden fallar por referencias a `qnapDeviceControls` si el componente aún las tiene — eso se resuelve en el siguiente paso.

- [ ] **Step 3: Eliminar lógica QNAP de maintenance-form.component.ts**

En `maintenance-form.component.ts`, eliminar:

**3a. Getter `qnapDeviceControls`** (líneas ~72-74):
```typescript
// ELIMINAR:
get qnapDeviceControls(): FormArray {
  return this.form.get('qnapDevices') as FormArray;
}
```

**3b. Getter `hasQNAP`** (línea ~61):
```typescript
// ELIMINAR:
get hasQNAP(): boolean    { return this.infrastructure?.nas?.length > 0; }
```

**3c. FormArray `qnapDevices`** en `buildForm()` — eliminar el bloque:
```typescript
// ELIMINAR (bloque completo dentro del fb.group):
qnapDevices: this.fb.array(
  this.infrastructure.nas.map(() => this.fb.group({
    diskCount:          [null as number | null],
    totalSpaceGB:       [null as number | null],
    totalSpaceUnit:     ['GB' as 'GB' | 'TB'],
    usedSpaceGB:        [null as number | null],
    usedSpaceUnit:      ['GB' as 'GB' | 'TB'],
    disksWithError:     [[] as string[]],
    raidStatus:         ['ok'],
    firmwareVersion:    [''],
    firmwareUpdated:    [false],
    firmwareNewVersion: [''],
  }))
),
```

**3d. Helpers QNAP** — eliminar los métodos completos:
```typescript
// ELIMINAR:
getQnapGroup(index: number): FormGroup { ... }
diskSlotOptions(index: number): string[] { ... }
qnapFirmwareUpdated(index: number): boolean { ... }
spaceRatio(index: number): number { ... }
```

**3e. Bloque QNAP en `buildPayload()`** — eliminar el bloque:
```typescript
// ELIMINAR:
if (this.hasQNAP) {
  payload.qnap = this.infrastructure.nas.map((nas, i) => {
    ...
  });
}
```

**3f. Bloque QNAP en `patchFormFromPayload()`** — eliminar el bloque:
```typescript
// ELIMINAR:
if (srv.qnap?.length) {
  this.infrastructure.nas.forEach((nas, i) => {
    ...
  });
}
```

**3g. Imports no usados** — quitar `QNAPSection` del import de `maintenance-log.models` si no se usa en ningún otro lado del archivo:
```typescript
// Remover QNAPSection del import:
import {
  BmcEntry,
  DcHealthSnapshot,
  MaintenancePayload,
  RouterEntry,
  ServerMaintenancePayload,
  TerminalPayload,
} from '../../../../core/models/maintenance-log.models';
```

- [ ] **Step 4: Eliminar sección QNAP del HTML**

En `maintenance-form.component.html`, eliminar el bloque completo:

```html
<!-- ── QNAP / NAS ───────────────────────────────────── -->
<ng-container *ngIf="hasQNAP">
  ...todo el contenido...
</ng-container>
```

El marcador de inicio es `<!-- ── QNAP / NAS ─` y termina antes de `<!-- ── Veeam Backup ─`.

- [ ] **Step 5: Verificar compilación TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Expected: sin errores

- [ ] **Step 6: Correr todos los tests del componente**

```bash
cd frontend && npx ng test --include="**/maintenance-form.component.spec.ts" --watch=false --browsers=ChromeHeadless
```

Expected: todos los tests restantes pasan

- [ ] **Step 7: Correr suite completa del frontend**

```bash
cd frontend && npx ng test --watch=false --browsers=ChromeHeadless
```

Expected: todos los tests pasan, sin regresiones

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.ts \
        frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.html \
        frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.spec.ts
git commit -m "refactor(maintenance-form): eliminar sección QNAP extraída a QnapFormComponent"
```

---

## Self-Review

**Spec coverage:**

| Requisito del spec | Task que lo implementa |
|---|---|
| `QNAP_MAINTENANCE` en enum backend | Task 1 |
| Migración `ALTER TYPE` PostgreSQL | Task 1 |
| `createTicket` acepta `taskType` | Task 2 |
| Título ticket QNAP: "Mantenimiento repositorio de backups QNAP/NAS" | Task 2 |
| Descripción ticket QNAP: "Control de estado de discos, volumen y actualizaciones" | Task 2 |
| `tasks.service` pasa `dto.type` | Task 3 |
| `QnapPayload` interfaz frontend | Task 4 |
| `QNAP_MAINTENANCE` en `TaskType` frontend | Task 4 |
| Labels en español para QNAP_MAINTENANCE | Task 5 |
| `QnapFormComponent` con misma lógica QNAP extraída | Task 6 |
| Health dot coloreado por `qnapCardHealth` | Task 6 (HTML) |
| Badge de porcentaje de espacio | Task 6 (HTML) |
| Chips de discos con error | Task 6 (HTML) |
| `TaskDrawerComponent` enruta a `app-qnap-form` | Task 7 |
| Footer QNAP_MAINTENANCE en drawer | Task 7 |
| Limpieza `MaintenanceFormComponent` | Task 8 |

**Out of scope (verificado):** migración de tareas existentes, scheduler automático, otros dominios (VMware, Veeam, Router, Windows). ✓
