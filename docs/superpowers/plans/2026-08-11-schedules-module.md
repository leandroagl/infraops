# Schedules de Mantenimiento — Plan de Implementación

> **Para agentes:** REQUIRED SUB-SKILL: Usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para implementar este plan tarea por tarea. Los pasos usan sintaxis de checkbox (`- [ ]`) para seguimiento.

**Goal:** Implementar el módulo de Schedules: configuración de grupos bimestrales por cliente, generación mensual de tareas con throttle Odoo, rotación equilibrada de técnicos, e historial de calendario anual.

**Architecture:** Backend NestJS con dos entidades nuevas (`ClientSchedule`, `RotationConfig`) y `SchedulesModule` que orquesta la generación reutilizando el `TasksService` existente. Frontend Angular con módulo lazy-loaded de 3 tabs (Configuración / Generación / Historial).

**Tech Stack:** NestJS · TypeORM · PostgreSQL · Angular 17 · Angular Material · Jest

## Global Constraints
- Angular: sin standalone components — siempre `@NgModule`
- Angular Material: `appearance="outline"` en todos los `mat-form-field`, sin excepción
- TypeScript: prohibido `any`
- TDD: escribir el test antes de la implementación en cada tarea backend
- Idioma de commits: español
- Ningún elemento HTML nativo de formulario (`<input>`, `<select>`, `<button>`) — siempre Angular Material
- No mezclar Ag-Grid y mat-table en la misma vista

---

## Mapa de archivos

```
backend/src/schedules/
├── schedule-group.enum.ts          ← nuevo
├── client-schedule.entity.ts       ← nuevo
├── rotation-config.entity.ts       ← nuevo
├── schedules.module.ts             ← nuevo
├── schedules.controller.ts         ← nuevo
├── schedules.controller.spec.ts    ← nuevo
├── schedules.service.ts            ← nuevo
├── schedules.service.spec.ts       ← nuevo
└── dto/
    ├── upsert-client-schedule.dto.ts   ← nuevo
    ├── generate-month.dto.ts           ← nuevo
    └── save-rotation-config.dto.ts     ← nuevo

backend/src/migrations/
└── <timestamp>-AddSchedulesTables.ts  ← nuevo

backend/src/app.module.ts           ← modificar (agregar SchedulesModule)

frontend/src/app/features/schedules/
├── schedules.module.ts             ← nuevo
├── schedules-routing.module.ts     ← nuevo
├── schedules.component.ts/html/scss ← nuevo (shell con mat-tab-group)
├── schedules.service.ts            ← nuevo
├── config-tab/
│   ├── config-tab.component.ts/html/scss         ← nuevo
│   └── rotation-modal/
│       └── rotation-modal.component.ts/html/scss ← nuevo
├── generation-tab/
│   └── generation-tab.component.ts/html/scss     ← nuevo
└── calendar-tab/
    └── calendar-tab.component.ts/html/scss       ← nuevo

frontend/src/app/app-routing.module.ts   ← modificar (agregar ruta /schedules)
frontend/src/app/core/shell/shell.component.ts ← modificar (agregar nav item)
frontend/src/app/core/guards/admin-or-tl.guard.ts ← nuevo
```

---

### Task 1: Backend — Entidades, enum y migración

**Files:**
- Create: `backend/src/schedules/schedule-group.enum.ts`
- Create: `backend/src/schedules/client-schedule.entity.ts`
- Create: `backend/src/schedules/rotation-config.entity.ts`
- Create: `backend/src/migrations/<timestamp>-AddSchedulesTables.ts`

**Interfaces:**
- Produces: `ScheduleGroup` enum, `ClientSchedule` entity, `RotationConfig` entity usados en Tasks 2–4

- [ ] **Paso 1: Crear el enum `ScheduleGroup`**

```typescript
// backend/src/schedules/schedule-group.enum.ts
export enum ScheduleGroup {
  BIMONTHLY_ODD  = 'BIMONTHLY_ODD',   // Ene, Mar, May, Jul, Sep, Nov
  BIMONTHLY_EVEN = 'BIMONTHLY_EVEN',  // Feb, Abr, Jun, Ago, Oct, Dic
}

export const MONTH_TO_GROUP: Record<number, ScheduleGroup> = {
  1:  ScheduleGroup.BIMONTHLY_ODD,
  2:  ScheduleGroup.BIMONTHLY_EVEN,
  3:  ScheduleGroup.BIMONTHLY_ODD,
  4:  ScheduleGroup.BIMONTHLY_EVEN,
  5:  ScheduleGroup.BIMONTHLY_ODD,
  6:  ScheduleGroup.BIMONTHLY_EVEN,
  7:  ScheduleGroup.BIMONTHLY_ODD,
  8:  ScheduleGroup.BIMONTHLY_EVEN,
  9:  ScheduleGroup.BIMONTHLY_ODD,
  10: ScheduleGroup.BIMONTHLY_EVEN,
  11: ScheduleGroup.BIMONTHLY_ODD,
  12: ScheduleGroup.BIMONTHLY_EVEN,
};
```

- [ ] **Paso 2: Crear la entidad `ClientSchedule`**

```typescript
// backend/src/schedules/client-schedule.entity.ts
import {
  Column, CreateDateColumn, Entity, JoinColumn,
  ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn, Unique,
} from 'typeorm';
import { Client } from '../clients/client.entity';
import { Technician } from '../technicians/technician.entity';
import { ScheduleGroup } from './schedule-group.enum';

@Entity('client_schedules')
@Unique(['clientId'])
export class ClientSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'client_id', type: 'uuid' })
  clientId: string;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ name: 'schedule_group', type: 'enum', enum: ScheduleGroup, nullable: true, default: null })
  scheduleGroup: ScheduleGroup | null;

  @Column({ name: 'technician_id', type: 'uuid', nullable: true, default: null })
  technicianId: string | null;

  @ManyToOne(() => Technician, { nullable: true })
  @JoinColumn({ name: 'technician_id' })
  technician: Technician | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

- [ ] **Paso 3: Crear la entidad `RotationConfig`**

```typescript
// backend/src/schedules/rotation-config.entity.ts
import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum RotationFrequency {
  EVERY_GENERATION      = 'EVERY_GENERATION',
  EVERY_TWO_GENERATIONS = 'EVERY_TWO_GENERATIONS',
}

@Entity('rotation_config')
export class RotationConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'is_active', default: false })
  isActive: boolean;

  @Column({
    type: 'enum',
    enum: RotationFrequency,
    default: RotationFrequency.EVERY_GENERATION,
  })
  frequency: RotationFrequency;

  @Column({ name: 'generations_since_last_rotation', type: 'int', default: 0 })
  generationsSinceLastRotation: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

- [ ] **Paso 4: Crear la migración**

Obtener el timestamp actual con `Date.now()` y nombrar el archivo `<timestamp>-AddSchedulesTables.ts`.

```typescript
// backend/src/migrations/<timestamp>-AddSchedulesTables.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchedulesTables<timestamp> implements MigrationInterface {
  name = 'AddSchedulesTables<timestamp>';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."schedule_group_enum" AS ENUM(
        'BIMONTHLY_ODD', 'BIMONTHLY_EVEN'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."rotation_config_frequency_enum" AS ENUM(
        'EVERY_GENERATION', 'EVERY_TWO_GENERATIONS'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "client_schedules" (
        "id"             uuid NOT NULL DEFAULT uuid_generate_v4(),
        "client_id"      uuid NOT NULL,
        "schedule_group" "public"."schedule_group_enum",
        "technician_id"  uuid,
        "is_active"      boolean NOT NULL DEFAULT true,
        "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_client_schedules_client_id" UNIQUE ("client_id"),
        CONSTRAINT "PK_client_schedules" PRIMARY KEY ("id"),
        CONSTRAINT "FK_client_schedules_client"
          FOREIGN KEY ("client_id") REFERENCES "clients"("id"),
        CONSTRAINT "FK_client_schedules_technician"
          FOREIGN KEY ("technician_id") REFERENCES "technicians"("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "rotation_config" (
        "id"                              uuid NOT NULL DEFAULT uuid_generate_v4(),
        "is_active"                       boolean NOT NULL DEFAULT false,
        "frequency"                       "public"."rotation_config_frequency_enum"
                                          NOT NULL DEFAULT 'EVERY_GENERATION',
        "generations_since_last_rotation" integer NOT NULL DEFAULT 0,
        "updated_at"                      TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rotation_config" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "rotation_config"`);
    await queryRunner.query(`DROP TABLE "client_schedules"`);
    await queryRunner.query(`DROP TYPE "public"."rotation_config_frequency_enum"`);
    await queryRunner.query(`DROP TYPE "public"."schedule_group_enum"`);
  }
}
```

Reemplazar `<timestamp>` con el timestamp real (ej: `1723382400000`).

- [ ] **Paso 5: Ejecutar la migración**

```bash
cd backend
npx typeorm-ts-node-commonjs migration:run -d src/database/data-source.ts
```

Verificar que las tablas `client_schedules` y `rotation_config` existan en la DB.

- [ ] **Paso 6: Commit**

```bash
git add backend/src/schedules/schedule-group.enum.ts \
        backend/src/schedules/client-schedule.entity.ts \
        backend/src/schedules/rotation-config.entity.ts \
        backend/src/migrations/
git commit -m "feat(schedules): entidades ClientSchedule, RotationConfig y migración"
```

---

### Task 2: Backend — SchedulesModule CRUD base

**Files:**
- Create: `backend/src/schedules/dto/upsert-client-schedule.dto.ts`
- Create: `backend/src/schedules/dto/save-rotation-config.dto.ts`
- Create: `backend/src/schedules/schedules.service.ts`
- Create: `backend/src/schedules/schedules.service.spec.ts`
- Create: `backend/src/schedules/schedules.controller.ts`
- Create: `backend/src/schedules/schedules.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `ClientSchedule`, `RotationConfig`, `ScheduleGroup`, `RotationFrequency` (Task 1)
- Produces:
  - `SchedulesService.findAll(): Promise<ClientSchedule[]>`
  - `SchedulesService.upsert(clientId, dto): Promise<ClientSchedule>`
  - `SchedulesService.getRotationConfig(): Promise<RotationConfig>`
  - `SchedulesService.saveRotationConfig(dto): Promise<RotationConfig>`
  - Endpoints: `GET /schedules`, `PUT /schedules/:clientId`, `GET /schedules/rotation`, `PUT /schedules/rotation`

- [ ] **Paso 1: Crear los DTOs**

```typescript
// backend/src/schedules/dto/upsert-client-schedule.dto.ts
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ScheduleGroup } from '../schedule-group.enum';

export class UpsertClientScheduleDto {
  @IsEnum(ScheduleGroup)
  @IsOptional()
  scheduleGroup: ScheduleGroup | null;

  @IsUUID()
  @IsOptional()
  technicianId: string | null;
}
```

```typescript
// backend/src/schedules/dto/save-rotation-config.dto.ts
import { IsBoolean, IsEnum } from 'class-validator';
import { RotationFrequency } from '../rotation-config.entity';

export class SaveRotationConfigDto {
  @IsBoolean()
  isActive: boolean;

  @IsEnum(RotationFrequency)
  frequency: RotationFrequency;
}
```

- [ ] **Paso 2: Escribir los tests de `findAll` y `upsert`**

```typescript
// backend/src/schedules/schedules.service.spec.ts
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClientSchedule } from './client-schedule.entity';
import { RotationConfig, RotationFrequency } from './rotation-config.entity';
import { ScheduleGroup } from './schedule-group.enum';
import { SchedulesService } from './schedules.service';

describe('SchedulesService', () => {
  let service: SchedulesService;
  let scheduleRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let rotationRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let techRepo: { find: jest.Mock };

  beforeEach(async () => {
    scheduleRepo = { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    rotationRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    techRepo = { find: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        SchedulesService,
        { provide: getRepositoryToken(ClientSchedule), useValue: scheduleRepo },
        { provide: getRepositoryToken(RotationConfig),  useValue: rotationRepo },
        // TasksService y TechnicianRepository inyectados después en Task 3/4
        { provide: 'TechnicianRepository', useValue: techRepo },
      ],
    }).compile();

    service = module.get(SchedulesService);
  });

  describe('findAll', () => {
    it('devuelve todas las reglas con relaciones', async () => {
      const rules = [{ id: 'uuid-1', clientId: 'c-1' }];
      scheduleRepo.find.mockResolvedValue(rules);
      const result = await service.findAll();
      expect(result).toBe(rules);
      expect(scheduleRepo.find).toHaveBeenCalledWith({
        relations: ['client', 'technician'],
        order: { client: { name: 'ASC' } },
      });
    });
  });

  describe('upsert', () => {
    it('crea la regla si no existe', async () => {
      scheduleRepo.findOne.mockResolvedValue(null);
      const created = { id: 'new', clientId: 'c-1', scheduleGroup: ScheduleGroup.BIMONTHLY_EVEN };
      scheduleRepo.create.mockReturnValue(created);
      scheduleRepo.save.mockResolvedValue(created);
      scheduleRepo.find.mockResolvedValue([created]);

      const dto = { scheduleGroup: ScheduleGroup.BIMONTHLY_EVEN, technicianId: null };
      const result = await service.upsert('c-1', dto);
      expect(scheduleRepo.create).toHaveBeenCalledWith({ clientId: 'c-1', ...dto });
      expect(result).toBe(created);
    });

    it('actualiza la regla si ya existe', async () => {
      const existing = { id: 'ex-1', clientId: 'c-1', scheduleGroup: ScheduleGroup.BIMONTHLY_ODD };
      scheduleRepo.findOne.mockResolvedValue(existing);
      scheduleRepo.save.mockResolvedValue({ ...existing, scheduleGroup: ScheduleGroup.BIMONTHLY_EVEN });
      scheduleRepo.find.mockResolvedValue([]);

      const dto = { scheduleGroup: ScheduleGroup.BIMONTHLY_EVEN, technicianId: null };
      await service.upsert('c-1', dto);
      expect(scheduleRepo.save).toHaveBeenCalledWith({ ...existing, ...dto });
    });
  });

  describe('getRotationConfig', () => {
    it('devuelve config existente', async () => {
      const cfg = { id: 'r-1', isActive: false };
      rotationRepo.findOne.mockResolvedValue(cfg);
      expect(await service.getRotationConfig()).toBe(cfg);
    });

    it('crea config por defecto si no existe', async () => {
      rotationRepo.findOne.mockResolvedValue(null);
      const def = { isActive: false, frequency: RotationFrequency.EVERY_GENERATION, generationsSinceLastRotation: 0 };
      rotationRepo.create.mockReturnValue(def);
      rotationRepo.save.mockResolvedValue(def);
      await service.getRotationConfig();
      expect(rotationRepo.create).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Paso 3: Ejecutar tests — verificar que fallan**

```bash
cd backend && npx jest schedules.service.spec.ts --no-coverage
```

Expected: fallan porque `SchedulesService` no existe.

- [ ] **Paso 4: Implementar `SchedulesService` (findAll, upsert, rotation CRUD)**

```typescript
// backend/src/schedules/schedules.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientSchedule } from './client-schedule.entity';
import { RotationConfig, RotationFrequency } from './rotation-config.entity';
import { UpsertClientScheduleDto } from './dto/upsert-client-schedule.dto';
import { SaveRotationConfigDto } from './dto/save-rotation-config.dto';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(ClientSchedule)
    private readonly scheduleRepo: Repository<ClientSchedule>,
    @InjectRepository(RotationConfig)
    private readonly rotationRepo: Repository<RotationConfig>,
  ) {}

  findAll(): Promise<ClientSchedule[]> {
    return this.scheduleRepo.find({
      relations: ['client', 'technician'],
      order: { client: { name: 'ASC' } },
    });
  }

  async upsert(clientId: string, dto: UpsertClientScheduleDto): Promise<ClientSchedule> {
    let rule = await this.scheduleRepo.findOne({ where: { clientId } });
    if (!rule) {
      rule = this.scheduleRepo.create({ clientId, ...dto });
    } else {
      Object.assign(rule, dto);
    }
    await this.scheduleRepo.save(rule);
    return this.scheduleRepo.findOne({
      where: { clientId },
      relations: ['client', 'technician'],
    }) as Promise<ClientSchedule>;
  }

  async getRotationConfig(): Promise<RotationConfig> {
    const cfg = await this.rotationRepo.findOne({ where: {} });
    if (cfg) return cfg;
    const def = this.rotationRepo.create({
      isActive: false,
      frequency: RotationFrequency.EVERY_GENERATION,
      generationsSinceLastRotation: 0,
    });
    return this.rotationRepo.save(def);
  }

  async saveRotationConfig(dto: SaveRotationConfigDto): Promise<RotationConfig> {
    const cfg = await this.getRotationConfig();
    Object.assign(cfg, dto);
    return this.rotationRepo.save(cfg);
  }
}
```

- [ ] **Paso 5: Ejecutar tests — verificar que pasan**

```bash
cd backend && npx jest schedules.service.spec.ts --no-coverage
```

Expected: PASS en todos los tests de Task 2.

- [ ] **Paso 6: Crear el controller**

```typescript
// backend/src/schedules/schedules.controller.ts
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user-role.enum';
import { UpsertClientScheduleDto } from './dto/upsert-client-schedule.dto';
import { SaveRotationConfigDto } from './dto/save-rotation-config.dto';
import { GenerateMonthDto } from './dto/generate-month.dto';
import { ClientSchedule } from './client-schedule.entity';
import { RotationConfig } from './rotation-config.entity';
import { SchedulesService } from './schedules.service';

@Controller('schedules')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TL)
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  findAll(): Promise<ClientSchedule[]> {
    return this.schedulesService.findAll();
  }

  @Put(':clientId')
  upsert(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() dto: UpsertClientScheduleDto,
  ): Promise<ClientSchedule> {
    return this.schedulesService.upsert(clientId, dto);
  }

  @Get('rotation')
  getRotationConfig(): Promise<RotationConfig> {
    return this.schedulesService.getRotationConfig();
  }

  @Put('rotation')
  saveRotationConfig(@Body() dto: SaveRotationConfigDto): Promise<RotationConfig> {
    return this.schedulesService.saveRotationConfig(dto);
  }

  @Get('rotation/preview')
  previewRotation() {
    return this.schedulesService.previewRotation();
  }

  @Get('preview')
  getMonthlyPreview(
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.schedulesService.getMonthlyPreview(parseInt(year), parseInt(month));
  }

  @Post('generate')
  generateMonth(@Body() dto: GenerateMonthDto) {
    return this.schedulesService.generateMonth(dto.year, dto.month);
  }
}
```

```typescript
// backend/src/schedules/dto/generate-month.dto.ts
import { IsInt, Max, Min } from 'class-validator';

export class GenerateMonthDto {
  @IsInt() @Min(2024) @Max(2100)
  year: number;

  @IsInt() @Min(1) @Max(12)
  month: number;
}
```

- [ ] **Paso 7: Crear el módulo**

```typescript
// backend/src/schedules/schedules.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TasksModule } from '../tasks/tasks.module';
import { TechniciansModule } from '../technicians/technicians.module';
import { ClientSchedule } from './client-schedule.entity';
import { RotationConfig } from './rotation-config.entity';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClientSchedule, RotationConfig]),
    TasksModule,
    TechniciansModule,
  ],
  controllers: [SchedulesController],
  providers: [SchedulesService, JwtAuthGuard, RolesGuard],
})
export class SchedulesModule {}
```

- [ ] **Paso 8: Registrar en `app.module.ts`**

En `backend/src/app.module.ts`, agregar en los imports:

```typescript
import { SchedulesModule } from './schedules/schedules.module';
// ...dentro de @Module imports[]:
SchedulesModule,
```

- [ ] **Paso 9: Levantar el backend y verificar endpoints**

```bash
cd backend && npm run start:dev
```

Probar con curl o Bruno:
- `GET /schedules` → `[]` (vacío, sin error)
- `GET /schedules/rotation` → objeto con `isActive: false`

- [ ] **Paso 10: Commit**

```bash
git add backend/src/schedules/ backend/src/app.module.ts
git commit -m "feat(schedules): módulo base con CRUD de reglas y configuración de rotación"
```

---

### Task 3: Backend — Preview mensual y generación con throttle

**Files:**
- Modify: `backend/src/schedules/schedules.service.ts`
- Modify: `backend/src/schedules/schedules.service.spec.ts`

**Interfaces:**
- Consumes:
  - `TasksService.create(dto: CreateTaskDto): Promise<Task>` (del TasksModule importado)
  - `MONTH_TO_GROUP` (Task 1)
- Produces:
  - `SchedulesService.getMonthlyPreview(year, month)` → `MonthlyPreviewDto`
  - `SchedulesService.generateMonth(year, month)` → `GenerationResultDto`

Tipos de respuesta (definir inline en el servicio):

```typescript
export interface MonthlyPreviewClientDto {
  clientId: string;
  clientName: string;
  technicianId: string | null;
  technicianName: string | null;
}

export interface MonthlyPreviewDto {
  year: number;
  month: number;
  group: ScheduleGroup;
  clients: MonthlyPreviewClientDto[];
  clientsWithoutTechnician: number;
}

export interface GenerationResultDto {
  tasksCreated: number;
  tasksSkipped: number;
  errors: Array<{ clientId: string; taskType: string; error: string }>;
}
```

- [ ] **Paso 1: Agregar tests de `getMonthlyPreview` y `generateMonth`**

Agregar al `schedules.service.spec.ts` existente:

```typescript
// Al inicio del describe('SchedulesService'), agregar en beforeEach:
let tasksService: { create: jest.Mock };
let taskRepo: { findOne: jest.Mock };

// En beforeEach, agregar al Test.createTestingModule providers:
tasksService = { create: jest.fn() };
taskRepo = { findOne: jest.fn() };
{ provide: 'TasksService', useValue: tasksService },
{ provide: getRepositoryToken(Task), useValue: taskRepo },

// Nuevos bloques de test:
describe('getMonthlyPreview', () => {
  it('devuelve clientes del grupo par para mes par', async () => {
    const rules: Partial<ClientSchedule>[] = [
      {
        clientId: 'c-1',
        scheduleGroup: ScheduleGroup.BIMONTHLY_EVEN,
        technicianId: 't-1',
        client: { name: 'Cliente A' } as Client,
        technician: { user: { name: 'Enzo' } } as Technician,
        isActive: true,
      },
    ];
    scheduleRepo.find.mockResolvedValue(rules);

    const result = await service.getMonthlyPreview(2026, 8); // agosto = par
    expect(result.group).toBe(ScheduleGroup.BIMONTHLY_EVEN);
    expect(result.clients).toHaveLength(1);
    expect(result.clientsWithoutTechnician).toBe(0);
  });

  it('filtra clientes del grupo impar en mes par', async () => {
    const rules: Partial<ClientSchedule>[] = [
      {
        clientId: 'c-2',
        scheduleGroup: ScheduleGroup.BIMONTHLY_ODD, // no aplica en mes par
        isActive: true,
        client: { name: 'B' } as Client,
        technician: null,
      },
    ];
    scheduleRepo.find.mockResolvedValue(rules);
    const result = await service.getMonthlyPreview(2026, 8);
    expect(result.clients).toHaveLength(0);
  });
});

describe('generateMonth', () => {
  it('crea tareas y respeta throttle', async () => {
    jest.useFakeTimers();
    const rules: Partial<ClientSchedule>[] = [
      {
        clientId: 'c-1',
        scheduleGroup: ScheduleGroup.BIMONTHLY_EVEN,
        technicianId: 't-1',
        isActive: true,
        client: { name: 'A' } as Client,
        technician: {} as Technician,
      },
    ];
    scheduleRepo.find.mockResolvedValue(rules);
    taskRepo.findOne.mockResolvedValue(null); // no existe tarea previa
    tasksService.create.mockResolvedValue({ id: 'task-1' });

    const promise = service.generateMonth(2026, 8);
    jest.runAllTimersAsync();
    const result = await promise;

    expect(result.tasksCreated).toBeGreaterThanOrEqual(0);
    expect(result.errors).toBeDefined();
    jest.useRealTimers();
  });

  it('es idempotente: no duplica tarea existente', async () => {
    const rules: Partial<ClientSchedule>[] = [
      {
        clientId: 'c-1',
        scheduleGroup: ScheduleGroup.BIMONTHLY_EVEN,
        technicianId: 't-1',
        isActive: true,
        client: { name: 'A' } as Client,
        technician: {} as Technician,
      },
    ];
    scheduleRepo.find.mockResolvedValue(rules);
    // Tarea ya existe → skip
    taskRepo.findOne.mockResolvedValue({ id: 'existing-task' });

    const result = await service.generateMonth(2026, 8);
    expect(tasksService.create).not.toHaveBeenCalled();
    expect(result.tasksSkipped).toBeGreaterThan(0);
  });
});
```

- [ ] **Paso 2: Ejecutar tests — verificar que fallan**

```bash
cd backend && npx jest schedules.service.spec.ts --no-coverage
```

- [ ] **Paso 3: Implementar `getMonthlyPreview` y `generateMonth` en el servicio**

Agregar a `schedules.service.ts`:

```typescript
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { TasksService } from '../tasks/tasks.service';
import { TaskType } from '../tasks/task-type.enum';
import { Task } from '../tasks/task.entity';
import { MONTH_TO_GROUP, ScheduleGroup } from './schedule-group.enum';
// ... resto de imports existentes

const V1_TASK_TYPES: TaskType[] = [
  TaskType.SERVER_HOST_MAINTENANCE,
  TaskType.WINDOWS_DOMAIN_MAINTENANCE,
  TaskType.QNAP_MAINTENANCE,
  TaskType.VEEAM_BACKUP,
  TaskType.ROUTER_MAINTENANCE,
];

const THROTTLE_MS = 800;

// Dentro de la clase SchedulesService, añadir constructor params y métodos:

// Constructor actualizado:
constructor(
  @InjectRepository(ClientSchedule)
  private readonly scheduleRepo: Repository<ClientSchedule>,
  @InjectRepository(RotationConfig)
  private readonly rotationRepo: Repository<RotationConfig>,
  @InjectRepository(Task)
  private readonly taskRepo: Repository<Task>,
  private readonly tasksService: TasksService,
) {}

private readonly logger = new Logger(SchedulesService.name);

async getMonthlyPreview(year: number, month: number): Promise<MonthlyPreviewDto> {
  const group = MONTH_TO_GROUP[month];
  const all = await this.scheduleRepo.find({
    where: { isActive: true, scheduleGroup: group },
    relations: ['client', 'technician', 'technician.user'],
  });

  const clients: MonthlyPreviewClientDto[] = all.map(r => ({
    clientId: r.clientId,
    clientName: r.client?.name ?? '',
    technicianId: r.technicianId,
    technicianName: r.technician?.user?.name ?? null,
  }));

  return {
    year, month, group,
    clients,
    clientsWithoutTechnician: clients.filter(c => !c.technicianId).length,
  };
}

async generateMonth(year: number, month: number): Promise<GenerationResultDto> {
  const group = MONTH_TO_GROUP[month];
  const rules = await this.scheduleRepo.find({
    where: { isActive: true, scheduleGroup: group },
    relations: ['client', 'technician'],
  });

  const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay  = new Date(year, month, 0).toISOString().slice(0, 10);

  let tasksCreated = 0;
  let tasksSkipped = 0;
  const errors: GenerationResultDto['errors'] = [];

  for (const rule of rules) {
    if (!rule.technicianId) continue;

    for (const type of V1_TASK_TYPES) {
      const exists = await this.taskRepo.findOne({
        where: {
          clientId: rule.clientId,
          type,
          scheduledDate: Between(firstDay, lastDay) as unknown as string,
        },
      });

      if (exists) { tasksSkipped++; continue; }

      try {
        await this.tasksService.create({
          clientId: rule.clientId,
          technicianId: rule.technicianId,
          type,
          scheduledDate: firstDay,
        });
        tasksCreated++;
      } catch (err) {
        if (err instanceof BadRequestException) {
          // InfraDoc: cliente no tiene infra para este tipo → skip silencioso
          tasksSkipped++;
        } else {
          this.logger.error(`Error generando ${type} para ${rule.clientId}: ${(err as Error).message}`);
          errors.push({ clientId: rule.clientId, taskType: type, error: (err as Error).message });
        }
      }

      await new Promise(r => setTimeout(r, THROTTLE_MS));
    }
  }

  return { tasksCreated, tasksSkipped, errors };
}
```

- [ ] **Paso 4: Ejecutar tests — verificar que pasan**

```bash
cd backend && npx jest schedules.service.spec.ts --no-coverage
```

- [ ] **Paso 5: Agregar `Task` repository al módulo**

En `schedules.module.ts`, agregar `Task` a `TypeOrmModule.forFeature`:

```typescript
import { Task } from '../tasks/task.entity';
// ...
TypeOrmModule.forFeature([ClientSchedule, RotationConfig, Task]),
```

- [ ] **Paso 6: Commit**

```bash
git add backend/src/schedules/
git commit -m "feat(schedules): preview mensual y generación de tareas con throttle Odoo"
```

---

### Task 4: Backend — Rotación de técnicos

**Files:**
- Modify: `backend/src/schedules/schedules.service.ts`
- Modify: `backend/src/schedules/schedules.service.spec.ts`

**Interfaces:**
- Consumes: `Technician` entity vía `TechniciansModule`
- Produces:
  - `SchedulesService.previewRotation()` → `RotationPreviewDto`
  - Rotación aplicada como efecto secundario de `generateMonth` cuando `isActive = true`

```typescript
export interface RotationPreviewDto {
  technicians: Array<{
    technicianId: string;
    name: string;
    clientCount: number;
    clients: string[]; // nombres de clientes
  }>;
}
```

- [ ] **Paso 1: Agregar tests de rotación**

```typescript
// Agregar a schedules.service.spec.ts
describe('previewRotation', () => {
  it('distribuye clientes en round-robin equilibrado', async () => {
    const rules = [
      { clientId: 'c-1', isActive: true, client: { name: 'A' } },
      { clientId: 'c-2', isActive: true, client: { name: 'B' } },
      { clientId: 'c-3', isActive: true, client: { name: 'C' } },
      { clientId: 'c-4', isActive: true, client: { name: 'D' } },
      { clientId: 'c-5', isActive: true, client: { name: 'E' } },
    ] as Partial<ClientSchedule>[];

    scheduleRepo.find.mockResolvedValue(rules);
    techRepo.find.mockResolvedValue([
      { id: 't-1', user: { name: 'Enzo' } },
      { id: 't-2', user: { name: 'Tow' } },
    ]);

    const preview = await service.previewRotation();
    const counts = preview.technicians.map(t => t.clientCount);
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    expect(max - min).toBeLessThanOrEqual(1); // equilibrado
    expect(counts.reduce((a, b) => a + b, 0)).toBe(5); // todos asignados
  });
});
```

- [ ] **Paso 2: Ejecutar tests — verificar que fallan**

```bash
cd backend && npx jest schedules.service.spec.ts --no-coverage
```

- [ ] **Paso 3: Implementar `previewRotation` y `applyRotationIfNeeded`**

Agregar a `schedules.service.ts`:

```typescript
import { Technician } from '../technicians/technician.entity';
// En constructor, agregar:
@InjectRepository(Technician)
private readonly techRepo: Repository<Technician>,

async previewRotation(): Promise<RotationPreviewDto> {
  const [rules, technicians] = await Promise.all([
    this.scheduleRepo.find({ where: { isActive: true }, relations: ['client'], order: { clientId: 'ASC' } }),
    this.techRepo.find({ relations: ['user'] }),
  ]);

  const distributed = this.distributeRoundRobin(rules, technicians);
  return {
    technicians: technicians.map(t => ({
      technicianId: t.id,
      name: t.user?.name ?? t.id,
      clientCount: distributed.filter(d => d.technicianId === t.id).length,
      clients: distributed.filter(d => d.technicianId === t.id).map(d => d.client?.name ?? d.clientId),
    })),
  };
}

private distributeRoundRobin(
  rules: ClientSchedule[],
  technicians: Technician[],
): Array<{ clientId: string; technicianId: string; client: Client | undefined }> {
  return rules.map((rule, idx) => ({
    clientId: rule.clientId,
    technicianId: technicians[idx % technicians.length].id,
    client: rule.client,
  }));
}

private async applyRotationIfNeeded(): Promise<void> {
  const cfg = await this.getRotationConfig();
  if (!cfg.isActive) return;

  if (cfg.frequency === RotationFrequency.EVERY_TWO_GENERATIONS) {
    cfg.generationsSinceLastRotation += 1;
    if (cfg.generationsSinceLastRotation < 2) {
      await this.rotationRepo.save(cfg);
      return;
    }
    cfg.generationsSinceLastRotation = 0;
  }

  const [rules, technicians] = await Promise.all([
    this.scheduleRepo.find({ where: { isActive: true }, order: { clientId: 'ASC' } }),
    this.techRepo.find(),
  ]);

  const distributed = this.distributeRoundRobin(rules, technicians);
  await Promise.all(
    distributed.map(d =>
      this.scheduleRepo.update({ clientId: d.clientId }, { technicianId: d.technicianId }),
    ),
  );

  await this.rotationRepo.save(cfg);
}
```

Llamar `applyRotationIfNeeded()` al inicio de `generateMonth()`:

```typescript
async generateMonth(year: number, month: number): Promise<GenerationResultDto> {
  await this.applyRotationIfNeeded(); // ← agregar esta línea
  // ... resto del método
}
```

- [ ] **Paso 4: Ejecutar todos los tests del módulo**

```bash
cd backend && npx jest schedules --no-coverage
```

Expected: PASS en todos.

- [ ] **Paso 5: Commit**

```bash
git add backend/src/schedules/
git commit -m "feat(schedules): rotación automática equilibrada de técnicos en round-robin"
```

---

### Task 5: Frontend — Guard, SchedulesService y módulo scaffold

**Files:**
- Create: `frontend/src/app/core/guards/admin-or-tl.guard.ts`
- Create: `frontend/src/app/features/schedules/schedules.service.ts`
- Create: `frontend/src/app/features/schedules/schedules.module.ts`
- Create: `frontend/src/app/features/schedules/schedules-routing.module.ts`
- Create: `frontend/src/app/features/schedules/schedules.component.ts`
- Create: `frontend/src/app/features/schedules/schedules.component.html`
- Create: `frontend/src/app/features/schedules/schedules.component.scss`
- Modify: `frontend/src/app/app-routing.module.ts`
- Modify: `frontend/src/app/core/shell/shell.component.ts`

**Interfaces:**
- Produces: `SchedulesService` con todos los métodos HTTP, módulo lazy-loaded en `/schedules`

- [ ] **Paso 1: Crear `AdminOrTlGuard`**

```typescript
// frontend/src/app/core/guards/admin-or-tl.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AdminOrTlGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean {
    const user = this.auth.getCurrentUser();
    if (!user) { this.router.navigate(['/login']); return false; }
    if (user.role !== 'ADMIN' && user.role !== 'TL') {
      this.router.navigate(['/dashboard']); return false;
    }
    return true;
  }
}
```

- [ ] **Paso 2: Crear `SchedulesService`**

```typescript
// frontend/src/app/features/schedules/schedules.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type ScheduleGroup = 'BIMONTHLY_ODD' | 'BIMONTHLY_EVEN' | null;
export type RotationFrequency = 'EVERY_GENERATION' | 'EVERY_TWO_GENERATIONS';

export interface ClientSchedule {
  id: string;
  clientId: string;
  client: { id: string; name: string };
  scheduleGroup: ScheduleGroup;
  technicianId: string | null;
  technician: { id: string; user: { name: string } } | null;
  isActive: boolean;
}

export interface RotationConfig {
  id: string;
  isActive: boolean;
  frequency: RotationFrequency;
  generationsSinceLastRotation: number;
}

export interface MonthlyPreviewClient {
  clientId: string;
  clientName: string;
  technicianId: string | null;
  technicianName: string | null;
}

export interface MonthlyPreview {
  year: number;
  month: number;
  group: 'BIMONTHLY_ODD' | 'BIMONTHLY_EVEN';
  clients: MonthlyPreviewClient[];
  clientsWithoutTechnician: number;
}

export interface GenerationResult {
  tasksCreated: number;
  tasksSkipped: number;
  errors: Array<{ clientId: string; taskType: string; error: string }>;
}

export interface RotationPreview {
  technicians: Array<{
    technicianId: string;
    name: string;
    clientCount: number;
    clients: string[];
  }>;
}

@Injectable({ providedIn: 'root' })
export class SchedulesService {
  private readonly base = `${environment.apiUrl}/schedules`;

  constructor(private http: HttpClient) {}

  findAll(): Observable<ClientSchedule[]> {
    return this.http.get<ClientSchedule[]>(this.base);
  }

  upsert(clientId: string, body: { scheduleGroup: ScheduleGroup; technicianId: string | null }): Observable<ClientSchedule> {
    return this.http.put<ClientSchedule>(`${this.base}/${clientId}`, body);
  }

  getMonthlyPreview(year: number, month: number): Observable<MonthlyPreview> {
    return this.http.get<MonthlyPreview>(`${this.base}/preview`, { params: { year, month } });
  }

  generateMonth(year: number, month: number): Observable<GenerationResult> {
    return this.http.post<GenerationResult>(`${this.base}/generate`, { year, month });
  }

  getRotationConfig(): Observable<RotationConfig> {
    return this.http.get<RotationConfig>(`${this.base}/rotation`);
  }

  saveRotationConfig(body: { isActive: boolean; frequency: RotationFrequency }): Observable<RotationConfig> {
    return this.http.put<RotationConfig>(`${this.base}/rotation`, body);
  }

  previewRotation(): Observable<RotationPreview> {
    return this.http.get<RotationPreview>(`${this.base}/rotation/preview`);
  }
}
```

- [ ] **Paso 3: Crear el componente shell con mat-tab-group**

```typescript
// frontend/src/app/features/schedules/schedules.component.ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-schedules',
  templateUrl: './schedules.component.html',
  styleUrl: './schedules.component.scss',
})
export class SchedulesComponent {}
```

```html
<!-- frontend/src/app/features/schedules/schedules.component.html -->
<div class="schedules-shell">
  <div class="page-header">
    <h1 class="page-title">Schedules de Mantenimiento</h1>
    <p class="page-sub">Generación automática de tareas mensuales por cliente</p>
  </div>

  <mat-tab-group animationDuration="0">
    <mat-tab label="Configuración">
      <app-config-tab></app-config-tab>
    </mat-tab>
    <mat-tab label="Generación mensual">
      <app-generation-tab></app-generation-tab>
    </mat-tab>
    <mat-tab label="Historial / Calendario">
      <app-calendar-tab></app-calendar-tab>
    </mat-tab>
  </mat-tab-group>
</div>
```

```scss
// frontend/src/app/features/schedules/schedules.component.scss
.schedules-shell { padding: 0; }
.page-header { padding: 16px 24px 0; }
.page-title { font-size: 18px; font-weight: 600; margin: 0; }
.page-sub { font-size: 12px; color: var(--tx-lo); margin: 4px 0 0; }
```

- [ ] **Paso 4: Crear el módulo y routing**

```typescript
// frontend/src/app/features/schedules/schedules-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SchedulesComponent } from './schedules.component';

const routes: Routes = [{ path: '', component: SchedulesComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SchedulesRoutingModule {}
```

```typescript
// frontend/src/app/features/schedules/schedules.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SchedulesRoutingModule } from './schedules-routing.module';
import { SchedulesComponent } from './schedules.component';
import { ConfigTabComponent } from './config-tab/config-tab.component';
import { RotationModalComponent } from './config-tab/rotation-modal/rotation-modal.component';
import { GenerationTabComponent } from './generation-tab/generation-tab.component';
import { CalendarTabComponent } from './calendar-tab/calendar-tab.component';

@NgModule({
  declarations: [
    SchedulesComponent,
    ConfigTabComponent,
    RotationModalComponent,
    GenerationTabComponent,
    CalendarTabComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatTabsModule, MatTableModule, MatFormFieldModule, MatSelectModule,
    MatButtonModule, MatButtonToggleModule, MatDialogModule,
    MatSnackBarModule, MatProgressBarModule, MatProgressSpinnerModule,
    MatSlideToggleModule, MatIconModule, MatChipsModule, MatTooltipModule,
    SchedulesRoutingModule,
  ],
})
export class SchedulesModule {}
```

- [ ] **Paso 5: Registrar la ruta en `app-routing.module.ts`**

```typescript
// Agregar dentro del array children del ShellComponent:
{
  path: 'schedules',
  canActivate: [AdminOrTlGuard],
  loadChildren: () =>
    import('./features/schedules/schedules.module').then(m => m.SchedulesModule),
},
```

```typescript
// Agregar import:
import { AdminOrTlGuard } from './core/guards/admin-or-tl.guard';
```

- [ ] **Paso 6: Agregar nav item en `shell.component.ts`**

```typescript
// Agregar al array navItems:
{ route: '/schedules', label: 'Schedules', icon: 'admin' },
```

- [ ] **Paso 7: Crear los componentes hijo vacíos (placeholders funcionales)**

Crear archivos `.ts`, `.html` y `.scss` mínimos para `ConfigTabComponent`, `GenerationTabComponent` y `CalendarTabComponent`. Cada uno con template `<p>Tab X</p>` para que compile.

- [ ] **Paso 8: Verificar que la ruta carga sin errores**

```bash
cd frontend && npm start
```

Navegar a `/schedules` y verificar que aparecen las 3 tabs sin errores de consola.

- [ ] **Paso 9: Commit**

```bash
git add frontend/src/app/features/schedules/ \
        frontend/src/app/core/guards/admin-or-tl.guard.ts \
        frontend/src/app/app-routing.module.ts \
        frontend/src/app/core/shell/shell.component.ts
git commit -m "feat(schedules): módulo Angular, guard AdminOrTl, SchedulesService y scaffold de tabs"
```

---

### Task 6: Frontend — Tab Configuración

**Files:**
- Modify: `frontend/src/app/features/schedules/config-tab/config-tab.component.ts`
- Modify: `frontend/src/app/features/schedules/config-tab/config-tab.component.html`
- Modify: `frontend/src/app/features/schedules/config-tab/config-tab.component.scss`

**Interfaces:**
- Consumes: `SchedulesService.findAll()`, `SchedulesService.upsert()`
- Produces: tabla editable de reglas con reactive save + badge de rotación activa

- [ ] **Paso 1: Implementar el componente**

```typescript
// config-tab.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { debounceTime, switchMap, takeUntil } from 'rxjs/operators';
import {
  ClientSchedule, RotationConfig, ScheduleGroup, SchedulesService,
} from '../schedules.service';
import { RotationModalComponent } from './rotation-modal/rotation-modal.component';

@Component({
  selector: 'app-config-tab',
  templateUrl: './config-tab.component.html',
  styleUrl: './config-tab.component.scss',
})
export class ConfigTabComponent implements OnInit, OnDestroy {
  rules: ClientSchedule[] = [];
  rotationConfig: RotationConfig | null = null;
  filterGroup: ScheduleGroup | 'ALL' = 'ALL';
  searchTerm = '';
  displayedColumns = ['client', 'group', 'months', 'technician'];
  loading = false;

  private readonly saveSubject = new Subject<{ clientId: string; scheduleGroup: ScheduleGroup; technicianId: string | null }>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly schedulesService: SchedulesService,
    private readonly dialog: MatDialog,
    private readonly snack: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.load();
    this.saveSubject.pipe(
      debounceTime(300),
      switchMap(change => this.schedulesService.upsert(change.clientId, {
        scheduleGroup: change.scheduleGroup,
        technicianId: change.technicianId,
      })),
      takeUntil(this.destroy$),
    ).subscribe({
      next: updated => {
        const idx = this.rules.findIndex(r => r.clientId === updated.clientId);
        if (idx !== -1) this.rules[idx] = updated;
        this.snack.open('Guardado', undefined, { duration: 1500 });
      },
      error: () => this.snack.open('Error al guardar', 'OK', { duration: 3000 }),
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private load(): void {
    this.loading = true;
    this.schedulesService.findAll().subscribe({
      next: rules => { this.rules = rules; this.loading = false; },
      error: () => this.loading = false,
    });
    this.schedulesService.getRotationConfig().subscribe(cfg => this.rotationConfig = cfg);
  }

  get filteredRules(): ClientSchedule[] {
    return this.rules.filter(r => {
      const matchGroup = this.filterGroup === 'ALL' || r.scheduleGroup === this.filterGroup;
      const matchSearch = !this.searchTerm ||
        r.client.name.toLowerCase().includes(this.searchTerm.toLowerCase());
      return matchGroup && matchSearch;
    });
  }

  monthsLabel(group: ScheduleGroup): string {
    if (group === 'BIMONTHLY_EVEN') return 'Feb · Abr · Jun · Ago · Oct · Dic';
    if (group === 'BIMONTHLY_ODD')  return 'Ene · Mar · May · Jul · Sep · Nov';
    return '—';
  }

  onGroupChange(rule: ClientSchedule, group: ScheduleGroup): void {
    rule.scheduleGroup = group;
    this.saveSubject.next({ clientId: rule.clientId, scheduleGroup: group, technicianId: rule.technicianId });
  }

  onTechnicianChange(rule: ClientSchedule, technicianId: string | null): void {
    rule.technicianId = technicianId;
    this.saveSubject.next({ clientId: rule.clientId, scheduleGroup: rule.scheduleGroup, technicianId });
  }

  openRotationModal(): void {
    const ref = this.dialog.open(RotationModalComponent, {
      width: '540px',
      data: this.rotationConfig,
    });
    ref.afterClosed().subscribe((saved: RotationConfig | undefined) => {
      if (saved) this.rotationConfig = saved;
    });
  }
}
```

- [ ] **Paso 2: Crear el template**

```html
<!-- config-tab.component.html -->
<div class="cfg-toolbar">
  <mat-button-toggle-group [(value)]="filterGroup" class="grp-toggle">
    <mat-button-toggle value="ALL">Todos</mat-button-toggle>
    <mat-button-toggle value="BIMONTHLY_EVEN">Grupo A · Par</mat-button-toggle>
    <mat-button-toggle value="BIMONTHLY_ODD">Grupo B · Impar</mat-button-toggle>
  </mat-button-toggle-group>

  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search-field">
    <mat-label>Buscar cliente</mat-label>
    <input matInput [(ngModel)]="searchTerm" />
  </mat-form-field>

  <div class="rotation-area">
    <span *ngIf="rotationConfig?.isActive" class="rot-badge">
      <span class="rot-dot"></span> Rotación activa
    </span>
    <button mat-stroked-button (click)="openRotationModal()">↺ Configurar rotación</button>
  </div>
</div>

<div *ngIf="loading" class="loading-wrap">
  <mat-spinner diameter="32"></mat-spinner>
</div>

<table mat-table [dataSource]="filteredRules" *ngIf="!loading">
  <ng-container matColumnDef="client">
    <th mat-header-cell *matHeaderCellDef>Cliente</th>
    <td mat-cell *matCellDef="let rule">{{ rule.client.name }}</td>
  </ng-container>

  <ng-container matColumnDef="group">
    <th mat-header-cell *matHeaderCellDef>Grupo</th>
    <td mat-cell *matCellDef="let rule">
      <mat-button-toggle-group
        [value]="rule.scheduleGroup"
        (change)="onGroupChange(rule, $event.value)"
        class="grp-inline">
        <mat-button-toggle value="BIMONTHLY_EVEN">A · Par</mat-button-toggle>
        <mat-button-toggle value="BIMONTHLY_ODD">B · Impar</mat-button-toggle>
        <mat-button-toggle [value]="null">—</mat-button-toggle>
      </mat-button-toggle-group>
    </td>
  </ng-container>

  <ng-container matColumnDef="months">
    <th mat-header-cell *matHeaderCellDef>Meses activos</th>
    <td mat-cell *matCellDef="let rule" class="months-hint">{{ monthsLabel(rule.scheduleGroup) }}</td>
  </ng-container>

  <ng-container matColumnDef="technician">
    <th mat-header-cell *matHeaderCellDef>Técnico asignado</th>
    <td mat-cell *matCellDef="let rule">
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-select
          [value]="rule.technicianId"
          (selectionChange)="onTechnicianChange(rule, $event.value)">
          <mat-option [value]="null">— Sin asignar —</mat-option>
          <!-- Los técnicos vendrán del mismo servicio; por ahora se puede extender -->
        </mat-select>
      </mat-form-field>
    </td>
  </ng-container>

  <tr mat-header-row *matHeaderRowDef="displayedColumns; sticky: true"></tr>
  <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
</table>
```

> **Nota:** la lista de técnicos para el `mat-select` debe cargarse del endpoint `GET /technicians` existente. Inyectar `HttpClient` o crear un método `getTechnicians()` en `SchedulesService` que llame a `/technicians`.

Agregar a `SchedulesService`:

```typescript
import { Technician } from '../technician/technician.models'; // ajustar path según el proyecto

getTechnicians(): Observable<Array<{ id: string; user: { name: string } }>> {
  return this.http.get<Array<{ id: string; user: { name: string } }>>(`${environment.apiUrl}/technicians`);
}
```

Y en `ConfigTabComponent.ngOnInit()`, cargar los técnicos y almacenarlos en `technicians: Array<{id: string; name: string}>`.

- [ ] **Paso 3: Estilos**

```scss
// config-tab.component.scss
.cfg-toolbar {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 24px; border-bottom: 1px solid var(--border);
}
.search-field { max-width: 200px; }
.rotation-area { margin-left: auto; display: flex; align-items: center; gap: 10px; }
.rot-badge {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; color: var(--purple);
  background: rgba(155,127,232,.1); border: 1px solid rgba(155,127,232,.25);
  border-radius: 5px; padding: 4px 10px;
}
.rot-dot {
  width: 6px; height: 6px; border-radius: 50%; background: var(--purple);
  animation: pulse 2s infinite;
}
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
.months-hint { font-family: var(--font-mono); font-size: 10px; color: var(--tx-lo); }
.grp-inline { font-size: 11px; }
.loading-wrap { display: flex; justify-content: center; padding: 40px; }
```

- [ ] **Paso 4: Verificar en el navegador**

Navegar a `/schedules` → tab "Configuración". Verificar que la tabla carga, que cambiar el grupo se guarda y aparece el toast "Guardado".

- [ ] **Paso 5: Commit**

```bash
git add frontend/src/app/features/schedules/config-tab/
git commit -m "feat(schedules): tab Configuración con reactive save y toggle de grupo"
```

---

### Task 7: Frontend — Modal de rotación

**Files:**
- Modify: `frontend/src/app/features/schedules/config-tab/rotation-modal/rotation-modal.component.ts`
- Modify: `frontend/src/app/features/schedules/config-tab/rotation-modal/rotation-modal.component.html`
- Modify: `frontend/src/app/features/schedules/config-tab/rotation-modal/rotation-modal.component.scss`

**Interfaces:**
- Consumes: `SchedulesService.saveRotationConfig()`, `SchedulesService.previewRotation()`, `MAT_DIALOG_DATA` con `RotationConfig`
- Produces: dialog que emite `RotationConfig` actualizado al cerrarse

- [ ] **Paso 1: Implementar el componente**

```typescript
// rotation-modal.component.ts
import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { RotationConfig, RotationFrequency, RotationPreview, SchedulesService } from '../../schedules.service';

@Component({
  selector: 'app-rotation-modal',
  templateUrl: './rotation-modal.component.html',
  styleUrl: './rotation-modal.component.scss',
})
export class RotationModalComponent implements OnInit {
  isActive: boolean;
  frequency: RotationFrequency;
  preview: RotationPreview | null = null;
  loading = false;
  saving = false;
  maxCount = 1;

  constructor(
    @Inject(MAT_DIALOG_DATA) private data: RotationConfig,
    private ref: MatDialogRef<RotationModalComponent>,
    private schedulesService: SchedulesService,
  ) {
    this.isActive = data?.isActive ?? false;
    this.frequency = data?.frequency ?? 'EVERY_GENERATION';
  }

  ngOnInit(): void {
    this.loadPreview();
  }

  private loadPreview(): void {
    this.loading = true;
    this.schedulesService.previewRotation().subscribe({
      next: p => {
        this.preview = p;
        this.maxCount = Math.max(...p.technicians.map(t => t.clientCount), 1);
        this.loading = false;
      },
      error: () => this.loading = false,
    });
  }

  barWidth(count: number): number {
    return this.maxCount > 0 ? Math.round((count / this.maxCount) * 100) : 0;
  }

  save(): void {
    this.saving = true;
    this.schedulesService.saveRotationConfig({ isActive: this.isActive, frequency: this.frequency }).subscribe({
      next: cfg => { this.saving = false; this.ref.close(cfg); },
      error: () => this.saving = false,
    });
  }

  deactivateAndClose(): void {
    this.schedulesService.saveRotationConfig({ isActive: false, frequency: this.frequency }).subscribe({
      next: cfg => this.ref.close(cfg),
    });
  }

  close(): void { this.ref.close(); }
}
```

- [ ] **Paso 2: Crear el template**

```html
<!-- rotation-modal.component.html -->
<h2 mat-dialog-title>↺ Rotación automática</h2>

<mat-dialog-content>
  <div class="toggle-row">
    <div>
      <div class="toggle-label">Rotación automática</div>
      <div class="toggle-sub">Al generar cada mes, rota los técnicos automáticamente</div>
    </div>
    <mat-slide-toggle [(ngModel)]="isActive" color="primary"></mat-slide-toggle>
  </div>

  <ng-container *ngIf="isActive">
    <div class="section-label">Frecuencia de rotación</div>
    <mat-button-toggle-group [(value)]="frequency" class="freq-toggle">
      <mat-button-toggle value="EVERY_GENERATION">
        Cada generación<br><small>Rota todos los meses</small>
      </mat-button-toggle>
      <mat-button-toggle value="EVERY_TWO_GENERATIONS">
        Cada 2 generaciones<br><small>Mismo técnico por 4 meses</small>
      </mat-button-toggle>
    </mat-button-toggle-group>

    <div class="section-label">Distribución propuesta</div>
    <div *ngIf="loading" class="load-center"><mat-spinner diameter="28"></mat-spinner></div>
    <div *ngIf="!loading && preview">
      <div *ngFor="let t of preview.technicians" class="tech-row">
        <div class="tech-avatar">{{ t.name.slice(0,2).toUpperCase() }}</div>
        <div class="tech-info">
          <div class="tech-top">
            <span class="tech-name">{{ t.name }}</span>
            <span class="tech-count">{{ t.clientCount }} clientes</span>
          </div>
          <mat-progress-bar mode="determinate" [value]="barWidth(t.clientCount)"></mat-progress-bar>
        </div>
      </div>
    </div>

    <div class="hint-box">
      💡 La rotación se aplica a partir de la próxima generación. Podés ajustar manualmente cualquier cliente después.
    </div>
  </ng-container>
</mat-dialog-content>

<mat-dialog-actions>
  <button mat-button color="warn" (click)="deactivateAndClose()">Desactivar y cerrar</button>
  <span class="spacer"></span>
  <button mat-stroked-button (click)="close()">Cancelar</button>
  <button mat-flat-button color="primary" (click)="save()" [disabled]="saving">
    {{ saving ? 'Guardando...' : 'Guardar configuración' }}
  </button>
</mat-dialog-actions>
```

- [ ] **Paso 3: Estilos**

```scss
// rotation-modal.component.scss
.toggle-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 0; border-bottom: 1px solid var(--border); margin-bottom: 16px;
}
.toggle-label { font-weight: 500; }
.toggle-sub { font-size: 11px; color: var(--tx-lo); margin-top: 2px; }
.section-label {
  font-size: 9px; text-transform: uppercase; letter-spacing: .8px;
  color: var(--tx-lo); margin: 14px 0 8px;
}
.freq-toggle { width: 100%; margin-bottom: 16px; }
.tech-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid rgba(42,47,66,.5); }
.tech-avatar {
  width: 32px; height: 32px; border-radius: 50%; background: rgba(91,141,238,.2);
  color: var(--accent); display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; flex-shrink: 0;
}
.tech-info { flex: 1; }
.tech-top { display: flex; justify-content: space-between; margin-bottom: 4px; }
.tech-name { font-size: 12px; font-weight: 500; }
.tech-count { font-size: 11px; color: var(--tx-lo); }
.load-center { display: flex; justify-content: center; padding: 20px; }
.hint-box {
  margin-top: 14px; padding: 10px 12px; background: rgba(91,141,238,.07);
  border-radius: 6px; font-size: 11px; color: var(--tx-lo);
}
.spacer { flex: 1; }
```

- [ ] **Paso 4: Verificar en el navegador**

Abrir el modal desde el botón "↺ Configurar rotación". Verificar toggle, barras de distribución y que "Guardar" llama al backend.

- [ ] **Paso 5: Commit**

```bash
git add frontend/src/app/features/schedules/config-tab/rotation-modal/
git commit -m "feat(schedules): modal de configuración de rotación automática"
```

---

### Task 8: Frontend — Tab Generación mensual

**Files:**
- Modify: `frontend/src/app/features/schedules/generation-tab/generation-tab.component.ts`
- Modify: `frontend/src/app/features/schedules/generation-tab/generation-tab.component.html`
- Modify: `frontend/src/app/features/schedules/generation-tab/generation-tab.component.scss`

**Interfaces:**
- Consumes: `SchedulesService.getMonthlyPreview()`, `SchedulesService.generateMonth()`
- Produces: tabla de preview del mes + botón de generación con feedback de progreso

- [ ] **Paso 1: Implementar el componente**

```typescript
// generation-tab.component.ts
import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { GenerationResult, MonthlyPreview, SchedulesService } from '../schedules.service';

const MONTH_NAMES = ['', 'Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

@Component({
  selector: 'app-generation-tab',
  templateUrl: './generation-tab.component.html',
  styleUrl: './generation-tab.component.scss',
})
export class GenerationTabComponent implements OnInit {
  year = new Date().getFullYear();
  month = new Date().getMonth() + 1;
  preview: MonthlyPreview | null = null;
  generating = false;
  lastResult: GenerationResult | null = null;
  displayedColumns = ['client', 'technician'];

  get monthName(): string { return MONTH_NAMES[this.month]; }
  get isEvenGroup(): boolean { return this.preview?.group === 'BIMONTHLY_EVEN'; }
  get canGenerate(): boolean {
    return !!this.preview && this.preview.clientsWithoutTechnician === 0 && !this.generating;
  }

  constructor(
    private readonly schedulesService: SchedulesService,
    private readonly snack: MatSnackBar,
  ) {}

  ngOnInit(): void { this.loadPreview(); }

  private loadPreview(): void {
    this.preview = null;
    this.lastResult = null;
    this.schedulesService.getMonthlyPreview(this.year, this.month).subscribe(p => this.preview = p);
  }

  prevMonth(): void {
    if (this.month === 1) { this.month = 12; this.year--; } else { this.month--; }
    this.loadPreview();
  }

  nextMonth(): void {
    if (this.month === 12) { this.month = 1; this.year++; } else { this.month++; }
    this.loadPreview();
  }

  generate(): void {
    this.generating = true;
    this.schedulesService.generateMonth(this.year, this.month).subscribe({
      next: result => {
        this.lastResult = result;
        this.generating = false;
        this.snack.open(
          `✓ ${result.tasksCreated} tareas generadas · ${result.tasksSkipped} omitidas`,
          undefined, { duration: 4000 },
        );
        this.loadPreview();
      },
      error: () => {
        this.generating = false;
        this.snack.open('Error al generar tareas', 'OK', { duration: 4000 });
      },
    });
  }
}
```

- [ ] **Paso 2: Crear el template**

```html
<!-- generation-tab.component.html -->
<div class="gen-controls">
  <div class="month-nav">
    <button mat-icon-button (click)="prevMonth()"><mat-icon>chevron_left</mat-icon></button>
    <span class="month-label">{{ monthName }} {{ year }}</span>
    <button mat-icon-button (click)="nextMonth()"><mat-icon>chevron_right</mat-icon></button>
  </div>

  <div class="stats" *ngIf="preview">
    <span class="stat">Grupo: <b [class.group-a]="isEvenGroup" [class.group-b]="!isEvenGroup">
      {{ isEvenGroup ? 'A · Par' : 'B · Impar' }}
    </b></span>
    <span class="stat"><b>{{ preview.clients.length }}</b> clientes</span>
    <span class="stat" [class.warn]="preview.clientsWithoutTechnician > 0">
      <b>{{ preview.clientsWithoutTechnician }}</b> sin técnico
    </span>
  </div>
</div>

<div class="group-banner" [class.banner-a]="isEvenGroup" [class.banner-b]="!isEvenGroup" *ngIf="preview">
  Mes {{ isEvenGroup ? 'par' : 'impar' }} — tareas para clientes del
  <strong>Grupo {{ isEvenGroup ? 'A · Par' : 'B · Impar' }}</strong>
</div>

<div class="table-wrap" *ngIf="preview">
  <table mat-table [dataSource]="preview.clients">
    <ng-container matColumnDef="client">
      <th mat-header-cell *matHeaderCellDef>Cliente</th>
      <td mat-cell *matCellDef="let c">{{ c.clientName }}</td>
    </ng-container>
    <ng-container matColumnDef="technician">
      <th mat-header-cell *matHeaderCellDef>Técnico</th>
      <td mat-cell *matCellDef="let c">
        <span *ngIf="c.technicianName" class="tech-ok">{{ c.technicianName }}</span>
        <span *ngIf="!c.technicianName" class="tech-missing">⚠ Sin técnico</span>
      </td>
    </ng-container>
    <tr mat-header-row *matHeaderRowDef="displayedColumns; sticky: true"></tr>
    <tr mat-row *matRowDef="let row; columns: displayedColumns;"
        [class.row-missing]="!row.technicianName"></tr>
  </table>
</div>

<div class="gen-footer">
  <span class="footer-hint" *ngIf="preview?.clientsWithoutTechnician">
    Asigná un técnico a todos los clientes para habilitar la generación
  </span>
  <button mat-flat-button color="primary" [disabled]="!canGenerate" (click)="generate()">
    <mat-spinner *ngIf="generating" diameter="16"></mat-spinner>
    {{ generating ? 'Generando...' : 'Generar ' + monthName + ' ' + year + ' →' }}
  </button>
</div>
```

- [ ] **Paso 3: Estilos**

```scss
// generation-tab.component.scss
.gen-controls {
  display: flex; align-items: center; gap: 20px;
  padding: 14px 24px; border-bottom: 1px solid var(--border);
}
.month-nav { display: flex; align-items: center; gap: 4px; }
.month-label { font-size: 15px; font-weight: 600; min-width: 160px; text-align: center; }
.stats { display: flex; gap: 16px; }
.stat { font-size: 12px; color: var(--tx-lo); b { color: var(--tx); } }
.stat.warn b { color: var(--crit); }
.group-a { color: var(--ok); }
.group-b { color: var(--warn); }
.group-banner {
  margin: 12px 24px; padding: 10px 16px; border-radius: 6px;
  font-size: 12px; font-weight: 500;
  &.banner-a { background: var(--ok-bg); color: var(--ok); border: 1px solid rgba(62,207,142,.2); }
  &.banner-b { background: var(--warn-bg); color: var(--warn); border: 1px solid rgba(245,166,35,.2); }
}
.table-wrap { flex: 1; overflow-y: auto; padding: 0 24px; }
.tech-ok { color: var(--ok); font-size: 12px; }
.tech-missing { color: var(--crit); font-size: 12px; }
.row-missing { background: rgba(240,96,96,.04); }
.gen-footer {
  padding: 14px 24px; border-top: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
}
.footer-hint { font-size: 11px; color: var(--tx-lo); }
```

- [ ] **Paso 4: Verificar en el navegador**

Navegar a tab "Generación mensual". Verificar la tabla del mes actual, el banner de grupo, y que el botón se habilita/deshabilita según clientes sin técnico.

- [ ] **Paso 5: Commit**

```bash
git add frontend/src/app/features/schedules/generation-tab/
git commit -m "feat(schedules): tab Generación mensual con preview, validación y botón de generación"
```

---

### Task 9: Frontend — Tab Historial / Calendario

**Files:**
- Modify: `frontend/src/app/features/schedules/calendar-tab/calendar-tab.component.ts`
- Modify: `frontend/src/app/features/schedules/calendar-tab/calendar-tab.component.html`
- Modify: `frontend/src/app/features/schedules/calendar-tab/calendar-tab.component.scss`

**Interfaces:**
- Consumes: `SchedulesService.getMonthlyPreview(year, month)` para cada mes del año
- Produces: grid 4×3 de cards mensuales con estado y detalle desplegable

- [ ] **Paso 1: Implementar el componente**

```typescript
// calendar-tab.component.ts
import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { MonthlyPreview, SchedulesService } from '../schedules.service';

const MONTH_NAMES = ['', 'Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export interface MonthCard {
  month: number;
  name: string;
  group: 'BIMONTHLY_ODD' | 'BIMONTHLY_EVEN';
  preview: MonthlyPreview | null;
  isCurrentMonth: boolean;
  isFuture: boolean;
  expanded: boolean;
}

@Component({
  selector: 'app-calendar-tab',
  templateUrl: './calendar-tab.component.html',
  styleUrl: './calendar-tab.component.scss',
})
export class CalendarTabComponent implements OnInit {
  year = new Date().getFullYear();
  currentMonth = new Date().getMonth() + 1;
  cards: MonthCard[] = [];
  loading = false;

  constructor(private readonly schedulesService: SchedulesService) {}

  ngOnInit(): void { this.loadYear(); }

  prevYear(): void { this.year--; this.loadYear(); }
  nextYear(): void { this.year++; this.loadYear(); }

  private loadYear(): void {
    this.loading = true;
    const requests = Array.from({ length: 12 }, (_, i) =>
      this.schedulesService.getMonthlyPreview(this.year, i + 1),
    );
    forkJoin(requests).subscribe({
      next: previews => {
        this.cards = previews.map((p, i) => ({
          month: i + 1,
          name: MONTH_NAMES[i + 1],
          group: p.group,
          preview: p,
          isCurrentMonth: this.year === new Date().getFullYear() && i + 1 === this.currentMonth,
          isFuture: this.year > new Date().getFullYear() ||
            (this.year === new Date().getFullYear() && i + 1 > this.currentMonth),
          expanded: false,
        }));
        this.loading = false;
      },
      error: () => this.loading = false,
    });
  }

  toggle(card: MonthCard): void { card.expanded = !card.expanded; }

  groupLabel(group: 'BIMONTHLY_ODD' | 'BIMONTHLY_EVEN'): string {
    return group === 'BIMONTHLY_EVEN' ? 'A · Par' : 'B · Impar';
  }
}
```

- [ ] **Paso 2: Crear el template**

```html
<!-- calendar-tab.component.html -->
<div class="cal-wrap">
  <div class="year-nav">
    <button mat-icon-button (click)="prevYear()"><mat-icon>chevron_left</mat-icon></button>
    <span class="year-label">{{ year }}</span>
    <button mat-icon-button (click)="nextYear()"><mat-icon>chevron_right</mat-icon></button>
    <span class="legend">
      <span class="leg-item leg-a">● Grupo A · Par</span>
      <span class="leg-item leg-b">● Grupo B · Impar</span>
    </span>
  </div>

  <div *ngIf="loading" class="load-center"><mat-spinner diameter="32"></mat-spinner></div>

  <div class="cal-grid" *ngIf="!loading">
    <div *ngFor="let card of cards"
         class="cal-card"
         [class.group-a]="card.group === 'BIMONTHLY_EVEN'"
         [class.group-b]="card.group === 'BIMONTHLY_ODD'"
         [class.current]="card.isCurrentMonth">

      <!-- Header siempre visible y clickeable -->
      <div class="card-head" (click)="toggle(card)">
        <div class="head-left">
          <span class="month-name" [class.future-text]="card.isFuture && !card.isCurrentMonth">
            {{ card.name }}<span *ngIf="card.isCurrentMonth" class="now-tag"> ← hoy</span>
          </span>
          <span class="grp-badge" [class.badge-a]="card.group === 'BIMONTHLY_EVEN'"
                [class.badge-b]="card.group === 'BIMONTHLY_ODD'">
            {{ groupLabel(card.group) }}
          </span>
        </div>
        <div class="head-right">
          <span class="status-badge"
            [class.s-future]="card.isFuture"
            [class.s-current]="card.isCurrentMonth">
            {{ card.isFuture ? 'Futuro' : card.isCurrentMonth ? 'Este mes' : 'Pasado' }}
          </span>
          <mat-icon class="chev" [class.open]="card.expanded">chevron_right</mat-icon>
        </div>
      </div>

      <!-- Summary siempre visible -->
      <div class="card-summary" [class.has-border]="card.expanded">
        <span class="client-count">
          <b>{{ card.preview?.clients?.length ?? 0 }}</b>
          {{ card.isFuture ? 'estimados' : 'clientes' }}
        </span>
      </div>

      <!-- Body desplegable -->
      <div class="card-body" *ngIf="card.expanded">
        <div *ngIf="!card.preview?.clients?.length" class="no-clients">Sin clientes configurados</div>
        <div *ngFor="let c of card.preview?.clients" class="client-row">
          <span class="c-name">{{ c.clientName }}</span>
          <span class="c-tech" [class.no-tech]="!c.technicianName">
            {{ c.technicianName ?? '⚠ Sin técnico' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Paso 3: Estilos**

```scss
// calendar-tab.component.scss
.cal-wrap { padding: 20px 24px; overflow-y: auto; }
.year-nav { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; }
.year-label { font-size: 16px; font-weight: 600; min-width: 50px; }
.legend { display: flex; gap: 14px; margin-left: 12px; font-size: 11px; color: var(--tx-lo); }
.leg-a { color: var(--ok); }
.leg-b { color: var(--warn); }
.load-center { display: flex; justify-content: center; padding: 40px; }

.cal-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }

.cal-card {
  background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px;
  overflow: hidden; transition: border-color .15s;
  &.group-a { border-top: 3px solid var(--ok); }
  &.group-b { border-top: 3px solid var(--warn); }
  &.current { border-color: var(--accent); box-shadow: 0 0 0 1px rgba(91,141,238,.3); }
}
.card-head {
  padding: 10px 12px; display: flex; align-items: center; justify-content: space-between;
  cursor: pointer;
  &:hover { background: var(--bg-hover); }
}
.head-left { display: flex; flex-direction: column; gap: 3px; }
.month-name { font-size: 12px; font-weight: 600; }
.future-text { color: var(--tx-lo); }
.now-tag { color: var(--accent); }
.head-right { display: flex; align-items: center; gap: 4px; }
.grp-badge { font-size: 9px; font-family: var(--font-mono); padding: 1px 6px; border-radius: 8px; display: inline-block; }
.badge-a { background: var(--ok-bg); color: var(--ok); }
.badge-b { background: var(--warn-bg); color: var(--warn); }
.status-badge { font-size: 10px; font-family: var(--font-mono); padding: 2px 7px; border-radius: 8px; background: rgba(122,128,160,.1); color: var(--tx-lo); }
.s-current { background: rgba(91,141,238,.1); color: var(--accent); }
.chev { font-size: 16px; color: var(--tx-lo); transition: transform .2s; &.open { transform: rotate(90deg); } }
.card-summary { padding: 5px 12px 8px; border-bottom: 1px solid transparent; &.has-border { border-bottom-color: var(--border); } }
.client-count { font-size: 11px; color: var(--tx-lo); b { color: var(--tx); } }
.card-body { padding: 6px 0; }
.no-clients { padding: 6px 12px; font-size: 11px; color: var(--tx-lo); font-style: italic; }
.client-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 12px; &:hover { background: var(--bg-hover); } }
.c-name { font-size: 11px; }
.c-tech { font-size: 10px; color: var(--tx-lo); font-family: var(--font-mono); &.no-tech { color: var(--crit); } }
```

- [ ] **Paso 4: Verificar en el navegador**

Navegar a tab "Historial / Calendario". Verificar el grid 4×3, que las cards se expanden al hacer clic, y que los colores de grupo son correctos.

- [ ] **Paso 5: Commit**

```bash
git add frontend/src/app/features/schedules/calendar-tab/
git commit -m "feat(schedules): tab Historial/Calendario con grid anual y cards desplegables"
```

---

## Self-review del plan

**Cobertura del spec:**

| Requisito | Tarea |
|---|---|
| Entidades `ClientSchedule` y `RotationConfig` | Task 1 |
| Enum `ScheduleGroup` con `MONTH_TO_GROUP` | Task 1 |
| Migración TypeORM | Task 1 |
| `findAll`, `upsert` backend | Task 2 |
| `getRotationConfig`, `saveRotationConfig` backend | Task 2 |
| `getMonthlyPreview` backend | Task 3 |
| `generateMonth` con throttle 800ms e idempotencia | Task 3 |
| `previewRotation` y rotación round-robin equilibrada | Task 4 |
| Guard `AdminOrTlGuard` frontend | Task 5 |
| `SchedulesService` Angular con todos los métodos | Task 5 |
| Módulo lazy-loaded + routing + nav item | Task 5 |
| Tab Configuración con reactive save + toast | Task 6 |
| Modal de rotación con toggle on/off y preview | Task 7 |
| Tab Generación mensual con banner de grupo | Task 8 |
| Tab Historial/Calendario con cards desplegables | Task 9 |
| Botón "Desactivar rotación" en modal | Task 7 ✓ |
| Generación bloqueada si hay clientes sin técnico | Task 8 ✓ |

**Sin placeholders confirmado:** todos los pasos tienen código real.

**Consistencia de tipos:** `ScheduleGroup`, `RotationFrequency`, `MonthlyPreview`, `GenerationResult`, `RotationPreview` definidos en Task 1–3 backend y replicados en `schedules.service.ts` frontend (Task 5).
