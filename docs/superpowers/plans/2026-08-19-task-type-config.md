# Task Type Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar tiempo libre y tags hardcodeados por una tabla de configuración por tipo de tarea, editable desde el panel Admin.

**Architecture:** Nueva tabla `task_type_config` (PK = TaskType enum) almacena `defaultTimeMinutes` y arrays paralelos de `odooTagIds`/`odooTagNames`. `OdooService.createTicket()` lee tags de DB en lugar de 6 métodos hardcodeados. El drawer del técnico consulta la config antes de permitir cerrar una tarea; el técnico solo ve y confirma el tiempo, sin ingresarlo manualmente.

**Tech Stack:** NestJS + TypeORM + PostgreSQL (backend); Angular + Angular Material (frontend); Jest (tests backend); Angular Testing Library / TestBed (tests frontend).

**Spec:** `docs/superpowers/specs/2026-08-19-task-type-config-design.md`

## Global Constraints

- Sin standalone components Angular — todos en módulos NgModule declarados.
- `mat-form-field` solo con `appearance="outline"`.
- Sin `any` en TypeScript salvo casos justificados.
- TDD: test antes que implementación en cada tarea.
- Un archivo a la vez — no generar múltiples archivos en el mismo paso sin confirmación.
- Sin elementos HTML nativos en formularios Angular (`<input>`, `<select>`, `<button>` sueltos prohibidos).
- Idioma del código: inglés; commits y comentarios: español cuando existan.
- `synchronize: false` en TypeORM — todos los cambios de schema vía migraciones.

---

## Task 1: Entidad y migración `task_type_config`

**Files:**
- Create: `backend/src/task-config/task-type-config.entity.ts`
- Create: `backend/src/migrations/1787200000000-CreateTaskTypeConfig.ts`

**Interfaces:**
- Produces: `TaskTypeConfig` entity — usada por Task 2 (servicio) y Task 3 (OdooService).

- [ ] **Step 1: Crear la entidad**

Crear `backend/src/task-config/task-type-config.entity.ts`:

```typescript
import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { TaskType } from '../tasks/task-type.enum';

@Entity('task_type_config')
export class TaskTypeConfig {
  @PrimaryColumn({ type: 'enum', enum: TaskType, name: 'task_type' })
  taskType: TaskType;

  @Column({ name: 'default_time_minutes', type: 'int', nullable: true, default: null })
  defaultTimeMinutes: number | null;

  @Column({ name: 'odoo_tag_ids', type: 'int', array: true, default: [] })
  odooTagIds: number[];

  @Column({ name: 'odoo_tag_names', type: 'text', array: true, default: [] })
  odooTagNames: string[];

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

- [ ] **Step 2: Crear la migración**

Crear `backend/src/migrations/1787200000000-CreateTaskTypeConfig.ts`:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTaskTypeConfig1787200000000 implements MigrationInterface {
  name = 'CreateTaskTypeConfig1787200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "task_type_config" (
        "task_type"             "public"."tasks_type_enum"  NOT NULL,
        "default_time_minutes"  integer,
        "odoo_tag_ids"          integer[]  NOT NULL DEFAULT '{}',
        "odoo_tag_names"        text[]     NOT NULL DEFAULT '{}',
        "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_task_type_config" PRIMARY KEY ("task_type")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "task_type_config"`);
  }
}
```

- [ ] **Step 3: Ejecutar la migración**

```bash
cd backend && npm run migration:run
```

Verificar que la tabla existe:

```bash
cd backend && npx ts-node -e "
const { Client } = require('pg');
const c = new Client({ host: process.env.DB_HOST || 'localhost', user: process.env.DB_USER || 'postgres', password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME || 'infraops' });
c.connect().then(() => c.query(\"SELECT column_name FROM information_schema.columns WHERE table_name='task_type_config'\")).then(r => { console.log(r.rows); c.end(); });
"
```

Esperar columnas: `task_type`, `default_time_minutes`, `odoo_tag_ids`, `odoo_tag_names`, `updated_at`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/task-config/task-type-config.entity.ts backend/src/migrations/1787200000000-CreateTaskTypeConfig.ts
git commit -m "feat(task-config): entidad TaskTypeConfig y migración"
```

---

## Task 2: Backend — TaskConfigModule (servicio, controlador, DTOs, tests)

**Files:**
- Create: `backend/src/task-config/dto/update-task-config.dto.ts`
- Create: `backend/src/task-config/task-config.service.ts`
- Create: `backend/src/task-config/task-config.controller.ts`
- Create: `backend/src/task-config/task-config.controller.spec.ts`
- Create: `backend/src/task-config/task-config.module.ts`

**Interfaces:**
- Consumes: `TaskTypeConfig` entity (Task 1), `TaskType` enum.
- Produces:
  - `TaskConfigService.findAll(): Promise<TaskTypeConfig[]>` — devuelve los 10 tipos, rellenando sin fila con defaults.
  - `TaskConfigService.findOne(taskType: TaskType): Promise<TaskTypeConfig | null>`
  - `TaskConfigService.upsert(taskType: TaskType, dto: UpdateTaskConfigDto): Promise<TaskTypeConfig>`
  - `GET /task-config` → `TaskTypeConfig[]`
  - `PATCH /task-config/:taskType` → `TaskTypeConfig`
  - `TaskConfigModule` que exporta `TaskConfigService` — usado por Tasks 3 y 4.

- [ ] **Step 1: Escribir el test que falla**

Crear `backend/src/task-config/task-config.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TaskConfigController } from './task-config.controller';
import { TaskConfigService } from './task-config.service';
import { TaskTypeConfig } from './task-type-config.entity';
import { TaskType } from '../tasks/task-type.enum';
import { ForbiddenException } from '@nestjs/common';

const mockRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
};

describe('TaskConfigController', () => {
  let controller: TaskConfigController;
  let service: TaskConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskConfigController],
      providers: [
        TaskConfigService,
        { provide: getRepositoryToken(TaskTypeConfig), useValue: mockRepo },
      ],
    }).compile();

    controller = module.get(TaskConfigController);
    service = module.get(TaskConfigService);
    jest.clearAllMocks();
  });

  describe('GET /task-config', () => {
    it('devuelve los 10 tipos de tarea con defaults para los que no tienen fila', async () => {
      mockRepo.find.mockResolvedValue([]);
      const result = await controller.findAll();
      expect(result).toHaveLength(10);
      expect(result[0].defaultTimeMinutes).toBeNull();
      expect(result[0].odooTagIds).toEqual([]);
    });

    it('combina filas de DB con defaults para tipos faltantes', async () => {
      const existing: Partial<TaskTypeConfig> = {
        taskType: TaskType.SERVER_HOST_MAINTENANCE,
        defaultTimeMinutes: 90,
        odooTagIds: [1, 2],
        odooTagNames: ['Tag A', 'Tag B'],
        updatedAt: new Date(),
      };
      mockRepo.find.mockResolvedValue([existing]);
      const result = await controller.findAll();
      expect(result).toHaveLength(10);
      const srv = result.find(r => r.taskType === TaskType.SERVER_HOST_MAINTENANCE)!;
      expect(srv.defaultTimeMinutes).toBe(90);
      expect(srv.odooTagIds).toEqual([1, 2]);
    });
  });

  describe('PATCH /task-config/:taskType', () => {
    it('hace upsert y devuelve la config actualizada', async () => {
      const updated: Partial<TaskTypeConfig> = {
        taskType: TaskType.QNAP_MAINTENANCE,
        defaultTimeMinutes: 45,
        odooTagIds: [5],
        odooTagNames: ['Backups (NAS)'],
        updatedAt: new Date(),
      };
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.save.mockResolvedValue(updated);
      const result = await controller.update(TaskType.QNAP_MAINTENANCE, {
        defaultTimeMinutes: 45,
        odooTagIds: [5],
        odooTagNames: ['Backups (NAS)'],
      });
      expect(result.defaultTimeMinutes).toBe(45);
    });

    it('retorna 400 con taskType inválido', async () => {
      await expect(
        controller.update('INVALID_TYPE' as TaskType, { defaultTimeMinutes: 30 })
      ).rejects.toThrow();
    });
  });
});
```

- [ ] **Step 2: Ejecutar el test — verificar que falla**

```bash
cd backend && npx jest task-config.controller.spec --no-coverage 2>&1 | tail -20
```

Esperar: fallo por módulos no encontrados.

- [ ] **Step 3: Crear el DTO**

Crear `backend/src/task-config/dto/update-task-config.dto.ts`:

```typescript
import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateTaskConfigDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  defaultTimeMinutes?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  odooTagIds?: number[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  odooTagNames?: string[];
}
```

- [ ] **Step 4: Crear el servicio**

Crear `backend/src/task-config/task-config.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskType } from '../tasks/task-type.enum';
import { TaskTypeConfig } from './task-type-config.entity';
import { UpdateTaskConfigDto } from './dto/update-task-config.dto';

const ALL_TASK_TYPES = Object.values(TaskType);

@Injectable()
export class TaskConfigService {
  constructor(
    @InjectRepository(TaskTypeConfig)
    private readonly repo: Repository<TaskTypeConfig>,
  ) {}

  async findAll(): Promise<TaskTypeConfig[]> {
    const rows = await this.repo.find();
    const byType = new Map(rows.map(r => [r.taskType, r]));
    return ALL_TASK_TYPES.map(taskType =>
      byType.get(taskType) ?? this.defaultConfig(taskType),
    );
  }

  async findOne(taskType: TaskType): Promise<TaskTypeConfig | null> {
    return this.repo.findOne({ where: { taskType } });
  }

  async upsert(taskType: TaskType, dto: UpdateTaskConfigDto): Promise<TaskTypeConfig> {
    const existing = (await this.repo.findOne({ where: { taskType } }))
      ?? this.defaultConfig(taskType);
    if (dto.defaultTimeMinutes !== undefined) existing.defaultTimeMinutes = dto.defaultTimeMinutes;
    if (dto.odooTagIds !== undefined)         existing.odooTagIds         = dto.odooTagIds;
    if (dto.odooTagNames !== undefined)       existing.odooTagNames       = dto.odooTagNames;
    return this.repo.save(existing);
  }

  private defaultConfig(taskType: TaskType): TaskTypeConfig {
    const config = new TaskTypeConfig();
    config.taskType          = taskType;
    config.defaultTimeMinutes = null;
    config.odooTagIds         = [];
    config.odooTagNames       = [];
    return config;
  }
}
```

- [ ] **Step 5: Crear el controlador**

Crear `backend/src/task-config/task-config.controller.ts`:

```typescript
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user-role.enum';
import { TaskType } from '../tasks/task-type.enum';
import { TaskConfigService } from './task-config.service';
import { TaskTypeConfig } from './task-type-config.entity';
import { UpdateTaskConfigDto } from './dto/update-task-config.dto';

const VALID_TASK_TYPES = new Set<string>(Object.values(TaskType));

@Controller('task-config')
@UseGuards(JwtAuthGuard)
export class TaskConfigController {
  constructor(private readonly taskConfigService: TaskConfigService) {}

  @Get()
  findAll(): Promise<TaskTypeConfig[]> {
    return this.taskConfigService.findAll();
  }

  @Patch(':taskType')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  update(
    @Param('taskType') taskType: string,
    @Body() dto: UpdateTaskConfigDto,
  ): Promise<TaskTypeConfig> {
    if (!VALID_TASK_TYPES.has(taskType)) {
      throw new BadRequestException(`Tipo de tarea inválido: ${taskType}`);
    }
    return this.taskConfigService.upsert(taskType as TaskType, dto);
  }
}
```

- [ ] **Step 6: Crear el módulo**

Crear `backend/src/task-config/task-config.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskTypeConfig } from './task-type-config.entity';
import { TaskConfigService } from './task-config.service';
import { TaskConfigController } from './task-config.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TaskTypeConfig])],
  controllers: [TaskConfigController],
  providers: [TaskConfigService],
  exports: [TaskConfigService],
})
export class TaskConfigModule {}
```

- [ ] **Step 7: Ejecutar los tests — verificar que pasan**

```bash
cd backend && npx jest task-config.controller.spec --no-coverage 2>&1 | tail -20
```

Esperar: todos en verde.

- [ ] **Step 8: Commit**

```bash
git add backend/src/task-config/
git commit -m "feat(task-config): módulo backend con CRUD de configuración por tipo de tarea"
```

---

## Task 3: Refactor OdooService — eliminar hardcoding, agregar getHelpdeskTags

**Files:**
- Modify: `backend/src/integrations/odoo/odoo.service.ts`
- Modify: `backend/src/integrations/odoo/odoo.controller.ts`
- Modify: `backend/src/integrations/odoo/odoo.service.spec.ts`

**Interfaces:**
- Consumes: `TaskConfigService.findOne(taskType)` (Task 2).
- Produces:
  - `OdooService.getHelpdeskTags(): Promise<{ id: number; name: string }[]>`
  - `GET /admin/odoo/helpdesk-tags` — usado por frontend Task 7.

- [ ] **Step 1: Actualizar el spec del OdooService**

Abrir `backend/src/integrations/odoo/odoo.service.spec.ts` y agregar/actualizar estos tests (mantener los existentes que no tocan la lógica de tags):

```typescript
// Agregar en el describe existente o crear uno nuevo:
describe('createTicket - tags desde DB', () => {
  it('asigna tag_ids desde la config de DB cuando están configurados', async () => {
    // mock taskConfigService.findOne devuelve config con tags
    taskConfigServiceMock.findOne.mockResolvedValue({
      odooTagIds: [42, 43],
      odooTagNames: ['Tag A', 'Tag B'],
    });
    // ... (setup de partnerId, userId, saleLineId como en tests existentes)
    // verificar que el payload enviado a callKw incluye tag_ids: [[6, 0, [42, 43]]]
  });

  it('no agrega tag_ids si la config no tiene tags', async () => {
    taskConfigServiceMock.findOne.mockResolvedValue({
      odooTagIds: [],
      odooTagNames: [],
    });
    // verificar que el payload NO incluye tag_ids
  });

  it('no agrega tag_ids si no hay config para el tipo', async () => {
    taskConfigServiceMock.findOne.mockResolvedValue(null);
    // verificar que el payload NO incluye tag_ids
  });
});

describe('getHelpdeskTags', () => {
  it('devuelve lista de tags desde Odoo ordenada por nombre', async () => {
    systemRpcMock.callKw.mockResolvedValue([
      { id: 2, name: 'Backups (NAS)' },
      { id: 1, name: 'Gestión de servidores' },
    ]);
    const result = await service.getHelpdeskTags();
    expect(result).toEqual([
      { id: 2, name: 'Backups (NAS)' },
      { id: 1, name: 'Gestión de servidores' },
    ]);
  });
});
```

- [ ] **Step 2: Ejecutar los tests nuevos — verificar que fallan**

```bash
cd backend && npx jest odoo.service.spec --no-coverage 2>&1 | tail -20
```

- [ ] **Step 3: Modificar OdooService**

En `backend/src/integrations/odoo/odoo.service.ts`:

**a) Inyectar TaskConfigService** — agregar al constructor:

```typescript
constructor(
  private readonly systemRpc: OdooSystemRpcService,
  private readonly configService: ConfigService,
  private readonly taskConfigService: TaskConfigService,   // ← nuevo
  @InjectRepository(Client) private readonly clientRepo: Repository<Client>,
  @InjectRepository(User)   private readonly userRepo:   Repository<User>,
  @InjectRepository(Technician) private readonly technicianRepo: Repository<Technician>,
) {}
```

Agregar import: `import { TaskConfigService } from '../../task-config/task-config.service';`

**b) Eliminar** las 6 propiedades de caché y los 6 métodos privados:
- Propiedades: `qnapTagId`, `windowsAdDomainTagId`, `windowsServerTagId`, `virtualizationTagId`, `serverManagementTagId`, `routerFirewallTagId`
- Métodos: `resolveQnapTagId()`, `resolveWindowsAdDomainTagId()`, `resolveWindowsServerTagId()`, `resolveVirtualizationTagId()`, `resolveServerManagementTagId()`, `resolveRouterFirewallTagId()`

**c) Reemplazar los bloques `if` de tags en `createTicket()`** — las líneas 689-711 actuales — por:

```typescript
const config = await this.taskConfigService.findOne(taskType);
if (config && config.odooTagIds.length > 0) {
  payload['tag_ids'] = [[6, 0, config.odooTagIds]];
}
```

**d) Agregar `getHelpdeskTags()`** antes del método `closeTicket`:

```typescript
async getHelpdeskTags(): Promise<{ id: number; name: string }[]> {
  const tags = await this.systemRpc.callKw<Array<{ id: number; name: string }>>(
    'helpdesk.tag',
    'search_read',
    [[]],
    { fields: ['id', 'name'] },
  );
  return tags.map(t => ({ id: t.id, name: t.name }));
}
```

- [ ] **Step 4: Agregar endpoint en OdooController**

En `backend/src/integrations/odoo/odoo.controller.ts`, agregar:

```typescript
@Get('helpdesk-tags')
getHelpdeskTags(): Promise<{ id: number; name: string }[]> {
  return this.odooService.getHelpdeskTags();
}
```

El controlador ya tiene `@UseGuards(JwtAuthGuard, RolesGuard)` y `@Roles(UserRole.ADMIN)` a nivel de clase, así que este endpoint hereda esas guardias.

- [ ] **Step 5: Ejecutar los tests — verificar que pasan**

```bash
cd backend && npx jest odoo.service.spec --no-coverage 2>&1 | tail -20
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/integrations/odoo/odoo.service.ts backend/src/integrations/odoo/odoo.controller.ts backend/src/integrations/odoo/odoo.service.spec.ts
git commit -m "refactor(odoo): eliminar tags hardcodeados, leer configuración desde DB"
```

---

## Task 4: Wiring backend — AppModule + OdooIntegrationModule

**Files:**
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/integrations/odoo/odoo-integration.module.ts`

**Interfaces:**
- Consumes: `TaskConfigModule` (Task 2).
- Produces: servidor levanta sin errores de inyección; `GET /api/task-config` responde 200.

- [ ] **Step 1: Importar TaskConfigModule en AppModule**

En `backend/src/app.module.ts`, agregar:

```typescript
import { TaskConfigModule } from './task-config/task-config.module';
// ...
@Module({
  imports: [
    // ... (existentes)
    TaskConfigModule,  // ← agregar
  ],
})
```

- [ ] **Step 2: Importar TaskConfigModule en OdooIntegrationModule**

En `backend/src/integrations/odoo/odoo-integration.module.ts`:

```typescript
import { TaskConfigModule } from '../../task-config/task-config.module';

@Module({
  imports: [ClientsModule, UsersModule, TechniciansModule, TaskConfigModule],  // ← agregar TaskConfigModule
  controllers: [OdooController, SubscriptionHoursController],
  providers: [OdooSystemRpcService, OdooService],
  exports: [OdooService],
})
```

- [ ] **Step 3: Verificar que el servidor levanta**

```bash
cd backend && npm run build 2>&1 | tail -20
```

Esperar: compilación sin errores.

- [ ] **Step 4: Commit**

```bash
git add backend/src/app.module.ts backend/src/integrations/odoo/odoo-integration.module.ts
git commit -m "feat(task-config): wiring de TaskConfigModule en AppModule y OdooIntegrationModule"
```

---

## Task 5: Frontend — modelo TaskTypeConfigDto y TaskConfigService

**Files:**
- Modify: `frontend/src/app/core/models/task.models.ts`
- Create: `frontend/src/app/core/services/task-config.service.ts`

**Interfaces:**
- Produces:
  - `TaskTypeConfigDto` interface — consumida por Tasks 6, 7, 9, 10.
  - `TaskConfigService.getAll(): Observable<TaskTypeConfigDto[]>`
  - `TaskConfigService.update(taskType, dto): Observable<TaskTypeConfigDto>`
  - `OdooHelpdeskTagDto` interface — consumida por Task 7.

- [ ] **Step 1: Agregar interfaces al modelo**

En `frontend/src/app/core/models/task.models.ts`, agregar al final:

```typescript
export interface TaskTypeConfigDto {
  taskType: TaskType;
  defaultTimeMinutes: number | null;
  odooTagIds: number[];
  odooTagNames: string[];
  updatedAt: string;
}

export interface OdooHelpdeskTagDto {
  id: number;
  name: string;
}

export interface UpdateTaskConfigPayload {
  defaultTimeMinutes?: number;
  odooTagIds?: number[];
  odooTagNames?: string[];
}
```

- [ ] **Step 2: Crear el servicio**

Crear `frontend/src/app/core/services/task-config.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  OdooHelpdeskTagDto,
  TaskType,
  TaskTypeConfigDto,
  UpdateTaskConfigPayload,
} from '../models/task.models';

@Injectable({ providedIn: 'root' })
export class TaskConfigService {
  private readonly base = `${environment.apiUrl}/task-config`;
  private readonly odooBase = `${environment.apiUrl}/admin/odoo`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<TaskTypeConfigDto[]> {
    return this.http.get<TaskTypeConfigDto[]>(this.base);
  }

  update(taskType: TaskType, payload: UpdateTaskConfigPayload): Observable<TaskTypeConfigDto> {
    return this.http.patch<TaskTypeConfigDto>(`${this.base}/${taskType}`, payload);
  }

  getHelpdeskTags(): Observable<OdooHelpdeskTagDto[]> {
    return this.http.get<OdooHelpdeskTagDto[]>(`${this.odooBase}/helpdesk-tags`);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/core/models/task.models.ts frontend/src/app/core/services/task-config.service.ts
git commit -m "feat(task-config): modelo TaskTypeConfigDto y TaskConfigService frontend"
```

---

## Task 6: Frontend Admin — TaskConfigComponent (tabla)

**Files:**
- Create: `frontend/src/app/features/admin/task-config/task-config.component.ts`
- Create: `frontend/src/app/features/admin/task-config/task-config.component.html`
- Create: `frontend/src/app/features/admin/task-config/task-config.component.scss`
- Create: `frontend/src/app/features/admin/task-config/task-config.component.spec.ts`

**Interfaces:**
- Consumes: `TaskConfigService.getAll()` (Task 5), `TaskTypeConfigDto` (Task 5).
- Produces: componente `TaskConfigComponent` — declarado en `AdminModule` (Task 8).

- [ ] **Step 1: Escribir el test que falla**

Crear `frontend/src/app/features/admin/task-config/task-config.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { TaskConfigComponent } from './task-config.component';
import { TaskConfigService } from '../../../core/services/task-config.service';
import { TaskTypeConfigDto } from '../../../core/models/task.models';

const mockConfigs: TaskTypeConfigDto[] = [
  {
    taskType: 'SERVER_HOST_MAINTENANCE',
    defaultTimeMinutes: 90,
    odooTagIds: [1],
    odooTagNames: ['Virtualización'],
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    taskType: 'WINDOWS_DOMAIN_MAINTENANCE',
    defaultTimeMinutes: null,
    odooTagIds: [],
    odooTagNames: [],
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

describe('TaskConfigComponent', () => {
  let component: TaskConfigComponent;
  let fixture: ComponentFixture<TaskConfigComponent>;
  let taskConfigService: jest.Mocked<TaskConfigService>;
  let dialog: jest.Mocked<MatDialog>;

  beforeEach(async () => {
    taskConfigService = { getAll: jest.fn().mockReturnValue(of(mockConfigs)) } as any;
    dialog = { open: jest.fn() } as any;

    await TestBed.configureTestingModule({
      declarations: [TaskConfigComponent],
      imports: [NoopAnimationsModule, MatTableModule, MatButtonModule, MatIconModule, MatDialogModule],
      providers: [
        { provide: TaskConfigService, useValue: taskConfigService },
        { provide: MatDialog, useValue: dialog },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carga configs al iniciar', () => {
    expect(taskConfigService.getAll).toHaveBeenCalledTimes(1);
    expect(component.configs).toEqual(mockConfigs);
  });

  it('actualiza el array local al recibir resultado del dialog', () => {
    const updated: TaskTypeConfigDto = { ...mockConfigs[0], defaultTimeMinutes: 120 };
    component.onConfigUpdated(updated);
    expect(component.configs[0].defaultTimeMinutes).toBe(120);
  });

  it('formatea minutos como HH:MM h', () => {
    expect(component.formatMinutes(90)).toBe('1:30 h');
    expect(component.formatMinutes(30)).toBe('0:30 h');
    expect(component.formatMinutes(null)).toBe('— sin configurar');
  });
});
```

- [ ] **Step 2: Ejecutar el test — verificar que falla**

```bash
cd frontend && npx ng test --include="**/task-config.component.spec.ts" --watch=false --browsers=ChromeHeadless 2>&1 | tail -30
```

- [ ] **Step 3: Crear el componente**

Crear `frontend/src/app/features/admin/task-config/task-config.component.ts`:

```typescript
import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TaskConfigService } from '../../../core/services/task-config.service';
import { TaskTypeConfigDto } from '../../../core/models/task.models';
import { TaskEditDialogComponent } from './task-edit-dialog/task-edit-dialog.component';

@Component({
  selector: 'app-task-config',
  templateUrl: './task-config.component.html',
  styleUrl: './task-config.component.scss',
})
export class TaskConfigComponent implements OnInit {
  configs: TaskTypeConfigDto[] = [];
  displayedColumns = ['taskType', 'defaultTimeMinutes', 'odooTags', 'actions'];
  loading = true;

  constructor(
    private taskConfigService: TaskConfigService,
    private dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.taskConfigService.getAll().subscribe({
      next: configs => { this.configs = configs; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  openEdit(config: TaskTypeConfigDto): void {
    this.dialog.open(TaskEditDialogComponent, { data: { config }, width: '440px' })
      .afterClosed()
      .subscribe((updated: TaskTypeConfigDto | null) => {
        if (updated) this.onConfigUpdated(updated);
      });
  }

  onConfigUpdated(updated: TaskTypeConfigDto): void {
    const idx = this.configs.findIndex(c => c.taskType === updated.taskType);
    if (idx !== -1) this.configs[idx] = { ...updated };
  }

  formatMinutes(minutes: number | null): string {
    if (minutes == null) return '— sin configurar';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}:${m.toString().padStart(2, '0')} h`;
  }

  readonly taskTypeLabels: Record<string, string> = {
    SERVER_HOST_MAINTENANCE:    'Hosts VMware / BMC',
    WINDOWS_DOMAIN_MAINTENANCE: 'Servidores Windows',
    QNAP_MAINTENANCE:           'QNAP / NAS',
    VEEAM_BACKUP:               'Veeam Backup',
    ROUTER_MAINTENANCE:         'Router / Firewall',
    TERMINAL_MAINTENANCE:       'Terminales',
    SITE_VISIT:                 'Visita presencial',
    AV_CONTROL:                 'Control de antivirus',
    UPS_CONTROL:                'Control de UPS',
    ENDPOINT_INVENTORY:         'Inventario de endpoints',
  };
}
```

- [ ] **Step 4: Crear el template**

Crear `frontend/src/app/features/admin/task-config/task-config.component.html`:

```html
<div class="section-header">
  <h2 class="section-title">Configuración de tipos de tarea</h2>
  <p class="section-subtitle">Tiempo predefinido y tags de Odoo por tipo de tarea</p>
</div>

<mat-table [dataSource]="configs" class="task-config-table">

  <ng-container matColumnDef="taskType">
    <mat-header-cell *matHeaderCellDef>Tipo de tarea</mat-header-cell>
    <mat-cell *matCellDef="let row">{{ taskTypeLabels[row.taskType] ?? row.taskType }}</mat-cell>
  </ng-container>

  <ng-container matColumnDef="defaultTimeMinutes">
    <mat-header-cell *matHeaderCellDef>Tiempo predefinido</mat-header-cell>
    <mat-cell *matCellDef="let row">
      <span *ngIf="row.defaultTimeMinutes != null" class="time-chip">{{ formatMinutes(row.defaultTimeMinutes) }}</span>
      <span *ngIf="row.defaultTimeMinutes == null" class="time-unset">— sin configurar</span>
    </mat-cell>
  </ng-container>

  <ng-container matColumnDef="odooTags">
    <mat-header-cell *matHeaderCellDef>Tags Odoo</mat-header-cell>
    <mat-cell *matCellDef="let row">
      <span *ngFor="let name of row.odooTagNames" class="tag-badge">{{ name }}</span>
      <span *ngIf="row.odooTagNames.length === 0" class="time-unset">—</span>
    </mat-cell>
  </ng-container>

  <ng-container matColumnDef="actions">
    <mat-header-cell *matHeaderCellDef></mat-header-cell>
    <mat-cell *matCellDef="let row">
      <button mat-icon-button (click)="openEdit(row)" aria-label="Editar configuración">
        <mat-icon>edit</mat-icon>
      </button>
    </mat-cell>
  </ng-container>

  <mat-header-row *matHeaderRowDef="displayedColumns"></mat-header-row>
  <mat-row *matRowDef="let row; columns: displayedColumns;"></mat-row>
</mat-table>
```

- [ ] **Step 5: Crear el scss**

Crear `frontend/src/app/features/admin/task-config/task-config.component.scss`:

```scss
.section-header {
  padding: 20px 0 16px;
}
.section-title    { font-size: 15px; font-weight: 600; color: var(--tx-hi); margin-bottom: 4px; }
.section-subtitle { font-size: 12px; color: var(--tx-md); }

.task-config-table { width: 100%; }

.time-chip {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--accent);
  background: var(--accent-bg);
  border: 1px solid var(--accent-bd);
  border-radius: 4px;
  padding: 2px 8px;
}
.time-unset { font-size: 12px; color: var(--tx-lo); font-style: italic; }

.tag-badge {
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 100px;
  background: var(--accent-bg);
  color: var(--accent);
  border: 1px solid var(--accent-bd);
  margin-right: 4px;
}
```

- [ ] **Step 6: Ejecutar el test — verificar que pasa**

```bash
cd frontend && npx ng test --include="**/task-config.component.spec.ts" --watch=false --browsers=ChromeHeadless 2>&1 | tail -20
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/features/admin/task-config/task-config.component.*
git commit -m "feat(admin): TaskConfigComponent — tabla de configuración por tipo de tarea"
```

---

## Task 7: Frontend Admin — TaskEditDialogComponent

**Files:**
- Create: `frontend/src/app/features/admin/task-config/task-edit-dialog/task-edit-dialog.component.ts`
- Create: `frontend/src/app/features/admin/task-config/task-edit-dialog/task-edit-dialog.component.html`
- Create: `frontend/src/app/features/admin/task-config/task-edit-dialog/task-edit-dialog.component.spec.ts`

**Interfaces:**
- Consumes: `TaskConfigService.update()` + `TaskConfigService.getHelpdeskTags()` (Task 5), `TaskTypeConfigDto` (Task 5).
- Produces: componente `TaskEditDialogComponent` — declarado en `AdminModule` (Task 8). Emite `TaskTypeConfigDto` actualizado al cerrarse.

- [ ] **Step 1: Escribir el test que falla**

Crear `frontend/src/app/features/admin/task-config/task-edit-dialog/task-edit-dialog.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TaskEditDialogComponent } from './task-edit-dialog.component';
import { TaskConfigService } from '../../../../core/services/task-config.service';
import { TaskTypeConfigDto } from '../../../../core/models/task.models';

const mockConfig: TaskTypeConfigDto = {
  taskType: 'SERVER_HOST_MAINTENANCE',
  defaultTimeMinutes: 90,
  odooTagIds: [1],
  odooTagNames: ['Virtualización'],
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('TaskEditDialogComponent', () => {
  let component: TaskEditDialogComponent;
  let fixture: ComponentFixture<TaskEditDialogComponent>;
  let service: jest.Mocked<TaskConfigService>;
  let dialogRef: jest.Mocked<MatDialogRef<TaskEditDialogComponent>>;

  beforeEach(async () => {
    service = {
      getHelpdeskTags: jest.fn().mockReturnValue(of([{ id: 1, name: 'Virtualización' }, { id: 2, name: 'Windows Server' }])),
      update: jest.fn().mockReturnValue(of({ ...mockConfig, defaultTimeMinutes: 120 })),
    } as any;
    dialogRef = { close: jest.fn() } as any;

    await TestBed.configureTestingModule({
      declarations: [TaskEditDialogComponent],
      imports: [NoopAnimationsModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatProgressSpinnerModule],
      providers: [
        { provide: TaskConfigService, useValue: service },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { config: mockConfig } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskEditDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('pre-llena el formulario con la config actual', () => {
    expect(component.form.value.time).toBe('01:30');
    expect(component.form.value.tagIds).toEqual([1]);
  });

  it('carga los tags disponibles desde Odoo al iniciar', () => {
    expect(service.getHelpdeskTags).toHaveBeenCalled();
    expect(component.availableTags.length).toBe(2);
  });

  it('convierte HH:MM a minutos correctamente al guardar', () => {
    component.form.patchValue({ time: '02:00', tagIds: [1, 2] });
    component.save();
    expect(service.update).toHaveBeenCalledWith(
      'SERVER_HOST_MAINTENANCE',
      expect.objectContaining({ defaultTimeMinutes: 120 })
    );
  });

  it('cierra el dialog con null al cancelar', () => {
    component.cancel();
    expect(dialogRef.close).toHaveBeenCalledWith(null);
  });
});
```

- [ ] **Step 2: Ejecutar el test — verificar que falla**

```bash
cd frontend && npx ng test --include="**/task-edit-dialog.component.spec.ts" --watch=false --browsers=ChromeHeadless 2>&1 | tail -30
```

- [ ] **Step 3: Crear el componente**

Crear `frontend/src/app/features/admin/task-config/task-edit-dialog/task-edit-dialog.component.ts`:

```typescript
import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TaskConfigService } from '../../../../core/services/task-config.service';
import { OdooHelpdeskTagDto, TaskTypeConfigDto } from '../../../../core/models/task.models';

const TIME_PATTERN = /^[0-9]{1,2}:[0-5][0-9]$/;

@Component({
  selector: 'app-task-edit-dialog',
  templateUrl: './task-edit-dialog.component.html',
})
export class TaskEditDialogComponent implements OnInit {
  availableTags: OdooHelpdeskTagDto[] = [];
  loadingTags = true;
  saving = false;

  form = new FormGroup({
    time:   new FormControl('', [Validators.required, Validators.pattern(TIME_PATTERN)]),
    tagIds: new FormControl<number[]>([]),
  });

  constructor(
    private dialogRef: MatDialogRef<TaskEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { config: TaskTypeConfigDto },
    private taskConfigService: TaskConfigService,
  ) {}

  ngOnInit(): void {
    const { defaultTimeMinutes, odooTagIds } = this.data.config;
    this.form.patchValue({
      time:   defaultTimeMinutes != null ? this.minutesToTime(defaultTimeMinutes) : '',
      tagIds: odooTagIds,
    });

    this.taskConfigService.getHelpdeskTags().subscribe({
      next: tags => { this.availableTags = tags; this.loadingTags = false; },
      error: () => { this.loadingTags = false; },
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving = true;

    const minutes = this.timeToMinutes(this.form.value.time!);
    const tagIds  = this.form.value.tagIds ?? [];
    const tagNames = tagIds.map(id => this.availableTags.find(t => t.id === id)?.name ?? '');

    this.taskConfigService.update(this.data.config.taskType, {
      defaultTimeMinutes: minutes,
      odooTagIds:  tagIds,
      odooTagNames: tagNames,
    }).subscribe({
      next: updated => { this.saving = false; this.dialogRef.close(updated); },
      error: () => { this.saving = false; },
    });
  }

  cancel(): void {
    this.dialogRef.close(null);
  }

  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }
}
```

- [ ] **Step 4: Crear el template**

Crear `frontend/src/app/features/admin/task-config/task-edit-dialog/task-edit-dialog.component.html`:

```html
<h2 mat-dialog-title>{{ data.config.taskType }}</h2>

<mat-dialog-content [formGroup]="form">

  <mat-form-field appearance="outline" subscriptSizing="dynamic">
    <mat-label>Tiempo predefinido (HH:MM)</mat-label>
    <input matInput formControlName="time" placeholder="01:30">
    <mat-hint>Horas y minutos que se imputarán en Odoo al cerrar la tarea</mat-hint>
    <mat-error *ngIf="form.controls.time.invalid">Formato requerido: HH:MM (ej. 01:30)</mat-error>
  </mat-form-field>

  <mat-form-field appearance="outline" subscriptSizing="dynamic" style="margin-top: 16px;">
    <mat-label>Tags de Odoo</mat-label>
    <mat-select formControlName="tagIds" multiple>
      <mat-option *ngFor="let tag of availableTags" [value]="tag.id">{{ tag.name }}</mat-option>
    </mat-select>
    <mat-hint *ngIf="loadingTags">Cargando tags desde Odoo…</mat-hint>
    <mat-hint *ngIf="!loadingTags">{{ availableTags.length }} tags disponibles</mat-hint>
  </mat-form-field>

</mat-dialog-content>

<mat-dialog-actions align="end">
  <button mat-stroked-button (click)="cancel()" [disabled]="saving">Cancelar</button>
  <button mat-flat-button color="primary" (click)="save()" [disabled]="form.invalid || loadingTags || saving">
    {{ saving ? 'Guardando…' : 'Guardar' }}
  </button>
</mat-dialog-actions>
```

- [ ] **Step 5: Ejecutar el test — verificar que pasa**

```bash
cd frontend && npx ng test --include="**/task-edit-dialog.component.spec.ts" --watch=false --browsers=ChromeHeadless 2>&1 | tail -20
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/features/admin/task-config/task-edit-dialog/
git commit -m "feat(admin): TaskEditDialogComponent — edición de tiempo predefinido y tags Odoo"
```

---

## Task 8: Wiring Admin Frontend — módulo, routing y navegación

**Files:**
- Modify: `frontend/src/app/features/admin/admin.module.ts`
- Modify: `frontend/src/app/features/admin/admin-routing.module.ts`
- Modify: `frontend/src/app/features/admin/admin-layout/admin-layout.component.ts`

**Interfaces:**
- Consumes: `TaskConfigComponent` (Task 6), `TaskEditDialogComponent` (Task 7).
- Produces: ruta `/admin/task-config` activa; ítem en la barra de navegación del Admin.

- [ ] **Step 1: Agregar componentes en admin.module.ts**

En `frontend/src/app/features/admin/admin.module.ts`, agregar:

```typescript
import { MatTooltipModule } from '@angular/material/tooltip';
import { TaskConfigComponent } from './task-config/task-config.component';
import { TaskEditDialogComponent } from './task-config/task-edit-dialog/task-edit-dialog.component';

// En declarations:
declarations: [
  // ... (existentes)
  TaskConfigComponent,
  TaskEditDialogComponent,
],

// En imports:
imports: [
  // ... (existentes)
  MatTooltipModule,
],
```

- [ ] **Step 2: Agregar ruta en admin-routing.module.ts**

En `frontend/src/app/features/admin/admin-routing.module.ts`:

```typescript
import { TaskConfigComponent } from './task-config/task-config.component';

// Agregar en children:
{ path: 'task-config', component: TaskConfigComponent },
```

- [ ] **Step 3: Agregar ítem de navegación en admin-layout**

En `frontend/src/app/features/admin/admin-layout/admin-layout.component.ts`, agregar al array `tabs`:

```typescript
{ path: '/admin/task-config', label: 'Config. tareas' },
```

- [ ] **Step 4: Verificar compilación**

```bash
cd frontend && npx ng build --configuration=development 2>&1 | tail -20
```

Esperar: sin errores de compilación.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/features/admin/admin.module.ts frontend/src/app/features/admin/admin-routing.module.ts frontend/src/app/features/admin/admin-layout/admin-layout.component.ts
git commit -m "feat(admin): wiring de TaskConfigComponent — ruta y navegación"
```

---

## Task 9: Frontend — ConfirmCloseDialogComponent (diálogo unificado de cierre)

**Files:**
- Create: `frontend/src/app/features/technician/task-drawer/confirm-close-dialog/confirm-close-dialog.component.ts`
- Create: `frontend/src/app/features/technician/task-drawer/confirm-close-dialog/confirm-close-dialog.component.html`
- Create: `frontend/src/app/features/technician/task-drawer/confirm-close-dialog/confirm-close-dialog.component.spec.ts`

**Interfaces:**
- Consumes: `TaskTypeConfigDto` (Task 5), `TaskType` (existente en `task.models.ts`).
- Produces: `ConfirmCloseDialogComponent` con `ConfirmCloseDialogData` — consumido por Task 10. Cierra con `true` (confirmar) o `null` (cancelar).

- [ ] **Step 1: Escribir el test que falla**

Crear `frontend/src/app/features/technician/task-drawer/confirm-close-dialog/confirm-close-dialog.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
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
    updatedAt: '2026-01-01T00:00:00Z',
  },
  odooTicketId: 1234,
  issuesSummary: { dcdiagErrors: [], veeamMissing: false, emptyFields: [] },
};

describe('ConfirmCloseDialogComponent', () => {
  let component: ConfirmCloseDialogComponent;
  let fixture: ComponentFixture<ConfirmCloseDialogComponent>;
  let dialogRef: jest.Mocked<MatDialogRef<ConfirmCloseDialogComponent>>;

  function setup(data: ConfirmCloseDialogData) {
    dialogRef = { close: jest.fn() } as any;
    TestBed.resetTestingModule();
    return TestBed.configureTestingModule({
      declarations: [ConfirmCloseDialogComponent],
      imports: [NoopAnimationsModule, CommonModule, MatButtonModule],
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

  it('muestra el tiempo formateado', async () => {
    await setup(baseData);
    expect(component.formattedTime).toBe('1:30 h');
  });

  it('devuelve true al confirmar', async () => {
    await setup(baseData);
    component.confirm();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
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

  it('en modo NOT_DONE no muestra tags ni ticket', async () => {
    await setup({ ...baseData, mode: 'NOT_DONE' });
    expect(component.showTags).toBe(false);
    expect(component.showTicket).toBe(false);
  });
});
```

- [ ] **Step 2: Ejecutar el test — verificar que falla**

```bash
cd frontend && npx ng test --include="**/confirm-close-dialog.component.spec.ts" --watch=false --browsers=ChromeHeadless 2>&1 | tail -30
```

- [ ] **Step 3: Crear el componente**

Crear `frontend/src/app/features/technician/task-drawer/confirm-close-dialog/confirm-close-dialog.component.ts`:

```typescript
import { Component, Inject } from '@angular/core';
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

@Component({
  selector: 'app-confirm-close-dialog',
  templateUrl: './confirm-close-dialog.component.html',
})
export class ConfirmCloseDialogComponent {
  constructor(
    private dialogRef: MatDialogRef<ConfirmCloseDialogComponent>,
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

  confirm(): void { this.dialogRef.close(true); }
  cancel():  void { this.dialogRef.close(null); }
}
```

- [ ] **Step 4: Crear el template**

Crear `frontend/src/app/features/technician/task-drawer/confirm-close-dialog/confirm-close-dialog.component.html`:

```html
<h2 mat-dialog-title>
  <span *ngIf="!hasAlerts">✓</span>
  <span *ngIf="hasAlerts">⚠</span>
  Confirmar cierre
</h2>

<mat-dialog-content>
  <p class="dialog-subtitle">{{ data.taskType }}</p>

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
</mat-dialog-content>

<mat-dialog-actions align="end">
  <button mat-stroked-button (click)="cancel()">Cancelar</button>
  <button
    mat-flat-button
    [color]="hasAlerts ? 'warn' : 'primary'"
    (click)="confirm()">
    {{ confirmLabel }}
  </button>
</mat-dialog-actions>
```

- [ ] **Step 5: Ejecutar el test — verificar que pasa**

```bash
cd frontend && npx ng test --include="**/confirm-close-dialog.component.spec.ts" --watch=false --browsers=ChromeHeadless 2>&1 | tail -20
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/features/technician/task-drawer/confirm-close-dialog/
git commit -m "feat(task-drawer): ConfirmCloseDialogComponent — diálogo unificado de cierre"
```

---

## Task 10: Refactor TaskDrawerComponent — nuevo flujo de cierre

**Files:**
- Modify: `frontend/src/app/features/technician/task-drawer/task-drawer.component.ts`

**Interfaces:**
- Consumes: `TaskConfigService.getAll()` (Task 5), `ConfirmCloseDialogComponent` + `ConfirmCloseDialogData` (Task 9), `TaskTypeConfigDto` (Task 5).
- Produces: `TaskDrawerComponent` actualizado — `onRequestComplete()` y `onRequestNotDone()` usan la config de la tarea; `canComplete` bloquea si no hay tiempo configurado.

- [ ] **Step 1: Actualizar el test del drawer**

En `frontend/src/app/features/tasks/tasks.module.ts` no hay specs — los tests del drawer si existen están en otro archivo. Verificar con:

```bash
ls frontend/src/app/features/technician/task-drawer/*.spec.ts 2>/dev/null || echo "sin spec"
```

Si no existe spec del drawer, omitir el step de tests y documentar para el equipo.

Si existe, agregar estos casos:

```typescript
it('canComplete es false cuando taskConfig es null', () => {
  component.task = { ...mockTask, status: 'IN_PROGRESS' };
  component['taskConfig'] = null;
  expect(component.canComplete).toBe(false);
});

it('canComplete es true cuando taskConfig tiene defaultTimeMinutes', () => {
  component.task = { ...mockTask, status: 'IN_PROGRESS' };
  component['taskConfig'] = {
    taskType: 'SERVER_HOST_MAINTENANCE',
    defaultTimeMinutes: 90,
    odooTagIds: [],
    odooTagNames: [],
    updatedAt: '',
  };
  expect(component.canComplete).toBe(true);
});
```

- [ ] **Step 2: Modificar las importaciones en task-drawer.component.ts**

Reemplazar:

```typescript
import { TimeSpentDialogComponent } from './time-spent-dialog/time-spent-dialog.component';
import {
  ConfirmMaintenanceDialogComponent,
  ConfirmMaintenanceDialogData,
} from './confirm-maintenance-dialog/confirm-maintenance-dialog.component';
```

Por:

```typescript
import {
  ConfirmCloseDialogComponent,
  ConfirmCloseDialogData,
} from './confirm-close-dialog/confirm-close-dialog.component';
import { TaskConfigService } from '../../../core/services/task-config.service';
import { TaskTypeConfigDto } from '../../../core/models/task.models';
```

- [ ] **Step 3: Agregar estado de config y nuevo getter**

En la clase `TaskDrawerComponent`, agregar:

```typescript
taskConfig: TaskTypeConfigDto | null = null;
```

Agregar getter:

```typescript
get canComplete(): boolean {
  return this.isActiveTask
    && this.canExecute
    && this.taskConfig?.defaultTimeMinutes != null;
}
```

- [ ] **Step 4: Inyectar TaskConfigService y cargar config en ngOnChanges**

En el constructor, agregar `private taskConfigService: TaskConfigService`.

En `ngOnChanges`, después de `this.loadInfrastructure()`:

```typescript
this.taskConfigService.getAll().subscribe(configs => {
  this.taskConfig = configs.find(c => c.taskType === this.task.type) ?? null;
});
```

- [ ] **Step 5: Reemplazar onRequestComplete()**

Reemplazar el método actual por:

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
    .subscribe((confirmed: boolean | null) => {
      if (confirmed) this.saveAndComplete(this.taskConfig!.defaultTimeMinutes!);
    });
}
```

- [ ] **Step 6: Reemplazar onRequestNotDone()**

Reemplazar el método actual por:

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
    .subscribe((confirmed: boolean | null) => {
      if (!confirmed) return;
      this.tasksService.updateStatus(this.task.id, {
        status: 'NOT_DONE',
        timeSpentMinutes: this.taskConfig!.defaultTimeMinutes!,
      }).subscribe({
        next: () => { this.taskNotDone.emit(); },
        error: () => { this.confirmError = 'No se pudo actualizar el estado de la tarea.'; },
      });
    });
}
```

- [ ] **Step 7: Actualizar el template del drawer**

En `task-drawer.component.html`, el botón "Completar tarea" debe agregar:

```html
[disabled]="!canComplete"
[matTooltip]="canComplete ? '' : 'El administrador debe configurar el tiempo para este tipo de tarea'"
```

- [ ] **Step 8: Verificar compilación TypeScript**

```bash
cd frontend && npx ng build --configuration=development 2>&1 | grep -E "error|ERROR" | head -20
```

Esperar: sin errores.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/app/features/technician/task-drawer/task-drawer.component.ts
git commit -m "refactor(task-drawer): flujo de cierre usa tiempo configurado por tipo de tarea"
```

---

## Task 11: Wiring final — tasks.module.ts y eliminación de componentes obsoletos

**Files:**
- Modify: `frontend/src/app/features/tasks/tasks.module.ts`
- Delete: `frontend/src/app/features/technician/task-drawer/time-spent-dialog/` (directorio)
- Delete: `frontend/src/app/features/technician/task-drawer/confirm-maintenance-dialog/` (directorio)

**Interfaces:**
- Consumes: `ConfirmCloseDialogComponent` (Task 9).
- Produces: aplicación compilando sin referencias a los componentes eliminados.

- [ ] **Step 1: Actualizar tasks.module.ts**

En `frontend/src/app/features/tasks/tasks.module.ts`:

**Eliminar** los imports:
```typescript
import { ConfirmMaintenanceDialogComponent } from '../technician/task-drawer/confirm-maintenance-dialog/confirm-maintenance-dialog.component';
import { TimeSpentDialogComponent } from '../technician/task-drawer/time-spent-dialog/time-spent-dialog.component';
```

**Agregar** el import:
```typescript
import { ConfirmCloseDialogComponent } from '../technician/task-drawer/confirm-close-dialog/confirm-close-dialog.component';
import { MatTooltipModule } from '@angular/material/tooltip';
```

**En `declarations`**, reemplazar `ConfirmMaintenanceDialogComponent` y `TimeSpentDialogComponent` por `ConfirmCloseDialogComponent`.

**En `imports`**, agregar `MatTooltipModule`.

- [ ] **Step 2: Eliminar los archivos obsoletos**

```bash
rm -rf "frontend/src/app/features/technician/task-drawer/time-spent-dialog"
rm -rf "frontend/src/app/features/technician/task-drawer/confirm-maintenance-dialog"
```

- [ ] **Step 3: Verificar compilación completa**

```bash
cd frontend && npx ng build --configuration=development 2>&1 | tail -20
```

Esperar: sin errores. Si aparecen referencias rotas, buscarlas y corregirlas.

- [ ] **Step 4: Ejecutar todos los tests**

```bash
cd backend && npx jest --no-coverage 2>&1 | tail -20
```

```bash
cd frontend && npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -30
```

Esperar: todos en verde.

- [ ] **Step 5: Commit final**

```bash
git add frontend/src/app/features/tasks/tasks.module.ts
git rm -r frontend/src/app/features/technician/task-drawer/time-spent-dialog/
git rm -r frontend/src/app/features/technician/task-drawer/confirm-maintenance-dialog/
git commit -m "feat(task-config): wiring final, eliminar TimeSpentDialog y ConfirmMaintenanceDialog"
```

---

## Self-Review

**Cobertura del spec:**
- ✅ Tabla `task_type_config` — Task 1
- ✅ `GET /task-config` con fallback a defaults — Task 2
- ✅ `PATCH /task-config/:taskType` upsert + validación 400 — Task 2
- ✅ `GET /admin/odoo/helpdesk-tags` — Task 3
- ✅ OdooService: eliminar 6 métodos hardcodeados — Task 3
- ✅ OdooService: leer tags de DB en `createTicket()` — Task 3
- ✅ Wiring AppModule + OdooIntegrationModule — Task 4
- ✅ `TaskTypeConfigDto` + `OdooHelpdeskTagDto` + `UpdateTaskConfigPayload` — Task 5
- ✅ `TaskConfigService` frontend — Task 5
- ✅ `TaskConfigComponent` tabla Admin — Task 6
- ✅ `TaskEditDialogComponent` HH:MM + mat-select tags — Task 7
- ✅ Routing + navegación Admin — Task 8
- ✅ `ConfirmCloseDialogComponent` unificado (DONE + NOT_DONE) — Task 9
- ✅ `TaskDrawerComponent` refactor: `canComplete`, carga config, nuevo flujo cierre — Task 10
- ✅ `tasks.module.ts` wiring + eliminación de componentes obsoletos — Task 11

**Tipos consistentes:**
- `TaskTypeConfigDto` definida en Task 5, usada en Tasks 6, 7, 9, 10 — ✅
- `ConfirmCloseDialogData` definida en Task 9, usada en Task 10 — ✅
- `TaskConfigService.update()` recibe `TaskType` + `UpdateTaskConfigPayload`, definido en Task 5, llamado en Task 7 — ✅
- `TaskConfigService.findAll()` definido en Task 5, llamado en Task 10 — ✅
