# Validación de infraestructura al crear tarea — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Impedir la creación de tareas de mantenimiento cuando el cliente no tiene la infraestructura requerida, con validación en el backend e información en tiempo real en el dialog del frontend.

**Architecture:** `TasksService.create()` llama a `InfrastructureService` antes de crear el ticket en Odoo y lanza `BadRequestException` si el cliente no tiene los activos requeridos. El frontend suscribe `clientId.valueChanges` para obtener la infraestructura del cliente seleccionado y filtra los tipos de tarea disponibles mediante un getter `availableTaskTypes`.

**Tech Stack:** NestJS + TypeORM (backend), Angular 19 + Angular Material (frontend), Jest (backend tests), Jasmine (frontend tests)

## Global Constraints
- TDD obligatorio: test escrito y corrido en rojo antes de implementar
- No usar `any` en TypeScript
- Solo `appearance="outline"` en `mat-form-field`
- No standalone components en Angular
- Commits al final de cada tarea

---

### Task 1: Backend — Wiring y validación en TasksService

**Files:**
- Modify: `backend/src/integrations/infradoc/infradoc-integration.module.ts`
- Modify: `backend/src/tasks/tasks.module.ts`
- Modify: `backend/src/tasks/tasks.service.spec.ts`
- Modify: `backend/src/tasks/tasks.service.ts`

**Interfaces:**
- Consumes: `InfrastructureService.getClientInfrastructure(clientId: string): Promise<ClientInfrastructureDto>`
- Produces: `TasksService.create()` lanza `BadRequestException` si el cliente no tiene la infraestructura requerida para el tipo de tarea

---

- [ ] **Step 1: Agregar imports y helpers al spec**

En `backend/src/tasks/tasks.service.spec.ts`, agregar al bloque de imports existente:

```typescript
import { InfrastructureService } from '../integrations/infradoc/infrastructure.service';
import { ClientInfrastructureDto } from '../integrations/infradoc/dto/client-infrastructure.dto';
```

Dentro del `describe('TasksService', () => {`, antes del bloque `beforeEach`, agregar:

```typescript
const emptyInfra: ClientInfrastructureDto = {
  esxiHosts: [], windowsVMs: [], domainControllers: [], linuxVMs: [], nas: [], routers: [],
};

const infraWithWindows: ClientInfrastructureDto = {
  ...emptyInfra,
  windowsVMs: [{ assetId: 1, name: 'WS-01', ip: null, bmcIp: null, bmcType: null, os: 'Windows Server 2019', model: null, uri1: null, uri2: null }],
};
```

Declarar la variable del mock junto a las otras (`let taskRepository`, etc.):

```typescript
let infrastructureService: { getClientInfrastructure: jest.Mock };
```

- [ ] **Step 2: Registrar el mock de `InfrastructureService` en el `beforeEach`**

En el `beforeEach`, después de inicializar `odooService`:

```typescript
infrastructureService = { getClientInfrastructure: jest.fn() };
```

En `Test.createTestingModule`, reemplazar el array `providers` completo:

```typescript
providers: [
  TasksService,
  { provide: getRepositoryToken(Task),           useValue: taskRepository },
  { provide: getRepositoryToken(Client),         useValue: clientRepository },
  { provide: getRepositoryToken(Technician),     useValue: technicianRepository },
  { provide: getRepositoryToken(MaintenanceLog), useValue: logRepository },
  { provide: OdooService,                        useValue: odooService },
  { provide: InfrastructureService,             useValue: infrastructureService },
],
```

- [ ] **Step 3: Actualizar los tests existentes de `create` que alcanzan la validación**

Los tests que usan `WINDOWS_DOMAIN_MAINTENANCE` y tienen cliente + técnico válidos necesitan mock de infra. Actualizar los dos primeros tests dentro de `describe('create')`:

```typescript
it('crea y devuelve la tarea con cliente y técnico cargados', async () => {
  clientRepository.findOne.mockResolvedValue(mockClient);
  technicianRepository.findOne.mockResolvedValue(mockTechnician);
  infrastructureService.getClientInfrastructure.mockResolvedValue(infraWithWindows);  // nuevo
  odooService.createTicket.mockResolvedValue(42);
  taskRepository.create.mockReturnValue({ ...mockTask, odooTicketId: 42 });
  taskRepository.save.mockResolvedValue({ ...mockTask, odooTicketId: 42 });
  taskRepository.findOne.mockResolvedValue({ ...mockTask, odooTicketId: 42 });

  const result = await service.create(createDto);

  expect(odooService.createTicket).toHaveBeenCalledWith(
    'client-1', 'tech-1', TaskType.WINDOWS_DOMAIN_MAINTENANCE,
  );
  expect(taskRepository.create).toHaveBeenCalledWith({
    clientId: 'client-1',
    technicianId: 'tech-1',
    type: TaskType.WINDOWS_DOMAIN_MAINTENANCE,
    scheduledDate: '2026-06-01',
    odooTicketId: 42,
  });
  expect(taskRepository.save).toHaveBeenCalled();
  expect(result.odooTicketId).toBe(42);
});

it('no guarda la tarea si Odoo falla al crear el ticket', async () => {
  clientRepository.findOne.mockResolvedValue(mockClient);
  technicianRepository.findOne.mockResolvedValue(mockTechnician);
  infrastructureService.getClientInfrastructure.mockResolvedValue(infraWithWindows);  // nuevo
  odooService.createTicket.mockRejectedValue(
    new ServiceUnavailableException('Odoo no disponible'),
  );

  await expect(service.create(createDto)).rejects.toThrow(ServiceUnavailableException);
  expect(taskRepository.save).not.toHaveBeenCalled();
});
```

Los tests de `NotFoundException` por cliente/técnico no necesitan cambios (la validación nunca se alcanza).

- [ ] **Step 4: Escribir los nuevos tests de validación**

Agregar al final de `describe('create')`:

```typescript
it('lanza BadRequestException si cliente sin VMs Windows para WINDOWS_DOMAIN_MAINTENANCE', async () => {
  clientRepository.findOne.mockResolvedValue(mockClient);
  technicianRepository.findOne.mockResolvedValue(mockTechnician);
  infrastructureService.getClientInfrastructure.mockResolvedValue(emptyInfra);

  await expect(service.create(createDto)).rejects.toThrow(
    'El cliente no tiene VMs Windows ni controladores de dominio en InfraDoc',
  );
  expect(odooService.createTicket).not.toHaveBeenCalled();
});

it('lanza BadRequestException si cliente sin esxiHosts para SERVER_HOST_MAINTENANCE', async () => {
  clientRepository.findOne.mockResolvedValue(mockClient);
  technicianRepository.findOne.mockResolvedValue(mockTechnician);
  infrastructureService.getClientInfrastructure.mockResolvedValue(emptyInfra);

  await expect(
    service.create({ ...createDto, type: TaskType.SERVER_HOST_MAINTENANCE }),
  ).rejects.toThrow('El cliente no tiene servidores ESXi/BMC registrados en InfraDoc');
  expect(odooService.createTicket).not.toHaveBeenCalled();
});

it('lanza BadRequestException si cliente sin routers para ROUTER_MAINTENANCE', async () => {
  clientRepository.findOne.mockResolvedValue(mockClient);
  technicianRepository.findOne.mockResolvedValue(mockTechnician);
  infrastructureService.getClientInfrastructure.mockResolvedValue(emptyInfra);

  await expect(
    service.create({ ...createDto, type: TaskType.ROUTER_MAINTENANCE }),
  ).rejects.toThrow('El cliente no tiene routers/firewalls registrados en InfraDoc');
  expect(odooService.createTicket).not.toHaveBeenCalled();
});

it('lanza BadRequestException si cliente sin NAS para QNAP_MAINTENANCE', async () => {
  clientRepository.findOne.mockResolvedValue(mockClient);
  technicianRepository.findOne.mockResolvedValue(mockTechnician);
  infrastructureService.getClientInfrastructure.mockResolvedValue(emptyInfra);

  await expect(
    service.create({ ...createDto, type: TaskType.QNAP_MAINTENANCE }),
  ).rejects.toThrow('El cliente no tiene dispositivos NAS/QNAP registrados en InfraDoc');
  expect(odooService.createTicket).not.toHaveBeenCalled();
});

it('lanza BadRequestException si cliente sin NAS para VEEAM_BACKUP', async () => {
  clientRepository.findOne.mockResolvedValue(mockClient);
  technicianRepository.findOne.mockResolvedValue(mockTechnician);
  infrastructureService.getClientInfrastructure.mockResolvedValue(emptyInfra);

  await expect(
    service.create({ ...createDto, type: TaskType.VEEAM_BACKUP }),
  ).rejects.toThrow('El cliente no tiene dispositivos NAS/QNAP registrados en InfraDoc (requerido para Veeam)');
  expect(odooService.createTicket).not.toHaveBeenCalled();
});

it('no llama a InfrastructureService y crea tarea para SITE_VISIT', async () => {
  clientRepository.findOne.mockResolvedValue(mockClient);
  technicianRepository.findOne.mockResolvedValue(mockTechnician);
  odooService.createTicket.mockResolvedValue(null);
  taskRepository.create.mockReturnValue({ ...mockTask, type: TaskType.SITE_VISIT, odooTicketId: null });
  taskRepository.save.mockResolvedValue({ ...mockTask, type: TaskType.SITE_VISIT, odooTicketId: null });
  taskRepository.findOne.mockResolvedValue({ ...mockTask, type: TaskType.SITE_VISIT, odooTicketId: null });

  await service.create({ ...createDto, type: TaskType.SITE_VISIT });

  expect(infrastructureService.getClientInfrastructure).not.toHaveBeenCalled();
  expect(taskRepository.save).toHaveBeenCalled();
});

it('propaga ServiceUnavailableException cuando InfraDoc no está disponible', async () => {
  clientRepository.findOne.mockResolvedValue(mockClient);
  technicianRepository.findOne.mockResolvedValue(mockTechnician);
  infrastructureService.getClientInfrastructure.mockRejectedValue(
    new ServiceUnavailableException('InfraDoc no disponible'),
  );

  await expect(service.create(createDto)).rejects.toThrow(ServiceUnavailableException);
  expect(odooService.createTicket).not.toHaveBeenCalled();
});
```

- [ ] **Step 5: Correr los tests — verificar que FALLAN**

```bash
cd backend && npx jest tasks.service.spec.ts --no-coverage
```

Esperado: errores de compilación TypeScript o fallos porque `InfrastructureService` no está inyectado aún.

- [ ] **Step 6: Exportar `InfrastructureService` en `infradoc-integration.module.ts`**

Reemplazar el archivo completo:

```typescript
import * as https from 'https';
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ClientsModule } from '../../clients/clients.module';
import { InfradocAssetsService } from './infradoc-assets.service';
import { InfrastructureController } from './infrastructure.controller';
import { InfrastructureService } from './infrastructure.service';

@Module({
  imports: [
    HttpModule.register({
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    }),
    ClientsModule,
  ],
  controllers: [InfrastructureController],
  providers: [InfrastructureService, InfradocAssetsService],
  exports: [InfrastructureService],
})
export class InfradocIntegrationModule {}
```

- [ ] **Step 7: Importar `InfradocIntegrationModule` en `tasks.module.ts`**

Reemplazar el archivo completo:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ClientsModule } from '../clients/clients.module';
import { TechniciansModule } from '../technicians/technicians.module';
import { MaintenanceLog } from '../maintenance-logs/maintenance-log.entity';
import { OdooIntegrationModule } from '../integrations/odoo/odoo-integration.module';
import { InfradocIntegrationModule } from '../integrations/infradoc/infradoc-integration.module';
import { Task } from './task.entity';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, MaintenanceLog]),
    ClientsModule,
    TechniciansModule,
    OdooIntegrationModule,
    InfradocIntegrationModule,
  ],
  controllers: [TasksController],
  providers: [TasksService, JwtAuthGuard, RolesGuard],
  exports: [TasksService],
})
export class TasksModule {}
```

- [ ] **Step 8: Implementar la validación en `tasks.service.ts`**

Agregar al bloque de imports existente:

```typescript
import { InfrastructureService } from '../integrations/infradoc/infrastructure.service';
import { ClientInfrastructureDto } from '../integrations/infradoc/dto/client-infrastructure.dto';
import { TaskType } from './task-type.enum';
```

Agregar la constante de mensajes ANTES de la clase (después de `VALID_TRANSITIONS`):

```typescript
const INFRA_ERROR_MESSAGES: Partial<Record<TaskType, string>> = {
  [TaskType.SERVER_HOST_MAINTENANCE]:    'El cliente no tiene servidores ESXi/BMC registrados en InfraDoc',
  [TaskType.WINDOWS_DOMAIN_MAINTENANCE]: 'El cliente no tiene VMs Windows ni controladores de dominio en InfraDoc',
  [TaskType.ROUTER_MAINTENANCE]:         'El cliente no tiene routers/firewalls registrados en InfraDoc',
  [TaskType.QNAP_MAINTENANCE]:           'El cliente no tiene dispositivos NAS/QNAP registrados en InfraDoc',
  [TaskType.VEEAM_BACKUP]:               'El cliente no tiene dispositivos NAS/QNAP registrados en InfraDoc (requerido para Veeam)',
};
```

Dentro de la clase, agregar la propiedad privada ANTES del constructor:

```typescript
private readonly INFRA_REQUIREMENTS: Partial<Record<TaskType, (i: ClientInfrastructureDto) => boolean>> = {
  [TaskType.SERVER_HOST_MAINTENANCE]:    (i) => i.esxiHosts.length > 0,
  [TaskType.WINDOWS_DOMAIN_MAINTENANCE]: (i) => i.windowsVMs.length > 0 || i.domainControllers.length > 0,
  [TaskType.ROUTER_MAINTENANCE]:         (i) => i.routers.length > 0,
  [TaskType.QNAP_MAINTENANCE]:           (i) => i.nas.length > 0,
  [TaskType.VEEAM_BACKUP]:               (i) => i.nas.length > 0,
};
```

Actualizar el constructor para inyectar `InfrastructureService`:

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
  private readonly infrastructureService: InfrastructureService,
) {}
```

Actualizar el método `create()` para agregar la llamada de validación antes de Odoo:

```typescript
async create(dto: CreateTaskDto): Promise<Task> {
  const client = await this.clientRepository.findOne({
    where: { id: dto.clientId },
  });
  if (!client) throw new NotFoundException('Cliente no encontrado');

  const technician = await this.technicianRepository.findOne({
    where: { id: dto.technicianId },
  });
  if (!technician) throw new NotFoundException('Técnico no encontrado');

  await this.validateInfrastructure(dto.clientId, dto.type);

  const odooTicketId = await this.odooService.createTicket(
    dto.clientId,
    dto.technicianId,
    dto.type,
  );

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

Agregar el método privado ANTES de `loadTask`:

```typescript
private async validateInfrastructure(clientId: string, type: TaskType): Promise<void> {
  const predicate = this.INFRA_REQUIREMENTS[type];
  if (!predicate) return;

  const infra = await this.infrastructureService.getClientInfrastructure(clientId);
  if (!predicate(infra)) {
    throw new BadRequestException(INFRA_ERROR_MESSAGES[type]);
  }
}
```

- [ ] **Step 9: Correr los tests — verificar que todos pasan**

```bash
cd backend && npx jest tasks.service.spec.ts --no-coverage
```

Esperado: todos los tests PASS.

- [ ] **Step 10: Commit**

```bash
git add backend/src/integrations/infradoc/infradoc-integration.module.ts backend/src/tasks/tasks.module.ts backend/src/tasks/tasks.service.ts backend/src/tasks/tasks.service.spec.ts
git commit -m "feat(tasks): validar infraestructura de cliente antes de crear tarea"
```

---

### Task 2: Frontend — Filtrado de tipos en el dialog

**Files:**
- Modify: `frontend/src/app/features/admin/tasks/task-create-dialog/task-create-dialog.component.ts`
- Modify: `frontend/src/app/features/admin/tasks/task-create-dialog/task-create-dialog.component.html`
- Modify: `frontend/src/app/features/admin/tasks/task-create-dialog/task-create-dialog.component.spec.ts`

**Interfaces:**
- Consumes: `InfradocService.getClientInfrastructure(clientId: string): Observable<ClientInfrastructure>` — ya existe en `frontend/src/app/core/services/infradoc.service.ts`
- Consumes: `ClientInfrastructure` — ya existe en `frontend/src/app/core/models/infradoc.models.ts`
- Produces: getter `availableTaskTypes(): { value: TaskType; label: string }[]` filtra según `this.infra`; propiedades `infra`, `loadingInfra`, `infraError`

---

- [ ] **Step 1: Agregar imports y helpers al spec**

En `frontend/src/app/features/admin/tasks/task-create-dialog/task-create-dialog.component.spec.ts`, agregar a los imports existentes:

```typescript
import { throwError } from 'rxjs';
import { InfradocService } from '../../../../core/services/infradoc.service';
import { ClientInfrastructure } from '../../../../core/models/infradoc.models';
```

Antes del `describe`, agregar las constantes helper:

```typescript
const emptyInfra: ClientInfrastructure = {
  esxiHosts: [], windowsVMs: [], domainControllers: [], linuxVMs: [], nas: [], routers: [],
};

const infraRoutersOnly: ClientInfrastructure = {
  ...emptyInfra,
  routers: [{ assetId: 1, name: 'FW-01', ip: '10.0.0.1', bmcIp: null, bmcType: null, os: null, model: null, uri1: null, uri2: null }],
};

const infraNasOnly: ClientInfrastructure = {
  ...emptyInfra,
  nas: [{ assetId: 2, name: 'NAS-01', ip: '192.168.1.50', bmcIp: null, bmcType: null, os: null, model: null, uri1: null, uri2: null }],
};
```

Dentro del `describe`, declarar el spy junto a los otros:

```typescript
let infradocServiceSpy: jasmine.SpyObj<InfradocService>;
```

- [ ] **Step 2: Registrar `InfradocService` en el `beforeEach` del spec**

En el `beforeEach`, agregar después de crear los spies existentes:

```typescript
infradocServiceSpy = jasmine.createSpyObj('InfradocService', ['getClientInfrastructure']);
```

En `TestBed.configureTestingModule`, agregar al array `providers`:

```typescript
{ provide: InfradocService, useValue: infradocServiceSpy },
```

- [ ] **Step 3: Escribir los nuevos tests**

Agregar al final del `describe('TaskCreateDialogComponent')`, antes del cierre `}`:

```typescript
describe('filtrado por infraestructura', () => {
  it('muestra todos los tipos cuando no hay cliente seleccionado', () => {
    expect(component.availableTaskTypes.length).toBe(component.taskTypes.length);
  });

  it('filtra tipos cuando el cliente solo tiene routers', async () => {
    infradocServiceSpy.getClientInfrastructure.and.returnValue(of(infraRoutersOnly));

    component.form.get('clientId')!.setValue('c1');
    await fixture.whenStable();

    const available = component.availableTaskTypes.map(t => t.value);
    expect(available).toContain('ROUTER_MAINTENANCE');
    expect(available).not.toContain('SERVER_HOST_MAINTENANCE');
    expect(available).not.toContain('WINDOWS_DOMAIN_MAINTENANCE');
    expect(available).not.toContain('QNAP_MAINTENANCE');
    expect(available).not.toContain('VEEAM_BACKUP');
    expect(available).toContain('SITE_VISIT');
    expect(available).toContain('TERMINAL_MAINTENANCE');
  });

  it('incluye QNAP_MAINTENANCE y VEEAM_BACKUP cuando el cliente tiene NAS', async () => {
    infradocServiceSpy.getClientInfrastructure.and.returnValue(of(infraNasOnly));

    component.form.get('clientId')!.setValue('c1');
    await fixture.whenStable();

    const available = component.availableTaskTypes.map(t => t.value);
    expect(available).toContain('QNAP_MAINTENANCE');
    expect(available).toContain('VEEAM_BACKUP');
  });

  it('resetea el campo type si el tipo actual no está disponible para el cliente', async () => {
    component.form.get('type')!.setValue('SERVER_HOST_MAINTENANCE');
    infradocServiceSpy.getClientInfrastructure.and.returnValue(of(infraRoutersOnly));

    component.form.get('clientId')!.setValue('c1');
    await fixture.whenStable();

    expect(component.form.get('type')!.value).toBeNull();
  });

  it('muestra error y deshabilita el botón cuando InfraDoc falla', async () => {
    infradocServiceSpy.getClientInfrastructure.and.returnValue(
      throwError(() => new Error('Network error')),
    );

    component.form.get('clientId')!.setValue('c1');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.infraError).toBeTruthy();
    const button = fixture.nativeElement.querySelector('button[color="primary"]');
    expect(button.disabled).toBeTrue();
  });

  it('resetea el error y carga la infra al cambiar de cliente', async () => {
    infradocServiceSpy.getClientInfrastructure.and.returnValue(
      throwError(() => new Error('error')),
    );
    component.form.get('clientId')!.setValue('c1');
    await fixture.whenStable();
    expect(component.infraError).toBeTruthy();

    infradocServiceSpy.getClientInfrastructure.and.returnValue(of(infraRoutersOnly));
    component.form.get('clientId')!.setValue('c2');
    await fixture.whenStable();

    expect(component.infraError).toBe('');
    expect(component.infra).toEqual(infraRoutersOnly);
  });
});
```

- [ ] **Step 4: Correr los tests — verificar que FALLAN**

```bash
cd frontend && npx ng test --include="**/task-create-dialog.component.spec.ts" --watch=false
```

Esperado: errores de compilación porque `availableTaskTypes` e `infraError` no existen aún.

- [ ] **Step 5: Implementar los cambios en `task-create-dialog.component.ts`**

Reemplazar el archivo completo:

```typescript
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { forkJoin, Subscription } from 'rxjs';
import { Client } from '../../../../core/models/client.models';
import { Technician } from '../../../../core/models/technician.models';
import { TaskType } from '../../../../core/models/task.models';
import { ClientInfrastructure } from '../../../../core/models/infradoc.models';
import { ClientsService } from '../../../../core/services/clients.service';
import { TechniciansService } from '../../../../core/services/technicians.service';
import { TasksService } from '../../../../core/services/tasks.service';
import { InfradocService } from '../../../../core/services/infradoc.service';

@Component({
  selector: 'app-task-create-dialog',
  templateUrl: './task-create-dialog.component.html',
  styleUrls: ['./task-create-dialog.component.scss'],
})
export class TaskCreateDialogComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  clients: Client[] = [];
  technicians: Technician[] = [];
  loading = false;
  saving = false;
  error = '';

  infra: ClientInfrastructure | null = null;
  loadingInfra = false;
  infraError = '';

  private clientSub?: Subscription;

  private readonly REQUIRES_INFRA: Partial<Record<TaskType, (i: ClientInfrastructure) => boolean>> = {
    SERVER_HOST_MAINTENANCE:    (i) => i.esxiHosts.length > 0,
    WINDOWS_DOMAIN_MAINTENANCE: (i) => i.windowsVMs.length > 0 || i.domainControllers.length > 0,
    ROUTER_MAINTENANCE:         (i) => i.routers.length > 0,
    QNAP_MAINTENANCE:           (i) => i.nas.length > 0,
    VEEAM_BACKUP:               (i) => i.nas.length > 0,
  };

  readonly taskTypes: { value: TaskType; label: string }[] = [
    { value: 'WINDOWS_DOMAIN_MAINTENANCE', label: 'Windows / Dominio'          },
    { value: 'SERVER_HOST_MAINTENANCE',    label: 'VMware / BMC'               },
    { value: 'ROUTER_MAINTENANCE',         label: 'Router / Firewall'          },
    { value: 'QNAP_MAINTENANCE',           label: 'Mantenimiento QNAP/NAS'     },
    { value: 'VEEAM_BACKUP',               label: 'Mantenimiento Veeam Backup' },
    { value: 'TERMINAL_MAINTENANCE',       label: 'Visita de terminales'        },
    { value: 'SITE_VISIT',                label: 'Visita presencial'           },
    { value: 'AV_CONTROL',               label: 'Control antivirus'           },
    { value: 'UPS_CONTROL',              label: 'Control UPS'                 },
    { value: 'ENDPOINT_INVENTORY',        label: 'Inventario de endpoints'     },
  ];

  get availableTaskTypes(): { value: TaskType; label: string }[] {
    if (!this.infra) return this.taskTypes;
    return this.taskTypes.filter(({ value }) => {
      const predicate = this.REQUIRES_INFRA[value];
      return !predicate || predicate(this.infra!);
    });
  }

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<TaskCreateDialogComponent>,
    private clientsService: ClientsService,
    private techniciansService: TechniciansService,
    private tasksService: TasksService,
    private infradocService: InfradocService,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      clientId:      ['', Validators.required],
      technicianId:  ['', Validators.required],
      type:          ['WINDOWS_DOMAIN_MAINTENANCE', Validators.required],
      scheduledDate: ['', Validators.required],
    });

    this.clientSub = this.form.get('clientId')!.valueChanges.subscribe(clientId => {
      this.infra = null;
      this.infraError = '';
      if (!clientId) return;

      this.loadingInfra = true;
      this.form.get('type')!.disable();
      this.infradocService.getClientInfrastructure(clientId).subscribe({
        next: (infra) => {
          this.infra = infra;
          this.loadingInfra = false;
          this.form.get('type')!.enable();
          const currentType = this.form.get('type')!.value as TaskType;
          if (currentType && !this.availableTaskTypes.find(t => t.value === currentType)) {
            this.form.get('type')!.reset();
          }
        },
        error: () => {
          this.infraError = 'No se pudo verificar la infraestructura. Reintentá.';
          this.loadingInfra = false;
          this.form.get('type')!.enable();
        },
      });
    });

    this.loading = true;
    forkJoin({
      clients:     this.clientsService.getAll(),
      technicians: this.techniciansService.getAll(),
    }).subscribe({
      next: ({ clients, technicians }) => {
        this.clients     = clients.filter(c => c.isActive);
        this.technicians = technicians.filter(t => t.user.isActive);
        this.loading = false;
      },
      error: () => { this.error = 'No se pudieron cargar los datos.'; this.loading = false; },
    });
  }

  ngOnDestroy(): void {
    this.clientSub?.unsubscribe();
  }

  confirm(): void {
    if (this.form.invalid || this.saving) return;
    this.saving = true;
    this.error = '';

    const { clientId, technicianId, type, scheduledDate } = this.form.getRawValue();
    const dateStr = scheduledDate instanceof Date
      ? scheduledDate.toISOString().split('T')[0]
      : scheduledDate;

    this.tasksService.create({ clientId, technicianId, type, scheduledDate: dateStr }).subscribe({
      next: task => this.dialogRef.close(task),
      error: () => { this.error = 'No se pudo crear la tarea.'; this.saving = false; },
    });
  }

  cancel(): void { this.dialogRef.close(null); }
}
```

**Nota:** `getRawValue()` en `confirm()` incluye controles deshabilitados — necesario para que `type` no quede como `undefined` si el control fue temporalmente deshabilitado durante la carga.

- [ ] **Step 6: Actualizar el template `task-create-dialog.component.html`**

Reemplazar el archivo completo:

```html
<h2 mat-dialog-title>Nueva tarea</h2>

<mat-dialog-content>

  <div *ngIf="loading" style="color:var(--tx-lo);font-size:12px;padding:8px 0">
    Cargando...
  </div>

  <form *ngIf="!loading" [formGroup]="form" class="dialog-form">

    <mat-form-field appearance="outline" subscriptSizing="dynamic">
      <mat-label>Cliente</mat-label>
      <mat-select formControlName="clientId">
        <mat-option value="">Seleccioná un cliente...</mat-option>
        <mat-option *ngFor="let c of clients" [value]="c.id">{{ c.name }}</mat-option>
      </mat-select>
    </mat-form-field>

    <div *ngIf="loadingInfra" style="color:var(--tx-lo);font-size:12px;padding:2px 0 6px">
      Verificando infraestructura...
    </div>
    <div *ngIf="infraError" class="error-banner" style="margin-bottom:8px">{{ infraError }}</div>

    <mat-form-field appearance="outline" subscriptSizing="dynamic">
      <mat-label>Técnico</mat-label>
      <mat-select formControlName="technicianId">
        <mat-option value="">Seleccioná un técnico...</mat-option>
        <mat-option *ngFor="let t of technicians" [value]="t.id">{{ t.user.name }}</mat-option>
      </mat-select>
    </mat-form-field>

    <mat-form-field appearance="outline" subscriptSizing="dynamic">
      <mat-label>Tipo de tarea</mat-label>
      <mat-select formControlName="type">
        <mat-option *ngFor="let t of availableTaskTypes" [value]="t.value">{{ t.label }}</mat-option>
      </mat-select>
    </mat-form-field>

    <mat-form-field appearance="outline" subscriptSizing="dynamic">
      <mat-label>Fecha programada</mat-label>
      <input matInput [matDatepicker]="picker" formControlName="scheduledDate" />
      <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
      <mat-datepicker #picker></mat-datepicker>
    </mat-form-field>

  </form>

  <div *ngIf="error" class="error-banner" style="margin-top:4px">{{ error }}</div>

</mat-dialog-content>

<mat-dialog-actions align="end">
  <button mat-button (click)="cancel()">Cancelar</button>
  <button mat-flat-button color="primary"
          [disabled]="!form || form.invalid || saving || loadingInfra || !!infraError"
          (click)="confirm()">
    <mat-spinner *ngIf="saving" diameter="16" style="display:inline-block;margin-right:6px"></mat-spinner>
    {{ saving ? 'Creando...' : 'Crear tarea' }}
  </button>
</mat-dialog-actions>
```

- [ ] **Step 7: Correr los tests — verificar que todos pasan**

```bash
cd frontend && npx ng test --include="**/task-create-dialog.component.spec.ts" --watch=false
```

Esperado: todos los tests PASS (existentes + nuevos).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/features/admin/tasks/task-create-dialog/task-create-dialog.component.ts frontend/src/app/features/admin/tasks/task-create-dialog/task-create-dialog.component.html frontend/src/app/features/admin/tasks/task-create-dialog/task-create-dialog.component.spec.ts
git commit -m "feat(tasks): filtrar tipos de tarea según infraestructura del cliente en el dialog"
```
