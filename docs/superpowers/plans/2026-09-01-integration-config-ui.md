# Integration Config UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persistir credenciales de Odoo/InfraDoc/VMware en la DB y exponer una UI en el panel admin para editarlas sin tocar el servidor.

**Architecture:** Nuevo módulo `integration-config` en NestJS con entidades tipadas (una fila por integración), encriptación AES-256-GCM para campos sensibles, y fallback al `.env` si no existe fila en DB. El frontend agrega una tab "Integraciones" en admin con un card por sistema. `OdooSystemRpcService` invalida su cache de uid via versionado cuando la config cambia.

**Tech Stack:** NestJS 11 · TypeORM 0.3 · PostgreSQL · Node.js `crypto` (built-in) · `@nestjs/axios` · Angular · Angular Material

**Spec:** `docs/superpowers/specs/2026-09-01-integration-config-ui-design.md`

## Global Constraints

- Todos los endpoints protegidos con `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(UserRole.ADMIN)`
- TDD: test fallido primero, luego implementación mínima
- Campos sensibles en respuestas HTTP siempre devuelven exactamente `"••••••••"` (8 bullets)
- `INTEGRATIONS_ENCRYPT_KEY` es un hex de 64 chars (32 bytes) — nunca se persiste en DB
- Frontend: Angular sin standalone, Angular Material, todo en `AdminModule`
- Un archivo a la vez; commit al final de cada tarea

---

### Task 1: Crypto utility + rename de env key

**Files:**
- Create: `backend/src/integration-config/crypto.util.ts`
- Create: `backend/src/integration-config/crypto.util.spec.ts`
- Modify: `backend/.env`

**Interfaces:**
- Produces:
  - `MASK: string` — la constante `"••••••••"`
  - `isMasked(value: string | null | undefined): boolean`
  - `encrypt(plaintext: string, keyHex: string): string` — formato devuelto: `"ivB64:authTagB64:ciphertextB64"`
  - `decrypt(stored: string, keyHex: string): string`

- [ ] **Step 1: Rename env key**

En `backend/.env` renombrar:
```diff
-ODOO_ENCRYPT_KEY=8b2202fa0aa8498ca124415c67472e7b479e1eb31a24d948eedeccecc2a5a5c2
+INTEGRATIONS_ENCRYPT_KEY=8b2202fa0aa8498ca124415c67472e7b479e1eb31a24d948eedeccecc2a5a5c2
```

- [ ] **Step 2: Escribir el test**

Create `backend/src/integration-config/crypto.util.spec.ts`:

```typescript
import { encrypt, decrypt, isMasked, MASK } from './crypto.util';

const KEY = '8b2202fa0aa8498ca124415c67472e7b479e1eb31a24d948eedeccecc2a5a5c2';

describe('crypto.util', () => {
  it('cifra y descifra correctamente', () => {
    const original = 'mi-api-key-secreta';
    const stored = encrypt(original, KEY);
    expect(stored).not.toBe(original);
    expect(decrypt(stored, KEY)).toBe(original);
  });

  it('produce ciphertexts distintos para el mismo input (IV aleatorio)', () => {
    const a = encrypt('misma', KEY);
    const b = encrypt('misma', KEY);
    expect(a).not.toBe(b);
    expect(decrypt(a, KEY)).toBe('misma');
    expect(decrypt(b, KEY)).toBe('misma');
  });

  it('isMasked: true para MASK, false para todo lo demás', () => {
    expect(isMasked(MASK)).toBe(true);
    expect(isMasked('')).toBe(false);
    expect(isMasked(null)).toBe(false);
    expect(isMasked('valor-real')).toBe(false);
  });
});
```

- [ ] **Step 3: Correr test para verificar que falla**

```bash
cd backend && npx jest crypto.util.spec.ts --no-coverage
```
Expected: FAIL — `Cannot find module './crypto.util'`

- [ ] **Step 4: Implementar utility**

Create `backend/src/integration-config/crypto.util.ts`:

```typescript
import * as crypto from 'crypto';

export const MASK = '••••••••';
const ALGORITHM = 'aes-256-gcm';

export function isMasked(value: string | null | undefined): boolean {
  return value === MASK;
}

export function encrypt(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decrypt(stored: string, keyHex: string): string {
  const [ivB64, authTagB64, ciphertextB64] = stored.split(':');
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
```

- [ ] **Step 5: Correr test para verificar que pasa**

```bash
cd backend && npx jest crypto.util.spec.ts --no-coverage
```
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/src/integration-config/crypto.util.ts backend/src/integration-config/crypto.util.spec.ts backend/.env
git commit -m "feat(integration-config): utility AES-256-GCM y renombrar ODOO_ENCRYPT_KEY"
```

---

### Task 2: Entidades + Migración

**Files:**
- Create: `backend/src/integration-config/entities/odoo-config.entity.ts`
- Create: `backend/src/integration-config/entities/infradoc-config.entity.ts`
- Create: `backend/src/integration-config/entities/vmware-config.entity.ts`
- Create: `backend/src/migrations/1788600000000-CreateIntegrationConfigTables.ts`

**Interfaces:**
- Produces: entidades `OdooConfig`, `InfraDocConfig`, `VmwareConfig` con una sola fila cada una (id siempre = 1, constrained por CHECK)

- [ ] **Step 1: Entidad OdooConfig**

Create `backend/src/integration-config/entities/odoo-config.entity.ts`:

```typescript
import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('odoo_config')
export class OdooConfig {
  @PrimaryColumn({ type: 'int', default: 1 })
  id: number = 1;

  @Column({ type: 'varchar', nullable: true })
  url: string | null = null;

  @Column({ type: 'varchar', nullable: true })
  db: string | null = null;

  @Column({ type: 'varchar', nullable: true })
  username: string | null = null;

  @Column({ name: 'api_key', type: 'varchar', nullable: true })
  apiKey: string | null = null;

  @Column({ name: 'helpdesk_team_id', type: 'int', nullable: true })
  helpdeskTeamId: number | null = null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'updated_by', type: 'varchar', nullable: true })
  updatedBy: string | null = null;
}
```

- [ ] **Step 2: Entidad InfraDocConfig**

Create `backend/src/integration-config/entities/infradoc-config.entity.ts`:

```typescript
import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('infradoc_config')
export class InfraDocConfig {
  @PrimaryColumn({ type: 'int', default: 1 })
  id: number = 1;

  @Column({ type: 'varchar', nullable: true })
  url: string | null = null;

  @Column({ name: 'api_key', type: 'varchar', nullable: true })
  apiKey: string | null = null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'updated_by', type: 'varchar', nullable: true })
  updatedBy: string | null = null;
}
```

- [ ] **Step 3: Entidad VmwareConfig**

Create `backend/src/integration-config/entities/vmware-config.entity.ts`:

```typescript
import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('vmware_config')
export class VmwareConfig {
  @PrimaryColumn({ type: 'int', default: 1 })
  id: number = 1;

  @Column({ type: 'varchar', nullable: true })
  username: string | null = null;

  @Column({ type: 'varchar', nullable: true })
  password: string | null = null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'updated_by', type: 'varchar', nullable: true })
  updatedBy: string | null = null;
}
```

- [ ] **Step 4: Migración**

Create `backend/src/migrations/1788600000000-CreateIntegrationConfigTables.ts`:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIntegrationConfigTables1788600000000 implements MigrationInterface {
  name = 'CreateIntegrationConfigTables1788600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "odoo_config" (
        "id"               integer     NOT NULL DEFAULT 1,
        "url"              varchar,
        "db"               varchar,
        "username"         varchar,
        "api_key"          varchar,
        "helpdesk_team_id" integer,
        "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_by"       varchar,
        CONSTRAINT "PK_odoo_config"        PRIMARY KEY ("id"),
        CONSTRAINT "CK_odoo_config_single" CHECK ("id" = 1)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "infradoc_config" (
        "id"         integer     NOT NULL DEFAULT 1,
        "url"        varchar,
        "api_key"    varchar,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_by" varchar,
        CONSTRAINT "PK_infradoc_config"        PRIMARY KEY ("id"),
        CONSTRAINT "CK_infradoc_config_single" CHECK ("id" = 1)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "vmware_config" (
        "id"         integer     NOT NULL DEFAULT 1,
        "username"   varchar,
        "password"   varchar,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_by" varchar,
        CONSTRAINT "PK_vmware_config"        PRIMARY KEY ("id"),
        CONSTRAINT "CK_vmware_config_single" CHECK ("id" = 1)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "vmware_config"`);
    await queryRunner.query(`DROP TABLE "infradoc_config"`);
    await queryRunner.query(`DROP TABLE "odoo_config"`);
  }
}
```

- [ ] **Step 5: Correr migración**

```bash
cd backend && npm run migration:run
```
Expected: `CreateIntegrationConfigTables1788600000000` executed successfully.

- [ ] **Step 6: Commit**

```bash
git add backend/src/integration-config/entities/ backend/src/migrations/1788600000000-CreateIntegrationConfigTables.ts
git commit -m "feat(integration-config): entidades TypeORM y migración para tablas de config"
```

---

### Task 3: DTOs

**Files:**
- Create: `backend/src/integration-config/dto/odoo-config.dto.ts`
- Create: `backend/src/integration-config/dto/infradoc-config.dto.ts`
- Create: `backend/src/integration-config/dto/vmware-config.dto.ts`

**Interfaces:**
- Produces:
  - `PatchOdooConfigDto`, `OdooConfigResponseDto`
  - `PatchInfraDocConfigDto`, `InfraDocConfigResponseDto`
  - `PatchVmwareConfigDto`, `VmwareConfigResponseDto`

- [ ] **Step 1: DTOs de Odoo**

Create `backend/src/integration-config/dto/odoo-config.dto.ts`:

```typescript
import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class PatchOdooConfigDto {
  @IsOptional() @IsString() url?: string;
  @IsOptional() @IsString() db?: string;
  @IsOptional() @IsString() username?: string;
  @IsOptional() @IsString() apiKey?: string;
  @IsOptional() @IsInt() @Min(1) helpdeskTeamId?: number;
}

export class OdooConfigResponseDto {
  url: string;
  db: string;
  username: string;
  apiKey: string;           // siempre '••••••••'
  helpdeskTeamId: number;
  updatedAt: Date | null;
  updatedBy: string | null;
}
```

- [ ] **Step 2: DTOs de InfraDoc**

Create `backend/src/integration-config/dto/infradoc-config.dto.ts`:

```typescript
import { IsString, IsOptional } from 'class-validator';

export class PatchInfraDocConfigDto {
  @IsOptional() @IsString() url?: string;
  @IsOptional() @IsString() apiKey?: string;
}

export class InfraDocConfigResponseDto {
  url: string;
  apiKey: string;           // siempre '••••••••'
  updatedAt: Date | null;
  updatedBy: string | null;
}
```

- [ ] **Step 3: DTOs de VMware**

Create `backend/src/integration-config/dto/vmware-config.dto.ts`:

```typescript
import { IsString, IsOptional } from 'class-validator';

export class PatchVmwareConfigDto {
  @IsOptional() @IsString() username?: string;
  @IsOptional() @IsString() password?: string;
}

export class VmwareConfigResponseDto {
  username: string;
  password: string;         // siempre '••••••••'
  updatedAt: Date | null;
  updatedBy: string | null;
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/integration-config/dto/
git commit -m "feat(integration-config): DTOs de request y response para las tres integraciones"
```

---

### Task 4: IntegrationConfigService

**Files:**
- Create: `backend/src/integration-config/integration-config.service.ts`
- Create: `backend/src/integration-config/integration-config.service.spec.ts`

**Interfaces:**
- Consumes: entidades (Task 2), DTOs (Task 3), `crypto.util` (Task 1), `buildOdooClient`/`rpcCall` de `../integrations/odoo/odoo-rpc.helpers`
- Produces (métodos públicos):
  - `getOdooVersion(): number` / `incrementOdooVersion(): void`
  - `getOdoo(): Promise<OdooConfigResponseDto>`
  - `patchOdoo(dto, updatedBy): Promise<OdooConfigResponseDto>`
  - `testOdoo(): Promise<{ ok: boolean; message: string }>`
  - `getOdooConfigDecrypted(): Promise<{ url, db, username, apiKey, helpdeskTeamId: number }>`
  - `getInfraDoc()` / `patchInfraDoc(dto, updatedBy)` / `testInfraDoc()` / `getInfraDocConfigDecrypted()`
  - `getVmware()` / `patchVmware(dto, updatedBy)` / `testVmware()` / `getVmwareConfigDecrypted()`

- [ ] **Step 1: Escribir tests**

Create `backend/src/integration-config/integration-config.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { IntegrationConfigService } from './integration-config.service';
import { OdooConfig } from './entities/odoo-config.entity';
import { InfraDocConfig } from './entities/infradoc-config.entity';
import { VmwareConfig } from './entities/vmware-config.entity';
import { MASK } from './crypto.util';

const KEY = '8b2202fa0aa8498ca124415c67472e7b479e1eb31a24d948eedeccecc2a5a5c2';

describe('IntegrationConfigService', () => {
  let service: IntegrationConfigService;
  let odooRepo: { findOne: jest.Mock; save: jest.Mock };
  let infradocRepo: { findOne: jest.Mock; save: jest.Mock };
  let vmwareRepo: { findOne: jest.Mock; save: jest.Mock };
  let httpGet: jest.Mock;

  beforeEach(async () => {
    odooRepo     = { findOne: jest.fn(), save: jest.fn() };
    infradocRepo = { findOne: jest.fn(), save: jest.fn() };
    vmwareRepo   = { findOne: jest.fn(), save: jest.fn() };
    httpGet      = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationConfigService,
        { provide: getRepositoryToken(OdooConfig),     useValue: odooRepo     },
        { provide: getRepositoryToken(InfraDocConfig), useValue: infradocRepo },
        { provide: getRepositoryToken(VmwareConfig),   useValue: vmwareRepo   },
        { provide: ConfigService, useValue: {
            get: (key: string, def = '') =>
              ({ INTEGRATIONS_ENCRYPT_KEY: KEY } as Record<string, string>)[key] ?? def,
          },
        },
        { provide: HttpService, useValue: { get: httpGet } },
      ],
    }).compile();

    service = module.get<IntegrationConfigService>(IntegrationConfigService);
  });

  describe('getOdoo', () => {
    it('devuelve fallback del .env cuando no hay fila en DB', async () => {
      odooRepo.findOne.mockResolvedValue(null);
      const result = await service.getOdoo();
      expect(result.apiKey).toBe(MASK);
      expect(result.updatedAt).toBeNull();
    });

    it('devuelve config de DB con apiKey enmascarada', async () => {
      odooRepo.findOne.mockResolvedValue({
        url: 'https://odoo.test', db: 'testdb', username: 'bot@test.com',
        apiKey: 'encrypted-value', helpdeskTeamId: 7,
        updatedAt: new Date('2026-09-01'), updatedBy: 'admin@ondra.com.ar',
      });
      const result = await service.getOdoo();
      expect(result.url).toBe('https://odoo.test');
      expect(result.apiKey).toBe(MASK);
      expect(result.updatedBy).toBe('admin@ondra.com.ar');
    });
  });

  describe('patchOdoo', () => {
    it('no modifica apiKey cuando viene masked', async () => {
      const existing = { id: 1, url: 'https://old.com', db: 'db', username: 'u',
        apiKey: 'enc', helpdeskTeamId: 7, updatedAt: new Date(), updatedBy: 'x' };
      odooRepo.findOne.mockResolvedValue(existing);
      odooRepo.save.mockImplementation(async (e: OdooConfig) => e);

      await service.patchOdoo({ url: 'https://new.com', apiKey: MASK }, 'admin@test.com');

      const saved = odooRepo.save.mock.calls[0][0];
      expect(saved.apiKey).toBe('enc');
      expect(saved.url).toBe('https://new.com');
    });

    it('encripta nueva apiKey cuando no viene masked', async () => {
      odooRepo.findOne.mockResolvedValue(null);
      odooRepo.save.mockImplementation(async (e: OdooConfig) => e);

      await service.patchOdoo({ apiKey: 'nueva-api-key' }, 'admin@test.com');

      const saved = odooRepo.save.mock.calls[0][0];
      expect(saved.apiKey).not.toBe('nueva-api-key');
      expect(saved.apiKey).toContain(':'); // formato iv:authTag:ciphertext
    });

    it('incrementa versión de config al guardar', async () => {
      odooRepo.findOne.mockResolvedValue(null);
      odooRepo.save.mockImplementation(async (e: OdooConfig) => e);
      const vBefore = service.getOdooVersion();
      await service.patchOdoo({ url: 'https://x.com' }, 'admin@test.com');
      expect(service.getOdooVersion()).toBe(vBefore + 1);
    });
  });

  describe('testOdoo', () => {
    it('devuelve ok: false cuando falla la conexión (URL inválida en test)', async () => {
      odooRepo.findOne.mockResolvedValue(null);
      const result = await service.testOdoo();
      expect(result.ok).toBe(false);
      expect(result.message).toBeTruthy();
    });
  });

  describe('testInfraDoc', () => {
    it('devuelve ok: true cuando el servidor responde (aunque sea con error de recurso)', async () => {
      infradocRepo.findOne.mockResolvedValue(null);
      httpGet.mockReturnValue(of({ data: { success: 'False', message: 'No resource' } }));
      const result = await service.testInfraDoc();
      expect(result.ok).toBe(true);
    });

    it('devuelve ok: false cuando falla la conexión de red', async () => {
      infradocRepo.findOne.mockResolvedValue(null);
      httpGet.mockReturnValue(throwError(() => new Error('ECONNREFUSED')));
      const result = await service.testInfraDoc();
      expect(result.ok).toBe(false);
    });
  });

  describe('testVmware', () => {
    it('siempre devuelve ok: true', async () => {
      const result = await service.testVmware();
      expect(result.ok).toBe(true);
    });
  });

  describe('getVmwareConfigDecrypted', () => {
    it('devuelve credenciales del .env cuando no hay fila en DB', async () => {
      vmwareRepo.findOne.mockResolvedValue(null);
      const cfg = await service.getVmwareConfigDecrypted();
      expect(cfg).toHaveProperty('username');
      expect(cfg).toHaveProperty('password');
    });
  });
});
```

- [ ] **Step 2: Correr test para verificar que falla**

```bash
cd backend && npx jest integration-config.service.spec.ts --no-coverage
```
Expected: FAIL — `Cannot find module './integration-config.service'`

- [ ] **Step 3: Implementar el servicio**

Create `backend/src/integration-config/integration-config.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { OdooConfig } from './entities/odoo-config.entity';
import { InfraDocConfig } from './entities/infradoc-config.entity';
import { VmwareConfig } from './entities/vmware-config.entity';
import { PatchOdooConfigDto, OdooConfigResponseDto } from './dto/odoo-config.dto';
import { PatchInfraDocConfigDto, InfraDocConfigResponseDto } from './dto/infradoc-config.dto';
import { PatchVmwareConfigDto, VmwareConfigResponseDto } from './dto/vmware-config.dto';
import { encrypt, decrypt, isMasked, MASK } from './crypto.util';
import { buildOdooClient, rpcCall } from '../integrations/odoo/odoo-rpc.helpers';

@Injectable()
export class IntegrationConfigService {
  private odooVersion = 0;

  constructor(
    @InjectRepository(OdooConfig)     private readonly odooRepo:     Repository<OdooConfig>,
    @InjectRepository(InfraDocConfig) private readonly infradocRepo: Repository<InfraDocConfig>,
    @InjectRepository(VmwareConfig)   private readonly vmwareRepo:   Repository<VmwareConfig>,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  private get encryptKey(): string {
    return this.configService.get<string>('INTEGRATIONS_ENCRYPT_KEY', '');
  }

  // ── Version tracking (permite a OdooSystemRpcService invalidar uid cache) ──
  getOdooVersion(): number { return this.odooVersion; }
  incrementOdooVersion(): void { this.odooVersion++; }

  // ── ODOO ──

  async getOdoo(): Promise<OdooConfigResponseDto> {
    const row = await this.odooRepo.findOne({ where: { id: 1 } });
    if (!row) {
      return {
        url: this.configService.get('ODOO_URL', ''),
        db: this.configService.get('ODOO_DB', ''),
        username: this.configService.get('ODOO_USERNAME', ''),
        apiKey: MASK,
        helpdeskTeamId: parseInt(this.configService.get('ODOO_HELPDESK_TEAM_ID', '0'), 10),
        updatedAt: null,
        updatedBy: null,
      };
    }
    return { url: row.url ?? '', db: row.db ?? '', username: row.username ?? '',
      apiKey: MASK, helpdeskTeamId: row.helpdeskTeamId ?? 0,
      updatedAt: row.updatedAt, updatedBy: row.updatedBy };
  }

  async patchOdoo(dto: PatchOdooConfigDto, updatedBy: string): Promise<OdooConfigResponseDto> {
    const existing = (await this.odooRepo.findOne({ where: { id: 1 } })) ?? new OdooConfig();
    existing.id = 1;
    if (dto.url !== undefined)            existing.url            = dto.url;
    if (dto.db !== undefined)             existing.db             = dto.db;
    if (dto.username !== undefined)       existing.username       = dto.username;
    if (dto.helpdeskTeamId !== undefined) existing.helpdeskTeamId = dto.helpdeskTeamId;
    if (dto.apiKey !== undefined && !isMasked(dto.apiKey) && dto.apiKey !== '') {
      existing.apiKey = encrypt(dto.apiKey, this.encryptKey);
    }
    existing.updatedBy = updatedBy;
    await this.odooRepo.save(existing);
    this.incrementOdooVersion();
    return this.getOdoo();
  }

  async getOdooConfigDecrypted(): Promise<{ url: string; db: string; username: string; apiKey: string; helpdeskTeamId: number }> {
    const row = await this.odooRepo.findOne({ where: { id: 1 } });
    if (!row) {
      return {
        url:            this.configService.get('ODOO_URL', ''),
        db:             this.configService.get('ODOO_DB', ''),
        username:       this.configService.get('ODOO_USERNAME', ''),
        apiKey:         this.configService.get('ODOO_API_KEY', ''),
        helpdeskTeamId: parseInt(this.configService.get('ODOO_HELPDESK_TEAM_ID', '0'), 10),
      };
    }
    return {
      url:            row.url      ?? '',
      db:             row.db       ?? '',
      username:       row.username ?? '',
      apiKey:         row.apiKey   ? decrypt(row.apiKey, this.encryptKey) : '',
      helpdeskTeamId: row.helpdeskTeamId ?? 0,
    };
  }

  async testOdoo(): Promise<{ ok: boolean; message: string }> {
    try {
      const cfg = await this.getOdooConfigDecrypted();
      const client = buildOdooClient(cfg.url, '/xmlrpc/2/common');
      const uid = await rpcCall<number>(client, 'authenticate', [cfg.db, cfg.username, cfg.apiKey, {}]);
      if (!uid) return { ok: false, message: 'Autenticación fallida: credenciales incorrectas' };
      return { ok: true, message: 'Conexión exitosa' };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }

  // ── INFRADOC ──

  async getInfraDoc(): Promise<InfraDocConfigResponseDto> {
    const row = await this.infradocRepo.findOne({ where: { id: 1 } });
    if (!row) return { url: this.configService.get('INFRADOC_URL', ''), apiKey: MASK, updatedAt: null, updatedBy: null };
    return { url: row.url ?? '', apiKey: MASK, updatedAt: row.updatedAt, updatedBy: row.updatedBy };
  }

  async patchInfraDoc(dto: PatchInfraDocConfigDto, updatedBy: string): Promise<InfraDocConfigResponseDto> {
    const existing = (await this.infradocRepo.findOne({ where: { id: 1 } })) ?? new InfraDocConfig();
    existing.id = 1;
    if (dto.url !== undefined) existing.url = dto.url;
    if (dto.apiKey !== undefined && !isMasked(dto.apiKey) && dto.apiKey !== '') {
      existing.apiKey = encrypt(dto.apiKey, this.encryptKey);
    }
    existing.updatedBy = updatedBy;
    await this.infradocRepo.save(existing);
    return this.getInfraDoc();
  }

  async getInfraDocConfigDecrypted(): Promise<{ url: string; apiKey: string }> {
    const row = await this.infradocRepo.findOne({ where: { id: 1 } });
    if (!row) return { url: this.configService.get('INFRADOC_URL', ''), apiKey: this.configService.get('INFRADOC_API_KEY', '') };
    return { url: row.url ?? '', apiKey: row.apiKey ? decrypt(row.apiKey, this.encryptKey) : '' };
  }

  async testInfraDoc(): Promise<{ ok: boolean; message: string }> {
    try {
      const cfg = await this.getInfraDocConfigDecrypted();
      await firstValueFrom(
        this.httpService.get(`${cfg.url}/api/v1/assets/read.php`, { params: { api_key: cfg.apiKey, client_id: 0, limit: 1 } }),
      );
      return { ok: true, message: 'Conexión exitosa' };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }

  // ── VMWARE ──

  async getVmware(): Promise<VmwareConfigResponseDto> {
    const row = await this.vmwareRepo.findOne({ where: { id: 1 } });
    if (!row) return { username: this.configService.get('VMWARE_USER', ''), password: MASK, updatedAt: null, updatedBy: null };
    return { username: row.username ?? '', password: MASK, updatedAt: row.updatedAt, updatedBy: row.updatedBy };
  }

  async patchVmware(dto: PatchVmwareConfigDto, updatedBy: string): Promise<VmwareConfigResponseDto> {
    const existing = (await this.vmwareRepo.findOne({ where: { id: 1 } })) ?? new VmwareConfig();
    existing.id = 1;
    if (dto.username !== undefined) existing.username = dto.username;
    if (dto.password !== undefined && !isMasked(dto.password) && dto.password !== '') {
      existing.password = encrypt(dto.password, this.encryptKey);
    }
    existing.updatedBy = updatedBy;
    await this.vmwareRepo.save(existing);
    return this.getVmware();
  }

  async getVmwareConfigDecrypted(): Promise<{ username: string; password: string }> {
    const row = await this.vmwareRepo.findOne({ where: { id: 1 } });
    if (!row) return { username: this.configService.get('VMWARE_USER', ''), password: this.configService.get('VMWARE_PASS', '') };
    return { username: row.username ?? '', password: row.password ? decrypt(row.password, this.encryptKey) : '' };
  }

  async testVmware(): Promise<{ ok: boolean; message: string }> {
    return { ok: true, message: 'Credenciales guardadas. Se verificarán en el próximo health check de ESXi.' };
  }
}
```

- [ ] **Step 4: Correr tests**

```bash
cd backend && npx jest integration-config.service.spec.ts --no-coverage
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/integration-config/integration-config.service.ts backend/src/integration-config/integration-config.service.spec.ts
git commit -m "feat(integration-config): servicio con get/patch/test para Odoo, InfraDoc y VMware"
```

---

### Task 5: Controller + Module + AppModule

**Files:**
- Create: `backend/src/integration-config/integration-config.controller.ts`
- Create: `backend/src/integration-config/integration-config.controller.spec.ts`
- Create: `backend/src/integration-config/integration-config.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `IntegrationConfigService` (Task 4), `JwtPayload` de `auth/auth.types`, `@CurrentUser()`, `JwtAuthGuard`, `RolesGuard`, `@Roles`, `UserRole`
- Produces: endpoints REST en `/integration-config/{odoo,infradoc,vmware}` y `/integration-config/{odoo,infradoc,vmware}/test`

- [ ] **Step 1: Escribir test del controller**

Create `backend/src/integration-config/integration-config.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationConfigController } from './integration-config.controller';
import { IntegrationConfigService } from './integration-config.service';
import { MASK } from './crypto.util';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

const mockUser = { sub: 'uid-1', email: 'admin@ondra.com.ar', role: 'ADMIN', mustChangePassword: false };
const mockOdooResp = { url: 'u', db: 'd', username: 'u', apiKey: MASK, helpdeskTeamId: 7, updatedAt: null, updatedBy: null };

const mockService = {
  getOdoo: jest.fn(), patchOdoo: jest.fn(), testOdoo: jest.fn(),
  getInfraDoc: jest.fn(), patchInfraDoc: jest.fn(), testInfraDoc: jest.fn(),
  getVmware: jest.fn(), patchVmware: jest.fn(), testVmware: jest.fn(),
};

describe('IntegrationConfigController', () => {
  let controller: IntegrationConfigController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IntegrationConfigController],
      providers: [{ provide: IntegrationConfigService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();
    controller = module.get<IntegrationConfigController>(IntegrationConfigController);
  });

  it('GET /odoo delega en service.getOdoo', async () => {
    mockService.getOdoo.mockResolvedValue(mockOdooResp);
    expect(await controller.getOdoo()).toEqual(mockOdooResp);
  });

  it('PATCH /odoo pasa email del JWT como updatedBy', async () => {
    mockService.patchOdoo.mockResolvedValue(mockOdooResp);
    await controller.patchOdoo({ url: 'u' }, mockUser as any);
    expect(mockService.patchOdoo).toHaveBeenCalledWith({ url: 'u' }, 'admin@ondra.com.ar');
  });

  it('POST /odoo/test delega en service.testOdoo', async () => {
    mockService.testOdoo.mockResolvedValue({ ok: true, message: 'OK' });
    expect(await controller.testOdoo()).toEqual({ ok: true, message: 'OK' });
  });
});
```

- [ ] **Step 2: Correr test para verificar que falla**

```bash
cd backend && npx jest integration-config.controller.spec.ts --no-coverage
```
Expected: FAIL — `Cannot find module './integration-config.controller'`

- [ ] **Step 3: Crear el controller**

Create `backend/src/integration-config/integration-config.controller.ts`:

```typescript
import { Body, Controller, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/user-role.enum';
import { JwtPayload } from '../auth/auth.types';
import { IntegrationConfigService } from './integration-config.service';
import { PatchOdooConfigDto, OdooConfigResponseDto } from './dto/odoo-config.dto';
import { PatchInfraDocConfigDto, InfraDocConfigResponseDto } from './dto/infradoc-config.dto';
import { PatchVmwareConfigDto, VmwareConfigResponseDto } from './dto/vmware-config.dto';

@Controller('integration-config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class IntegrationConfigController {
  constructor(private readonly svc: IntegrationConfigService) {}

  @Get('odoo')    getOdoo(): Promise<OdooConfigResponseDto>  { return this.svc.getOdoo(); }
  @Patch('odoo')  patchOdoo(@Body() dto: PatchOdooConfigDto, @CurrentUser() u: JwtPayload): Promise<OdooConfigResponseDto> { return this.svc.patchOdoo(dto, u.email); }
  @Post('odoo/test') @HttpCode(200) testOdoo(): Promise<{ ok: boolean; message: string }> { return this.svc.testOdoo(); }

  @Get('infradoc')    getInfraDoc(): Promise<InfraDocConfigResponseDto>  { return this.svc.getInfraDoc(); }
  @Patch('infradoc')  patchInfraDoc(@Body() dto: PatchInfraDocConfigDto, @CurrentUser() u: JwtPayload): Promise<InfraDocConfigResponseDto> { return this.svc.patchInfraDoc(dto, u.email); }
  @Post('infradoc/test') @HttpCode(200) testInfraDoc(): Promise<{ ok: boolean; message: string }> { return this.svc.testInfraDoc(); }

  @Get('vmware')    getVmware(): Promise<VmwareConfigResponseDto>  { return this.svc.getVmware(); }
  @Patch('vmware')  patchVmware(@Body() dto: PatchVmwareConfigDto, @CurrentUser() u: JwtPayload): Promise<VmwareConfigResponseDto> { return this.svc.patchVmware(dto, u.email); }
  @Post('vmware/test') @HttpCode(200) testVmware(): Promise<{ ok: boolean; message: string }> { return this.svc.testVmware(); }
}
```

- [ ] **Step 4: Crear el módulo**

Create `backend/src/integration-config/integration-config.module.ts`:

```typescript
import * as https from 'https';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { OdooConfig } from './entities/odoo-config.entity';
import { InfraDocConfig } from './entities/infradoc-config.entity';
import { VmwareConfig } from './entities/vmware-config.entity';
import { IntegrationConfigService } from './integration-config.service';
import { IntegrationConfigController } from './integration-config.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([OdooConfig, InfraDocConfig, VmwareConfig]),
    HttpModule.register({ httpsAgent: new https.Agent({ rejectUnauthorized: false }) }),
  ],
  providers: [IntegrationConfigService],
  controllers: [IntegrationConfigController],
  exports: [IntegrationConfigService],
})
export class IntegrationConfigModule {}
```

- [ ] **Step 5: Registrar en AppModule**

En `backend/src/app.module.ts` agregar el import:

```typescript
import { IntegrationConfigModule } from './integration-config/integration-config.module';
// En el array imports del @Module:
IntegrationConfigModule,
```

- [ ] **Step 6: Correr todos los tests del módulo**

```bash
cd backend && npx jest integration-config --no-coverage
```
Expected: PASS (crypto.util + service + controller)

- [ ] **Step 7: Commit**

```bash
git add backend/src/integration-config/integration-config.controller.ts \
        backend/src/integration-config/integration-config.controller.spec.ts \
        backend/src/integration-config/integration-config.module.ts \
        backend/src/app.module.ts
git commit -m "feat(integration-config): controller, módulo y registro en AppModule"
```

---

### Task 6: Refactor Odoo (buildOdooClient + OdooSystemRpcService + OdooService)

**Files:**
- Modify: `backend/src/integrations/odoo/odoo-rpc.helpers.ts`
- Modify: `backend/src/integrations/odoo/odoo-system-rpc.service.ts`
- Modify: `backend/src/integrations/odoo/odoo-system-rpc.service.spec.ts`
- Modify: `backend/src/integrations/odoo/odoo.service.ts`
- Modify: `backend/src/integrations/odoo/odoo.service.spec.ts`
- Modify: `backend/src/integrations/odoo/odoo-integration.module.ts`

**Interfaces:**
- `buildOdooClient` cambia firma: `(baseUrl: string, path: string): xmlrpc.Client` (ya no recibe ConfigService)
- `OdooSystemRpcService` ya no inyecta `ConfigService`, inyecta `IntegrationConfigService`
- Invalida uid cache via versionado: re-autentica cuando `integrationConfigService.getOdooVersion()` cambia

- [ ] **Step 1: Actualizar buildOdooClient**

Reemplazar el contenido de `backend/src/integrations/odoo/odoo-rpc.helpers.ts`:

```typescript
import * as xmlrpc from 'xmlrpc';

export function buildOdooClient(baseUrl: string, path: string): xmlrpc.Client {
  const parsed = new URL(baseUrl);
  const opts = {
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : undefined,
    path,
  };
  return parsed.protocol === 'https:'
    ? xmlrpc.createSecureClient(opts)
    : xmlrpc.createClient(opts);
}

export function rpcCall<T>(client: xmlrpc.Client, method: string, params: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    client.methodCall(method, params as any[], (err: any, value: unknown) => {
      if (err) reject(err);
      else resolve(value as T);
    });
  });
}
```

- [ ] **Step 2: Reemplazar OdooSystemRpcService**

Reemplazar `backend/src/integrations/odoo/odoo-system-rpc.service.ts`:

```typescript
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { buildOdooClient, rpcCall } from './odoo-rpc.helpers';
import { IntegrationConfigService } from '../../integration-config/integration-config.service';

@Injectable()
export class OdooSystemRpcService {
  private readonly logger = new Logger(OdooSystemRpcService.name);
  private uid: number | null = null;
  private lastSeenVersion = -1;

  constructor(private readonly integrationConfigService: IntegrationConfigService) {}

  invalidateCache(): void { this.uid = null; }

  async authenticate(): Promise<number> {
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
      this.uid = await this.authenticate();
    }
    const cfg = await this.integrationConfigService.getOdooConfigDecrypted();
    const client = buildOdooClient(cfg.url, '/xmlrpc/2/object');
    try {
      return await rpcCall<T>(client, 'execute_kw', [cfg.db, this.uid, cfg.apiKey, model, method, args, kwargs]);
    } catch (err) {
      this.logger.error(`Odoo RPC ${model}.${method}: ${(err as Error).message}`);
      throw new ServiceUnavailableException(`Odoo RPC ${model}.${method}: ${(err as Error).message}`);
    }
  }
}
```

- [ ] **Step 3: Actualizar spec de OdooSystemRpcService**

Reemplazar `backend/src/integrations/odoo/odoo-system-rpc.service.spec.ts`:

```typescript
jest.mock('xmlrpc');
import * as xmlrpc from 'xmlrpc';
import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { OdooSystemRpcService } from './odoo-system-rpc.service';
import { IntegrationConfigService } from '../../integration-config/integration-config.service';

const mockCfg = { url: 'http://odoo.test', db: 'testdb', username: 'admin', apiKey: 'sys-key', helpdeskTeamId: 7 };
let mockVersion = 0;

const mockIntegrationConfigService = {
  getOdooConfigDecrypted: jest.fn().mockResolvedValue(mockCfg),
  getOdooVersion: jest.fn().mockImplementation(() => mockVersion),
};

describe('OdooSystemRpcService', () => {
  let service: OdooSystemRpcService;
  let mockMethodCall: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockVersion = 0;
    mockIntegrationConfigService.getOdooConfigDecrypted.mockResolvedValue(mockCfg);
    mockIntegrationConfigService.getOdooVersion.mockImplementation(() => mockVersion);
    mockMethodCall = jest.fn();
    const mockClient = { methodCall: mockMethodCall };
    (xmlrpc.createClient as jest.Mock).mockReturnValue(mockClient);
    (xmlrpc.createSecureClient as jest.Mock).mockReturnValue(mockClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OdooSystemRpcService,
        { provide: IntegrationConfigService, useValue: mockIntegrationConfigService },
      ],
    }).compile();
    service = module.get<OdooSystemRpcService>(OdooSystemRpcService);
  });

  it('autentica y devuelve uid', async () => {
    mockMethodCall.mockImplementation((_m, _p, cb) => cb(null, 7));
    expect(await service.authenticate()).toBe(7);
  });

  it('lanza ServiceUnavailableException cuando uid es falsy', async () => {
    mockMethodCall.mockImplementation((_m, _p, cb) => cb(null, 0));
    await expect(service.authenticate()).rejects.toThrow(ServiceUnavailableException);
  });

  it('reutiliza uid cacheado sin re-autenticar cuando la versión no cambia', async () => {
    mockMethodCall
      .mockImplementationOnce((_m, _p, cb) => cb(null, 7))
      .mockImplementation((_m, _p, cb) => cb(null, []));
    await service.callKw('res.partner', 'search_read', [[]], {});
    await service.callKw('res.partner', 'search_read', [[]], {});
    expect(mockMethodCall).toHaveBeenCalledTimes(3); // 1 auth + 2 data
  });

  it('re-autentica cuando la versión de config cambia', async () => {
    mockMethodCall
      .mockImplementationOnce((_m, _p, cb) => cb(null, 7))
      .mockImplementationOnce((_m, _p, cb) => cb(null, []))
      .mockImplementationOnce((_m, _p, cb) => cb(null, 8))
      .mockImplementationOnce((_m, _p, cb) => cb(null, []));

    await service.callKw('res.partner', 'search_read', [[]], {});
    mockVersion = 1; // simular cambio de config
    await service.callKw('res.partner', 'search_read', [[]], {});

    expect(mockMethodCall).toHaveBeenCalledTimes(4); // 2 auth + 2 data
  });

  it('lanza ServiceUnavailableException en error de red', async () => {
    mockMethodCall
      .mockImplementationOnce((_m, _p, cb) => cb(null, 7))
      .mockImplementationOnce((_m, _p, cb) => cb(new Error('net'), null));
    await expect(service.callKw('m', 'search_read', [[]], {})).rejects.toThrow(ServiceUnavailableException);
  });
});
```

- [ ] **Step 4: Actualizar OdooService — inyectar IntegrationConfigService en lugar de ConfigService**

En `backend/src/integrations/odoo/odoo.service.ts`:

Reemplazar la inyección de `ConfigService` por `IntegrationConfigService`:

```typescript
// Quitar: import { ConfigService } from '@nestjs/config';
// Agregar:
import { IntegrationConfigService } from '../../integration-config/integration-config.service';
```

Actualizar el constructor — quitar `private readonly configService: ConfigService,` y agregar:

```typescript
private readonly integrationConfigService: IntegrationConfigService,
```

Reemplazar cada ocurrencia de:
```typescript
const teamId = parseInt(this.configService.getOrThrow<string>('ODOO_HELPDESK_TEAM_ID'), 10);
```
por:
```typescript
const { helpdeskTeamId: teamId } = await this.integrationConfigService.getOdooConfigDecrypted();
```

Hay cuatro métodos afectados: `resolveInProgressStageId()`, `resolveNotDoneStageId()`, `resolveDoneStageId()`, y `createTicket()`. En `createTicket()` también hay una validación de `isNaN(teamId)` que se puede quitar porque `helpdeskTeamId` ya es `number`.

- [ ] **Step 5: Actualizar odoo.service.spec.ts**

En `backend/src/integrations/odoo/odoo.service.spec.ts`, reemplazar el mock de `ConfigService` por `IntegrationConfigService`:

```typescript
// Quitar: { provide: ConfigService, useValue: ... }
// Agregar:
{
  provide: IntegrationConfigService,
  useValue: { getOdooConfigDecrypted: jest.fn().mockResolvedValue({ url: 'u', db: 'd', username: 'u', apiKey: 'k', helpdeskTeamId: 7 }) },
},
```

- [ ] **Step 6: Actualizar OdooIntegrationModule**

Reemplazar `backend/src/integrations/odoo/odoo-integration.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ClientsModule } from '../../clients/clients.module';
import { UsersModule } from '../../users/users.module';
import { TechniciansModule } from '../../technicians/technicians.module';
import { TaskConfigModule } from '../../task-config/task-config.module';
import { IntegrationConfigModule } from '../../integration-config/integration-config.module';
import { OdooSystemRpcService } from './odoo-system-rpc.service';
import { OdooService } from './odoo.service';
import { OdooController } from './odoo.controller';
import { SubscriptionHoursController } from './subscription-hours.controller';

@Module({
  imports: [ClientsModule, UsersModule, TechniciansModule, TaskConfigModule, IntegrationConfigModule],
  controllers: [OdooController, SubscriptionHoursController],
  providers: [OdooSystemRpcService, OdooService],
  exports: [OdooService],
})
export class OdooIntegrationModule {}
```

- [ ] **Step 7: Correr tests de Odoo**

```bash
cd backend && npx jest integrations/odoo --no-coverage
```
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add backend/src/integrations/odoo/
git commit -m "refactor(odoo): leer config de IntegrationConfigService, invalidar uid cache por versionado"
```

---

### Task 7: Refactor VmwareService + InfradocAssetsService

**Files:**
- Modify: `backend/src/integrations/vmware/vmware.service.ts`
- Modify: `backend/src/integrations/vmware/vmware.service.spec.ts`
- Modify: `backend/src/integrations/vmware/vmware-integration.module.ts`
- Modify: `backend/src/integrations/infradoc/infradoc-assets.service.ts`
- Modify: `backend/src/integrations/infradoc/infradoc-assets.service.spec.ts`
- Modify: `backend/src/integrations/infradoc/infradoc-integration.module.ts`

**Interfaces:**
- Consumes: `IntegrationConfigService.getVmwareConfigDecrypted()`, `IntegrationConfigService.getInfraDocConfigDecrypted()`

- [ ] **Step 1: Reemplazar VmwareService**

Reemplazar `backend/src/integrations/vmware/vmware.service.ts`:

```typescript
import { BadGatewayException, GatewayTimeoutException, Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import { join } from 'path';
import { IntegrationConfigService } from '../../integration-config/integration-config.service';
import { VmwareHealthResult } from './dto/vmware-health-result.dto';

const TIMEOUT_MS = 30_000;

@Injectable()
export class VmwareService {
  constructor(private readonly integrationConfigService: IntegrationConfigService) {}

  async runHealthCheck(hostUri: string): Promise<VmwareHealthResult> {
    const colonIdx = hostUri.lastIndexOf(':');
    const host = colonIdx > 0 ? hostUri.slice(0, colonIdx) : hostUri;
    const port = colonIdx > 0 ? hostUri.slice(colonIdx + 1) : '443';
    const script = join(process.cwd(), 'collectors', 'vmware', 'vmware_health.py');
    const creds = await this.integrationConfigService.getVmwareConfigDecrypted();

    return new Promise<VmwareHealthResult>((resolve, reject) => {
      const proc = spawn('python3', [
        script, '--host', host, '--port', port,
        '--user', creds.username, '--pass', creds.password,
      ]);
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (c: Buffer) => { stdout += c.toString(); });
      proc.stderr.on('data', (c: Buffer) => { stderr += c.toString(); });
      const timer = setTimeout(() => { proc.kill('SIGTERM'); reject(new GatewayTimeoutException('El host ESXi no respondió en 30 segundos')); }, TIMEOUT_MS);
      proc.on('close', (code: number | null) => {
        clearTimeout(timer);
        if (code !== 0) { reject(new BadGatewayException(stderr.trim() || 'Error al ejecutar el health check de VMware')); return; }
        try { resolve(JSON.parse(stdout) as VmwareHealthResult); }
        catch { reject(new BadGatewayException('Respuesta inválida del script Python')); }
      });
    });
  }
}
```

- [ ] **Step 2: Actualizar vmware-integration.module.ts**

Reemplazar `backend/src/integrations/vmware/vmware-integration.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { IntegrationConfigModule } from '../../integration-config/integration-config.module';
import { VmwareService } from './vmware.service';
import { VmwareController } from './vmware.controller';

@Module({
  imports: [IntegrationConfigModule],
  controllers: [VmwareController],
  providers: [VmwareService],
  exports: [VmwareService],
})
export class VmwareIntegrationModule {}
```

- [ ] **Step 3: Actualizar vmware.service.spec.ts**

En `backend/src/integrations/vmware/vmware.service.spec.ts`, reemplazar el proveedor de config por `IntegrationConfigService`:

```typescript
import { IntegrationConfigService } from '../../integration-config/integration-config.service';

// En providers, reemplazar ConfigService por:
{
  provide: IntegrationConfigService,
  useValue: {
    getVmwareConfigDecrypted: jest.fn().mockResolvedValue({ username: 'ondra-read', password: 'pass' }),
  },
},
```

- [ ] **Step 4: Actualizar InfradocAssetsService**

En `backend/src/integrations/infradoc/infradoc-assets.service.ts`, actualizar el constructor e inicio de `getAssets()`:

```typescript
// Agregar al import:
import { IntegrationConfigService } from '../../integration-config/integration-config.service';

// Actualizar constructor:
constructor(
  private readonly httpService: HttpService,
  private readonly integrationConfigService: IntegrationConfigService,
) {}

// Al inicio de getAssets(), reemplazar la lectura de process.env por:
async getAssets(infradocClientId: number): Promise<RawInfradocAsset[]> {
  const { url: baseUrl, apiKey } = await this.integrationConfigService.getInfraDocConfigDecrypted();
  if (!baseUrl || !apiKey) {
    throw new Error('URL y API key de InfraDoc no configuradas');
  }
  const url = `${baseUrl}/api/v1/assets/read.php`;
  // ... resto del método sin cambios
```

- [ ] **Step 5: Actualizar infradoc-integration.module.ts**

Reemplazar `backend/src/integrations/infradoc/infradoc-integration.module.ts`:

```typescript
import * as https from 'https';
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ClientsModule } from '../../clients/clients.module';
import { IntegrationConfigModule } from '../../integration-config/integration-config.module';
import { InfradocAssetsService } from './infradoc-assets.service';
import { InfrastructureController } from './infrastructure.controller';
import { InfrastructureService } from './infrastructure.service';

@Module({
  imports: [
    HttpModule.register({ httpsAgent: new https.Agent({ rejectUnauthorized: false }) }),
    ClientsModule,
    IntegrationConfigModule,
  ],
  controllers: [InfrastructureController],
  providers: [InfrastructureService, InfradocAssetsService],
  exports: [InfrastructureService],
})
export class InfradocIntegrationModule {}
```

- [ ] **Step 6: Actualizar infradoc-assets.service.spec.ts**

En `backend/src/integrations/infradoc/infradoc-assets.service.spec.ts`, agregar `IntegrationConfigService` al TestBed y eliminar cualquier `process.env.INFRADOC_*` del setup:

```typescript
import { IntegrationConfigService } from '../../integration-config/integration-config.service';

// En providers, agregar:
{
  provide: IntegrationConfigService,
  useValue: {
    getInfraDocConfigDecrypted: jest.fn().mockResolvedValue({ url: 'http://infradoc.test', apiKey: 'key' }),
  },
},
```

- [ ] **Step 7: Correr tests**

```bash
cd backend && npx jest integrations/vmware integrations/infradoc --no-coverage
```
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add backend/src/integrations/vmware/ backend/src/integrations/infradoc/
git commit -m "refactor(integrations): VmwareService e InfradocAssetsService leen config de IntegrationConfigService"
```

---

### Task 8: Frontend — IntegrationConfigService

**Files:**
- Create: `frontend/src/app/core/services/integration-config.service.ts`
- Create: `frontend/src/app/core/services/integration-config.service.spec.ts`

**Interfaces:**
- Produces (interfaces exportadas):
  - `OdooConfigDto { url, db, username, apiKey, helpdeskTeamId, updatedAt, updatedBy }`
  - `InfraDocConfigDto { url, apiKey, updatedAt, updatedBy }`
  - `VmwareConfigDto { username, password, updatedAt, updatedBy }`
  - `TestConnectionResult { ok: boolean; message: string }`
- Produces (métodos):
  - `getOdoo()`, `patchOdoo(dto)`, `testOdoo()`
  - `getInfraDoc()`, `patchInfraDoc(dto)`, `testInfraDoc()`
  - `getVmware()`, `patchVmware(dto)`, `testVmware()`

- [ ] **Step 1: Escribir tests**

Create `frontend/src/app/core/services/integration-config.service.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { IntegrationConfigService, OdooConfigDto } from './integration-config.service';
import { environment } from '../../../environments/environment';

describe('IntegrationConfigService', () => {
  let service: IntegrationConfigService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/integration-config`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [IntegrationConfigService] });
    service = TestBed.inject(IntegrationConfigService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('getOdoo hace GET a /integration-config/odoo', () => {
    const mock: OdooConfigDto = { url: 'u', db: 'd', username: 'u', apiKey: '••••••••', helpdeskTeamId: 7, updatedAt: null, updatedBy: null };
    service.getOdoo().subscribe(r => expect(r).toEqual(mock));
    http.expectOne(`${base}/odoo`).flush(mock);
  });

  it('patchOdoo hace PATCH a /integration-config/odoo', () => {
    const mock: OdooConfigDto = { url: 'nuevo', db: 'd', username: 'u', apiKey: '••••••••', helpdeskTeamId: 7, updatedAt: null, updatedBy: 'a' };
    service.patchOdoo({ url: 'nuevo' }).subscribe(r => expect(r.url).toBe('nuevo'));
    const req = http.expectOne(`${base}/odoo`);
    expect(req.request.method).toBe('PATCH');
    req.flush(mock);
  });

  it('testOdoo hace POST a /integration-config/odoo/test', () => {
    service.testOdoo().subscribe(r => expect(r.ok).toBe(true));
    const req = http.expectOne(`${base}/odoo/test`);
    expect(req.request.method).toBe('POST');
    req.flush({ ok: true, message: 'Conexión exitosa' });
  });
});
```

- [ ] **Step 2: Correr test para verificar que falla**

```bash
cd frontend && npx ng test --include="**/integration-config.service.spec.ts" --watch=false --browsers=ChromeHeadless
```
Expected: FAIL

- [ ] **Step 3: Implementar el servicio**

Create `frontend/src/app/core/services/integration-config.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface OdooConfigDto {
  url: string; db: string; username: string; apiKey: string;
  helpdeskTeamId: number; updatedAt: Date | null; updatedBy: string | null;
}
export interface InfraDocConfigDto {
  url: string; apiKey: string; updatedAt: Date | null; updatedBy: string | null;
}
export interface VmwareConfigDto {
  username: string; password: string; updatedAt: Date | null; updatedBy: string | null;
}
export interface TestConnectionResult { ok: boolean; message: string; }

@Injectable({ providedIn: 'root' })
export class IntegrationConfigService {
  private readonly base = `${environment.apiUrl}/integration-config`;
  constructor(private readonly http: HttpClient) {}

  getOdoo(): Observable<OdooConfigDto>                              { return this.http.get<OdooConfigDto>(`${this.base}/odoo`); }
  patchOdoo(dto: Partial<OdooConfigDto>): Observable<OdooConfigDto> { return this.http.patch<OdooConfigDto>(`${this.base}/odoo`, dto); }
  testOdoo(): Observable<TestConnectionResult>                       { return this.http.post<TestConnectionResult>(`${this.base}/odoo/test`, {}); }

  getInfraDoc(): Observable<InfraDocConfigDto>                              { return this.http.get<InfraDocConfigDto>(`${this.base}/infradoc`); }
  patchInfraDoc(dto: Partial<InfraDocConfigDto>): Observable<InfraDocConfigDto> { return this.http.patch<InfraDocConfigDto>(`${this.base}/infradoc`, dto); }
  testInfraDoc(): Observable<TestConnectionResult>                              { return this.http.post<TestConnectionResult>(`${this.base}/infradoc/test`, {}); }

  getVmware(): Observable<VmwareConfigDto>                              { return this.http.get<VmwareConfigDto>(`${this.base}/vmware`); }
  patchVmware(dto: Partial<VmwareConfigDto>): Observable<VmwareConfigDto> { return this.http.patch<VmwareConfigDto>(`${this.base}/vmware`, dto); }
  testVmware(): Observable<TestConnectionResult>                          { return this.http.post<TestConnectionResult>(`${this.base}/vmware/test`, {}); }
}
```

- [ ] **Step 4: Correr tests**

```bash
cd frontend && npx ng test --include="**/integration-config.service.spec.ts" --watch=false --browsers=ChromeHeadless
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/core/services/integration-config.service.ts frontend/src/app/core/services/integration-config.service.spec.ts
git commit -m "feat(frontend): IntegrationConfigService para Odoo, InfraDoc y VMware"
```

---

### Task 9: Frontend — IntegracionesComponent + routing

**Files:**
- Create: `frontend/src/app/features/admin/integraciones/integraciones.component.ts`
- Create: `frontend/src/app/features/admin/integraciones/integraciones.component.html`
- Create: `frontend/src/app/features/admin/integraciones/integraciones.component.scss`
- Create: `frontend/src/app/features/admin/integraciones/integraciones.component.spec.ts`
- Modify: `frontend/src/app/features/admin/admin-routing.module.ts`
- Modify: `frontend/src/app/features/admin/admin-layout/admin-layout.component.ts`
- Modify: `frontend/src/app/features/admin/admin.module.ts`

**Interfaces:**
- Consumes: `IntegrationConfigService` (Task 8)
- Produce: `buildOdooPatchDto()`, `buildInfraDocPatchDto()`, `buildVmwarePatchDto()` (públicos para testeo)

- [ ] **Step 1: Escribir spec**

Create `frontend/src/app/features/admin/integraciones/integraciones.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { of } from 'rxjs';
import { IntegracionesComponent } from './integraciones.component';
import { IntegrationConfigService } from '../../../core/services/integration-config.service';

const MASK = '••••••••';

const mockService = {
  getOdoo:      jest.fn().mockReturnValue(of({ url: 'https://odoo.test', db: 'db', username: 'bot@test.com', apiKey: MASK, helpdeskTeamId: 7, updatedAt: null, updatedBy: null })),
  patchOdoo:    jest.fn().mockReturnValue(of({})),
  testOdoo:     jest.fn().mockReturnValue(of({ ok: true, message: 'OK' })),
  getInfraDoc:  jest.fn().mockReturnValue(of({ url: 'https://id.test', apiKey: MASK, updatedAt: null, updatedBy: null })),
  patchInfraDoc:jest.fn().mockReturnValue(of({})),
  testInfraDoc: jest.fn().mockReturnValue(of({ ok: true, message: 'OK' })),
  getVmware:    jest.fn().mockReturnValue(of({ username: 'ondra-read', password: MASK, updatedAt: null, updatedBy: null })),
  patchVmware:  jest.fn().mockReturnValue(of({})),
  testVmware:   jest.fn().mockReturnValue(of({ ok: true, message: 'OK' })),
};

describe('IntegracionesComponent', () => {
  let fixture: ComponentFixture<IntegracionesComponent>;
  let comp: IntegracionesComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [IntegracionesComponent],
      imports: [NoopAnimationsModule, ReactiveFormsModule, MatSnackBarModule, MatProgressSpinnerModule, MatFormFieldModule, MatInputModule, MatButtonModule],
      providers: [{ provide: IntegrationConfigService, useValue: mockService }],
    }).compileComponents();
    fixture = TestBed.createComponent(IntegracionesComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carga config de las tres integraciones al iniciar', () => {
    expect(mockService.getOdoo).toHaveBeenCalled();
    expect(mockService.getInfraDoc).toHaveBeenCalled();
    expect(mockService.getVmware).toHaveBeenCalled();
  });

  it('popula el form de Odoo con los datos recibidos', () => {
    expect(comp.odooForm.get('url')?.value).toBe('https://odoo.test');
    expect(comp.odooForm.get('apiKey')?.value).toBe(MASK);
  });

  it('buildOdooPatchDto omite apiKey cuando es MASK', () => {
    comp.odooForm.patchValue({ apiKey: MASK });
    expect(comp.buildOdooPatchDto().apiKey).toBeUndefined();
  });

  it('buildOdooPatchDto incluye apiKey cuando es un valor nuevo', () => {
    comp.odooForm.patchValue({ apiKey: 'nueva-key' });
    expect(comp.buildOdooPatchDto().apiKey).toBe('nueva-key');
  });
});
```

- [ ] **Step 2: Correr test para verificar que falla**

```bash
cd frontend && npx ng test --include="**/integraciones.component.spec.ts" --watch=false --browsers=ChromeHeadless
```
Expected: FAIL — component not found

- [ ] **Step 3: Crear el componente TypeScript**

Create `frontend/src/app/features/admin/integraciones/integraciones.component.ts`:

```typescript
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  IntegrationConfigService, OdooConfigDto, InfraDocConfigDto, VmwareConfigDto,
} from '../../../core/services/integration-config.service';

const MASK = '••••••••';
type ConnectionStatus = 'ok' | 'error' | 'unknown';

interface CardState {
  loading: boolean; saving: boolean; testing: boolean;
  connectionStatus: ConnectionStatus; connectionMessage: string;
  updatedAt: Date | null; updatedBy: string | null;
}

const initCard = (): CardState => ({ loading: true, saving: false, testing: false, connectionStatus: 'unknown', connectionMessage: '', updatedAt: null, updatedBy: null });

@Component({
  selector: 'app-integraciones',
  templateUrl: './integraciones.component.html',
  styleUrl: './integraciones.component.scss',
})
export class IntegracionesComponent implements OnInit {
  readonly MASK = MASK;

  odooForm: FormGroup;
  infradocForm: FormGroup;
  vmwareForm: FormGroup;

  odoo     = initCard();
  infradoc = initCard();
  vmware   = initCard();

  showOdooApiKey      = false;
  showInfradocApiKey  = false;
  showVmwarePassword  = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly svc: IntegrationConfigService,
    private readonly snackBar: MatSnackBar,
  ) {
    this.odooForm     = this.fb.group({ url: [''], db: [''], username: [''], apiKey: [MASK], helpdeskTeamId: [null] });
    this.infradocForm = this.fb.group({ url: [''], apiKey: [MASK] });
    this.vmwareForm   = this.fb.group({ username: [''], password: [MASK] });
  }

  ngOnInit(): void {
    this.svc.getOdoo().subscribe({ next: (d) => { this.odooForm.patchValue(d); this.odoo.loading = false; this.odoo.updatedAt = d.updatedAt; this.odoo.updatedBy = d.updatedBy; } });
    this.svc.getInfraDoc().subscribe({ next: (d) => { this.infradocForm.patchValue(d); this.infradoc.loading = false; this.infradoc.updatedAt = d.updatedAt; this.infradoc.updatedBy = d.updatedBy; } });
    this.svc.getVmware().subscribe({ next: (d) => { this.vmwareForm.patchValue(d); this.vmware.loading = false; this.vmware.updatedAt = d.updatedAt; this.vmware.updatedBy = d.updatedBy; } });
  }

  buildOdooPatchDto(): Partial<OdooConfigDto> {
    const v = this.odooForm.value;
    const dto: Partial<OdooConfigDto> = { url: v.url, db: v.db, username: v.username, helpdeskTeamId: v.helpdeskTeamId };
    if (v.apiKey && v.apiKey !== MASK) dto.apiKey = v.apiKey;
    return dto;
  }

  buildInfraDocPatchDto(): Partial<InfraDocConfigDto> {
    const v = this.infradocForm.value;
    const dto: Partial<InfraDocConfigDto> = { url: v.url };
    if (v.apiKey && v.apiKey !== MASK) dto.apiKey = v.apiKey;
    return dto;
  }

  buildVmwarePatchDto(): Partial<VmwareConfigDto> {
    const v = this.vmwareForm.value;
    const dto: Partial<VmwareConfigDto> = { username: v.username };
    if (v.password && v.password !== MASK) dto.password = v.password;
    return dto;
  }

  saveOdoo(): void {
    this.odoo.saving = true;
    this.svc.patchOdoo(this.buildOdooPatchDto()).subscribe({
      next: (d) => { this.odooForm.patchValue(d); this.odoo.saving = false; this.odoo.updatedAt = (d as any).updatedAt; this.odoo.updatedBy = (d as any).updatedBy; this.snackBar.open('Configuración de Odoo guardada', '', { duration: 3000 }); },
      error: () => { this.odoo.saving = false; this.snackBar.open('Error al guardar configuración de Odoo', '', { duration: 4000 }); },
    });
  }

  testOdoo(): void {
    this.odoo.testing = true;
    this.svc.testOdoo().subscribe({
      next: (r) => { this.odoo.testing = false; this.odoo.connectionStatus = r.ok ? 'ok' : 'error'; this.odoo.connectionMessage = r.message; if (!r.ok) this.snackBar.open(r.message, '', { duration: 5000 }); },
      error: (e) => { this.odoo.testing = false; this.odoo.connectionStatus = 'error'; this.odoo.connectionMessage = e?.error?.message ?? 'Error de conexión'; this.snackBar.open(this.odoo.connectionMessage, '', { duration: 5000 }); },
    });
  }

  saveInfraDoc(): void {
    this.infradoc.saving = true;
    this.svc.patchInfraDoc(this.buildInfraDocPatchDto()).subscribe({
      next: (d) => { this.infradocForm.patchValue(d); this.infradoc.saving = false; this.infradoc.updatedAt = (d as any).updatedAt; this.infradoc.updatedBy = (d as any).updatedBy; this.snackBar.open('Configuración de InfraDoc guardada', '', { duration: 3000 }); },
      error: () => { this.infradoc.saving = false; this.snackBar.open('Error al guardar configuración de InfraDoc', '', { duration: 4000 }); },
    });
  }

  testInfraDoc(): void {
    this.infradoc.testing = true;
    this.svc.testInfraDoc().subscribe({
      next: (r) => { this.infradoc.testing = false; this.infradoc.connectionStatus = r.ok ? 'ok' : 'error'; this.infradoc.connectionMessage = r.message; if (!r.ok) this.snackBar.open(r.message, '', { duration: 5000 }); },
      error: (e) => { this.infradoc.testing = false; this.infradoc.connectionStatus = 'error'; this.infradoc.connectionMessage = e?.error?.message ?? 'Error de conexión'; this.snackBar.open(this.infradoc.connectionMessage, '', { duration: 5000 }); },
    });
  }

  saveVmware(): void {
    this.vmware.saving = true;
    this.svc.patchVmware(this.buildVmwarePatchDto()).subscribe({
      next: (d) => { this.vmwareForm.patchValue(d); this.vmware.saving = false; this.vmware.updatedAt = (d as any).updatedAt; this.vmware.updatedBy = (d as any).updatedBy; this.snackBar.open('Configuración de VMware guardada', '', { duration: 3000 }); },
      error: () => { this.vmware.saving = false; this.snackBar.open('Error al guardar configuración de VMware', '', { duration: 4000 }); },
    });
  }

  testVmware(): void {
    this.vmware.testing = true;
    this.svc.testVmware().subscribe({
      next: (r) => { this.vmware.testing = false; this.vmware.connectionStatus = r.ok ? 'ok' : 'error'; this.vmware.connectionMessage = r.message; },
      error: () => { this.vmware.testing = false; this.vmware.connectionStatus = 'error'; },
    });
  }
}
```

- [ ] **Step 4: Crear el template HTML**

Create `frontend/src/app/features/admin/integraciones/integraciones.component.html`:

```html
<div class="integraciones-page">
  <div class="page-header">
    <h2 class="page-title">Integraciones externas</h2>
    <p class="page-subtitle">Configuración de credenciales y endpoints. Los cambios toman efecto de inmediato.</p>
  </div>

  <!-- ODOO -->
  <div class="integration-card">
    <div class="card-header">
      <div class="card-icon odoo">OD</div>
      <div class="card-title-group">
        <div class="card-title">Odoo</div>
        <div class="card-desc">Gestión de tickets, hojas de tiempo y métricas de clientes</div>
      </div>
      <div class="status-badge" [ngClass]="{ ok: odoo.connectionStatus === 'ok', err: odoo.connectionStatus === 'error', unk: odoo.connectionStatus === 'unknown' }">
        <span class="status-dot"></span>
        {{ odoo.connectionStatus === 'ok' ? 'Conectado' : odoo.connectionStatus === 'error' ? 'Error' : 'Sin probar' }}
      </div>
    </div>
    <div class="card-body" [formGroup]="odooForm">
      <div class="field full">
        <label class="field-label">URL <span class="req">*</span></label>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <input matInput formControlName="url" placeholder="https://ondra.odoo.com" />
        </mat-form-field>
        <span class="field-hint">URL base de la instancia Odoo. Incluir protocolo (https://).</span>
      </div>
      <div class="field-row">
        <div class="field">
          <label class="field-label">Base de datos <span class="req">*</span></label>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <input matInput formControlName="db" placeholder="nombre-db" />
          </mat-form-field>
          <span class="field-hint">Nombre exacto de la DB Odoo. Sensible a mayúsculas.</span>
        </div>
        <div class="field">
          <label class="field-label">Usuario <span class="req">*</span></label>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <input matInput formControlName="username" placeholder="bot@empresa.com" />
          </mat-form-field>
          <span class="field-hint">Email del usuario bot que crea tickets y timesheets.</span>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label class="field-label">API Key <span class="req">*</span></label>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <input matInput formControlName="apiKey" [type]="showOdooApiKey ? 'text' : 'password'" />
            <button matSuffix mat-icon-button type="button" (click)="showOdooApiKey = !showOdooApiKey">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </mat-form-field>
          <span class="field-hint">Clave generada en Odoo → Config → Técnico → API Keys. Dejar vacío para no modificar.</span>
        </div>
        <div class="field">
          <label class="field-label">ID Equipo Helpdesk <span class="req">*</span></label>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <input matInput formControlName="helpdeskTeamId" type="number" placeholder="7" />
          </mat-form-field>
          <span class="field-hint">ID del equipo Helpdesk en Odoo al que se asignan los tickets.</span>
        </div>
      </div>
    </div>
    <div class="card-actions">
      <button mat-stroked-button [disabled]="odoo.testing || odoo.saving" (click)="testOdoo()">
        <mat-spinner *ngIf="odoo.testing" diameter="14"></mat-spinner>
        <span *ngIf="!odoo.testing">Probar conexión</span>
      </button>
      <button mat-flat-button color="primary" [disabled]="odoo.saving || odoo.testing" (click)="saveOdoo()">
        <mat-spinner *ngIf="odoo.saving" diameter="14"></mat-spinner>
        <span *ngIf="!odoo.saving">Guardar</span>
      </button>
      <span class="last-updated" *ngIf="odoo.updatedAt">{{ odoo.updatedAt | date:'dd/MM/yyyy HH:mm' }}{{ odoo.updatedBy ? ' · ' + odoo.updatedBy : '' }}</span>
    </div>
  </div>

  <!-- INFRADOC -->
  <div class="integration-card">
    <div class="card-header">
      <div class="card-icon infradoc">ID</div>
      <div class="card-title-group">
        <div class="card-title">InfraDoc</div>
        <div class="card-desc">Inventario de infraestructura por cliente, consultado en tiempo real</div>
      </div>
      <div class="status-badge" [ngClass]="{ ok: infradoc.connectionStatus === 'ok', err: infradoc.connectionStatus === 'error', unk: infradoc.connectionStatus === 'unknown' }">
        <span class="status-dot"></span>
        {{ infradoc.connectionStatus === 'ok' ? 'Conectado' : infradoc.connectionStatus === 'error' ? 'Error' : 'Sin probar' }}
      </div>
    </div>
    <div class="card-body" [formGroup]="infradocForm">
      <div class="field full">
        <label class="field-label">URL <span class="req">*</span></label>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <input matInput formControlName="url" placeholder="https://infradoc.empresa.com:6443" />
        </mat-form-field>
        <span class="field-hint">Endpoint de la API de InfraDoc. Incluir puerto si corresponde.</span>
      </div>
      <div class="field full">
        <label class="field-label">API Key <span class="req">*</span></label>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <input matInput formControlName="apiKey" [type]="showInfradocApiKey ? 'text' : 'password'" />
          <button matSuffix mat-icon-button type="button" (click)="showInfradocApiKey = !showInfradocApiKey">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </mat-form-field>
        <span class="field-hint">Token de autenticación para la API de InfraDoc. Dejar vacío para no modificar.</span>
      </div>
    </div>
    <div class="card-actions">
      <button mat-stroked-button [disabled]="infradoc.testing || infradoc.saving" (click)="testInfraDoc()">
        <mat-spinner *ngIf="infradoc.testing" diameter="14"></mat-spinner>
        <span *ngIf="!infradoc.testing">Probar conexión</span>
      </button>
      <button mat-flat-button color="primary" [disabled]="infradoc.saving || infradoc.testing" (click)="saveInfraDoc()">
        <mat-spinner *ngIf="infradoc.saving" diameter="14"></mat-spinner>
        <span *ngIf="!infradoc.saving">Guardar</span>
      </button>
      <span class="last-updated" *ngIf="infradoc.updatedAt">{{ infradoc.updatedAt | date:'dd/MM/yyyy HH:mm' }}{{ infradoc.updatedBy ? ' · ' + infradoc.updatedBy : '' }}</span>
    </div>
  </div>

  <!-- VMWARE -->
  <div class="integration-card">
    <div class="card-header">
      <div class="card-icon vmware">VM</div>
      <div class="card-title-group">
        <div class="card-title">VMware ESXi</div>
        <div class="card-desc">Credenciales para health checks de hosts ESXi de clientes</div>
      </div>
      <div class="status-badge" [ngClass]="{ ok: vmware.connectionStatus === 'ok', err: vmware.connectionStatus === 'error', unk: vmware.connectionStatus === 'unknown' }">
        <span class="status-dot"></span>
        {{ vmware.connectionStatus === 'ok' ? 'Guardado' : vmware.connectionStatus === 'error' ? 'Error' : 'Sin probar' }}
      </div>
    </div>
    <div class="card-body" [formGroup]="vmwareForm">
      <div class="field-row">
        <div class="field">
          <label class="field-label">Usuario <span class="req">*</span></label>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <input matInput formControlName="username" placeholder="ondra-read" />
          </mat-form-field>
          <span class="field-hint">Usuario de solo lectura en los hosts ESXi. Debe existir en todos los hosts monitoreados.</span>
        </div>
        <div class="field">
          <label class="field-label">Contraseña <span class="req">*</span></label>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <input matInput formControlName="password" [type]="showVmwarePassword ? 'text' : 'password'" />
            <button matSuffix mat-icon-button type="button" (click)="showVmwarePassword = !showVmwarePassword">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </mat-form-field>
          <span class="field-hint">Contraseña del usuario de lectura. Dejar vacío para no modificar.</span>
        </div>
      </div>
    </div>
    <div class="card-actions">
      <button mat-stroked-button [disabled]="vmware.testing || vmware.saving" (click)="testVmware()">
        <mat-spinner *ngIf="vmware.testing" diameter="14"></mat-spinner>
        <span *ngIf="!vmware.testing">Probar conexión</span>
      </button>
      <button mat-flat-button color="primary" [disabled]="vmware.saving || vmware.testing" (click)="saveVmware()">
        <mat-spinner *ngIf="vmware.saving" diameter="14"></mat-spinner>
        <span *ngIf="!vmware.saving">Guardar</span>
      </button>
      <span class="last-updated" *ngIf="vmware.updatedAt">{{ vmware.updatedAt | date:'dd/MM/yyyy HH:mm' }}{{ vmware.updatedBy ? ' · ' + vmware.updatedBy : '' }}</span>
    </div>
  </div>
</div>
```

- [ ] **Step 5: Crear el SCSS**

Create `frontend/src/app/features/admin/integraciones/integraciones.component.scss`:

```scss
.integraciones-page {
  padding: 28px 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 860px;
}

.page-header { margin-bottom: 4px; }
.page-title { font-size: 16px; font-weight: 600; color: var(--tx-hi); margin: 0 0 4px; }
.page-subtitle { font-size: 12px; color: var(--tx-lo); margin: 0; }

.integration-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.card-header {
  display: flex; align-items: center; gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-lo);
  background: var(--elevated);
}

.card-icon {
  width: 32px; height: 32px; border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700;
  &.odoo    { background: rgba(113,75,201,0.15); color: #9b70eb; border: 1px solid rgba(113,75,201,0.3); }
  &.infradoc { background: var(--accent-bg); color: var(--accent); border: 1px solid var(--accent-bd); }
  &.vmware  { background: var(--vmware-bg); color: var(--vmware); border: 1px solid var(--vmware-bd); }
}

.card-title-group { flex: 1; }
.card-title { font-size: 14px; font-weight: 600; color: var(--tx-hi); }
.card-desc  { font-size: 11px; color: var(--tx-lo); margin-top: 2px; }

.status-badge {
  display: flex; align-items: center; gap: 5px;
  padding: 4px 10px; border-radius: 20px;
  font-size: 11px; font-weight: 500;
  &.ok  { background: var(--ok-bg);   color: var(--ok);   border: 1px solid var(--ok-bd);   }
  &.err { background: var(--crit-bg); color: var(--crit); border: 1px solid var(--crit-bd); }
  &.unk { background: rgba(84,98,114,0.15); color: var(--tx-md); border: 1px solid var(--border); }
}
.status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

.card-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }

.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

.field {
  display: flex; flex-direction: column; gap: 4px;
  &.full { grid-column: 1 / -1; }
  mat-form-field { width: 100%; }
}

.field-label {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px;
  color: var(--tx-lo); font-weight: 500;
  .req { color: var(--crit); margin-left: 2px; }
}

.field-hint { font-size: 11px; color: var(--tx-lo); line-height: 1.4; }

.card-actions {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--border-lo);
  background: rgba(0,0,0,0.12);
}

.last-updated { margin-left: auto; font-size: 11px; color: var(--tx-lo); }
```

- [ ] **Step 6: Registrar en AdminModule**

En `frontend/src/app/features/admin/admin.module.ts`:

```typescript
import { IntegracionesComponent } from './integraciones/integraciones.component';
// Agregar a declarations:
IntegracionesComponent,
```

- [ ] **Step 7: Agregar ruta en admin-routing.module.ts**

En `frontend/src/app/features/admin/admin-routing.module.ts`:

```typescript
import { IntegracionesComponent } from './integraciones/integraciones.component';
// Agregar en children:
{ path: 'integraciones', component: IntegracionesComponent },
```

- [ ] **Step 8: Agregar tab en admin-layout.component.ts**

En `frontend/src/app/features/admin/admin-layout/admin-layout.component.ts`, agregar al array `tabs`:

```typescript
{ path: '/admin/integraciones', label: 'Integraciones' },
```

- [ ] **Step 9: Correr tests del componente**

```bash
cd frontend && npx ng test --include="**/integraciones.component.spec.ts" --watch=false --browsers=ChromeHeadless
```
Expected: PASS

- [ ] **Step 10: Commit final**

```bash
git add frontend/src/app/features/admin/integraciones/ \
        frontend/src/app/features/admin/admin.module.ts \
        frontend/src/app/features/admin/admin-routing.module.ts \
        frontend/src/app/features/admin/admin-layout/admin-layout.component.ts
git commit -m "feat(frontend): tab Integraciones con formularios para Odoo, InfraDoc y VMware"
```
