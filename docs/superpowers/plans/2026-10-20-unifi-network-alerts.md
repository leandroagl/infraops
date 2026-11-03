# UniFi Network Alerts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar UniFi Site Manager (api.ui.com) para centralizar alertas de red de todos los clientes en una vista `/network`, con apertura manual y automática de tickets Odoo.

**Architecture:** API key global cifrada en `integration-config`; mapeo site→cliente en tabla propia; alertas leídas en tiempo real desde api.ui.com sin caché; deduplicación de tickets automáticos via tabla `unifi_tickets` (igual patrón que `expiration_tickets`).

**Tech Stack:** NestJS · TypeORM · PostgreSQL · HttpService · @nestjs/schedule · Angular · Angular Material · Ag-Grid

**Spec:** `docs/superpowers/specs/2026-10-20-unifi-network-alerts-design.md`

## Global Constraints

- TypeORM `synchronize: false` — toda entidad nueva requiere migración SQL explícita
- Sin standalone components Angular — usar NgModule siempre
- `appearance="outline"` único estilo permitido en `mat-form-field`
- Ag-Grid solo para tabla principal de `/network`; `mat-table` para tablas en Admin
- TDD obligatorio: test antes que implementación
- Un archivo confirmado a la vez; esperar aprobación entre tareas si el usuario lo pide
- Idioma de código: inglés; commits: español
- Auth header UniFi Site Manager: `X-API-KEY: <apiKey>` (no Bearer)
- Base URL UniFi: `https://api.ui.com`

## Review Focus

- `GET /unifi/alerts` con 0 sites configurados debe devolver `[]` sin llamar a api.ui.com
- Cron con auto-config deshabilitado (`enabled: false`) no debe crear tickets, aunque haya alertas críticas
- `POST /unifi/alerts/:alertId/ticket` con `alertId` que ya tiene ticket en `unifi_tickets` debe rechazar con 409
- Severidades no reconocidas de la API de UniFi deben mapearse a `low` sin romper el flujo
- `PATCH /unifi/sites/:id` con `enabled: false` no debe eliminar tickets ya creados para ese site

---

## Mapa de archivos

### Backend — nuevos
```
backend/src/
├── integration-config/
│   ├── entities/unifi-config.entity.ts
│   └── dto/unifi-integration-config.dto.ts
├── integrations/unifi/
│   ├── dto/unifi-api.dto.ts
│   ├── unifi.service.ts
│   ├── unifi.service.spec.ts
│   └── unifi.module.ts
├── unifi/
│   ├── entities/
│   │   ├── unifi-site-config.entity.ts
│   │   └── unifi-ticket.entity.ts
│   ├── dto/
│   │   ├── unifi-site-config.dto.ts
│   │   ├── unifi-alert-response.dto.ts
│   │   └── unifi-auto-config.dto.ts
│   ├── unifi-sites.service.ts
│   ├── unifi-sites.service.spec.ts
│   ├── unifi-sites.controller.ts
│   ├── unifi-sites.controller.spec.ts
│   ├── unifi-alerts.service.ts
│   ├── unifi-alerts.service.spec.ts
│   ├── unifi-alerts.controller.ts
│   ├── unifi-alerts.controller.spec.ts
│   ├── unifi-auto-config.service.ts
│   ├── unifi-auto-config.service.spec.ts
│   ├── unifi-auto-config.controller.ts
│   ├── unifi-cron.service.ts
│   ├── unifi-cron.service.spec.ts
│   └── unifi.module.ts
└── migrations/
    ├── 1791400000000-CreateUnifiConfig.ts
    ├── 1791500000000-CreateUnifiSiteConfigs.ts
    └── 1791600000000-CreateUnifiTicketsAndAutoConfig.ts
```

### Backend — modificados
```
backend/src/
├── integration-config/
│   ├── integration-config.service.ts   ← métodos UniFi (getUnifi, patchUnifi, testUnifi, getUnifiDecrypted)
│   ├── integration-config.controller.ts ← endpoints GET/PATCH/POST unifi y unifi/test
│   ├── integration-config.module.ts    ← agregar UnifiConfig a TypeOrmModule.forFeature
│   └── integration-config.service.spec.ts ← agregar tests UniFi
└── app.module.ts                       ← agregar UnifiModule
```

### Frontend — nuevos
```
frontend/src/app/
├── core/
│   ├── models/network.models.ts
│   └── services/network.service.ts
└── features/
    ├── network/
    │   ├── network.module.ts
    │   ├── network-routing.module.ts
    │   ├── network.component.ts
    │   ├── network.component.html
    │   ├── network.component.scss
    │   └── components/network-alert-drawer/
    │       ├── network-alert-drawer.component.ts
    │       ├── network-alert-drawer.component.html
    │       └── network-alert-drawer.component.scss
    └── admin/network-config/
        ├── network-config.component.ts
        ├── network-config.component.html
        ├── network-config.component.scss
        └── network-site-dialog/
            ├── network-site-dialog.component.ts
            └── network-site-dialog.component.html
```

### Frontend — modificados
```
frontend/src/app/
├── core/
│   └── services/integration-config.service.ts  ← añadir UniFi interfaces + métodos
├── core/shell/
│   └── shell.component.ts                       ← añadir nav item 'network'
├── app-routing.module.ts                         ← añadir ruta /network
└── features/admin/
    ├── admin.module.ts                           ← declarar NetworkConfigComponent + dialog
    ├── admin-routing.module.ts                   ← añadir ruta /admin/red
    ├── admin-layout/admin-layout.component.ts    ← añadir tab 'Red'
    └── integraciones/
        ├── integraciones.component.ts            ← añadir estado y métodos UniFi
        └── integraciones.component.html          ← añadir card UniFi
```

---

### Task 1: UnifiConfig entity + integration-config endpoints

**Files:**
- Create: `backend/src/integration-config/entities/unifi-config.entity.ts`
- Create: `backend/src/integration-config/dto/unifi-integration-config.dto.ts`
- Modify: `backend/src/integration-config/integration-config.module.ts`
- Modify: `backend/src/integration-config/integration-config.service.ts`
- Modify: `backend/src/integration-config/integration-config.controller.ts`
- Modify: `backend/src/integration-config/integration-config.service.spec.ts`
- Create: `backend/src/migrations/1791400000000-CreateUnifiConfig.ts`

**Interfaces:**
- Produces: `IntegrationConfigService.getUnifi()`, `patchUnifi(dto, email)`, `testUnifi()`, `getUnifiDecrypted()` — usados por `UnifiCronService` y `UnifiAlertsService` en Task 6

- [ ] **Step 1: Escribir tests para getUnifi y patchUnifi en integration-config.service.spec.ts**

Agregar al `beforeEach` de `integration-config.service.spec.ts`:
```typescript
let unifiRepo: { findOne: jest.Mock; save: jest.Mock };
// en beforeEach:
unifiRepo = { findOne: jest.fn(), save: jest.fn() };
// en providers:
{ provide: getRepositoryToken(UnifiConfig), useValue: unifiRepo },
```
Agregar import de `UnifiConfig` al spec.

Agregar casos de test:
```typescript
describe('UniFi', () => {
  it('getUnifi returns masked apiKey when row exists', async () => {
    unifiRepo.findOne.mockResolvedValue({ id: 1, apiKey: encrypt('real-key', KEY), updatedAt: new Date(), updatedBy: 'test@test.com' });
    const result = await service.getUnifi();
    expect(result.apiKey).toBe(MASK);
    expect(result.updatedBy).toBe('test@test.com');
  });

  it('getUnifi returns empty defaults when no row', async () => {
    unifiRepo.findOne.mockResolvedValue(null);
    const result = await service.getUnifi();
    expect(result.apiKey).toBe(MASK);
    expect(result.updatedAt).toBeNull();
  });

  it('patchUnifi encrypts apiKey and saves', async () => {
    unifiRepo.findOne.mockResolvedValue(null);
    unifiRepo.save.mockImplementation(async (e) => e);
    await service.patchUnifi({ apiKey: 'new-key' }, 'admin@test.com');
    const saved = unifiRepo.save.mock.calls[0][0];
    expect(saved.apiKey).not.toBe('new-key');
    expect(saved.updatedBy).toBe('admin@test.com');
  });

  it('getUnifiDecrypted decrypts stored key', async () => {
    unifiRepo.findOne.mockResolvedValue({ id: 1, apiKey: encrypt('secret', KEY) });
    const result = await service.getUnifiDecrypted();
    expect(result.apiKey).toBe('secret');
  });
});
```

- [ ] **Step 2: Ejecutar tests — deben fallar**

```bash
cd backend && npx jest integration-config.service.spec.ts --no-coverage
```
Expected: FAIL — `UnifiConfig` no definido.

- [ ] **Step 3: Crear la entidad**

`backend/src/integration-config/entities/unifi-config.entity.ts`:
```typescript
import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('unifi_config')
export class UnifiConfig {
  @PrimaryColumn({ type: 'int', default: 1 })
  id: number = 1;

  @Column({ name: 'api_key', type: 'varchar', nullable: true })
  apiKey: string | null = null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'updated_by', type: 'varchar', nullable: true })
  updatedBy: string | null = null;
}
```

- [ ] **Step 4: Crear los DTOs**

`backend/src/integration-config/dto/unifi-integration-config.dto.ts`:
```typescript
import { IsOptional, IsString } from 'class-validator';

export class PatchUnifiIntegrationConfigDto {
  @IsOptional() @IsString() apiKey?: string;
}

export class UnifiIntegrationConfigResponseDto {
  apiKey: string;
  updatedAt: Date | null;
  updatedBy: string | null;
}
```

- [ ] **Step 5: Agregar los métodos al servicio**

En `integration-config.service.ts`, agregar al constructor `@InjectRepository(UnifiConfig) private readonly unifiRepo: Repository<UnifiConfig>`, y los métodos:

```typescript
// ── UNIFI ──

async getUnifi(): Promise<UnifiIntegrationConfigResponseDto> {
  const row = await this.unifiRepo.findOne({ where: { id: 1 } });
  return { apiKey: MASK, updatedAt: row?.updatedAt ?? null, updatedBy: row?.updatedBy ?? null };
}

async patchUnifi(dto: PatchUnifiIntegrationConfigDto, updatedBy: string): Promise<UnifiIntegrationConfigResponseDto> {
  const existing = (await this.unifiRepo.findOne({ where: { id: 1 } })) ?? new UnifiConfig();
  existing.id = 1;
  if (dto.apiKey !== undefined && !isMasked(dto.apiKey) && dto.apiKey.trim() !== '') {
    existing.apiKey = this.safeEncrypt(dto.apiKey.trim());
  }
  existing.updatedBy = updatedBy;
  await this.unifiRepo.save(existing);
  return this.getUnifi();
}

async getUnifiDecrypted(): Promise<{ apiKey: string }> {
  const row = await this.unifiRepo.findOne({ where: { id: 1 } });
  return { apiKey: row?.apiKey ? decrypt(row.apiKey, this.encryptKey) : '' };
}

async testUnifi(): Promise<{ ok: boolean; message: string }> {
  try {
    const { apiKey } = await this.getUnifiDecrypted();
    if (!apiKey) return { ok: false, message: 'Falta el API key de UniFi' };
    const res = await firstValueFrom(
      this.httpService.get('https://api.ui.com/ea/sites', {
        headers: { 'X-API-KEY': apiKey, Accept: 'application/json' },
        timeout: 10000,
      }),
    );
    const count = (res.data?.data ?? []).length;
    return { ok: true, message: `Conexión exitosa. ${count} sites encontrados.` };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}
```

Agregar imports: `UnifiConfig`, `PatchUnifiIntegrationConfigDto`, `UnifiIntegrationConfigResponseDto`.

- [ ] **Step 6: Agregar endpoints al controller**

En `integration-config.controller.ts`, agregar:
```typescript
import { PatchUnifiIntegrationConfigDto, UnifiIntegrationConfigResponseDto } from './dto/unifi-integration-config.dto';

@Get('unifi')
getUnifi(): Promise<UnifiIntegrationConfigResponseDto> { return this.svc.getUnifi(); }

@Patch('unifi')
patchUnifi(@Body() dto: PatchUnifiIntegrationConfigDto, @CurrentUser() u: JwtPayload): Promise<UnifiIntegrationConfigResponseDto> {
  return this.svc.patchUnifi(dto, u.email);
}

@Post('unifi/test')
@HttpCode(200)
testUnifi(): Promise<{ ok: boolean; message: string }> { return this.svc.testUnifi(); }
```

- [ ] **Step 7: Registrar la entidad en el módulo**

En `integration-config.module.ts`, agregar `UnifiConfig` al array de `TypeOrmModule.forFeature([..., UnifiConfig])`.

- [ ] **Step 8: Crear la migración**

`backend/src/migrations/1791400000000-CreateUnifiConfig.ts`:
```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUnifiConfig1791400000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE unifi_config (
        id INT PRIMARY KEY DEFAULT 1,
        api_key VARCHAR,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_by VARCHAR
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS unifi_config`);
  }
}
```

- [ ] **Step 9: Ejecutar tests — deben pasar**

```bash
cd backend && npx jest integration-config.service.spec.ts --no-coverage
```
Expected: PASS todos los tests incluyendo los nuevos UniFi.

- [ ] **Step 10: Commit**

```bash
git add backend/src/integration-config/entities/unifi-config.entity.ts \
        backend/src/integration-config/dto/unifi-integration-config.dto.ts \
        backend/src/integration-config/integration-config.service.ts \
        backend/src/integration-config/integration-config.controller.ts \
        backend/src/integration-config/integration-config.module.ts \
        backend/src/integration-config/integration-config.service.spec.ts \
        backend/src/migrations/1791400000000-CreateUnifiConfig.ts
git commit -m "feat(unifi): agregar UnifiConfig entity y endpoints de credenciales en integration-config"
```

---

### Task 2: UnifiSiteConfig entity + CRUD

**Files:**
- Create: `backend/src/unifi/entities/unifi-site-config.entity.ts`
- Create: `backend/src/unifi/dto/unifi-site-config.dto.ts`
- Create: `backend/src/unifi/unifi-sites.service.ts`
- Create: `backend/src/unifi/unifi-sites.service.spec.ts`
- Create: `backend/src/unifi/unifi-sites.controller.ts`
- Create: `backend/src/unifi/unifi-sites.controller.spec.ts`
- Create: `backend/src/migrations/1791500000000-CreateUnifiSiteConfigs.ts`

**Interfaces:**
- Produces: `UnifiSitesService` con métodos `findAll()`, `create(dto)`, `update(id, dto)`, `remove(id)` — usados por `UnifiSitesController` y por `UnifiAlertsService` (Task 4)

- [ ] **Step 1: Crear la entidad**

`backend/src/unifi/entities/unifi-site-config.entity.ts`:
```typescript
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('unifi_site_configs')
export class UnifiSiteConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'client_id', type: 'uuid' })
  clientId: string;

  @Column({ name: 'client_name', type: 'varchar', default: '' })
  clientName: string;

  @Column({ name: 'site_id', type: 'varchar' })
  siteId: string;

  @Column({ name: 'site_name', type: 'varchar' })
  siteName: string;

  @Column({ name: 'is_enabled', type: 'boolean', default: true })
  isEnabled: boolean;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
```

- [ ] **Step 2: Crear los DTOs**

`backend/src/unifi/dto/unifi-site-config.dto.ts`:
```typescript
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateUnifiSiteConfigDto {
  @IsUUID()         clientId: string;
  @IsString()       clientName: string;
  @IsString()       siteId: string;
  @IsString()       siteName: string;
  @IsOptional()
  @IsBoolean()      isEnabled?: boolean;
}

export class UpdateUnifiSiteConfigDto {
  @IsOptional() @IsString()  siteName?: string;
  @IsOptional() @IsBoolean() isEnabled?: boolean;
}

export class UnifiSiteConfigResponseDto {
  id: string;
  clientId: string;
  clientName: string;
  siteId: string;
  siteName: string;
  isEnabled: boolean;
  createdAt: Date;
}
```

- [ ] **Step 3: Escribir tests del servicio**

`backend/src/unifi/unifi-sites.service.spec.ts`:
```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnifiSitesService } from './unifi-sites.service';
import { UnifiSiteConfig } from './entities/unifi-site-config.entity';

describe('UnifiSitesService', () => {
  let service: UnifiSitesService;
  let repo: { find: jest.Mock; findOne: jest.Mock; save: jest.Mock; delete: jest.Mock };

  beforeEach(async () => {
    repo = { find: jest.fn(), findOne: jest.fn(), save: jest.fn(), delete: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        UnifiSitesService,
        { provide: getRepositoryToken(UnifiSiteConfig), useValue: repo },
      ],
    }).compile();
    service = module.get(UnifiSitesService);
  });

  it('findAll returns all rows', async () => {
    repo.find.mockResolvedValue([{ id: 'uuid-1', siteId: 'site-a' }]);
    const result = await service.findAll();
    expect(result).toHaveLength(1);
    expect(result[0].siteId).toBe('site-a');
  });

  it('create saves new site config', async () => {
    repo.save.mockImplementation(async (e) => ({ ...e, id: 'new-uuid', createdAt: new Date() }));
    const dto = { clientId: 'c1', clientName: 'ACME', siteId: 'site-b', siteName: 'Oficina', isEnabled: true };
    const result = await service.create(dto);
    expect(result.siteId).toBe('site-b');
    expect(repo.save).toHaveBeenCalled();
  });

  it('remove throws NotFoundException when not found', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.remove('non-existent')).rejects.toThrow('Site config no encontrado');
  });
});
```

- [ ] **Step 4: Ejecutar tests — deben fallar**

```bash
cd backend && npx jest unifi-sites.service.spec.ts --no-coverage
```

- [ ] **Step 5: Implementar el servicio**

`backend/src/unifi/unifi-sites.service.ts`:
```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnifiSiteConfig } from './entities/unifi-site-config.entity';
import { CreateUnifiSiteConfigDto, UpdateUnifiSiteConfigDto, UnifiSiteConfigResponseDto } from './dto/unifi-site-config.dto';

@Injectable()
export class UnifiSitesService {
  constructor(
    @InjectRepository(UnifiSiteConfig)
    private readonly repo: Repository<UnifiSiteConfig>,
  ) {}

  async findAll(): Promise<UnifiSiteConfigResponseDto[]> {
    return this.repo.find();
  }

  async create(dto: CreateUnifiSiteConfigDto): Promise<UnifiSiteConfigResponseDto> {
    const entity = this.repo.create({
      clientId: dto.clientId,
      clientName: dto.clientName,
      siteId: dto.siteId,
      siteName: dto.siteName,
      isEnabled: dto.isEnabled ?? true,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateUnifiSiteConfigDto): Promise<UnifiSiteConfigResponseDto> {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Site config no encontrado');
    if (dto.siteName !== undefined) existing.siteName = dto.siteName;
    if (dto.isEnabled !== undefined) existing.isEnabled = dto.isEnabled;
    return this.repo.save(existing);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Site config no encontrado');
    await this.repo.delete(id);
  }

  async findEnabled(): Promise<UnifiSiteConfig[]> {
    return this.repo.find({ where: { isEnabled: true } });
  }
}
```

- [ ] **Step 6: Ejecutar tests — deben pasar**

```bash
cd backend && npx jest unifi-sites.service.spec.ts --no-coverage
```

- [ ] **Step 7: Crear el controller**

`backend/src/unifi/unifi-sites.controller.ts`:
```typescript
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user-role.enum';
import { UnifiSitesService } from './unifi-sites.service';
import { CreateUnifiSiteConfigDto, UpdateUnifiSiteConfigDto } from './dto/unifi-site-config.dto';

@Controller('unifi/sites')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UnifiSitesController {
  constructor(private readonly svc: UnifiSitesService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TL)
  findAll() { return this.svc.findAll(); }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateUnifiSiteConfigDto) { return this.svc.create(dto); }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateUnifiSiteConfigDto) { return this.svc.update(id, dto); }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(204)
  remove(@Param('id') id: string) { return this.svc.remove(id); }
}
```

- [ ] **Step 8: Escribir test del controller**

`backend/src/unifi/unifi-sites.controller.spec.ts`:
```typescript
import { Test } from '@nestjs/testing';
import { UnifiSitesController } from './unifi-sites.controller';
import { UnifiSitesService } from './unifi-sites.service';

describe('UnifiSitesController', () => {
  let controller: UnifiSitesController;
  const svc = { findAll: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn() };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [UnifiSitesController],
      providers: [{ provide: UnifiSitesService, useValue: svc }],
    }).compile();
    controller = module.get(UnifiSitesController);
  });

  it('findAll delegates to service', async () => {
    svc.findAll.mockResolvedValue([]);
    expect(await controller.findAll()).toEqual([]);
  });

  it('remove delegates to service', async () => {
    svc.remove.mockResolvedValue(undefined);
    await expect(controller.remove('some-id')).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 9: Ejecutar tests — deben pasar**

```bash
cd backend && npx jest unifi-sites.controller.spec.ts --no-coverage
```

- [ ] **Step 10: Crear la migración**

`backend/src/migrations/1791500000000-CreateUnifiSiteConfigs.ts`:
```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUnifiSiteConfigs1791500000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE unifi_site_configs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        client_id UUID NOT NULL,
        client_name VARCHAR NOT NULL DEFAULT '',
        site_id VARCHAR NOT NULL,
        site_name VARCHAR NOT NULL,
        is_enabled BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS unifi_site_configs`);
  }
}
```

- [ ] **Step 11: Commit**

```bash
git add backend/src/unifi/ backend/src/migrations/1791500000000-CreateUnifiSiteConfigs.ts
git commit -m "feat(unifi): agregar UnifiSiteConfig entity y CRUD de sites por cliente"
```

---

### Task 3: UnifiService (cliente HTTP de api.ui.com)

**Files:**
- Create: `backend/src/integrations/unifi/dto/unifi-api.dto.ts`
- Create: `backend/src/integrations/unifi/unifi.service.ts`
- Create: `backend/src/integrations/unifi/unifi.service.spec.ts`
- Create: `backend/src/integrations/unifi/unifi.module.ts`

**Interfaces:**
- Produces: `UnifiService.getSiteAlerts(siteId, apiKey): Promise<UnifiAlert[]>` — usado en Task 4 y Task 6

- [ ] **Step 1: Crear los DTOs de la API**

`backend/src/integrations/unifi/dto/unifi-api.dto.ts`:
```typescript
// Respuesta cruda de api.ui.com
export interface UnifiApiSite {
  id: string;
  meta: { name: string; desc?: string };
}

export interface UnifiApiAlert {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info' | string;
  payload?: { message?: string; [key: string]: unknown };
  siteId: string;
  closedAt: string | null;
  createdAt: string;
}

export interface UnifiApiListResponse<T> {
  data: T[];
  nextPage?: string;
}

// DTO normalizado que devuelve UnifiService
export interface UnifiAlert {
  alertId: string;
  siteId: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  createdAt: string;
}
```

- [ ] **Step 2: Escribir los tests del servicio**

`backend/src/integrations/unifi/unifi.service.spec.ts`:
```typescript
import { Test } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { UnifiService } from './unifi.service';

const API_KEY = 'test-api-key';

describe('UnifiService', () => {
  let service: UnifiService;
  let httpGet: jest.Mock;

  beforeEach(async () => {
    httpGet = jest.fn();
    const module = await Test.createTestingModule({
      providers: [
        UnifiService,
        { provide: HttpService, useValue: { get: httpGet } },
      ],
    }).compile();
    service = module.get(UnifiService);
  });

  it('getSiteAlerts returns normalized alerts for active alerts', async () => {
    httpGet.mockReturnValue(of({
      data: {
        data: [
          { id: 'a1', type: 'gw_wan_transition', severity: 'critical', payload: { message: 'WAN down' }, siteId: 'site-1', closedAt: null, createdAt: '2024-01-01T00:00:00Z' },
          { id: 'a2', type: 'device_restart', severity: 'high', payload: {}, siteId: 'site-1', closedAt: '2024-01-01T01:00:00Z', createdAt: '2024-01-01T00:30:00Z' },
        ],
      },
    }));
    const alerts = await service.getSiteAlerts('site-1', API_KEY);
    // solo devuelve alertas sin closedAt
    expect(alerts).toHaveLength(1);
    expect(alerts[0].alertId).toBe('a1');
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].message).toBe('WAN down');
  });

  it('getSiteAlerts maps unknown severity to low', async () => {
    httpGet.mockReturnValue(of({
      data: { data: [{ id: 'a3', type: 'unknown_type', severity: 'whatever', payload: {}, siteId: 's', closedAt: null, createdAt: '2024-01-01T00:00:00Z' }] },
    }));
    const [alert] = await service.getSiteAlerts('s', API_KEY);
    expect(alert.severity).toBe('low');
  });

  it('getSiteAlerts returns empty array when API returns empty data', async () => {
    httpGet.mockReturnValue(of({ data: { data: [] } }));
    const result = await service.getSiteAlerts('site-x', API_KEY);
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 3: Ejecutar tests — deben fallar**

```bash
cd backend && npx jest integrations/unifi/unifi.service.spec.ts --no-coverage
```

- [ ] **Step 4: Implementar UnifiService**

`backend/src/integrations/unifi/unifi.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { UnifiApiAlert, UnifiApiListResponse, UnifiAlert } from './dto/unifi-api.dto';

const VALID_SEVERITIES = new Set(['critical', 'high', 'medium', 'low']);

@Injectable()
export class UnifiService {
  private readonly BASE = 'https://api.ui.com';

  constructor(private readonly httpService: HttpService) {}

  private headers(apiKey: string) {
    return { 'X-API-KEY': apiKey, Accept: 'application/json' };
  }

  private normalizeSeverity(s: string): 'critical' | 'high' | 'medium' | 'low' {
    return VALID_SEVERITIES.has(s) ? (s as 'critical' | 'high' | 'medium' | 'low') : 'low';
  }

  async getSiteAlerts(siteId: string, apiKey: string): Promise<UnifiAlert[]> {
    const res = await firstValueFrom(
      this.httpService.get<UnifiApiListResponse<UnifiApiAlert>>(
        `${this.BASE}/ea/alerts`,
        { headers: this.headers(apiKey), params: { siteId }, timeout: 15000 },
      ),
    );
    return (res.data.data ?? [])
      .filter(a => a.closedAt === null)
      .map(a => ({
        alertId: a.id,
        siteId: a.siteId,
        type: a.type,
        severity: this.normalizeSeverity(a.severity),
        message: a.payload?.message ?? a.type,
        createdAt: a.createdAt,
      }));
  }
}
```

- [ ] **Step 5: Ejecutar tests — deben pasar**

```bash
cd backend && npx jest integrations/unifi/unifi.service.spec.ts --no-coverage
```

- [ ] **Step 6: Crear el módulo**

`backend/src/integrations/unifi/unifi.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { UnifiService } from './unifi.service';

@Module({
  imports: [HttpModule],
  providers: [UnifiService],
  exports: [UnifiService],
})
export class UnifiModule {}
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/integrations/unifi/
git commit -m "feat(unifi): agregar UnifiService con cliente HTTP de api.ui.com"
```

---

### Task 4: UnifiAlertsService + GET /unifi/alerts + POST ticket manual

**Files:**
- Create: `backend/src/unifi/dto/unifi-alert-response.dto.ts`
- Create: `backend/src/unifi/unifi-alerts.service.ts`
- Create: `backend/src/unifi/unifi-alerts.service.spec.ts`
- Create: `backend/src/unifi/unifi-alerts.controller.ts`
- Create: `backend/src/unifi/unifi-alerts.controller.spec.ts`

**Interfaces:**
- Consumes: `UnifiSitesService.findEnabled()`, `UnifiService.getSiteAlerts()`, `IntegrationConfigService.getUnifiDecrypted()`, `OdooService` (para ticket manual)
- Produces: `GET /unifi/alerts → AlertWithTicketDto[]`, `POST /unifi/alerts/:alertId/ticket → { odooTicketId: number }`

- [ ] **Step 1: Crear el DTO de respuesta**

`backend/src/unifi/dto/unifi-alert-response.dto.ts`:
```typescript
export class AlertWithTicketDto {
  alertId: string;
  siteId: string;
  siteName: string;
  clientId: string;
  clientName: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  message: string;
  createdAt: string;
  odooTicketId: number | null;
}
```

- [ ] **Step 2: Escribir tests del servicio**

`backend/src/unifi/unifi-alerts.service.spec.ts`:
```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { UnifiAlertsService } from './unifi-alerts.service';
import { UnifiSitesService } from './unifi-sites.service';
import { UnifiTicket } from './entities/unifi-ticket.entity';
import { UnifiService } from '../integrations/unifi/unifi.service';
import { IntegrationConfigService } from '../integration-config/integration-config.service';
import { OdooService } from '../integrations/odoo/odoo.service';

describe('UnifiAlertsService', () => {
  let service: UnifiAlertsService;
  let sitesSvc: { findEnabled: jest.Mock };
  let unifiSvc: { getSiteAlerts: jest.Mock };
  let integrationCfg: { getUnifiDecrypted: jest.Mock };
  let odooSvc: { createDeviationTicket: jest.Mock };
  let ticketRepo: { find: jest.Mock; findOne: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    sitesSvc = { findEnabled: jest.fn() };
    unifiSvc = { getSiteAlerts: jest.fn() };
    integrationCfg = { getUnifiDecrypted: jest.fn().mockResolvedValue({ apiKey: 'key' }) };
    odooSvc = { createDeviationTicket: jest.fn() };
    ticketRepo = { find: jest.fn().mockResolvedValue([]), findOne: jest.fn(), save: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        UnifiAlertsService,
        { provide: UnifiSitesService, useValue: sitesSvc },
        { provide: UnifiService, useValue: unifiSvc },
        { provide: IntegrationConfigService, useValue: integrationCfg },
        { provide: OdooService, useValue: odooSvc },
        { provide: getRepositoryToken(UnifiTicket), useValue: ticketRepo },
      ],
    }).compile();
    service = module.get(UnifiAlertsService);
  });

  it('getAlerts returns empty array when no enabled sites', async () => {
    sitesSvc.findEnabled.mockResolvedValue([]);
    const result = await service.getAlerts();
    expect(result).toEqual([]);
    expect(unifiSvc.getSiteAlerts).not.toHaveBeenCalled();
  });

  it('getAlerts enriches alerts with ticket info', async () => {
    sitesSvc.findEnabled.mockResolvedValue([{ id: 'sc1', siteId: 'site-1', siteName: 'Oficina', clientId: 'c1', clientName: 'ACME', isEnabled: true }]);
    unifiSvc.getSiteAlerts.mockResolvedValue([{ alertId: 'a1', siteId: 'site-1', type: 'gw_wan', severity: 'critical', message: 'WAN down', createdAt: '2024-01-01T00:00:00Z' }]);
    ticketRepo.find.mockResolvedValue([{ alertId: 'a1', odooTicketId: 42 }]);
    const result = await service.getAlerts();
    expect(result).toHaveLength(1);
    expect(result[0].odooTicketId).toBe(42);
    expect(result[0].clientName).toBe('ACME');
  });

  it('createManualTicket throws ConflictException when ticket already exists', async () => {
    ticketRepo.findOne.mockResolvedValue({ alertId: 'a1', odooTicketId: 99 });
    await expect(service.createManualTicket('a1', 'site-1', 'c1', 'WAN down', 1, [])).rejects.toThrow(ConflictException);
  });
});
```

- [ ] **Step 3: Ejecutar tests — deben fallar**

```bash
cd backend && npx jest unifi-alerts.service.spec.ts --no-coverage
```

- [ ] **Step 4: Implementar UnifiAlertsService**

`backend/src/unifi/unifi-alerts.service.ts`:
```typescript
import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnifiSitesService } from './unifi-sites.service';
import { UnifiService } from '../integrations/unifi/unifi.service';
import { IntegrationConfigService } from '../integration-config/integration-config.service';
import { OdooService } from '../integrations/odoo/odoo.service';
import { UnifiTicket } from './entities/unifi-ticket.entity';
import { AlertWithTicketDto } from './dto/unifi-alert-response.dto';

@Injectable()
export class UnifiAlertsService {
  constructor(
    private readonly sitesSvc: UnifiSitesService,
    private readonly unifiSvc: UnifiService,
    private readonly integrationCfg: IntegrationConfigService,
    private readonly odooSvc: OdooService,
    @InjectRepository(UnifiTicket)
    private readonly ticketRepo: Repository<UnifiTicket>,
  ) {}

  async getAlerts(): Promise<AlertWithTicketDto[]> {
    const sites = await this.sitesSvc.findEnabled();
    if (sites.length === 0) return [];
    const { apiKey } = await this.integrationCfg.getUnifiDecrypted();

    const alerts = (
      await Promise.all(
        sites.map(async site => {
          const raw = await this.unifiSvc.getSiteAlerts(site.siteId, apiKey);
          return raw.map(a => ({ ...a, siteName: site.siteName, clientId: site.clientId, clientName: site.clientName }));
        }),
      )
    ).flat();

    const tickets = await this.ticketRepo.find();
    const ticketByAlertId = new Map(tickets.map(t => [t.alertId, t.odooTicketId]));

    return alerts.map(a => ({
      ...a,
      odooTicketId: ticketByAlertId.get(a.alertId) ?? null,
    }));
  }

  async createManualTicket(
    alertId: string, siteId: string, clientId: string,
    helpdeskTeamId: number, tagIds: number[],
  ): Promise<{ odooTicketId: number }> {
    const existing = await this.ticketRepo.findOne({ where: { alertId } });
    if (existing) throw new ConflictException('Esta alerta ya tiene un ticket de Odoo asociado');

    const odooTicketId = await this.odooSvc.createDeviationTicket(
      clientId,
      helpdeskTeamId,
      tagIds,
      `[UniFi] Alerta de red — ${alertId}`,
      `Alerta UniFi ID: ${alertId}\nSite: ${siteId}`,
    );

    await this.ticketRepo.save({ alertId, siteId, clientId, odooTicketId, createdAt: new Date() });
    return { odooTicketId };
  }
}
```

- [ ] **Step 5: Ejecutar tests — deben pasar**

```bash
cd backend && npx jest unifi-alerts.service.spec.ts --no-coverage
```

- [ ] **Step 6: Crear el controller**

`backend/src/unifi/unifi-alerts.controller.ts`:
```typescript
import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user-role.enum';
import { UnifiAlertsService } from './unifi-alerts.service';

class CreateTicketDto {
  helpdeskTeamId: number;
  tagIds: number[];
  clientId: string;
  siteId: string;
}

@Controller('unifi/alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UnifiAlertsController {
  constructor(private readonly svc: UnifiAlertsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TL, UserRole.COORDINATOR)
  getAlerts() { return this.svc.getAlerts(); }

  @Post(':alertId/ticket')
  @Roles(UserRole.ADMIN, UserRole.TL)
  @HttpCode(200)
  createTicket(@Param('alertId') alertId: string, @Body() dto: CreateTicketDto) {
    return this.svc.createManualTicket(alertId, dto.siteId, dto.clientId, dto.helpdeskTeamId, dto.tagIds ?? []);
  }
}
```

- [ ] **Step 7: Escribir test del controller**

`backend/src/unifi/unifi-alerts.controller.spec.ts`:
```typescript
import { Test } from '@nestjs/testing';
import { UnifiAlertsController } from './unifi-alerts.controller';
import { UnifiAlertsService } from './unifi-alerts.service';

describe('UnifiAlertsController', () => {
  let controller: UnifiAlertsController;
  const svc = { getAlerts: jest.fn(), createManualTicket: jest.fn() };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [UnifiAlertsController],
      providers: [{ provide: UnifiAlertsService, useValue: svc }],
    }).compile();
    controller = module.get(UnifiAlertsController);
  });

  it('getAlerts returns service result', async () => {
    svc.getAlerts.mockResolvedValue([]);
    expect(await controller.getAlerts()).toEqual([]);
  });

  it('createTicket delegates to service with correct params', async () => {
    svc.createManualTicket.mockResolvedValue({ odooTicketId: 5 });
    const result = await controller.createTicket('alert-1', { helpdeskTeamId: 1, tagIds: [], clientId: 'c1', siteId: 's1' });
    expect(result.odooTicketId).toBe(5);
    expect(svc.createManualTicket).toHaveBeenCalledWith('alert-1', 's1', 'c1', 1, []);
  });
});
```

- [ ] **Step 8: Ejecutar todos los tests UniFi hasta ahora**

```bash
cd backend && npx jest --testPathPattern="unifi" --no-coverage
```

- [ ] **Step 9: Commit**

```bash
git add backend/src/unifi/dto/ backend/src/unifi/unifi-alerts.service.ts backend/src/unifi/unifi-alerts.service.spec.ts backend/src/unifi/unifi-alerts.controller.ts backend/src/unifi/unifi-alerts.controller.spec.ts
git commit -m "feat(unifi): agregar UnifiAlertsService con GET alertas y POST ticket manual"
```

---

### Task 5: UnifiTicket entity + cron auto-tickets + auto-config + UnifiModule + AppModule

**Files:**
- Create: `backend/src/unifi/entities/unifi-ticket.entity.ts`
- Create: `backend/src/unifi/dto/unifi-auto-config.dto.ts`
- Create: `backend/src/unifi/unifi-auto-config.service.ts`
- Create: `backend/src/unifi/unifi-auto-config.service.spec.ts`
- Create: `backend/src/unifi/unifi-auto-config.controller.ts`
- Create: `backend/src/unifi/unifi-cron.service.ts`
- Create: `backend/src/unifi/unifi-cron.service.spec.ts`
- Create: `backend/src/unifi/unifi.module.ts`
- Modify: `backend/src/app.module.ts`
- Create: `backend/src/migrations/1791600000000-CreateUnifiTicketsAndAutoConfig.ts`

**Interfaces:**
- `UnifiCronService.createPendingAlertTickets()` — cron diario 8am, usa `UnifiAlertsService.getAlerts()` + `UnifiAutoConfigService.getDecrypted()` + `OdooService`

- [ ] **Step 1: Crear la entidad UnifiTicket**

`backend/src/unifi/entities/unifi-ticket.entity.ts`:
```typescript
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('unifi_tickets')
export class UnifiTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'alert_id', type: 'varchar' })
  alertId: string;

  @Column({ name: 'site_id', type: 'varchar' })
  siteId: string;

  @Column({ name: 'client_id', type: 'uuid' })
  clientId: string;

  @Column({ name: 'odoo_ticket_id', type: 'int' })
  odooTicketId: number;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
```

- [ ] **Step 2: Crear DTOs y servicio de auto-config**

`backend/src/unifi/dto/unifi-auto-config.dto.ts`:
```typescript
import { IsArray, IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class PatchUnifiAutoConfigDto {
  @IsOptional() @IsBoolean()   enabled?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true })  severities?: string[];
  @IsOptional() @IsInt()       helpdeskTeamId?: number | null;
  @IsOptional() @IsArray() @IsInt({ each: true })     tagIds?: number[];
}

export class UnifiAutoConfigResponseDto {
  enabled: boolean;
  severities: string[];
  helpdeskTeamId: number | null;
  tagIds: number[];
}
```

`backend/src/unifi/unifi-auto-config.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnifiAutoConfig } from './entities/unifi-auto-config.entity';
import { PatchUnifiAutoConfigDto, UnifiAutoConfigResponseDto } from './dto/unifi-auto-config.dto';

@Injectable()
export class UnifiAutoConfigService {
  constructor(
    @InjectRepository(UnifiAutoConfig)
    private readonly repo: Repository<UnifiAutoConfig>,
  ) {}

  private async getRow(): Promise<UnifiAutoConfig> {
    return (await this.repo.findOne({ where: { id: 1 } })) ?? new UnifiAutoConfig();
  }

  async get(): Promise<UnifiAutoConfigResponseDto> {
    const row = await this.getRow();
    return { enabled: row.enabled ?? false, severities: row.severities ?? ['critical'], helpdeskTeamId: row.helpdeskTeamId ?? null, tagIds: row.tagIds ?? [] };
  }

  async patch(dto: PatchUnifiAutoConfigDto): Promise<UnifiAutoConfigResponseDto> {
    const existing = await this.getRow();
    existing.id = 1;
    if (dto.enabled !== undefined)         existing.enabled         = dto.enabled;
    if (dto.severities !== undefined)      existing.severities      = dto.severities;
    if (dto.helpdeskTeamId !== undefined)  existing.helpdeskTeamId  = dto.helpdeskTeamId;
    if (dto.tagIds !== undefined)          existing.tagIds          = dto.tagIds;
    await this.repo.save(existing);
    return this.get();
  }
}
```

También crear la entidad `UnifiAutoConfig`:

`backend/src/unifi/entities/unifi-auto-config.entity.ts`:
```typescript
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('unifi_auto_config')
export class UnifiAutoConfig {
  @PrimaryColumn({ type: 'int', default: 1 })
  id: number = 1;

  @Column({ type: 'boolean', default: false })
  enabled: boolean = false;

  @Column({ name: 'severities', type: 'text', array: true, default: () => "ARRAY['critical']" })
  severities: string[] = ['critical'];

  @Column({ name: 'helpdesk_team_id', type: 'int', nullable: true })
  helpdeskTeamId: number | null = null;

  @Column({ name: 'tag_ids', type: 'int', array: true, default: () => 'ARRAY[]::int[]' })
  tagIds: number[] = [];
}
```

- [ ] **Step 3: Escribir tests del cron**

`backend/src/unifi/unifi-cron.service.spec.ts`:
```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnifiCronService } from './unifi-cron.service';
import { UnifiAlertsService } from './unifi-alerts.service';
import { UnifiAutoConfigService } from './unifi-auto-config.service';
import { UnifiTicket } from './entities/unifi-ticket.entity';
import { OdooService } from '../integrations/odoo/odoo.service';

describe('UnifiCronService', () => {
  let service: UnifiCronService;
  let alertsSvc: { getAlerts: jest.Mock };
  let autoConfigSvc: { get: jest.Mock };
  let odooSvc: { createDeviationTicket: jest.Mock };
  let ticketRepo: { find: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    alertsSvc = { getAlerts: jest.fn() };
    autoConfigSvc = { get: jest.fn() };
    odooSvc = { createDeviationTicket: jest.fn() };
    ticketRepo = { find: jest.fn().mockResolvedValue([]), save: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        UnifiCronService,
        { provide: UnifiAlertsService, useValue: alertsSvc },
        { provide: UnifiAutoConfigService, useValue: autoConfigSvc },
        { provide: OdooService, useValue: odooSvc },
        { provide: getRepositoryToken(UnifiTicket), useValue: ticketRepo },
      ],
    }).compile();
    service = module.get(UnifiCronService);
  });

  it('does nothing when auto-config is disabled', async () => {
    autoConfigSvc.get.mockResolvedValue({ enabled: false, severities: ['critical'], helpdeskTeamId: 1, tagIds: [] });
    await service.createPendingAlertTickets();
    expect(alertsSvc.getAlerts).not.toHaveBeenCalled();
    expect(odooSvc.createTicket).not.toHaveBeenCalled();
  });

  it('does nothing when helpdeskTeamId is null', async () => {
    autoConfigSvc.get.mockResolvedValue({ enabled: true, severities: ['critical'], helpdeskTeamId: null, tagIds: [] });
    await service.createPendingAlertTickets();
    expect(alertsSvc.getAlerts).not.toHaveBeenCalled();
  });

  it('skips alerts that already have a ticket', async () => {
    autoConfigSvc.get.mockResolvedValue({ enabled: true, severities: ['critical'], helpdeskTeamId: 5, tagIds: [] });
    alertsSvc.getAlerts.mockResolvedValue([{ alertId: 'a1', severity: 'critical', siteId: 's1', clientId: 'c1', siteName: 'Site', clientName: 'ACME', type: 'gw_wan', message: 'WAN down', createdAt: '2024-01-01T00:00:00Z', odooTicketId: 42 }]);
    await service.createPendingAlertTickets();
    expect(odooSvc.createTicket).not.toHaveBeenCalled();
  });

  it('creates ticket for new critical alert without ticket', async () => {
    autoConfigSvc.get.mockResolvedValue({ enabled: true, severities: ['critical'], helpdeskTeamId: 5, tagIds: [1] });
    alertsSvc.getAlerts.mockResolvedValue([{ alertId: 'a2', severity: 'critical', siteId: 's1', clientId: 'c1', siteName: 'Site', clientName: 'ACME', type: 'gw_wan', message: 'WAN down', createdAt: '2024-01-01T00:00:00Z', odooTicketId: null }]);
    odooSvc.createDeviationTicket.mockResolvedValue(99);
    await service.createPendingAlertTickets();
    expect(odooSvc.createDeviationTicket).toHaveBeenCalledTimes(1);
    expect(ticketRepo.save).toHaveBeenCalledWith(expect.objectContaining({ alertId: 'a2', odooTicketId: 99 }));
  });
});
```

- [ ] **Step 4: Ejecutar tests — deben fallar**

```bash
cd backend && npx jest unifi-cron.service.spec.ts --no-coverage
```

- [ ] **Step 5: Implementar UnifiCronService**

`backend/src/unifi/unifi-cron.service.ts`:
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnifiAlertsService } from './unifi-alerts.service';
import { UnifiAutoConfigService } from './unifi-auto-config.service';
import { UnifiTicket } from './entities/unifi-ticket.entity';
import { OdooService } from '../integrations/odoo/odoo.service';

@Injectable()
export class UnifiCronService {
  private readonly logger = new Logger(UnifiCronService.name);

  constructor(
    private readonly alertsSvc: UnifiAlertsService,
    private readonly autoConfigSvc: UnifiAutoConfigService,
    private readonly odooSvc: OdooService,
    @InjectRepository(UnifiTicket)
    private readonly ticketRepo: Repository<UnifiTicket>,
  ) {}

  @Cron('0 8 * * *')
  async createPendingAlertTickets(): Promise<void> {
    try {
      const cfg = await this.autoConfigSvc.get();
      if (!cfg.enabled || !cfg.helpdeskTeamId) {
        this.logger.log('createPendingAlertTickets: auto-config deshabilitado o sin equipo, omitiendo');
        return;
      }

      const alerts = await this.alertsSvc.getAlerts();
      const pending = alerts.filter(
        a => a.odooTicketId === null && cfg.severities.includes(a.severity),
      );

      let created = 0;
      let errors = 0;

      for (const alert of pending) {
        try {
          const odooTicketId = await this.odooSvc.createDeviationTicket(
            alert.clientId,
            cfg.helpdeskTeamId!,
            cfg.tagIds,
            `[UniFi] ${alert.type} — ${alert.clientName}`,
            `Cliente: ${alert.clientName}\nSite: ${alert.siteName}\nMensaje: ${alert.message}\nAlerta ID: ${alert.alertId}`,
          );
          await this.ticketRepo.save({ alertId: alert.alertId, siteId: alert.siteId, clientId: alert.clientId, odooTicketId, createdAt: new Date() });
          created++;
        } catch (err) {
          this.logger.error(`Error creando ticket para alerta ${alert.alertId}: ${(err as Error).message}`);
          errors++;
        }
      }

      this.logger.log(`createPendingAlertTickets: ${created} creados, ${errors} errores`);
    } catch (err) {
      this.logger.error(`createPendingAlertTickets falló: ${(err as Error).message}`);
    }
  }
}
```

- [ ] **Step 6: Ejecutar tests — deben pasar**

```bash
cd backend && npx jest unifi-cron.service.spec.ts --no-coverage
```

- [ ] **Step 7: Crear el controller de auto-config**

`backend/src/unifi/unifi-auto-config.controller.ts`:
```typescript
import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user-role.enum';
import { UnifiAutoConfigService } from './unifi-auto-config.service';
import { PatchUnifiAutoConfigDto } from './dto/unifi-auto-config.dto';

@Controller('unifi/auto-config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UnifiAutoConfigController {
  constructor(private readonly svc: UnifiAutoConfigService) {}

  @Get()  get()                              { return this.svc.get(); }
  @Patch() patch(@Body() dto: PatchUnifiAutoConfigDto) { return this.svc.patch(dto); }
}
```

- [ ] **Step 8: Crear la migración**

`backend/src/migrations/1791600000000-CreateUnifiTicketsAndAutoConfig.ts`:
```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUnifiTicketsAndAutoConfig1791600000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE unifi_tickets (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        alert_id VARCHAR NOT NULL UNIQUE,
        site_id VARCHAR NOT NULL,
        client_id UUID NOT NULL,
        odoo_ticket_id INT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE unifi_auto_config (
        id INT PRIMARY KEY DEFAULT 1,
        enabled BOOLEAN NOT NULL DEFAULT false,
        severities TEXT[] NOT NULL DEFAULT ARRAY['critical'],
        helpdesk_team_id INT,
        tag_ids INT[] NOT NULL DEFAULT ARRAY[]::INT[]
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS unifi_tickets`);
    await queryRunner.query(`DROP TABLE IF EXISTS unifi_auto_config`);
  }
}
```

- [ ] **Step 9: Crear el UnifiModule y registrar en AppModule**

`backend/src/unifi/unifi.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnifiSiteConfig } from './entities/unifi-site-config.entity';
import { UnifiTicket } from './entities/unifi-ticket.entity';
import { UnifiAutoConfig } from './entities/unifi-auto-config.entity';
import { UnifiSitesService } from './unifi-sites.service';
import { UnifiSitesController } from './unifi-sites.controller';
import { UnifiAlertsService } from './unifi-alerts.service';
import { UnifiAlertsController } from './unifi-alerts.controller';
import { UnifiAutoConfigService } from './unifi-auto-config.service';
import { UnifiAutoConfigController } from './unifi-auto-config.controller';
import { UnifiCronService } from './unifi-cron.service';
import { UnifiModule as UnifiIntegrationModule } from '../integrations/unifi/unifi.module';
import { IntegrationConfigModule } from '../integration-config/integration-config.module';
import { OdooIntegrationModule } from '../integrations/odoo/odoo-integration.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UnifiSiteConfig, UnifiTicket, UnifiAutoConfig]),
    UnifiIntegrationModule,
    IntegrationConfigModule,
    OdooIntegrationModule,
  ],
  controllers: [UnifiSitesController, UnifiAlertsController, UnifiAutoConfigController],
  providers: [UnifiSitesService, UnifiAlertsService, UnifiAutoConfigService, UnifiCronService],
})
export class UnifiModule {}
```

En `app.module.ts`, agregar `UnifiModule` a `imports` (junto a los demás módulos) y su import correspondiente:
```typescript
import { UnifiModule } from './unifi/unifi.module';
// en imports array:
UnifiModule,
```

- [ ] **Step 10: Ejecutar todos los tests del módulo unifi**

```bash
cd backend && npx jest --testPathPattern="unifi" --no-coverage
```
Expected: PASS todos.

- [ ] **Step 11: Commit**

```bash
git add backend/src/unifi/ backend/src/migrations/1791600000000-CreateUnifiTicketsAndAutoConfig.ts backend/src/app.module.ts
git commit -m "feat(unifi): agregar cron de tickets automáticos, auto-config y UnifiModule"
```

---

### Task 6: Frontend — Admin Integraciones + Admin "Red"

**Files:**
- Modify: `frontend/src/app/core/services/integration-config.service.ts`
- Modify: `frontend/src/app/features/admin/integraciones/integraciones.component.ts`
- Modify: `frontend/src/app/features/admin/integraciones/integraciones.component.html`
- Create: `frontend/src/app/core/models/network.models.ts`
- Create: `frontend/src/app/core/services/network.service.ts`
- Create: `frontend/src/app/features/admin/network-config/network-config.component.ts`
- Create: `frontend/src/app/features/admin/network-config/network-config.component.html`
- Create: `frontend/src/app/features/admin/network-config/network-config.component.scss`
- Create: `frontend/src/app/features/admin/network-config/network-site-dialog/network-site-dialog.component.ts`
- Create: `frontend/src/app/features/admin/network-config/network-site-dialog/network-site-dialog.component.html`
- Modify: `frontend/src/app/features/admin/admin-layout/admin-layout.component.ts`
- Modify: `frontend/src/app/features/admin/admin-routing.module.ts`
- Modify: `frontend/src/app/features/admin/admin.module.ts`

- [ ] **Step 1: Agregar interfaces y métodos UniFi al integration-config.service.ts**

En `integration-config.service.ts`, agregar:
```typescript
export interface UnifiIntegrationConfigDto {
  apiKey: string;
  updatedAt: Date | null;
  updatedBy: string | null;
}

// en la clase IntegrationConfigService:
getUnifi(): Observable<UnifiIntegrationConfigDto> { return this.http.get<UnifiIntegrationConfigDto>(`${this.base}/unifi`); }
patchUnifi(dto: Partial<UnifiIntegrationConfigDto>): Observable<UnifiIntegrationConfigDto> { return this.http.patch<UnifiIntegrationConfigDto>(`${this.base}/unifi`, dto); }
testUnifi(): Observable<TestConnectionResult> { return this.http.post<TestConnectionResult>(`${this.base}/unifi/test`, {}); }
```

- [ ] **Step 2: Crear los modelos de red**

`frontend/src/app/core/models/network.models.ts`:
```typescript
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface NetworkAlert {
  alertId: string;
  siteId: string;
  siteName: string;
  clientId: string;
  clientName: string;
  severity: AlertSeverity;
  type: string;
  message: string;
  createdAt: string;
  odooTicketId: number | null;
}

export interface UnifiSiteConfig {
  id: string;
  clientId: string;
  clientName: string;
  siteId: string;
  siteName: string;
  isEnabled: boolean;
  createdAt: string;
}

export interface UnifiAutoConfig {
  enabled: boolean;
  severities: string[];
  helpdeskTeamId: number | null;
  tagIds: number[];
}

export interface CreateUnifiSiteRequest {
  clientId: string;
  clientName: string;
  siteId: string;
  siteName: string;
  isEnabled?: boolean;
}

export interface UpdateUnifiSiteRequest {
  siteName?: string;
  isEnabled?: boolean;
}
```

- [ ] **Step 3: Crear network.service.ts**

`frontend/src/app/core/services/network.service.ts`:
```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { NetworkAlert, UnifiSiteConfig, UnifiAutoConfig, CreateUnifiSiteRequest, UpdateUnifiSiteRequest } from '../models/network.models';

@Injectable({ providedIn: 'root' })
export class NetworkService {
  private readonly base = `${environment.apiUrl}/unifi`;

  constructor(private readonly http: HttpClient) {}

  getAlerts(): Observable<NetworkAlert[]>           { return this.http.get<NetworkAlert[]>(`${this.base}/alerts`); }
  createTicket(alertId: string, body: { helpdeskTeamId: number; tagIds: number[]; clientId: string; siteId: string }): Observable<{ odooTicketId: number }> {
    return this.http.post<{ odooTicketId: number }>(`${this.base}/alerts/${alertId}/ticket`, body);
  }

  getSites(): Observable<UnifiSiteConfig[]>         { return this.http.get<UnifiSiteConfig[]>(`${this.base}/sites`); }
  createSite(dto: CreateUnifiSiteRequest): Observable<UnifiSiteConfig> { return this.http.post<UnifiSiteConfig>(`${this.base}/sites`, dto); }
  updateSite(id: string, dto: UpdateUnifiSiteRequest): Observable<UnifiSiteConfig> { return this.http.patch<UnifiSiteConfig>(`${this.base}/sites/${id}`, dto); }
  deleteSite(id: string): Observable<void>          { return this.http.delete<void>(`${this.base}/sites/${id}`); }

  getAutoConfig(): Observable<UnifiAutoConfig>      { return this.http.get<UnifiAutoConfig>(`${this.base}/auto-config`); }
  patchAutoConfig(dto: Partial<UnifiAutoConfig>): Observable<UnifiAutoConfig> { return this.http.patch<UnifiAutoConfig>(`${this.base}/auto-config`, dto); }
}
```

- [ ] **Step 4: Agregar card UniFi al componente Integraciones**

En `integraciones.component.ts`, agregar `unifi = initCard()`, `showUnifiApiKey = false`, `unifiForm`, y los métodos `loadUnifi()`, `saveUnifi()`, `testUnifi()`, `toggleUnifiApiKey()`. Patrón idéntico al de `acronisForm`.

En `integraciones.component.html`, agregar una card con el mismo patrón que la card de Acronis:
```html
<!-- UniFi -->
<div class="int-card">
  <div class="int-card__header">
    <span class="int-card__title">UniFi Site Manager</span>
    <span class="int-card__status" [class.int-card__status--ok]="unifi.connectionStatus === 'ok'"
          [class.int-card__status--error]="unifi.connectionStatus === 'error'">
      {{ unifi.connectionStatus === 'ok' ? 'Conectado' : unifi.connectionStatus === 'error' ? 'Error' : '—' }}
    </span>
  </div>
  <form [formGroup]="unifiForm" (ngSubmit)="saveUnifi()">
    <mat-form-field appearance="outline" subscriptSizing="dynamic" style="width:100%">
      <mat-label>API Key</mat-label>
      <input matInput formControlName="apiKey" [type]="showUnifiApiKey ? 'text' : 'password'" />
      <button mat-icon-button matSuffix type="button" (click)="toggleUnifiApiKey()">
        <mat-icon>{{ showUnifiApiKey ? 'visibility_off' : 'visibility' }}</mat-icon>
      </button>
    </mat-form-field>
    <div class="int-card__actions">
      <button mat-stroked-button type="button" (click)="testUnifi()" [disabled]="unifi.testing">
        {{ unifi.testing ? 'Probando...' : 'Probar conexión' }}
      </button>
      <button mat-flat-button color="primary" type="submit" [disabled]="unifi.saving">Guardar</button>
    </div>
    <div class="int-card__meta" *ngIf="unifi.updatedAt">
      Actualizado {{ unifi.updatedAt | date:'dd/MM/yyyy HH:mm' }} por {{ unifi.updatedBy }}
    </div>
    <div class="int-card__message" *ngIf="unifi.connectionMessage">{{ unifi.connectionMessage }}</div>
  </form>
</div>
```

- [ ] **Step 5: Crear NetworkConfigComponent**

`frontend/src/app/features/admin/network-config/network-config.component.ts`:
```typescript
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormBuilder, FormGroup } from '@angular/forms';
import { NetworkService } from '../../../core/services/network.service';
import { NetworkSiteDialogComponent } from './network-site-dialog/network-site-dialog.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import type { UnifiSiteConfig, UnifiAutoConfig } from '../../../core/models/network.models';

@Component({
  selector: 'app-network-config',
  templateUrl: './network-config.component.html',
  styleUrl: './network-config.component.scss',
})
export class NetworkConfigComponent implements OnInit {
  sites: UnifiSiteConfig[] = [];
  autoConfig: UnifiAutoConfig | null = null;
  loadingSites = false;
  savingAuto = false;
  autoForm: FormGroup;
  readonly siteCols = ['clientName', 'siteId', 'siteName', 'isEnabled', 'actions'];
  readonly severityOptions = ['critical', 'high', 'medium', 'low'];
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly svc: NetworkService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar,
    private readonly fb: FormBuilder,
  ) {
    this.autoForm = this.fb.group({ enabled: [false], severities: [[]], helpdeskTeamId: [null], tagIds: [[]] });
  }

  ngOnInit(): void { this.loadSites(); this.loadAutoConfig(); }

  loadSites(): void {
    this.loadingSites = true;
    this.svc.getSites().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: sites => { this.sites = sites; this.loadingSites = false; },
      error: () => this.loadingSites = false,
    });
  }

  loadAutoConfig(): void {
    this.svc.getAutoConfig().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: cfg => { this.autoConfig = cfg; this.autoForm.patchValue(cfg); },
    });
  }

  openSiteDialog(site?: UnifiSiteConfig): void {
    this.dialog.open(NetworkSiteDialogComponent, { data: site ?? null, width: '480px' })
      .afterClosed().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(saved => { if (saved) this.loadSites(); });
  }

  deleteSite(site: UnifiSiteConfig): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Eliminar site', message: `¿Eliminar ${site.siteName} (${site.clientName})?` },
      width: '420px',
    }).afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(confirmed => {
      if (!confirmed) return;
      this.svc.deleteSite(site.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => { this.sites = this.sites.filter(s => s.id !== site.id); this.snackBar.open('Site eliminado', 'Cerrar', { duration: 3000 }); },
        error: () => this.snackBar.open('Error al eliminar', 'Cerrar', { duration: 3000 }),
      });
    });
  }

  saveAutoConfig(): void {
    this.savingAuto = true;
    this.svc.patchAutoConfig(this.autoForm.value).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: cfg => { this.autoConfig = cfg; this.savingAuto = false; this.snackBar.open('Config guardada', 'Cerrar', { duration: 3000 }); },
      error: () => { this.savingAuto = false; this.snackBar.open('Error al guardar', 'Cerrar', { duration: 3000 }); },
    });
  }
}
```

- [ ] **Step 6: Crear NetworkConfigComponent template (network-config.component.html)**

```html
<div class="nc-container">
  <section class="nc-section">
    <div class="nc-section__header">
      <h3 class="nc-section__title">Sites por cliente</h3>
      <button mat-flat-button color="primary" (click)="openSiteDialog()">Agregar site</button>
    </div>
    <mat-table [dataSource]="sites" class="nc-table">
      <ng-container matColumnDef="clientName">
        <mat-header-cell *matHeaderCellDef>Cliente</mat-header-cell>
        <mat-cell *matCellDef="let row">{{ row.clientName }}</mat-cell>
      </ng-container>
      <ng-container matColumnDef="siteId">
        <mat-header-cell *matHeaderCellDef>Site ID</mat-header-cell>
        <mat-cell *matCellDef="let row" class="font-mono">{{ row.siteId }}</mat-cell>
      </ng-container>
      <ng-container matColumnDef="siteName">
        <mat-header-cell *matHeaderCellDef>Nombre</mat-header-cell>
        <mat-cell *matCellDef="let row">{{ row.siteName }}</mat-cell>
      </ng-container>
      <ng-container matColumnDef="isEnabled">
        <mat-header-cell *matHeaderCellDef>Habilitado</mat-header-cell>
        <mat-cell *matCellDef="let row">{{ row.isEnabled ? 'Sí' : 'No' }}</mat-cell>
      </ng-container>
      <ng-container matColumnDef="actions">
        <mat-header-cell *matHeaderCellDef></mat-header-cell>
        <mat-cell *matCellDef="let row">
          <button mat-icon-button (click)="openSiteDialog(row)"><mat-icon>edit</mat-icon></button>
          <button mat-icon-button color="warn" (click)="deleteSite(row)"><mat-icon>delete</mat-icon></button>
        </mat-cell>
      </ng-container>
      <mat-header-row *matHeaderRowDef="siteCols"></mat-header-row>
      <mat-row *matRowDef="let row; columns: siteCols;"></mat-row>
    </mat-table>
    <p *ngIf="!loadingSites && !sites.length" class="nc-empty">No hay sites configurados</p>
  </section>

  <section class="nc-section" *ngIf="autoForm">
    <div class="nc-section__header"><h3 class="nc-section__title">Auto-tickets</h3></div>
    <form [formGroup]="autoForm" (ngSubmit)="saveAutoConfig()">
      <mat-checkbox formControlName="enabled">Habilitar creación automática de tickets</mat-checkbox>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" style="width:100%;margin-top:12px">
        <mat-label>Severidades que disparan ticket</mat-label>
        <mat-select formControlName="severities" multiple>
          <mat-option *ngFor="let s of severityOptions" [value]="s">{{ s }}</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" style="width:100%">
        <mat-label>ID equipo Odoo</mat-label>
        <input matInput type="number" formControlName="helpdeskTeamId" />
      </mat-form-field>
      <div style="margin-top:12px">
        <button mat-flat-button color="primary" type="submit" [disabled]="savingAuto">Guardar config</button>
      </div>
    </form>
  </section>
</div>
```

- [ ] **Step 7: Crear NetworkSiteDialogComponent**

`frontend/src/app/features/admin/network-config/network-site-dialog/network-site-dialog.component.ts`:
```typescript
import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NetworkService } from '../../../../core/services/network.service';
import type { UnifiSiteConfig } from '../../../../core/models/network.models';

@Component({
  selector: 'app-network-site-dialog',
  templateUrl: './network-site-dialog.component.html',
})
export class NetworkSiteDialogComponent {
  form: FormGroup;
  saving = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly svc: NetworkService,
    private readonly snackBar: MatSnackBar,
    private readonly dialogRef: MatDialogRef<NetworkSiteDialogComponent>,
    @Inject(MAT_DIALOG_DATA) readonly data: UnifiSiteConfig | null,
  ) {
    this.form = this.fb.group({
      clientId:   [data?.clientId   ?? '', Validators.required],
      clientName: [data?.clientName ?? '', Validators.required],
      siteId:     [data?.siteId     ?? '', Validators.required],
      siteName:   [data?.siteName   ?? '', Validators.required],
      isEnabled:  [data?.isEnabled  ?? true],
    });
  }

  get isEdit(): boolean { return !!this.data; }

  save(): void {
    if (this.form.invalid) return;
    this.saving = true;
    const obs = this.isEdit
      ? this.svc.updateSite(this.data!.id, { siteName: this.form.value.siteName, isEnabled: this.form.value.isEnabled })
      : this.svc.createSite(this.form.value);
    obs.subscribe({
      next:  () => { this.snackBar.open('Guardado', 'Cerrar', { duration: 3000 }); this.dialogRef.close(true); },
      error: () => { this.saving = false; this.snackBar.open('Error al guardar', 'Cerrar', { duration: 3000 }); },
    });
  }
}
```

`frontend/src/app/features/admin/network-config/network-site-dialog/network-site-dialog.component.html`:
```html
<h2 mat-dialog-title>{{ isEdit ? 'Editar site' : 'Agregar site' }}</h2>
<mat-dialog-content>
  <form [formGroup]="form" style="display:flex;flex-direction:column;gap:8px;padding-top:4px">
    <mat-form-field appearance="outline" subscriptSizing="dynamic">
      <mat-label>ID Cliente (UUID)</mat-label>
      <input matInput formControlName="clientId" [readonly]="isEdit" />
    </mat-form-field>
    <mat-form-field appearance="outline" subscriptSizing="dynamic">
      <mat-label>Nombre del cliente</mat-label>
      <input matInput formControlName="clientName" [readonly]="isEdit" />
    </mat-form-field>
    <mat-form-field appearance="outline" subscriptSizing="dynamic">
      <mat-label>Site ID (UniFi)</mat-label>
      <input matInput formControlName="siteId" [readonly]="isEdit" />
    </mat-form-field>
    <mat-form-field appearance="outline" subscriptSizing="dynamic">
      <mat-label>Nombre del site</mat-label>
      <input matInput formControlName="siteName" />
    </mat-form-field>
    <mat-checkbox formControlName="isEnabled">Habilitado</mat-checkbox>
  </form>
</mat-dialog-content>
<mat-dialog-actions align="end">
  <button mat-stroked-button mat-dialog-close>Cancelar</button>
  <button mat-flat-button color="primary" (click)="save()" [disabled]="saving || form.invalid">Guardar</button>
</mat-dialog-actions>
```

- [ ] **Step 8: Registrar en AdminModule y AdminRoutingModule**

En `admin-routing.module.ts`, agregar:
```typescript
import { NetworkConfigComponent } from './network-config/network-config.component';
// en routes children:
{ path: 'red', component: NetworkConfigComponent },
```

En `admin.module.ts` `declarations`:
```typescript
NetworkConfigComponent,
NetworkSiteDialogComponent,
```
Agregar `import { NetworkSiteDialogComponent } from './network-config/network-site-dialog/network-site-dialog.component';` y `import { NetworkConfigComponent } from './network-config/network-config.component';`.

- [ ] **Step 9: Agregar tab "Red" en AdminLayoutComponent**

En `admin-layout.component.ts`, agregar al array `tabs`:
```typescript
{ path: '/admin/red', label: 'Red' },
```

- [ ] **Step 10: Commit**

```bash
git add frontend/src/app/core/models/network.models.ts \
        frontend/src/app/core/services/network.service.ts \
        frontend/src/app/core/services/integration-config.service.ts \
        frontend/src/app/features/admin/network-config/ \
        frontend/src/app/features/admin/admin-layout/admin-layout.component.ts \
        frontend/src/app/features/admin/admin-routing.module.ts \
        frontend/src/app/features/admin/admin.module.ts \
        frontend/src/app/features/admin/integraciones/
git commit -m "feat(unifi): agregar configuración de Red en Admin y card de integración UniFi"
```

---

### Task 7: Frontend — Vista /network

**Files:**
- Create: `frontend/src/app/features/network/network.module.ts`
- Create: `frontend/src/app/features/network/network-routing.module.ts`
- Create: `frontend/src/app/features/network/network.component.ts`
- Create: `frontend/src/app/features/network/network.component.html`
- Create: `frontend/src/app/features/network/network.component.scss`
- Create: `frontend/src/app/features/network/components/network-alert-drawer/network-alert-drawer.component.ts`
- Create: `frontend/src/app/features/network/components/network-alert-drawer/network-alert-drawer.component.html`
- Create: `frontend/src/app/features/network/components/network-alert-drawer/network-alert-drawer.component.scss`
- Modify: `frontend/src/app/app-routing.module.ts`
- Modify: `frontend/src/app/core/shell/shell.component.ts`

- [ ] **Step 1: Crear NetworkComponent**

`frontend/src/app/features/network/network.component.ts`:
```typescript
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NetworkService } from '../../core/services/network.service';
import type { NetworkAlert, AlertSeverity } from '../../core/models/network.models';
import { ColDef, GridReadyEvent } from 'ag-grid-community';

@Component({
  selector: 'app-network',
  templateUrl: './network.component.html',
  styleUrl: './network.component.scss',
})
export class NetworkComponent implements OnInit {
  alerts: NetworkAlert[] = [];
  selectedAlert: NetworkAlert | null = null;
  drawerOpen = false;
  loading = false;
  filterClient: string = '';
  filterSeverity: AlertSeverity | '' = '';
  filterHasTicket: 'all' | 'with' | 'without' = 'all';
  kpi = { total: 0, critical: 0, affectedClients: 0 };
  private readonly destroyRef = inject(DestroyRef);

  colDefs: ColDef[] = [
    { field: 'clientName', headerName: 'CLIENTE', flex: 1 },
    { field: 'siteName',   headerName: 'SITE',    flex: 1 },
    { field: 'severity',   headerName: 'SEVERIDAD', width: 130,
      cellRenderer: (p: { value: string }) => `<span class="sev-chip sev-chip--${p.value}">${p.value}</span>` },
    { field: 'type',    headerName: 'TIPO',    flex: 1 },
    { field: 'message', headerName: 'MENSAJE', flex: 2 },
    { field: 'createdAt', headerName: 'HACE', width: 110,
      valueFormatter: (p: { value: string }) => {
        const h = Math.round((Date.now() - new Date(p.value).getTime()) / 3600000);
        return h < 1 ? '<1h' : `${h}h`;
      } },
    { field: 'odooTicketId', headerName: 'TICKET', width: 90,
      cellRenderer: (p: { value: number | null }) => p.value ? `#${p.value}` : '—' },
  ];

  constructor(
    private readonly svc: NetworkService,
    private readonly snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.svc.getAlerts().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: alerts => { this.alerts = alerts; this.updateKpi(); this.loading = false; },
      error: () => { this.snackBar.open('Error al cargar alertas', 'Cerrar', { duration: 3000 }); this.loading = false; },
    });
  }

  get filteredAlerts(): NetworkAlert[] {
    return this.alerts.filter(a => {
      if (this.filterClient && !a.clientName.toLowerCase().includes(this.filterClient.toLowerCase())) return false;
      if (this.filterSeverity && a.severity !== this.filterSeverity) return false;
      if (this.filterHasTicket === 'with'    && a.odooTicketId === null) return false;
      if (this.filterHasTicket === 'without' && a.odooTicketId !== null) return false;
      return true;
    });
  }

  private updateKpi(): void {
    this.kpi = {
      total: this.alerts.length,
      critical: this.alerts.filter(a => a.severity === 'critical').length,
      affectedClients: new Set(this.alerts.map(a => a.clientId)).size,
    };
  }

  onRowClicked(alert: NetworkAlert): void {
    this.selectedAlert = alert;
    this.drawerOpen = true;
  }

  closeDrawer(): void { this.drawerOpen = false; this.selectedAlert = null; }

  onTicketCreated(updated: NetworkAlert): void {
    const idx = this.alerts.findIndex(a => a.alertId === updated.alertId);
    if (idx !== -1) this.alerts[idx] = { ...this.alerts[idx], odooTicketId: updated.odooTicketId };
    this.closeDrawer();
  }

  onGridReady(event: GridReadyEvent): void { event.api.sizeColumnsToFit(); }
}
```

- [ ] **Step 2: Crear NetworkComponent template**

`frontend/src/app/features/network/network.component.html`:
```html
<div class="net-view" [class.net-view--drawer-open]="drawerOpen">
  <div class="net-main">
    <!-- KPI strip -->
    <div class="kpi-strip">
      <div class="kpi-card">
        <span class="kpi-card__val">{{ kpi.total }}</span>
        <span class="kpi-card__label">ALERTAS ACTIVAS</span>
      </div>
      <div class="kpi-card kpi-card--crit">
        <span class="kpi-card__val">{{ kpi.critical }}</span>
        <span class="kpi-card__label">CRÍTICAS</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-card__val">{{ kpi.affectedClients }}</span>
        <span class="kpi-card__label">CLIENTES AFECTADOS</span>
      </div>
      <div class="kpi-strip__spacer"></div>
      <button mat-stroked-button (click)="load()">Actualizar</button>
    </div>

    <!-- Filtros -->
    <div class="net-filters">
      <mat-form-field appearance="outline" subscriptSizing="dynamic" style="width:180px">
        <mat-label>Cliente</mat-label>
        <input matInput [(ngModel)]="filterClient" />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" style="width:140px">
        <mat-label>Severidad</mat-label>
        <mat-select [(ngModel)]="filterSeverity">
          <mat-option value="">Todas</mat-option>
          <mat-option value="critical">critical</mat-option>
          <mat-option value="high">high</mat-option>
          <mat-option value="medium">medium</mat-option>
          <mat-option value="low">low</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" style="width:160px">
        <mat-label>Ticket</mat-label>
        <mat-select [(ngModel)]="filterHasTicket">
          <mat-option value="all">Todos</mat-option>
          <mat-option value="with">Con ticket</mat-option>
          <mat-option value="without">Sin ticket</mat-option>
        </mat-select>
      </mat-form-field>
    </div>

    <!-- Grid -->
    <div *ngIf="loading" class="net-loading"><mat-spinner [diameter]="36"></mat-spinner></div>
    <ag-grid-angular *ngIf="!loading"
      class="ag-theme-alpine-dark net-grid"
      [rowData]="filteredAlerts"
      [columnDefs]="colDefs"
      [animateRows]="true"
      (rowClicked)="onRowClicked($event.data)"
      (gridReady)="onGridReady($event)">
    </ag-grid-angular>
  </div>

  <!-- Drawer -->
  <app-network-alert-drawer
    *ngIf="drawerOpen && selectedAlert"
    [alert]="selectedAlert"
    (drawerClosed)="closeDrawer()"
    (ticketCreated)="onTicketCreated($event)">
  </app-network-alert-drawer>
</div>
```

- [ ] **Step 3: Crear NetworkAlertDrawerComponent**

`frontend/src/app/features/network/components/network-alert-drawer/network-alert-drawer.component.ts`:
```typescript
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NetworkService } from '../../../../core/services/network.service';
import type { NetworkAlert } from '../../../../core/models/network.models';

@Component({
  selector: 'app-network-alert-drawer',
  templateUrl: './network-alert-drawer.component.html',
  styleUrl: './network-alert-drawer.component.scss',
})
export class NetworkAlertDrawerComponent {
  @Input() alert!: NetworkAlert;
  @Output() drawerClosed  = new EventEmitter<void>();
  @Output() ticketCreated = new EventEmitter<NetworkAlert>();

  creatingTicket = false;
  helpdeskTeamId = 0;
  tagIds: number[] = [];

  constructor(
    private readonly svc: NetworkService,
    private readonly snackBar: MatSnackBar,
  ) {}

  createTicket(): void {
    if (!this.helpdeskTeamId) { this.snackBar.open('Ingresá el ID del equipo Odoo', 'Cerrar', { duration: 3000 }); return; }
    this.creatingTicket = true;
    this.svc.createTicket(this.alert.alertId, {
      helpdeskTeamId: this.helpdeskTeamId,
      tagIds: this.tagIds,
      clientId: this.alert.clientId,
      siteId: this.alert.siteId,
    }).subscribe({
      next: res => {
        this.snackBar.open(`Ticket #${res.odooTicketId} creado en Odoo`, 'Cerrar', { duration: 4000 });
        this.ticketCreated.emit({ ...this.alert, odooTicketId: res.odooTicketId });
        this.creatingTicket = false;
      },
      error: err => {
        const msg = err?.error?.message ?? 'Error al crear ticket';
        this.snackBar.open(msg, 'Cerrar', { duration: 4000 });
        this.creatingTicket = false;
      },
    });
  }
}
```

`frontend/src/app/features/network/components/network-alert-drawer/network-alert-drawer.component.html`:
```html
<div class="ndr">
  <div class="ndr__header">
    <span class="ndr__title">Detalle de alerta</span>
    <button mat-icon-button (click)="drawerClosed.emit()"><mat-icon>close</mat-icon></button>
  </div>

  <div class="ndr__body">
    <div class="ndr__row"><span class="ndr__label">CLIENTE</span><span>{{ alert.clientName }}</span></div>
    <div class="ndr__row"><span class="ndr__label">SITE</span><span>{{ alert.siteName }}</span></div>
    <div class="ndr__row"><span class="ndr__label">SEVERIDAD</span>
      <span class="sev-chip sev-chip--{{ alert.severity }}">{{ alert.severity }}</span>
    </div>
    <div class="ndr__row"><span class="ndr__label">TIPO</span><span>{{ alert.type }}</span></div>
    <div class="ndr__row"><span class="ndr__label">MENSAJE</span><span>{{ alert.message }}</span></div>
    <div class="ndr__row"><span class="ndr__label">CREADA</span><span>{{ alert.createdAt | date:'dd/MM/yyyy HH:mm' }}</span></div>

    <div class="ndr__row" *ngIf="alert.odooTicketId">
      <span class="ndr__label">TICKET ODOO</span>
      <span class="ndr__ticket">#{{ alert.odooTicketId }}</span>
    </div>

    <ng-container *ngIf="!alert.odooTicketId">
      <div class="ndr__divider"></div>
      <p class="ndr__section-title">Abrir ticket en Odoo</p>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" style="width:100%">
        <mat-label>ID equipo Odoo</mat-label>
        <input matInput type="number" [(ngModel)]="helpdeskTeamId" />
      </mat-form-field>
      <button mat-flat-button color="primary" style="width:100%;margin-top:8px"
              (click)="createTicket()" [disabled]="creatingTicket">
        {{ creatingTicket ? 'Creando...' : 'Abrir ticket en Odoo' }}
      </button>
    </ng-container>
  </div>
</div>
```

- [ ] **Step 4: Crear el módulo de red**

`frontend/src/app/features/network/network-routing.module.ts`:
```typescript
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NetworkComponent } from './network.component';

const routes: Routes = [{ path: '', component: NetworkComponent }];

@NgModule({ imports: [RouterModule.forChild(routes)], exports: [RouterModule] })
export class NetworkRoutingModule {}
```

`frontend/src/app/features/network/network.module.ts`:
```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NetworkRoutingModule } from './network-routing.module';
import { NetworkComponent } from './network.component';
import { NetworkAlertDrawerComponent } from './components/network-alert-drawer/network-alert-drawer.component';

@NgModule({
  declarations: [NetworkComponent, NetworkAlertDrawerComponent],
  imports: [
    CommonModule, FormsModule, AgGridModule,
    MatButtonModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatProgressSpinnerModule, MatIconModule,
    MatSnackBarModule, NetworkRoutingModule,
  ],
})
export class NetworkModule {}
```

- [ ] **Step 5: Registrar la ruta en AppRoutingModule**

En `app-routing.module.ts`, agregar antes de `admin`:
```typescript
{
  path: 'network',
  loadChildren: () => import('./features/network/network.module').then(m => m.NetworkModule),
},
```

- [ ] **Step 6: Agregar la entrada al sidebar**

En `shell.component.ts`, el tipo `NavItem.icon` actualmente acepta un string literal union. Agregar `'network'` al tipo:
```typescript
icon: 'dashboard' | 'clients' | 'tasks' | 'notifications' | 'backups' | 'network' | 'admin' | 'schedules' | 'docs';
```
Y agregar el item en `navItems` entre Backups y Admin:
```typescript
{ route: '/network', label: 'Red', icon: 'network' },
```

Agregar el SVG del ícono de red en `shell.component.html` (ícono de antena/wifi, stroke, 15×15px, `currentColor`) — consultar cómo están definidos los demás íconos en el template del shell y seguir el mismo patrón de `[ngSwitch]` o `*ngIf`.

- [ ] **Step 7: Commit final**

```bash
git add frontend/src/app/features/network/ \
        frontend/src/app/app-routing.module.ts \
        frontend/src/app/core/shell/shell.component.ts
git commit -m "feat(unifi): agregar vista /network con grid de alertas y drawer de detalle"
```
