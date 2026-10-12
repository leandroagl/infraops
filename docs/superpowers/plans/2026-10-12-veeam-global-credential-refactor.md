# Veeam Global Credential Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover las credenciales Veeam del vault per-cliente a una credencial global en Admin → Integraciones, con el mismo criterio que VMware.

**Architecture:** Nueva entidad singleton `VeeamConfig` en `integration-config` almacena `username` + `password` encriptado. `VeeamClientConfig` retiene solo `host`, `port`, `isEnabled` por cliente. `BackupsService` obtiene las credenciales globales vía `IntegrationConfigService.getVeeamConfigDecrypted()` en cada llamada a la API Veeam. El vault de credenciales (`credential_vault_entries` + toda su infra frontend/backend) se elimina por completo.

**Tech Stack:** NestJS · TypeORM · PostgreSQL · Angular · Angular Material

**Spec:** Conversación de diseño — usuario confirmó "veeam y vmware tienen el mismo criterio, ambos necesitan una credencial global" y que todo lo del vault debe ser limpiado.

## Global Constraints

- TDD obligatorio: test antes que implementación
- Un archivo a la vez, confirmación entre cada uno
- No usar `any` en TypeScript
- Angular Material únicamente (no elementos HTML nativos en templates)
- `appearance="outline"` en todos los `mat-form-field`
- Commits en español
- Sin código especulativo ni features no pedidas

## Review Focus

1. **BackupsService sin ConfigService**: después de remover `encrypt`/`decrypt`, `ConfigService` ya no es necesario en `BackupsService` — asegurarse de que se quitó también del constructor y del TestBed.
2. **Dialog formulario válido sin campo credencial**: el formulario del dialog ahora valida con solo `clientId` + `host` + `port` — verificar que `isValid` retorna `true` con esos tres campos completos.
3. **getVeeamConfigDecrypted llamada dos veces en getAllClientStatuses**: con N clientes habilitados, se hace una llamada por cliente. Considerar si esto es un problema de rendimiento (no lo es para la escala actual, pero el test debe verificar que se llama por cada cliente enabled).
4. **admin.module.ts sin CredentialVaultComponent**: si el módulo Angular compila sin las declaraciones removidas, confirmar que no hay otro lugar que las referencie.
5. **Migration down() reversible**: el `down()` de la migración debe recrear `credential_vault_entries` y las columnas en `veeam_client_configs` exactamente como estaban, para no romper rollback.

---

### Task 1: Backend — VeeamConfig entity + DTO en integration-config

**Files:**
- Create: `backend/src/integration-config/entities/veeam-config.entity.ts`
- Create: `backend/src/integration-config/dto/veeam-integration-config.dto.ts`

**Interfaces:**
- Produces: clase `VeeamConfig` (entity), `PatchVeeamIntegrationConfigDto`, `VeeamIntegrationConfigResponseDto` — usados en Task 2

- [ ] **Step 1: Crear la entidad VeeamConfig**

```typescript
// backend/src/integration-config/entities/veeam-config.entity.ts
import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('veeam_config')
export class VeeamConfig {
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

- [ ] **Step 2: Crear los DTOs de Veeam para integration-config**

```typescript
// backend/src/integration-config/dto/veeam-integration-config.dto.ts
import { IsString, IsOptional } from 'class-validator';

export class PatchVeeamIntegrationConfigDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;
}

export class VeeamIntegrationConfigResponseDto {
  username: string;
  password: string;
  updatedAt: Date | null;
  updatedBy: string | null;
}
```

- [ ] **Step 3: Commit**

```
git add backend/src/integration-config/entities/veeam-config.entity.ts
git add backend/src/integration-config/dto/veeam-integration-config.dto.ts
git commit -m "feat: entidad y DTOs VeeamConfig en integration-config"
```

---

### Task 2: Backend — IntegrationConfigService + Controller + Module: agregar Veeam

**Files:**
- Modify: `backend/src/integration-config/integration-config.service.ts`
- Modify: `backend/src/integration-config/integration-config.service.spec.ts`
- Modify: `backend/src/integration-config/integration-config.controller.ts`
- Modify: `backend/src/integration-config/integration-config.module.ts`

**Interfaces:**
- Consumes: `VeeamConfig` (Task 1), `PatchVeeamIntegrationConfigDto`, `VeeamIntegrationConfigResponseDto` (Task 1)
- Produces: métodos `getVeeam()`, `patchVeeam()`, `getVeeamConfigDecrypted()`, `testVeeam()` — usados en Task 5

- [ ] **Step 1: Escribir los tests fallidos en integration-config.service.spec.ts**

Agregar estas importaciones al inicio del spec:
```typescript
import { VeeamConfig } from './entities/veeam-config.entity';
import { VeeamIntegrationConfigResponseDto } from './dto/veeam-integration-config.dto';
```

Agregar `veeamRepo: { findOne: jest.Mock; save: jest.Mock }` junto a los otros repos en `beforeEach`. Agregar al `TestingModule.createTestingModule`:
```typescript
{ provide: getRepositoryToken(VeeamConfig), useValue: veeamRepo },
```
Agregar al `beforeEach` interno: `veeamRepo = { findOne: jest.fn(), save: jest.fn() };`.

Agregar al `ConfigService` mock la clave `VEEAM_USER: 'env-veeam-user'`.

Luego agregar el bloque de tests al final del describe raíz:
```typescript
describe('getVeeam', () => {
  it('retorna password enmascarado cuando hay fila en DB', async () => {
    veeamRepo.findOne.mockResolvedValue({
      id: 1, username: 'admin', password: 'encrypted-value',
      updatedAt: new Date('2026-10-01'), updatedBy: 'pepe@ondra.com.ar',
    });
    const result = await service.getVeeam();
    expect(result.username).toBe('admin');
    expect(result.password).toBe(MASK);
    expect(result.updatedBy).toBe('pepe@ondra.com.ar');
  });

  it('retorna fallback del env cuando no hay fila en DB', async () => {
    veeamRepo.findOne.mockResolvedValue(null);
    const result = await service.getVeeam();
    expect(result.username).toBe('env-veeam-user');
    expect(result.password).toBe(MASK);
    expect(result.updatedAt).toBeNull();
  });
});

describe('patchVeeam', () => {
  it('encripta el password nuevo al guardar', async () => {
    veeamRepo.findOne.mockResolvedValue(null);
    veeamRepo.save.mockImplementation((e: VeeamConfig) => Promise.resolve({ ...e, updatedAt: new Date() }));
    veeamRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 1, username: 'admin', password: 'encrypted', updatedAt: new Date(), updatedBy: 'u',
    });
    await service.patchVeeam({ username: 'admin', password: 'plaintext' }, 'u@test.com');
    const saved = veeamRepo.save.mock.calls[0][0] as VeeamConfig;
    expect(saved.password).not.toBe('plaintext');
    expect(saved.password).toBeDefined();
  });

  it('no modifica el password si se envía el MASK', async () => {
    veeamRepo.findOne.mockResolvedValue({
      id: 1, username: 'admin', password: 'existing-encrypted',
      updatedAt: new Date(), updatedBy: 'u',
    });
    veeamRepo.save.mockImplementation((e: VeeamConfig) => Promise.resolve({ ...e, updatedAt: new Date() }));
    veeamRepo.findOne.mockResolvedValueOnce({
      id: 1, username: 'admin', password: 'existing-encrypted',
      updatedAt: new Date(), updatedBy: 'u',
    }).mockResolvedValueOnce({
      id: 1, username: 'admin', password: 'existing-encrypted',
      updatedAt: new Date(), updatedBy: 'u',
    });
    await service.patchVeeam({ password: MASK }, 'u@test.com');
    const saved = veeamRepo.save.mock.calls[0][0] as VeeamConfig;
    expect(saved.password).toBe('existing-encrypted');
  });
});

describe('getVeeamConfigDecrypted', () => {
  it('retorna username y password desencriptado desde DB', async () => {
    const { encrypt: enc } = await import('./crypto.util');
    const encryptedPassword = enc('real-password', KEY);
    veeamRepo.findOne.mockResolvedValue({
      id: 1, username: 'admin', password: encryptedPassword,
      updatedAt: new Date(), updatedBy: null,
    });
    const result = await service.getVeeamConfigDecrypted();
    expect(result.username).toBe('admin');
    expect(result.password).toBe('real-password');
  });
});
```

- [ ] **Step 2: Ejecutar los tests para verificar que fallan**

```
cd backend && npx jest integration-config.service.spec --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `service.getVeeam is not a function`

- [ ] **Step 3: Implementar los métodos Veeam en IntegrationConfigService**

Agregar a las importaciones de `integration-config.service.ts`:
```typescript
import { VeeamConfig } from './entities/veeam-config.entity';
import { PatchVeeamIntegrationConfigDto, VeeamIntegrationConfigResponseDto } from './dto/veeam-integration-config.dto';
```

Agregar en el constructor:
```typescript
@InjectRepository(VeeamConfig) private readonly veeamIntegrationRepo: Repository<VeeamConfig>,
```

Agregar los métodos al final de la clase (después de `testVmware`):

```typescript
// ── VEEAM ──

async getVeeam(): Promise<VeeamIntegrationConfigResponseDto> {
  const row = await this.veeamIntegrationRepo.findOne({ where: { id: 1 } });
  if (!row) return { username: this.configService.get('VEEAM_USER', ''), password: MASK, updatedAt: null, updatedBy: null };
  return { username: row.username ?? '', password: MASK, updatedAt: row.updatedAt, updatedBy: row.updatedBy };
}

async patchVeeam(dto: PatchVeeamIntegrationConfigDto, updatedBy: string): Promise<VeeamIntegrationConfigResponseDto> {
  const existing = (await this.veeamIntegrationRepo.findOne({ where: { id: 1 } })) ?? new VeeamConfig();
  existing.id = 1;
  if (dto.username !== undefined) existing.username = dto.username.trim();
  if (dto.password !== undefined && !isMasked(dto.password) && dto.password.trim() !== '') {
    existing.password = this.safeEncrypt(dto.password.trim());
  }
  if (!existing.password) {
    const envPass = this.configService.get<string>('VEEAM_PASS', '');
    if (envPass) existing.password = this.safeEncrypt(envPass);
  }
  existing.updatedBy = updatedBy;
  await this.veeamIntegrationRepo.save(existing);
  return this.getVeeam();
}

async getVeeamConfigDecrypted(): Promise<{ username: string; password: string }> {
  const row = await this.veeamIntegrationRepo.findOne({ where: { id: 1 } });
  if (!row) return { username: this.configService.get('VEEAM_USER', ''), password: this.configService.get('VEEAM_PASS', '') };
  return { username: row.username ?? '', password: row.password ? decrypt(row.password, this.encryptKey) : '' };
}

async testVeeam(): Promise<{ ok: boolean; message: string }> {
  return { ok: true, message: 'Credenciales guardadas. Se verificarán al conectar con los servidores Veeam de clientes.' };
}
```

- [ ] **Step 4: Agregar endpoints Veeam al controller**

En `integration-config.controller.ts`, agregar importaciones:
```typescript
import { PatchVeeamIntegrationConfigDto, VeeamIntegrationConfigResponseDto } from './dto/veeam-integration-config.dto';
```

Agregar métodos al final de la clase:
```typescript
@Get('veeam')
getVeeam(): Promise<VeeamIntegrationConfigResponseDto> { return this.svc.getVeeam(); }

@Patch('veeam')
patchVeeam(@Body() dto: PatchVeeamIntegrationConfigDto, @CurrentUser() u: JwtPayload): Promise<VeeamIntegrationConfigResponseDto> {
  return this.svc.patchVeeam(dto, u.email);
}

@Post('veeam/test')
@HttpCode(200)
testVeeam(): Promise<{ ok: boolean; message: string }> { return this.svc.testVeeam(); }
```

- [ ] **Step 5: Registrar VeeamConfig en IntegrationConfigModule**

En `integration-config.module.ts`, agregar `VeeamConfig` al import y a `TypeOrmModule.forFeature`:

```typescript
import { VeeamConfig } from './entities/veeam-config.entity';
// ...
TypeOrmModule.forFeature([OdooConfig, InfraDocConfig, VmwareConfig, VeeamConfig]),
```

- [ ] **Step 6: Ejecutar tests**

```
cd backend && npx jest integration-config.service.spec --no-coverage 2>&1 | tail -20
```

Expected: PASS (todos los tests del describe 'getVeeam', 'patchVeeam', 'getVeeamConfigDecrypted' pasan)

- [ ] **Step 7: Commit**

```
git add backend/src/integration-config/
git commit -m "feat: credencial global Veeam en integration-config — service, controller, module"
```

---

### Task 3: Backend — Migración de base de datos

**Files:**
- Create: `backend/src/migrations/1790700000000-RefactorVeeamCredentialsToIntegrationConfig.ts`

**Interfaces:**
- Produces: tabla `veeam_config`, sin columnas de credencial en `veeam_client_configs`, sin tabla `credential_vault_entries`

- [ ] **Step 1: Crear la migración**

```typescript
// backend/src/migrations/1790700000000-RefactorVeeamCredentialsToIntegrationConfig.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefactorVeeamCredentialsToIntegrationConfig1790700000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Quitar FK y columna credential_vault_entry_id de veeam_client_configs
    await queryRunner.query(`
      ALTER TABLE veeam_client_configs
        DROP COLUMN IF EXISTS credential_vault_entry_id
    `);
    // 2. Quitar username y encrypted_password (ahora son globales en veeam_config)
    await queryRunner.query(`
      ALTER TABLE veeam_client_configs
        DROP COLUMN IF EXISTS username,
        DROP COLUMN IF EXISTS encrypted_password
    `);
    // 3. Eliminar la tabla de vault
    await queryRunner.query(`DROP TABLE IF EXISTS credential_vault_entries`);
    // 4. Crear tabla singleton veeam_config
    await queryRunner.query(`
      CREATE TABLE veeam_config (
        id INT PRIMARY KEY DEFAULT 1,
        username VARCHAR,
        password VARCHAR,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_by VARCHAR
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS veeam_config`);
    await queryRunner.query(`
      CREATE TABLE credential_vault_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        encrypted_password VARCHAR NOT NULL,
        username VARCHAR,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      ALTER TABLE veeam_client_configs
        ADD COLUMN username VARCHAR NOT NULL DEFAULT '',
        ADD COLUMN encrypted_password VARCHAR NOT NULL DEFAULT '',
        ADD COLUMN credential_vault_entry_id UUID
    `);
  }
}
```

- [ ] **Step 2: Commit**

```
git add backend/src/migrations/1790700000000-RefactorVeeamCredentialsToIntegrationConfig.ts
git commit -m "feat: migración — mover credenciales Veeam a tabla global, eliminar vault"
```

---

### Task 4: Backend — Limpiar VeeamClientConfig entity y DTOs de backups

**Files:**
- Modify: `backend/src/backups/entities/veeam-client-config.entity.ts`
- Modify: `backend/src/backups/dto/veeam-config.dto.ts`

**Interfaces:**
- Produces: `VeeamClientConfig` sin `username`/`encryptedPassword`/`credentialVaultEntryId`; DTOs sin campos de credencial — usados en Task 5

- [ ] **Step 1: Actualizar la entidad VeeamClientConfig**

Reemplazar el contenido completo del archivo:

```typescript
// backend/src/backups/entities/veeam-client-config.entity.ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('veeam_client_configs')
export class VeeamClientConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'client_id' })
  clientId: string;

  @Column({ type: 'varchar', name: 'client_name', default: '' })
  clientName: string;

  @Column({ type: 'varchar' })
  host: string;

  @Column({ type: 'int', default: 9419 })
  port: number;

  @Column({ type: 'boolean', name: 'is_enabled', default: true })
  isEnabled: boolean;

  @Column({ type: 'timestamptz', name: 'last_connected_at', nullable: true })
  lastConnectedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'now()' })
  updatedAt: Date;
}
```

- [ ] **Step 2: Actualizar los DTOs de backups**

Reemplazar el contenido completo del archivo:

```typescript
// backend/src/backups/dto/veeam-config.dto.ts
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class VeeamClientConfigResponseDto {
  id: string;
  clientId: string;
  clientName: string;
  host: string;
  port: number;
  isEnabled: boolean;
  lastConnectedAt: string | null;
}

export class CreateVeeamConfigDto {
  @IsUUID()
  clientId: string;

  @IsString()
  @IsNotEmpty()
  clientName: string;

  @IsString()
  @IsNotEmpty()
  host: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  port: number;

  @IsBoolean()
  isEnabled: boolean;
}

export class UpdateVeeamConfigDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  clientName?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  host?: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  port?: number;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}

export class TestConnectionResultDto {
  success: boolean;
  message: string;
  jobCount?: number;
}
```

- [ ] **Step 3: Commit**

```
git add backend/src/backups/entities/veeam-client-config.entity.ts
git add backend/src/backups/dto/veeam-config.dto.ts
git commit -m "refactor: VeeamClientConfig y DTOs sin campos de credencial (ahora globales)"
```

---

### Task 5: Backend — Refactorizar BackupsService + eliminar vault

**Files:**
- Modify: `backend/src/backups/backups.service.ts`
- Modify: `backend/src/backups/backups.service.spec.ts`
- Modify: `backend/src/backups/backups.module.ts`
- Delete: `backend/src/backups/credential-vault.service.ts`
- Delete: `backend/src/backups/credential-vault.service.spec.ts`
- Delete: `backend/src/backups/credential-vault.controller.ts`
- Delete: `backend/src/backups/credential-vault.controller.spec.ts`
- Delete: `backend/src/backups/dto/credential-vault.dto.ts`
- Delete: `backend/src/backups/entities/credential-vault-entry.entity.ts`

**Interfaces:**
- Consumes: `IntegrationConfigService.getVeeamConfigDecrypted()` (Task 2), `VeeamClientConfig` sin credenciales (Task 4), `CreateVeeamConfigDto`/`UpdateVeeamConfigDto` sin credenciales (Task 4)

- [ ] **Step 1: Reescribir el spec de BackupsService**

Reemplazar el contenido completo de `backend/src/backups/backups.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BackupsService } from './backups.service';
import { VeeamClientConfig } from './entities/veeam-client-config.entity';
import { VeeamDailySnapshot } from './entities/veeam-daily-snapshot.entity';
import { VeeamService } from '../integrations/veeam/veeam.service';
import { IntegrationConfigService } from '../integration-config/integration-config.service';

const mockConfigRepo = { find: jest.fn(), findOne: jest.fn(), save: jest.fn(), delete: jest.fn(), create: jest.fn() };
const mockSnapshotRepo = {
  upsert: jest.fn().mockResolvedValue(undefined),
  findOne: jest.fn(),
  find: jest.fn(),
};
const mockVeeamService = { getJobStatuses: jest.fn(), testConnection: jest.fn() };
const mockIntegrationConfigSvc = { getVeeamConfigDecrypted: jest.fn() };

describe('BackupsService', () => {
  let svc: BackupsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BackupsService,
        { provide: getRepositoryToken(VeeamClientConfig), useValue: mockConfigRepo },
        { provide: getRepositoryToken(VeeamDailySnapshot), useValue: mockSnapshotRepo },
        { provide: VeeamService, useValue: mockVeeamService },
        { provide: IntegrationConfigService, useValue: mockIntegrationConfigSvc },
      ],
    }).compile();
    svc = module.get(BackupsService);
    jest.clearAllMocks();
  });

  it('debería calcular estado del cliente como el peor estado de sus jobs', () => {
    const jobs = [
      { lastResult: 'Success', isRunning: false, isStale: false } as any,
      { lastResult: 'Warning', isRunning: false, isStale: false } as any,
    ];
    expect((svc as any).deriveClientStatus(jobs)).toBe('warn');
  });

  it('debería devolver crit si hay al menos un job Failed', () => {
    const jobs = [
      { lastResult: 'Success', isRunning: false, isStale: false } as any,
      { lastResult: 'Failed', isRunning: false, isStale: false } as any,
    ];
    expect((svc as any).deriveClientStatus(jobs)).toBe('crit');
  });

  it('debería devolver no_data si no hay jobs', () => {
    expect((svc as any).deriveClientStatus([])).toBe('no_data');
  });

  it('crea config sin campos de credencial', async () => {
    mockConfigRepo.create.mockImplementation((d: any) => ({ ...d }));
    mockConfigRepo.save.mockResolvedValue({
      id: 'uuid', clientId: 'c1', clientName: 'Client 1', host: 'h', port: 9419,
      isEnabled: true, lastConnectedAt: null, createdAt: new Date(), updatedAt: new Date(),
    });
    await svc.createConfig({ clientId: 'c1', clientName: 'Client 1', host: 'h', port: 9419, isEnabled: true });
    expect(mockConfigRepo.save).toHaveBeenCalled();
  });

  it('testConnection usa credenciales globales de IntegrationConfigService', async () => {
    mockConfigRepo.findOne.mockResolvedValue({
      id: 'cfg1', clientId: 'c1', clientName: 'Client 1',
      host: '10.0.0.1', port: 9419, isEnabled: true, lastConnectedAt: null,
    });
    mockIntegrationConfigSvc.getVeeamConfigDecrypted.mockResolvedValue({ username: 'admin', password: 'secret' });
    mockVeeamService.testConnection.mockResolvedValue({ success: true, message: 'OK', jobCount: 3 });
    await svc.testConnection('cfg1');
    expect(mockIntegrationConfigSvc.getVeeamConfigDecrypted).toHaveBeenCalled();
    expect(mockVeeamService.testConnection).toHaveBeenCalledWith('10.0.0.1', 9419, 'admin', 'secret');
  });

  it('getClientStatus usa credenciales globales para llamar a VeeamService', async () => {
    mockConfigRepo.findOne.mockResolvedValue({
      id: '1', clientId: 'c1', clientName: 'Client 1',
      host: 'h', port: 9419, isEnabled: true, lastConnectedAt: null,
    });
    mockIntegrationConfigSvc.getVeeamConfigDecrypted.mockResolvedValue({ username: 'veeamadmin', password: 'pass' });
    mockVeeamService.getJobStatuses.mockResolvedValue([]);
    await svc.getClientStatus('c1');
    expect(mockVeeamService.getJobStatuses).toHaveBeenCalledWith('h', 9419, 'veeamadmin', 'pass');
  });

  it('getAllClientStatuses incluye configs deshabilitadas con status disconnected', async () => {
    mockConfigRepo.find.mockResolvedValue([
      { id: '1', clientId: 'c1', clientName: 'Client 1', host: 'h', port: 9419, isEnabled: false, lastConnectedAt: null },
    ]);
    const result = await svc.getAllClientStatuses();
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('disconnected');
    expect(mockVeeamService.getJobStatuses).not.toHaveBeenCalled();
  });

  it('getAllClientStatuses retorna disconnected cuando la conexión falla en un config habilitado', async () => {
    mockConfigRepo.find.mockResolvedValue([
      { id: '1', clientId: 'c1', clientName: 'Client 1', host: 'h', port: 9419, isEnabled: true, lastConnectedAt: null },
    ]);
    mockConfigRepo.findOne.mockResolvedValue({
      id: '1', clientId: 'c1', clientName: 'Client 1', host: 'h', port: 9419, isEnabled: true, lastConnectedAt: null,
    });
    mockIntegrationConfigSvc.getVeeamConfigDecrypted.mockResolvedValue({ username: 'u', password: 'p' });
    mockVeeamService.getJobStatuses.mockRejectedValue(new Error('Connection refused'));
    const result = await svc.getAllClientStatuses();
    expect(result[0].status).toBe('disconnected');
  });

  it('getClientStatus llama saveSnapshot tras conexión exitosa', async () => {
    mockConfigRepo.findOne.mockResolvedValue({
      id: '1', clientId: 'c1', clientName: 'Client 1', host: 'h', port: 9419, isEnabled: true, lastConnectedAt: null,
    });
    mockIntegrationConfigSvc.getVeeamConfigDecrypted.mockResolvedValue({ username: 'u', password: 'p' });
    mockVeeamService.getJobStatuses.mockResolvedValue([
      { jobId: 'j1', jobName: 'Job1', jobType: 'Backup', isRunning: false,
        lastResult: 'Success', lastMessage: null, lastRunAt: new Date().toISOString(), hoursAgo: 2, isStale: false },
    ]);
    await svc.getClientStatus('c1');
    await Promise.resolve();
    expect(mockSnapshotRepo.upsert).toHaveBeenCalledTimes(1);
  });

  it('getLastSnapshot retorna disconnectedDto cuando no hay snapshots para un cliente', async () => {
    mockConfigRepo.find.mockResolvedValue([
      { id: '1', clientId: 'c1', clientName: 'Client 1', host: 'h', port: 9419, isEnabled: true, lastConnectedAt: null },
    ]);
    mockSnapshotRepo.findOne.mockResolvedValue(null);
    const result = await svc.getLastSnapshot();
    expect(result[0].status).toBe('disconnected');
  });

  it('getLastSnapshot reconstruye status desde filas de snapshot', async () => {
    const lastRunAt = new Date(Date.now() - 2 * 3600000);
    mockConfigRepo.find.mockResolvedValue([
      { id: '1', clientId: 'c1', clientName: 'Client 1', host: 'h', port: 9419, isEnabled: true, lastConnectedAt: null },
    ]);
    mockSnapshotRepo.findOne.mockResolvedValue({ clientId: 'c1', jobId: 'j1', snapshotDate: '2026-10-12' });
    mockSnapshotRepo.find.mockResolvedValue([
      { clientId: 'c1', jobId: 'j1', jobName: 'Job1', jobType: 'Backup',
        result: 'Success', message: null, lastRunAt, hoursAgo: 2, snapshotDate: '2026-10-12' },
    ]);
    const result = await svc.getLastSnapshot();
    expect(result[0].status).toBe('ok');
    expect(result[0].isSnapshot).toBe(true);
  });

  it('getLastSnapshot retorna disconnectedDto para clientes deshabilitados', async () => {
    mockConfigRepo.find.mockResolvedValue([
      { id: '1', clientId: 'c1', clientName: 'Client 1', host: 'h', port: 9419, isEnabled: false, lastConnectedAt: null },
    ]);
    const result = await svc.getLastSnapshot();
    expect(result[0].status).toBe('disconnected');
    expect(mockSnapshotRepo.findOne).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Ejecutar los tests para verificar que fallan**

```
cd backend && npx jest backups.service.spec --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `BackupsService` still injects `CredentialVaultService` / `ConfigService`

- [ ] **Step 3: Reescribir BackupsService**

Reemplazar el contenido completo de `backend/src/backups/backups.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VeeamClientConfig } from './entities/veeam-client-config.entity';
import { VeeamDailySnapshot } from './entities/veeam-daily-snapshot.entity';
import { VeeamService } from '../integrations/veeam/veeam.service';
import { IntegrationConfigService } from '../integration-config/integration-config.service';
import type { BackupJobStatus } from '../integrations/veeam/dto/veeam-api.dto';
import type { BackupJobStatusDto, JobResult } from './dto/backup-status.dto';
import type {
  CreateVeeamConfigDto,
  UpdateVeeamConfigDto,
  VeeamClientConfigResponseDto,
  TestConnectionResultDto,
} from './dto/veeam-config.dto';
import type { ClientBackupStatusDto, ClientStatus } from './dto/backup-status.dto';

@Injectable()
export class BackupsService {
  constructor(
    @InjectRepository(VeeamClientConfig) private readonly configRepo: Repository<VeeamClientConfig>,
    @InjectRepository(VeeamDailySnapshot) private readonly snapshotRepo: Repository<VeeamDailySnapshot>,
    private readonly veeamService: VeeamService,
    private readonly integrationConfigSvc: IntegrationConfigService,
  ) {}

  private toResponseDto(c: VeeamClientConfig): VeeamClientConfigResponseDto {
    return {
      id: c.id,
      clientId: c.clientId,
      clientName: c.clientName,
      host: c.host,
      port: c.port,
      isEnabled: c.isEnabled,
      lastConnectedAt: c.lastConnectedAt?.toISOString() ?? null,
    };
  }

  private deriveClientStatus(jobs: BackupJobStatus[]): ClientStatus {
    if (!jobs.length) return 'no_data';
    if (jobs.some(j => j.lastResult === 'Failed')) return 'crit';
    if (jobs.some(j => j.lastResult === 'Warning')) return 'warn';
    return 'ok';
  }

  async getClientStatus(clientId: string): Promise<ClientBackupStatusDto> {
    const config = await this.configRepo.findOne({ where: { clientId } });
    if (!config) throw new NotFoundException('Config not found');
    const { username, password } = await this.integrationConfigSvc.getVeeamConfigDecrypted();
    const jobs = await this.veeamService.getJobStatuses(config.host, config.port, username, password);
    const status = this.deriveClientStatus(jobs);
    void this.saveSnapshot(clientId, jobs);
    return {
      clientId: config.clientId,
      clientName: config.clientName,
      status,
      totalJobs: jobs.length,
      okCount: jobs.filter(j => j.lastResult === 'Success').length,
      warnCount: jobs.filter(j => j.lastResult === 'Warning').length,
      critCount: jobs.filter(j => j.lastResult === 'Failed').length,
      hasRunningJob: jobs.some(j => j.isRunning),
      lastReadAt: new Date().toISOString(),
      jobs,
    };
  }

  private snapshotToDto(config: VeeamClientConfig, snaps: VeeamDailySnapshot[]): ClientBackupStatusDto {
    const now = Date.now();
    const jobs: BackupJobStatusDto[] = snaps.map(s => {
      const hoursAgo = s.lastRunAt
        ? Math.round(((now - s.lastRunAt.getTime()) / 3600000) * 10) / 10
        : s.hoursAgo;
      return {
        jobId: s.jobId,
        jobName: s.jobName,
        jobType: s.jobType,
        isRunning: false,
        lastResult: s.result as JobResult | null,
        lastMessage: s.message,
        lastRunAt: s.lastRunAt?.toISOString() ?? null,
        hoursAgo,
        isStale: hoursAgo !== null && hoursAgo > 30,
      };
    });
    const status = this.deriveClientStatus(jobs);
    return {
      clientId: config.clientId,
      clientName: config.clientName,
      status,
      totalJobs: jobs.length,
      okCount: jobs.filter(j => j.lastResult === 'Success').length,
      warnCount: jobs.filter(j => j.lastResult === 'Warning').length,
      critCount: jobs.filter(j => j.lastResult === 'Failed').length,
      hasRunningJob: false,
      lastReadAt: snaps[0].snapshotDate,
      jobs,
      isSnapshot: true,
    };
  }

  async getLastSnapshot(): Promise<ClientBackupStatusDto[]> {
    const configs = await this.configRepo.find();
    if (!configs.length) return [];
    return Promise.all(
      configs.map(async config => {
        if (!config.isEnabled) return this.disconnectedDto(config);
        const latest = await this.snapshotRepo.findOne({
          where: { clientId: config.clientId },
          order: { snapshotDate: 'DESC' },
        });
        if (!latest) return this.disconnectedDto(config);
        const snaps = await this.snapshotRepo.find({
          where: { clientId: config.clientId, snapshotDate: latest.snapshotDate },
        });
        return this.snapshotToDto(config, snaps);
      }),
    );
  }

  private disconnectedDto(config: VeeamClientConfig): ClientBackupStatusDto {
    return {
      clientId: config.clientId,
      clientName: config.clientName,
      status: 'disconnected',
      totalJobs: 0,
      okCount: 0,
      warnCount: 0,
      critCount: 0,
      hasRunningJob: false,
      lastReadAt: new Date().toISOString(),
      jobs: [],
    };
  }

  async getAllClientStatuses(): Promise<ClientBackupStatusDto[]> {
    const configs = await this.configRepo.find();
    return Promise.all(
      configs.map(async c => {
        if (!c.isEnabled) return this.disconnectedDto(c);
        try {
          return await this.getClientStatus(c.clientId);
        } catch {
          return this.disconnectedDto(c);
        }
      }),
    );
  }

  async saveSnapshot(clientId: string, jobs: BackupJobStatus[]): Promise<void> {
    const date = new Date().toISOString().split('T')[0];
    const rows = jobs.map(j => ({
      clientId,
      jobId: j.jobId,
      jobName: j.jobName,
      jobType: j.jobType,
      result: j.lastResult,
      message: j.lastMessage,
      lastRunAt: j.lastRunAt ? new Date(j.lastRunAt) : null,
      hoursAgo: j.hoursAgo,
      snapshotDate: date,
    }));
    await this.snapshotRepo.upsert(rows, ['clientId', 'jobId', 'snapshotDate']);
  }

  async listConfigs(): Promise<VeeamClientConfigResponseDto[]> {
    const configs = await this.configRepo.find();
    return configs.map(c => this.toResponseDto(c));
  }

  async createConfig(dto: CreateVeeamConfigDto): Promise<VeeamClientConfigResponseDto> {
    const entity = this.configRepo.create({
      clientId: dto.clientId,
      clientName: dto.clientName,
      host: dto.host,
      port: dto.port,
      isEnabled: dto.isEnabled,
    });
    const saved = await this.configRepo.save(entity);
    return this.toResponseDto(saved);
  }

  async updateConfig(id: string, dto: UpdateVeeamConfigDto): Promise<VeeamClientConfigResponseDto> {
    const config = await this.configRepo.findOne({ where: { id } });
    if (!config) throw new NotFoundException();
    if (dto.clientName !== undefined) config.clientName = dto.clientName;
    if (dto.host !== undefined) config.host = dto.host;
    if (dto.port !== undefined) config.port = dto.port;
    if (dto.isEnabled !== undefined) config.isEnabled = dto.isEnabled;
    config.updatedAt = new Date();
    const saved = await this.configRepo.save(config);
    return this.toResponseDto(saved);
  }

  async deleteConfig(id: string): Promise<void> {
    await this.configRepo.delete(id);
  }

  async testConnection(id: string): Promise<TestConnectionResultDto> {
    const config = await this.configRepo.findOne({ where: { id } });
    if (!config) throw new NotFoundException();
    const { username, password } = await this.integrationConfigSvc.getVeeamConfigDecrypted();
    return this.veeamService.testConnection(config.host, config.port, username, password);
  }
}
```

- [ ] **Step 4: Actualizar BackupsModule**

Reemplazar el contenido completo de `backend/src/backups/backups.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackupsController } from './backups.controller';
import { BackupsService } from './backups.service';
import { BackupsCron } from './backups.cron';
import { VeeamClientConfig } from './entities/veeam-client-config.entity';
import { VeeamDailySnapshot } from './entities/veeam-daily-snapshot.entity';
import { VeeamModule } from '../integrations/veeam/veeam.module';
import { IntegrationConfigModule } from '../integration-config/integration-config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VeeamClientConfig, VeeamDailySnapshot]),
    VeeamModule,
    IntegrationConfigModule,
  ],
  controllers: [BackupsController],
  providers: [BackupsService, BackupsCron],
  exports: [BackupsService],
})
export class BackupsModule {}
```

- [ ] **Step 5: Ejecutar los tests**

```
cd backend && npx jest backups.service.spec --no-coverage 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 6: Eliminar los archivos del vault**

```
rm backend/src/backups/credential-vault.service.ts
rm backend/src/backups/credential-vault.service.spec.ts
rm backend/src/backups/credential-vault.controller.ts
rm backend/src/backups/credential-vault.controller.spec.ts
rm backend/src/backups/dto/credential-vault.dto.ts
rm backend/src/backups/entities/credential-vault-entry.entity.ts
```

- [ ] **Step 7: Ejecutar suite completa de backend**

```
cd backend && npx jest --no-coverage 2>&1 | tail -30
```

Expected: todos los tests pasan. Verificar que no hay ningún import roto de los archivos eliminados.

- [ ] **Step 8: Commit**

```
git add backend/src/backups/
git commit -m "refactor: BackupsService usa credencial global Veeam, elimina vault de credenciales"
```

---

### Task 6: Frontend — IntegrationConfigService: agregar Veeam

**Files:**
- Modify: `frontend/src/app/core/services/integration-config.service.ts`

**Interfaces:**
- Produces: `VeeamIntegrationConfigDto` interface, `getVeeam()`, `patchVeeam()`, `testVeeam()` — usados en Task 7

- [ ] **Step 1: Agregar la interfaz y los métodos Veeam**

En `integration-config.service.ts`, agregar después de `VmwareConfigDto`:

```typescript
export interface VeeamIntegrationConfigDto {
  username: string;
  password: string;
  updatedAt: Date | null;
  updatedBy: string | null;
}
```

Agregar al final de la clase:

```typescript
getVeeam(): Observable<VeeamIntegrationConfigDto>                                    { return this.http.get<VeeamIntegrationConfigDto>(`${this.base}/veeam`); }
patchVeeam(dto: Partial<VeeamIntegrationConfigDto>): Observable<VeeamIntegrationConfigDto> { return this.http.patch<VeeamIntegrationConfigDto>(`${this.base}/veeam`, dto); }
testVeeam(): Observable<TestConnectionResult>                                          { return this.http.post<TestConnectionResult>(`${this.base}/veeam/test`, {}); }
```

- [ ] **Step 2: Commit**

```
git add frontend/src/app/core/services/integration-config.service.ts
git commit -m "feat: métodos Veeam en IntegrationConfigService del frontend"
```

---

### Task 7: Frontend — IntegracionesComponent: agregar tarjeta Veeam

**Files:**
- Modify: `frontend/src/app/features/admin/integraciones/integraciones.component.ts`
- Modify: `frontend/src/app/features/admin/integraciones/integraciones.component.html`

**Interfaces:**
- Consumes: `VeeamIntegrationConfigDto`, `getVeeam()`, `patchVeeam()`, `testVeeam()` (Task 6)

- [ ] **Step 1: Agregar estado y métodos Veeam al componente**

En `integraciones.component.ts`:

Agregar a las importaciones del servicio `IntegrationConfigService`:
```typescript
import {
  IntegrationConfigService, OdooConfigDto, InfraDocConfigDto, VmwareConfigDto, VeeamIntegrationConfigDto,
} from '../../../core/services/integration-config.service';
```

Agregar las propiedades de Veeam junto a las de VMware:
```typescript
veeamForm: FormGroup;
showVeeamPassword = false;
veeam = initCard();
toggleVeeamPassword(): void { this.showVeeamPassword = !this.showVeeamPassword; }
```

En el constructor, agregar:
```typescript
this.veeamForm = this.fb.group({ username: [''], password: [MASK] });
```

En `ngOnInit()`, agregar:
```typescript
this.svc.getVeeam().subscribe({
  next: (d) => {
    this.veeamForm.patchValue(d);
    this.veeam.loading   = false;
    this.veeam.updatedAt = d.updatedAt;
    this.veeam.updatedBy = d.updatedBy;
  },
});
```

Agregar los métodos `buildVeeamPatchDto`, `saveVeeam` y `testVeeam` al final de la clase:

```typescript
buildVeeamPatchDto(): Partial<VeeamIntegrationConfigDto> {
  const v = this.veeamForm.value as { username: string; password: string };
  const dto: Partial<VeeamIntegrationConfigDto> = { username: v.username };
  if (v.password && v.password !== MASK) dto.password = v.password;
  return dto;
}

saveVeeam(): void {
  this.veeam.saving = true;
  this.svc.patchVeeam(this.buildVeeamPatchDto()).subscribe({
    next: (d) => {
      this.veeamForm.patchValue(d);
      this.veeam.saving    = false;
      this.veeam.updatedAt = d.updatedAt;
      this.veeam.updatedBy = d.updatedBy;
      this.snackBar.open('Configuración de Veeam guardada', '', { duration: 3000 });
    },
    error: (e: { error?: { message?: string } }) => {
      this.veeam.saving = false;
      this.snackBar.open(e?.error?.message ?? 'Error al guardar configuración de Veeam', '', { duration: 4000 });
    },
  });
}

testVeeam(): void {
  this.veeam.testing = true;
  this.svc.testVeeam().subscribe({
    next: (r) => {
      this.veeam.testing          = false;
      this.veeam.connectionStatus = r.ok ? 'ok' : 'error';
      this.veeam.connectionMessage = r.message;
      this.snackBar.open(r.message, '', { duration: r.ok ? 3000 : 5000 });
    },
    error: () => {
      this.veeam.testing          = false;
      this.veeam.connectionStatus = 'error';
      this.snackBar.open('Error al probar Veeam', '', { duration: 5000 });
    },
  });
}
```

- [ ] **Step 2: Agregar la tarjeta Veeam al template HTML**

Agregar después del bloque `<!-- VMWARE -->` en `integraciones.component.html`:

```html
<!-- VEEAM -->
<div class="integration-card">
  <div class="card-header">
    <div class="card-icon vmware">VB</div>
    <div class="card-title-group">
      <div class="card-title">Veeam Backup & Replication</div>
      <div class="card-desc">Credenciales globales para conectar con los servidores Veeam de clientes</div>
    </div>
    <div class="status-badge" [ngClass]="{ ok: veeam.connectionStatus === 'ok', err: veeam.connectionStatus === 'error', unk: veeam.connectionStatus === 'unknown' }">
      <span class="status-dot"></span>
      {{ veeam.connectionStatus === 'ok' ? 'Guardado' : veeam.connectionStatus === 'error' ? 'Error' : 'Sin probar' }}
    </div>
  </div>
  <div class="card-body" [formGroup]="veeamForm">
    <div class="field-row">
      <div class="field">
        <label class="field-label">Usuario <span class="req">*</span></label>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <input matInput formControlName="username" placeholder="ondra-veeam" />
        </mat-form-field>
        <span class="field-hint">Usuario administrador de Veeam B&R. Debe existir en todos los servidores monitoreados.</span>
      </div>
      <div class="field">
        <label class="field-label">Contraseña <span class="req">*</span></label>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <input matInput formControlName="password" [type]="showVeeamPassword ? 'text' : 'password'" />
          <button matSuffix mat-icon-button type="button" (mousedown)="$event.preventDefault()" (click)="toggleVeeamPassword()">
            <svg *ngIf="!showVeeamPassword" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            <svg *ngIf="showVeeamPassword"  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          </button>
        </mat-form-field>
        <span class="field-hint">Contraseña del usuario Veeam. Dejar vacío para no modificar.</span>
      </div>
    </div>
  </div>
  <div class="card-actions">
    <button mat-stroked-button [disabled]="veeam.testing || veeam.saving" (click)="testVeeam()">
      <mat-spinner *ngIf="veeam.testing" diameter="14"></mat-spinner>
      <span *ngIf="!veeam.testing">Probar conexión</span>
    </button>
    <button mat-flat-button color="primary" [disabled]="veeam.saving || veeam.testing" (click)="saveVeeam()">
      <mat-spinner *ngIf="veeam.saving" diameter="14"></mat-spinner>
      <span *ngIf="!veeam.saving">Guardar</span>
    </button>
    <span class="last-updated" *ngIf="veeam.updatedAt">{{ veeam.updatedAt | date:'dd/MM/yyyy HH:mm' }}{{ veeam.updatedBy ? ' · ' + veeam.updatedBy : '' }}</span>
  </div>
</div>
```

- [ ] **Step 3: Commit**

```
git add frontend/src/app/features/admin/integraciones/
git commit -m "feat: tarjeta Veeam en Integraciones con credencial global"
```

---

### Task 8: Frontend — Limpiar backups: dialog, modelos, tabla + eliminar vault

**Files:**
- Modify: `frontend/src/app/features/backups/models/backup.models.ts`
- Modify: `frontend/src/app/features/admin/backups-config/backups-config-dialog/backups-config-dialog.component.ts`
- Modify: `frontend/src/app/features/admin/backups-config/backups-config-dialog/backups-config-dialog.component.html`
- Modify: `frontend/src/app/features/admin/backups-config/backups-config-dialog/backups-config-dialog.component.spec.ts`
- Modify: `frontend/src/app/features/admin/backups-config/backups-config.component.ts`
- Modify: `frontend/src/app/features/admin/backups-config/backups-config.component.html`
- Modify: `frontend/src/app/features/admin/admin.module.ts`
- Delete: `frontend/src/app/features/admin/backups-config/credential-vault/credential-vault.component.ts`
- Delete: `frontend/src/app/features/admin/backups-config/credential-vault/credential-vault.component.html`
- Delete: `frontend/src/app/features/admin/backups-config/credential-vault/credential-vault.component.scss`
- Delete: `frontend/src/app/features/admin/backups-config/credential-vault/credential-vault.component.spec.ts`
- Delete: `frontend/src/app/features/admin/backups-config/credential-vault/credential-vault-dialog.component.ts`
- Delete: `frontend/src/app/features/admin/backups-config/credential-vault/credential-vault-dialog.component.html`
- Delete: `frontend/src/app/features/admin/backups-config/credential-vault/credential-vault-dialog.component.spec.ts` (si existe)
- Delete: `frontend/src/app/core/services/credential-vault.service.ts`
- Delete: `frontend/src/app/core/services/credential-vault.service.spec.ts`
- Delete: `frontend/src/app/core/models/credential-vault.models.ts`

**Interfaces:**
- Consumes: `VeeamClientConfig` sin campos de credencial (Task 4 y 5 aplicados)

- [ ] **Step 1: Actualizar los modelos de backup**

Reemplazar el contenido de `frontend/src/app/features/backups/models/backup.models.ts`:

```typescript
export type BackupJobResult = 'Success' | 'Warning' | 'Failed';
export type ClientBackupStatus = 'ok' | 'warn' | 'crit' | 'no_data' | 'disconnected';

export interface BackupJobStatus {
  jobId: string;
  jobName: string;
  jobType: string;
  isRunning: boolean;
  lastResult: BackupJobResult | null;
  lastMessage: string | null;
  lastRunAt: string | null;
  hoursAgo: number | null;
  isStale: boolean;
}

export interface ClientBackup {
  clientId: string;
  clientName: string;
  status: ClientBackupStatus;
  totalJobs: number;
  okCount: number;
  warnCount: number;
  critCount: number;
  hasRunningJob: boolean;
  lastReadAt: string;
  jobs: BackupJobStatus[];
  isSnapshot?: boolean;
}

export interface VeeamClientConfig {
  id: string;
  clientId: string;
  clientName: string;
  host: string;
  port: number;
  isEnabled: boolean;
  lastConnectedAt: string | null;
}

export interface CreateVeeamConfigRequest {
  clientId: string;
  clientName: string;
  host: string;
  port: number;
  isEnabled: boolean;
}

export interface UpdateVeeamConfigRequest {
  clientName?: string;
  host?: string;
  port?: number;
  isEnabled?: boolean;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  jobCount?: number;
}
```

- [ ] **Step 2: Reescribir el spec del dialog**

Reemplazar el contenido completo de `backups-config-dialog.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { BackupsConfigDialogComponent } from './backups-config-dialog.component';
import { BackupsService } from '../../../../features/backups/services/backups.service';
import { ClientsService } from '../../../../core/services/clients.service';
import { InfradocService } from '../../../../core/services/infradoc.service';

const mockClients = [
  { id: 'c1', name: 'ACME', isActive: true, primaryAddress: null, createdAt: '2024-01-01' },
  { id: 'c2', name: 'Otra Empresa', isActive: true, primaryAddress: null, createdAt: '2024-01-01' },
];

const mockEmptyInfra = {
  esxiHosts: [], windowsVMs: [], domainControllers: [], linuxVMs: [], nas: [], routers: [],
};

const mockSvc       = { createConfig: jest.fn(), updateConfig: jest.fn() };
const mockDialogRef = { close: jest.fn() };
const mockClientsSvc   = { getAll: jest.fn() };
const mockInfradocSvc  = { getClientInfrastructure: jest.fn() };

describe('BackupsConfigDialogComponent', () => {
  async function setup(data: any = null) {
    mockClientsSvc.getAll.mockReturnValue(of(mockClients));

    await TestBed.configureTestingModule({
      declarations: [BackupsConfigDialogComponent],
      imports: [
        NoopAnimationsModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatCheckboxModule,
        MatButtonModule,
        MatTooltipModule,
        MatProgressSpinnerModule,
        MatIconModule,
      ],
      providers: [
        { provide: BackupsService,  useValue: mockSvc },
        { provide: ClientsService,  useValue: mockClientsSvc },
        { provide: MatDialogRef,    useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: InfradocService, useValue: mockInfradocSvc },
      ],
    }).compileComponents();

    const fixture: ComponentFixture<BackupsConfigDialogComponent> = TestBed.createComponent(BackupsConfigDialogComponent);
    fixture.detectChanges();
    return { fixture, comp: fixture.componentInstance };
  }

  beforeEach(() => { jest.clearAllMocks(); });

  it('auto-popula el host con el hostname de uri1 (sin puerto) al seleccionar cliente', async () => {
    const { comp } = await setup(null);
    mockInfradocSvc.getClientInfrastructure.mockReturnValue(of({
      ...mockEmptyInfra,
      esxiHosts: [{ assetId: 1, name: 'hpGL360.covema.local', ip: null, bmcIp: null, bmcType: null, os: null, make: null, model: null, uri1: 'https://acme.ondravirtual.com.ar:344', uri2: null }],
    }));
    comp.onClientChange('c1');
    expect(comp.form.controls.host.value).toBe('acme.ondravirtual.com.ar');
  });

  it('usa uri2 si uri1 es null', async () => {
    const { comp } = await setup(null);
    mockInfradocSvc.getClientInfrastructure.mockReturnValue(of({
      ...mockEmptyInfra,
      esxiHosts: [{ assetId: 1, name: 'server.local', ip: null, bmcIp: null, bmcType: null, os: null, make: null, model: null, uri1: null, uri2: 'https://beta.ondravirtual.com.ar:344' }],
    }));
    comp.onClientChange('c1');
    expect(comp.form.controls.host.value).toBe('beta.ondravirtual.com.ar');
  });

  it('no modifica el host si esxiHosts está vacío', async () => {
    const { comp } = await setup(null);
    mockInfradocSvc.getClientInfrastructure.mockReturnValue(of(mockEmptyInfra));
    comp.form.controls.host.setValue('10.0.0.1');
    comp.onClientChange('c1');
    expect(comp.form.controls.host.value).toBe('10.0.0.1');
  });

  it('formulario válido con clientId, host y port completos', async () => {
    const { comp } = await setup(null);
    comp.form.patchValue({ clientId: 'c1', host: 'acme.ondravirtual.com.ar', port: 9419, isEnabled: true });
    expect(comp.isValid).toBe(true);
  });

  it('formulario inválido si falta el host', async () => {
    const { comp } = await setup(null);
    comp.form.patchValue({ clientId: 'c1', host: '', port: 9419, isEnabled: true });
    expect(comp.isValid).toBe(false);
  });

  it('crea config con clientId, host, port e isEnabled', async () => {
    const { comp } = await setup(null);
    mockSvc.createConfig.mockReturnValue(of({
      id: 'new', clientId: 'c1', clientName: 'ACME',
      host: 'acme.ondravirtual.com.ar', port: 9419,
      isEnabled: true, lastConnectedAt: null,
    }));
    comp.form.patchValue({ clientId: 'c1', host: 'acme.ondravirtual.com.ar', port: 9419, isEnabled: true });
    comp.save();
    expect(mockSvc.createConfig).toHaveBeenCalledWith(expect.objectContaining({
      clientId:  'c1',
      clientName: 'ACME',
      host:      'acme.ondravirtual.com.ar',
      port:      9419,
      isEnabled: true,
    }));
    expect(mockDialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ id: 'new' }));
  });

  it('edita config actualizando host', async () => {
    const existing = {
      id: 'abc', clientName: 'Empresa A', host: '192.168.1.1',
      port: 9419, isEnabled: true, clientId: 'c1', lastConnectedAt: null,
    };
    const { comp } = await setup(existing);
    mockSvc.updateConfig.mockReturnValue(of({ ...existing, host: '10.0.0.5' }));
    comp.form.patchValue({ host: '10.0.0.5' });
    comp.save();
    expect(mockSvc.updateConfig).toHaveBeenCalledWith('abc', expect.objectContaining({ host: '10.0.0.5' }));
  });

  it('onClientChange no llama a InfraDoc en modo edición', async () => {
    const existing = {
      id: 'abc', clientName: 'Empresa A', host: '192.168.1.1',
      port: 9419, isEnabled: true, clientId: 'c1', lastConnectedAt: null,
    };
    const { comp } = await setup(existing);
    comp.onClientChange('c1');
    expect(mockInfradocSvc.getClientInfrastructure).not.toHaveBeenCalled();
  });

  it('carga solo clientes activos en el selector', async () => {
    mockClientsSvc.getAll.mockReturnValue(of([
      ...mockClients,
      { id: 'c3', name: 'Inactivo', isActive: false, primaryAddress: null, createdAt: '2024-01-01' },
    ]));
    const { comp } = await setup(null);
    expect(comp.clients.length).toBe(2);
    expect(comp.clients.every(c => c.isActive)).toBe(true);
  });
});
```

- [ ] **Step 3: Ejecutar los tests del spec para verificar que fallan**

```
cd frontend && npx jest backups-config-dialog.component.spec --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `CredentialVaultService is not provided` o errores de tipos

- [ ] **Step 4: Reescribir BackupsConfigDialogComponent**

Reemplazar el contenido completo de `backups-config-dialog.component.ts`:

```typescript
import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { BackupsService } from '../../../../features/backups/services/backups.service';
import { ClientsService } from '../../../../core/services/clients.service';
import { InfradocService } from '../../../../core/services/infradoc.service';
import { Client } from '../../../../core/models/client.models';
import type { CreateVeeamConfigRequest, UpdateVeeamConfigRequest, VeeamClientConfig } from '../../../../features/backups/models/backup.models';

@Component({
  selector: 'app-backups-config-dialog',
  templateUrl: './backups-config-dialog.component.html',
})
export class BackupsConfigDialogComponent implements OnInit {
  saving      = false;
  loadingHost = false;
  isEdit      = false;
  clients: Client[] = [];

  form = new FormGroup({
    clientId:  new FormControl('',   [Validators.required]),
    host:      new FormControl('',   [Validators.required]),
    port:      new FormControl<number>(9419, [Validators.required, Validators.min(1), Validators.max(65535)]),
    isEnabled: new FormControl(true),
  });

  constructor(
    private readonly dialogRef:   MatDialogRef<BackupsConfigDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: VeeamClientConfig | null,
    private readonly svc:         BackupsService,
    private readonly clientsSvc:  ClientsService,
    private readonly infradocSvc: InfradocService,
  ) {}

  ngOnInit(): void {
    this.clientsSvc.getAll().subscribe(all => {
      this.clients = all.filter(c => c.isActive);
    });

    if (this.data) {
      this.isEdit = true;
      this.form.patchValue({
        clientId:  this.data.clientId,
        host:      this.data.host,
        port:      this.data.port,
        isEnabled: this.data.isEnabled,
      });
      this.form.controls.clientId.setValidators([]);
      this.form.controls.clientId.updateValueAndValidity();
      this.form.get('clientId')?.disable();
    }
  }

  onClientChange(clientId: string): void {
    if (this.isEdit) return;
    this.loadingHost = true;
    this.infradocSvc.getClientInfrastructure(clientId).subscribe({
      next: infra => {
        const esxi = infra.esxiHosts[0];
        if (esxi) {
          const uri = esxi.uri1 ?? esxi.uri2;
          if (uri) {
            const noProto = uri.replace(/^https?:\/\//, '');
            const colonIdx = noProto.lastIndexOf(':');
            const host = colonIdx >= 0 ? noProto.slice(0, colonIdx) : noProto;
            this.form.controls.host.setValue(host);
          }
        }
        this.loadingHost = false;
      },
      error: () => { this.loadingHost = false; },
    });
  }

  get isValid(): boolean {
    return this.form.valid;
  }

  save(): void {
    if (!this.isValid) return;
    this.saving = true;
    const v = this.form.value;

    if (this.isEdit && this.data) {
      const dto: UpdateVeeamConfigRequest = {
        host:      v.host      ?? undefined,
        port:      v.port      ?? 9419,
        isEnabled: v.isEnabled ?? true,
      };
      this.svc.updateConfig(this.data.id, dto).subscribe({
        next: updated => { this.saving = false; this.dialogRef.close(updated); },
        error: ()      => { this.saving = false; },
      });
    } else {
      const clientName = this.clients.find(c => c.id === v.clientId)?.name ?? '';
      const dto: CreateVeeamConfigRequest = {
        clientId:  v.clientId!,
        clientName,
        host:      v.host!,
        port:      v.port ?? 9419,
        isEnabled: v.isEnabled ?? true,
      };
      this.svc.createConfig(dto).subscribe({
        next: created => { this.saving = false; this.dialogRef.close(created); },
        error: ()      => { this.saving = false; },
      });
    }
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
```

- [ ] **Step 5: Actualizar el template del dialog**

Reemplazar el contenido completo de `backups-config-dialog.component.html`:

```html
<h2 mat-dialog-title>{{ isEdit ? 'Editar configuración Veeam' : 'Nueva configuración Veeam' }}</h2>

<mat-dialog-content [formGroup]="form">

  <mat-form-field appearance="outline" subscriptSizing="dynamic"
    [matTooltip]="isEdit ? 'No se puede cambiar el cliente de una configuración existente' : ''">
    <mat-label>Cliente</mat-label>
    <mat-select formControlName="clientId" (selectionChange)="onClientChange($event.value)">
      <mat-option *ngFor="let c of clients" [value]="c.id">{{ c.name }}</mat-option>
    </mat-select>
    <mat-error *ngIf="form.controls.clientId.invalid">Campo requerido</mat-error>
  </mat-form-field>

  <mat-form-field appearance="outline" subscriptSizing="dynamic" style="margin-top: 16px;">
    <mat-label>Host del servidor Veeam</mat-label>
    <input matInput formControlName="host" placeholder="cliente.ondravirtual.com.ar" />
    <span matSuffix *ngIf="loadingHost"><mat-spinner [diameter]="16"></mat-spinner></span>
    <mat-hint *ngIf="!loadingHost && !isEdit">Se auto-completa con el DNS del cliente desde InfraDoc</mat-hint>
    <mat-error *ngIf="form.controls.host.invalid">Campo requerido</mat-error>
  </mat-form-field>

  <mat-form-field appearance="outline" subscriptSizing="dynamic" style="margin-top: 16px;">
    <mat-label>Puerto</mat-label>
    <input matInput type="number" formControlName="port" min="1" max="65535" />
    <mat-error *ngIf="form.controls.port.invalid">Puerto inválido (1–65535)</mat-error>
  </mat-form-field>

  <div style="margin-top: 16px;">
    <mat-checkbox formControlName="isEnabled">Habilitado</mat-checkbox>
  </div>

</mat-dialog-content>

<mat-dialog-actions align="end">
  <button mat-stroked-button (click)="cancel()" [disabled]="saving">Cancelar</button>
  <button mat-flat-button color="primary" (click)="save()" [disabled]="!isValid || saving">
    {{ saving ? 'Guardando…' : 'Guardar' }}
  </button>
</mat-dialog-actions>
```

- [ ] **Step 6: Actualizar backups-config.component.ts — quitar username de displayedColumns**

En `backups-config.component.ts`, cambiar:
```typescript
readonly displayedColumns = ['clientName', 'host', 'port', 'username', 'isEnabled', 'actions'];
```
por:
```typescript
readonly displayedColumns = ['clientName', 'host', 'port', 'isEnabled', 'actions'];
```

- [ ] **Step 7: Actualizar backups-config.component.html — quitar columna username**

Eliminar el bloque completo de la columna `username` del template:
```html
<ng-container matColumnDef="username">
  <mat-header-cell *matHeaderCellDef>Usuario</mat-header-cell>
  <mat-cell *matCellDef="let row">{{ row.username }}</mat-cell>
</ng-container>
```

- [ ] **Step 8: Actualizar backups-config.component.html — quitar app-credential-vault**

Eliminar la línea:
```html
<app-credential-vault></app-credential-vault>
```

- [ ] **Step 9: Actualizar admin.module.ts — quitar declaraciones del vault**

Eliminar las líneas de importación:
```typescript
import { CredentialVaultComponent } from './backups-config/credential-vault/credential-vault.component';
import { CredentialVaultDialogComponent } from './backups-config/credential-vault/credential-vault-dialog.component';
```

Eliminar del array `declarations`:
```typescript
CredentialVaultComponent,
CredentialVaultDialogComponent,
```

- [ ] **Step 10: Ejecutar los tests del dialog**

```
cd frontend && npx jest backups-config-dialog.component.spec --no-coverage 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 11: Eliminar los archivos del vault (frontend)**

```
rm frontend/src/app/features/admin/backups-config/credential-vault/credential-vault.component.ts
rm frontend/src/app/features/admin/backups-config/credential-vault/credential-vault.component.html
rm frontend/src/app/features/admin/backups-config/credential-vault/credential-vault.component.scss
rm frontend/src/app/features/admin/backups-config/credential-vault/credential-vault.component.spec.ts
rm frontend/src/app/features/admin/backups-config/credential-vault/credential-vault-dialog.component.ts
rm frontend/src/app/features/admin/backups-config/credential-vault/credential-vault-dialog.component.html
rm frontend/src/app/core/services/credential-vault.service.ts
rm frontend/src/app/core/services/credential-vault.service.spec.ts
rm frontend/src/app/core/models/credential-vault.models.ts
```

(Verificar si existe `credential-vault-dialog.component.spec.ts` antes de borrar)

- [ ] **Step 12: Ejecutar suite completa de frontend**

```
cd frontend && npx jest --no-coverage 2>&1 | tail -30
```

Expected: todos los tests pasan, sin imports rotos.

- [ ] **Step 13: Commit**

```
git add frontend/src/
git commit -m "refactor: limpiar vault de credenciales del frontend, dialog Veeam simplificado"
```
