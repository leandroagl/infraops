# Odoo Ticket on Task Create — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear automáticamente un ticket en Odoo Helpdesk al crear una tarea en InfraOps, fallando la creación si Odoo no está disponible.

**Architecture:** `OdooService` recibe un nuevo método `createTicket()` que resuelve los IDs de Odoo del cliente y técnico (con cache automático), luego llama a `helpdesk.ticket.create` vía `OdooRpcService`. `TasksService.create()` llama a `createTicket()` antes de persistir la tarea; si Odoo falla, la tarea no se guarda.

**Tech Stack:** NestJS, TypeORM, Jest, `xmlrpc` (ya instalado), `@nestjs/config`

---

## Archivos afectados

| Archivo | Acción |
|---------|--------|
| `backend/src/integrations/odoo/odoo.service.spec.ts` | Modificar: agregar mocks, agregar tests `createTicket` |
| `backend/src/integrations/odoo/odoo.service.ts` | Modificar: inyectar `ConfigService` + `technicianRepo`, agregar `createTicket()` |
| `backend/src/integrations/odoo/odoo-integration.module.ts` | Modificar: importar `TechniciansModule` |
| `backend/src/tasks/tasks.service.spec.ts` | Modificar: agregar mock `OdooService`, actualizar tests `create` |
| `backend/src/tasks/tasks.service.ts` | Modificar: inyectar `OdooService`, llamar `createTicket()` en `create()` |
| `backend/src/tasks/tasks.module.ts` | Modificar: importar `OdooIntegrationModule` |

---

### Task 1: Tests failing para `OdooService.createTicket()`

**Files:**
- Modify: `backend/src/integrations/odoo/odoo.service.spec.ts`

- [ ] **Step 1: Agregar imports y mocks de infraestructura al spec**

En `odoo.service.spec.ts`, agregar estos imports al bloque existente:

```typescript
import { ConfigService } from '@nestjs/config';
import { Technician } from '../../technicians/technician.entity';
```

En el bloque de variables del `describe('OdooService')`, agregar:

```typescript
let technicianRepo: { findOne: jest.Mock };
let configService: { getOrThrow: jest.Mock };
```

Agregar factory `makeTechnician` junto a las otras factories existentes:

```typescript
const makeTechnician = (userId = 'user-uuid-1'): Technician =>
  ({
    id: 'tech-uuid-1',
    user: makeUser({ id: userId, odooUserId: 201 }),
    createdAt: new Date('2026-01-01'),
  }) as unknown as Technician;
```

- [ ] **Step 2: Actualizar `beforeEach` para incluir los nuevos mocks**

Dentro del `beforeEach`, inicializar los nuevos mocks:

```typescript
technicianRepo = { findOne: jest.fn() };
configService = {
  getOrThrow: jest.fn().mockReturnValue('5'),
};
```

En el `TestingModule.createTestingModule({ providers: [...] })`, agregar junto a los providers existentes:

```typescript
{ provide: ConfigService, useValue: configService },
{ provide: getRepositoryToken(Technician), useValue: technicianRepo },
```

- [ ] **Step 3: Escribir los tests failing para `createTicket()`**

Agregar este bloque `describe` al final del archivo, antes del cierre del `describe('OdooService')`:

```typescript
describe('createTicket', () => {
  it('crea un ticket en Odoo y retorna el ticket ID', async () => {
    clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: 101 }));
    technicianRepo.findOne.mockResolvedValue(makeTechnician());
    userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
    odooRpc.callKw.mockResolvedValue(42);

    const ticketId = await service.createTicket('client-uuid-1', 'tech-uuid-1');

    expect(ticketId).toBe(42);
    expect(odooRpc.callKw).toHaveBeenCalledWith(
      'helpdesk.ticket',
      'create',
      [
        {
          team_id: 5,
          partner_id: 101,
          user_id: 201,
          name: 'Mantenimiento de infraestructura',
          description: 'Mantenimiento mensual!',
        },
      ],
      {},
    );
  });

  it('lanza BadRequestException cuando el cliente no tiene ID de Odoo', async () => {
    clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: null, taxIdNumber: null }));

    await expect(service.createTicket('client-uuid-1', 'tech-uuid-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(odooRpc.callKw).not.toHaveBeenCalled();
  });

  it('lanza BadRequestException cuando el técnico no tiene ID de Odoo', async () => {
    clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: 101 }));
    technicianRepo.findOne.mockResolvedValue(makeTechnician());
    userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: null }));
    odooRpc.callKw.mockResolvedValue([]);

    await expect(service.createTicket('client-uuid-1', 'tech-uuid-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('propaga ServiceUnavailableException cuando Odoo falla al crear el ticket', async () => {
    clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: 101 }));
    technicianRepo.findOne.mockResolvedValue(makeTechnician());
    userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
    odooRpc.callKw.mockRejectedValue(new ServiceUnavailableException('Odoo caído'));

    await expect(service.createTicket('client-uuid-1', 'tech-uuid-1')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
```

Asegurate de que `BadRequestException` y `ServiceUnavailableException` están importados al inicio del spec:

```typescript
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
```

- [ ] **Step 4: Correr tests y verificar que los 4 nuevos fallan**

```bash
cd backend && npx jest odoo.service.spec.ts --no-coverage
```

Resultado esperado: los 4 tests de `createTicket` fallan con `TypeError: service.createTicket is not a function`. Los tests existentes siguen pasando.

- [ ] **Step 5: Commit**

```bash
git add backend/src/integrations/odoo/odoo.service.spec.ts
git commit -m "test(odoo): tests failing para OdooService.createTicket"
```

---

### Task 2: Implementar `OdooService.createTicket()`

**Files:**
- Modify: `backend/src/integrations/odoo/odoo.service.ts`
- Modify: `backend/src/integrations/odoo/odoo-integration.module.ts`

- [ ] **Step 1: Agregar imports a `odoo.service.ts`**

Agregar a los imports existentes al inicio del archivo:

```typescript
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Technician } from '../../technicians/technician.entity';
```

`BadRequestException` ya está en `@nestjs/common`, solo agregar `ConfigService` y `Technician`.

- [ ] **Step 2: Actualizar el constructor de `OdooService`**

Reemplazar el constructor actual:

```typescript
constructor(
  private readonly odooRpc: OdooRpcService,
  @InjectRepository(Client)
  private readonly clientRepo: Repository<Client>,
  @InjectRepository(User)
  private readonly userRepo: Repository<User>,
) {}
```

Por:

```typescript
constructor(
  private readonly odooRpc: OdooRpcService,
  private readonly configService: ConfigService,
  @InjectRepository(Client)
  private readonly clientRepo: Repository<Client>,
  @InjectRepository(User)
  private readonly userRepo: Repository<User>,
  @InjectRepository(Technician)
  private readonly technicianRepo: Repository<Technician>,
) {}
```

- [ ] **Step 3: Agregar el método `createTicket()` al final de `OdooService`**

Agregar antes del cierre de la clase:

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

  const odooUserId = await this.resolveUserId(technician.user.id);
  if (odooUserId === null) {
    throw new BadRequestException(`Técnico ${technicianId} no tiene ID de Odoo`);
  }

  const teamId = parseInt(
    this.configService.getOrThrow<string>('ODOO_HELPDESK_TEAM_ID'),
    10,
  );

  return this.odooRpc.callKw<number>(
    'helpdesk.ticket',
    'create',
    [
      {
        team_id: teamId,
        partner_id: partnerId,
        user_id: odooUserId,
        name: 'Mantenimiento de infraestructura',
        description: 'Mantenimiento mensual!',
      },
    ],
    {},
  );
}
```

- [ ] **Step 4: Importar `TechniciansModule` en `odoo-integration.module.ts`**

Reemplazar el contenido de `odoo-integration.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ClientsModule } from '../../clients/clients.module';
import { UsersModule } from '../../users/users.module';
import { TechniciansModule } from '../../technicians/technicians.module';
import { OdooRpcService } from './odoo-rpc.service';
import { OdooService } from './odoo.service';
import { OdooController } from './odoo.controller';

@Module({
  imports: [
    ClientsModule,
    UsersModule,
    TechniciansModule,
  ],
  controllers: [OdooController],
  providers: [OdooRpcService, OdooService],
  exports: [OdooService],
})
export class OdooIntegrationModule {}
```

- [ ] **Step 5: Correr los tests y verificar que los 4 nuevos pasan**

```bash
cd backend && npx jest odoo.service.spec.ts --no-coverage
```

Resultado esperado: todos los tests de `odoo.service.spec.ts` pasan, incluyendo los 4 nuevos de `createTicket`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/integrations/odoo/odoo.service.ts backend/src/integrations/odoo/odoo-integration.module.ts
git commit -m "feat(odoo): agregar OdooService.createTicket con resolución de IDs bajo demanda"
```

---

### Task 3: Tests failing para `TasksService.create()` con Odoo

**Files:**
- Modify: `backend/src/tasks/tasks.service.spec.ts`

- [ ] **Step 1: Agregar import y mock de `OdooService`**

Agregar import al inicio del spec:

```typescript
import { ServiceUnavailableException } from '@nestjs/common';
import { OdooService } from '../integrations/odoo/odoo.service';
```

En el bloque de variables del `describe`, agregar:

```typescript
let odooService: { createTicket: jest.Mock };
```

- [ ] **Step 2: Actualizar `beforeEach` para incluir `odooService`**

En el `beforeEach`, inicializar el mock:

```typescript
odooService = { createTicket: jest.fn() };
```

En `TestingModule.createTestingModule({ providers: [...] })`, agregar:

```typescript
{ provide: OdooService, useValue: odooService },
```

- [ ] **Step 3: Actualizar el test de `create` exitoso existente**

Reemplazar el test `'crea y devuelve la tarea con cliente y técnico cargados'` completo:

```typescript
it('crea y devuelve la tarea con cliente y técnico cargados', async () => {
  clientRepository.findOne.mockResolvedValue(mockClient);
  technicianRepository.findOne.mockResolvedValue(mockTechnician);
  odooService.createTicket.mockResolvedValue(42);
  taskRepository.create.mockReturnValue({ ...mockTask, odooTicketId: 42 });
  taskRepository.save.mockResolvedValue({ ...mockTask, odooTicketId: 42 });
  taskRepository.findOne.mockResolvedValue({ ...mockTask, odooTicketId: 42 });

  const result = await service.create(createDto);

  expect(odooService.createTicket).toHaveBeenCalledWith('client-1', 'tech-1');
  expect(taskRepository.create).toHaveBeenCalledWith({
    clientId: 'client-1',
    technicianId: 'tech-1',
    type: TaskType.SERVER_MAINTENANCE,
    scheduledDate: '2026-06-01',
    odooTicketId: 42,
  });
  expect(taskRepository.save).toHaveBeenCalled();
  expect(result.odooTicketId).toBe(42);
});
```

- [ ] **Step 4: Agregar test nuevo: Odoo falla, tarea no se guarda**

Agregar dentro del `describe('create')`, después del test actualizado:

```typescript
it('no guarda la tarea si Odoo falla al crear el ticket', async () => {
  clientRepository.findOne.mockResolvedValue(mockClient);
  technicianRepository.findOne.mockResolvedValue(mockTechnician);
  odooService.createTicket.mockRejectedValue(
    new ServiceUnavailableException('Odoo no disponible'),
  );

  await expect(service.create(createDto)).rejects.toThrow(ServiceUnavailableException);

  expect(taskRepository.save).not.toHaveBeenCalled();
});
```

- [ ] **Step 5: Correr los tests y verificar estado**

```bash
cd backend && npx jest tasks.service.spec.ts --no-coverage
```

Resultado esperado:
- El test actualizado `'crea y devuelve...'` falla: `odooService.createTicket is not a function` (o similar porque el servicio aún no lo llama)
- El test `'no guarda la tarea si Odoo falla...'` falla: la tarea se guarda aunque Odoo falle
- Los demás tests siguen pasando

- [ ] **Step 6: Commit**

```bash
git add backend/src/tasks/tasks.service.spec.ts
git commit -m "test(tasks): tests failing para TasksService.create con integración Odoo"
```

---

### Task 4: Integrar `OdooService` en `TasksService`

**Files:**
- Modify: `backend/src/tasks/tasks.service.ts`
- Modify: `backend/src/tasks/tasks.module.ts`

- [ ] **Step 1: Agregar import de `OdooService` a `tasks.service.ts`**

Agregar al bloque de imports existente:

```typescript
import { OdooService } from '../integrations/odoo/odoo.service';
```

- [ ] **Step 2: Inyectar `OdooService` en el constructor de `TasksService`**

Reemplazar el constructor actual:

```typescript
constructor(
  @InjectRepository(Task)
  private readonly taskRepository: Repository<Task>,
  @InjectRepository(Client)
  private readonly clientRepository: Repository<Client>,
  @InjectRepository(Technician)
  private readonly technicianRepository: Repository<Technician>,
  @InjectRepository(MaintenanceLog)
  private readonly logRepository: Repository<MaintenanceLog>,
) {}
```

Por:

```typescript
constructor(
  @InjectRepository(Task)
  private readonly taskRepository: Repository<Task>,
  @InjectRepository(Client)
  private readonly clientRepository: Repository<Client>,
  @InjectRepository(Technician)
  private readonly technicianRepository: Repository<Technician>,
  @InjectRepository(MaintenanceLog)
  private readonly logRepository: Repository<MaintenanceLog>,
  private readonly odooService: OdooService,
) {}
```

- [ ] **Step 3: Actualizar `create()` para llamar a `createTicket()` antes del save**

Reemplazar el método `create` completo:

```typescript
async create(dto: CreateTaskDto): Promise<Task> {
  const client = await this.clientRepository.findOne({ where: { id: dto.clientId } });
  if (!client) throw new NotFoundException('Cliente no encontrado');

  const technician = await this.technicianRepository.findOne({ where: { id: dto.technicianId } });
  if (!technician) throw new NotFoundException('Técnico no encontrado');

  const odooTicketId = await this.odooService.createTicket(dto.clientId, dto.technicianId);

  const task = this.taskRepository.create({
    clientId: dto.clientId,
    technicianId: dto.technicianId,
    type: dto.type,
    scheduledDate: dto.scheduledDate,
    odooTicketId,
  });
  const saved = await this.taskRepository.save(task);
  return this.loadTask(saved.id);
}
```

- [ ] **Step 4: Importar `OdooIntegrationModule` en `tasks.module.ts`**

Reemplazar el contenido de `tasks.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ClientsModule } from '../clients/clients.module';
import { TechniciansModule } from '../technicians/technicians.module';
import { MaintenanceLog } from '../maintenance-logs/maintenance-log.entity';
import { OdooIntegrationModule } from '../integrations/odoo/odoo-integration.module';
import { Task } from './task.entity';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, MaintenanceLog]),
    ClientsModule,
    TechniciansModule,
    OdooIntegrationModule,
  ],
  controllers: [TasksController],
  providers: [TasksService, JwtAuthGuard, RolesGuard],
  exports: [TasksService],
})
export class TasksModule {}
```

- [ ] **Step 5: Correr todos los tests y verificar que pasan**

```bash
cd backend && npx jest --no-coverage
```

Resultado esperado: todos los tests pasan, sin errores. Prestá especial atención a:
- `odoo.service.spec.ts`: todos pasan
- `tasks.service.spec.ts`: todos pasan
- `odoo.controller.spec.ts`: sigue pasando sin cambios

- [ ] **Step 6: Commit final**

```bash
git add backend/src/tasks/tasks.service.ts backend/src/tasks/tasks.module.ts
git commit -m "feat(tasks): crear ticket Odoo al crear tarea"
```

---

## Variable de entorno requerida

Antes de correr en producción/staging, agregar al `.env`:

```
ODOO_HELPDESK_TEAM_ID=<id_del_equipo_en_odoo>
```

El valor es el ID numérico del equipo de helpdesk de mantenimientos en la instancia de Odoo.
