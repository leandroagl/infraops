# Backups: Vault de Credenciales + Host Auto-DNS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar el campo IP/host del formulario Veeam (auto-derivado de InfraDoc) y reemplazar el campo password por un selector de un vault interno cifrado.

**Architecture:** Nueva tabla `credential_vault_entries` con contraseñas cifradas AES-256-GCM (mismo patrón que `integration-config`). `veeam_client_configs` agrega FK nullable `credential_vault_entry_id` para backward compatibility. El diálogo de configuración auto-popula el host desde InfraDoc al seleccionar cliente (esxiHosts[0].name) y presenta un `<mat-select>` del vault en lugar del campo password.

**Tech Stack:** NestJS + TypeORM + PostgreSQL (backend), Angular + Angular Material (frontend), crypto.util existente (AES-256-GCM).

**Spec:** `docs/superpowers/plans/2026-10-07-backups-vault-y-host-autodns.md` (este archivo)

## Global Constraints

- Sin standalone components Angular
- `appearance="outline"` en todos los `mat-form-field`
- `mat-form-field` hereda altura 32px del global — no sobreescribir
- Sin `any` en TypeScript salvo casos excepcionales justificados
- TDD: test antes que implementación
- Un archivo a la vez confirmado antes de avanzar
- Idioma del código: inglés; commits y docs: español
- Encriptación: AES-256-GCM usando la función `encrypt`/`decrypt` de `backend/src/integration-config/crypto.util.ts`
- Clave de encriptación: `INTEGRATIONS_ENCRYPT_KEY` (64 chars hex) via ConfigService
- Migraciones: timestamps siguiendo la serie existente, siguiente disponible: 1790400000000

## Review Focus

- **Fallback cuando InfraDoc no devuelve hosts**: si `esxiHosts` está vacío, el campo host debe quedar editable y vacío (no bloquear el formulario).
- **Config existente con `encrypted_password` pero sin vault FK**: `resolvePassword` debe seguir usando el campo legacy sin lanzar error.
- **Crear config sin vault ni password directo**: el backend debe rechazar con error claro si no viene ni `credentialVaultId` ni `password`.
- **Vault entry eliminada referenciada por config Veeam**: el endpoint DELETE del vault debe verificar que no haya configs usando esa entrada antes de eliminarla (o retornar 409).
- **Editar config existente sin cambiar credencial**: enviar `PATCH` sin `credentialVaultId` ni `password` no debe borrar la credencial almacenada.

---

## Task 1: Backend — CredentialVaultEntry entity + migrations

**Files:**
- Create: `backend/src/backups/entities/credential-vault-entry.entity.ts`
- Create: `backend/src/migrations/1790400000000-CreateCredentialVaultEntries.ts`
- Create: `backend/src/migrations/1790500000000-AddCredentialVaultToVeeamConfigs.ts`

**Interfaces:**
- Produces: entidad `CredentialVaultEntry { id: string, name: string, encryptedPassword: string, createdAt: Date }` disponible para inyección en TaskN+1

- [ ] **Step 1: Crear la entidad**

```typescript
// backend/src/backups/entities/credential-vault-entry.entity.ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('credential_vault_entries')
export class CredentialVaultEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', name: 'encrypted_password' })
  encryptedPassword: string;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;
}
```

- [ ] **Step 2: Crear migration para la tabla vault**

```typescript
// backend/src/migrations/1790400000000-CreateCredentialVaultEntries.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCredentialVaultEntries1790400000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE credential_vault_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        encrypted_password VARCHAR NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE credential_vault_entries');
  }
}
```

- [ ] **Step 3: Crear migration para agregar FK a veeam_client_configs**

```typescript
// backend/src/migrations/1790500000000-AddCredentialVaultToVeeamConfigs.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCredentialVaultToVeeamConfigs1790500000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE veeam_client_configs
        ADD COLUMN credential_vault_entry_id UUID REFERENCES credential_vault_entries(id) ON DELETE SET NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE veeam_client_configs DROP COLUMN credential_vault_entry_id
    `);
  }
}
```

- [ ] **Step 4: Agregar la FK a la entidad VeeamClientConfig**

Archivo: `backend/src/backups/entities/veeam-client-config.entity.ts`

Agregar después del campo `encryptedPassword`:

```typescript
  @Column({ type: 'uuid', name: 'credential_vault_entry_id', nullable: true })
  credentialVaultEntryId: string | null;
```

- [ ] **Step 5: Registrar las migraciones en data-source**

Verificar que `backend/src/data-source.ts` (o el archivo de configuración de TypeORM) incluye las nuevas migraciones. Normalmente usan glob `migrations: ['src/migrations/*.ts']` — si es así, no se necesita cambio manual.

- [ ] **Step 6: Commit**

```
git add backend/src/backups/entities/credential-vault-entry.entity.ts
git add backend/src/backups/entities/veeam-client-config.entity.ts
git add backend/src/migrations/1790400000000-CreateCredentialVaultEntries.ts
git add backend/src/migrations/1790500000000-AddCredentialVaultToVeeamConfigs.ts
git commit -m "feat: entidad CredentialVaultEntry y migraciones para vault + FK en veeam_client_configs"
```

---

## Task 2: Backend — CredentialVaultService con tests

**Files:**
- Create: `backend/src/backups/credential-vault.service.ts`
- Create: `backend/src/backups/credential-vault.service.spec.ts`
- Create: `backend/src/backups/dto/credential-vault.dto.ts`

**Interfaces:**
- Consumes: `CredentialVaultEntry` entity, `encrypt`/`decrypt` de `crypto.util`, `ConfigService`
- Produces:
  - `CredentialVaultService.list(): Promise<CredentialVaultEntryResponseDto[]>` — devuelve entradas sin contraseña
  - `CredentialVaultService.create(dto: CreateCredentialVaultEntryDto): Promise<CredentialVaultEntryResponseDto>`
  - `CredentialVaultService.delete(id: string): Promise<void>` — lanza `ConflictException` si hay configs Veeam usando esa entrada
  - `CredentialVaultService.getDecryptedPassword(id: string): Promise<string>` — para uso interno de BackupsService

- [ ] **Step 1: Crear los DTOs**

```typescript
// backend/src/backups/dto/credential-vault.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCredentialVaultEntryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class CredentialVaultEntryResponseDto {
  id: string;
  name: string;
  createdAt: string;
}
```

- [ ] **Step 2: Escribir los tests (failing)**

```typescript
// backend/src/backups/credential-vault.service.spec.ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ConflictException } from '@nestjs/common';
import { CredentialVaultService } from './credential-vault.service';
import { CredentialVaultEntry } from './entities/credential-vault-entry.entity';
import { VeeamClientConfig } from './entities/veeam-client-config.entity';
import { encrypt, decrypt } from '../integration-config/crypto.util';

const TEST_KEY = 'a'.repeat(64);

const mockVaultRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
};
const mockVeeamConfigRepo = {
  findOne: jest.fn(),
};
const mockConfigService = { get: jest.fn().mockReturnValue(TEST_KEY) };

describe('CredentialVaultService', () => {
  let svc: CredentialVaultService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CredentialVaultService,
        { provide: getRepositoryToken(CredentialVaultEntry), useValue: mockVaultRepo },
        { provide: getRepositoryToken(VeeamClientConfig), useValue: mockVeeamConfigRepo },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    svc = module.get(CredentialVaultService);
    jest.clearAllMocks();
  });

  it('list devuelve entradas sin contraseña', async () => {
    const entry = { id: 'u1', name: 'Veeam ACME', encryptedPassword: 'enc', createdAt: new Date('2026-01-01') };
    mockVaultRepo.find.mockResolvedValue([entry]);
    const result = await svc.list();
    expect(result).toEqual([{ id: 'u1', name: 'Veeam ACME', createdAt: entry.createdAt.toISOString() }]);
    expect(result[0]).not.toHaveProperty('password');
    expect(result[0]).not.toHaveProperty('encryptedPassword');
  });

  it('create cifra la contraseña y devuelve sin contraseña', async () => {
    const saved = { id: 'u2', name: 'Test', encryptedPassword: 'enc', createdAt: new Date() };
    mockVaultRepo.create.mockImplementation((d: any) => ({ ...d }));
    mockVaultRepo.save.mockResolvedValue(saved);
    const result = await svc.create({ name: 'Test', password: 'plain123' });
    const saveArg = mockVaultRepo.save.mock.calls[0][0];
    expect(saveArg.encryptedPassword).not.toBe('plain123');
    expect(decrypt(saveArg.encryptedPassword, TEST_KEY)).toBe('plain123');
    expect(result.id).toBe('u2');
    expect(result).not.toHaveProperty('encryptedPassword');
  });

  it('delete lanza ConflictException si hay configs Veeam usando la entrada', async () => {
    mockVeeamConfigRepo.findOne.mockResolvedValue({ id: 'cfg1', credentialVaultEntryId: 'u1' });
    await expect(svc.delete('u1')).rejects.toThrow(ConflictException);
    expect(mockVaultRepo.delete).not.toHaveBeenCalled();
  });

  it('delete procede si no hay configs usando la entrada', async () => {
    mockVeeamConfigRepo.findOne.mockResolvedValue(null);
    await svc.delete('u1');
    expect(mockVaultRepo.delete).toHaveBeenCalledWith('u1');
  });

  it('getDecryptedPassword descifra y devuelve la contraseña', async () => {
    const plain = 'secretpass';
    const enc = encrypt(plain, TEST_KEY);
    mockVaultRepo.findOne.mockResolvedValue({ id: 'u1', encryptedPassword: enc });
    const result = await svc.getDecryptedPassword('u1');
    expect(result).toBe(plain);
  });

  it('getDecryptedPassword lanza NotFoundException si la entrada no existe', async () => {
    const { NotFoundException } = await import('@nestjs/common');
    mockVaultRepo.findOne.mockResolvedValue(null);
    await expect(svc.getDecryptedPassword('no-existe')).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 3: Ejecutar tests — deben fallar**

```
cd backend && npx jest credential-vault.service.spec --no-coverage
```
Expected: FAIL (CredentialVaultService not found)

- [ ] **Step 4: Implementar el servicio**

```typescript
// backend/src/backups/credential-vault.service.ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { CredentialVaultEntry } from './entities/credential-vault-entry.entity';
import { VeeamClientConfig } from './entities/veeam-client-config.entity';
import { encrypt, decrypt } from '../integration-config/crypto.util';
import type { CreateCredentialVaultEntryDto, CredentialVaultEntryResponseDto } from './dto/credential-vault.dto';

@Injectable()
export class CredentialVaultService {
  constructor(
    @InjectRepository(CredentialVaultEntry) private readonly vaultRepo: Repository<CredentialVaultEntry>,
    @InjectRepository(VeeamClientConfig) private readonly veeamConfigRepo: Repository<VeeamClientConfig>,
    private readonly configService: ConfigService,
  ) {}

  private get encryptKey(): string {
    return this.configService.get<string>('INTEGRATIONS_ENCRYPT_KEY', '');
  }

  private toDto(entry: CredentialVaultEntry): CredentialVaultEntryResponseDto {
    return { id: entry.id, name: entry.name, createdAt: entry.createdAt.toISOString() };
  }

  async list(): Promise<CredentialVaultEntryResponseDto[]> {
    const entries = await this.vaultRepo.find({ order: { name: 'ASC' } });
    return entries.map(e => this.toDto(e));
  }

  async create(dto: CreateCredentialVaultEntryDto): Promise<CredentialVaultEntryResponseDto> {
    const entity = this.vaultRepo.create({
      name: dto.name,
      encryptedPassword: encrypt(dto.password, this.encryptKey),
    });
    const saved = await this.vaultRepo.save(entity);
    return this.toDto(saved);
  }

  async delete(id: string): Promise<void> {
    const inUse = await this.veeamConfigRepo.findOne({ where: { credentialVaultEntryId: id } });
    if (inUse) {
      throw new ConflictException('Esta credencial está en uso por una o más configuraciones Veeam');
    }
    await this.vaultRepo.delete(id);
  }

  async getDecryptedPassword(id: string): Promise<string> {
    const entry = await this.vaultRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Credencial no encontrada');
    return decrypt(entry.encryptedPassword, this.encryptKey);
  }
}
```

- [ ] **Step 5: Ejecutar tests — deben pasar**

```
cd backend && npx jest credential-vault.service.spec --no-coverage
```
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```
git add backend/src/backups/credential-vault.service.ts
git add backend/src/backups/credential-vault.service.spec.ts
git add backend/src/backups/dto/credential-vault.dto.ts
git commit -m "feat: CredentialVaultService con cifrado AES y protección de delete"
```

---

## Task 3: Backend — CredentialVaultController + registro en BackupsModule

**Files:**
- Create: `backend/src/backups/credential-vault.controller.ts`
- Create: `backend/src/backups/credential-vault.controller.spec.ts`
- Modify: `backend/src/backups/backups.module.ts`

**Interfaces:**
- Consumes: `CredentialVaultService.list()`, `.create()`, `.delete()`
- Produces: rutas `GET/POST/DELETE /credential-vault` (ADMIN only)

- [ ] **Step 1: Escribir tests del controller**

```typescript
// backend/src/backups/credential-vault.controller.spec.ts
import { Test } from '@nestjs/testing';
import { CredentialVaultController } from './credential-vault.controller';
import { CredentialVaultService } from './credential-vault.service';

const mockSvc = { list: jest.fn(), create: jest.fn(), delete: jest.fn() };

describe('CredentialVaultController', () => {
  let ctrl: CredentialVaultController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [CredentialVaultController],
      providers: [{ provide: CredentialVaultService, useValue: mockSvc }],
    }).compile();
    ctrl = module.get(CredentialVaultController);
    jest.clearAllMocks();
  });

  it('GET /credential-vault → llama list', async () => {
    mockSvc.list.mockResolvedValue([]);
    const result = await ctrl.list();
    expect(mockSvc.list).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('POST /credential-vault → llama create con dto', async () => {
    const dto = { name: 'Test', password: 'pass' };
    mockSvc.create.mockResolvedValue({ id: 'u1', name: 'Test', createdAt: '2026-01-01' });
    const result = await ctrl.create(dto as any);
    expect(mockSvc.create).toHaveBeenCalledWith(dto);
    expect(result.id).toBe('u1');
  });

  it('DELETE /credential-vault/:id → llama delete', async () => {
    mockSvc.delete.mockResolvedValue(undefined);
    await ctrl.delete('u1');
    expect(mockSvc.delete).toHaveBeenCalledWith('u1');
  });
});
```

- [ ] **Step 2: Ejecutar tests — deben fallar**

```
cd backend && npx jest credential-vault.controller.spec --no-coverage
```
Expected: FAIL

- [ ] **Step 3: Implementar el controller**

```typescript
// backend/src/backups/credential-vault.controller.ts
import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user-role.enum';
import { CredentialVaultService } from './credential-vault.service';
import { CreateCredentialVaultEntryDto } from './dto/credential-vault.dto';

@Controller('credential-vault')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class CredentialVaultController {
  constructor(private readonly svc: CredentialVaultService) {}

  @Get()
  list() {
    return this.svc.list();
  }

  @Post()
  create(@Body() dto: CreateCredentialVaultEntryDto) {
    return this.svc.create(dto);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Param('id') id: string) {
    return this.svc.delete(id);
  }
}
```

- [ ] **Step 4: Registrar en BackupsModule**

Archivo: `backend/src/backups/backups.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackupsController } from './backups.controller';
import { BackupsService } from './backups.service';
import { BackupsCron } from './backups.cron';
import { VeeamClientConfig } from './entities/veeam-client-config.entity';
import { VeeamDailySnapshot } from './entities/veeam-daily-snapshot.entity';
import { CredentialVaultEntry } from './entities/credential-vault-entry.entity';
import { CredentialVaultService } from './credential-vault.service';
import { CredentialVaultController } from './credential-vault.controller';
import { VeeamModule } from '../integrations/veeam/veeam.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VeeamClientConfig, VeeamDailySnapshot, CredentialVaultEntry]),
    VeeamModule,
  ],
  controllers: [BackupsController, CredentialVaultController],
  providers: [BackupsService, BackupsCron, CredentialVaultService],
  exports: [BackupsService],
})
export class BackupsModule {}
```

- [ ] **Step 5: Ejecutar tests del controller**

```
cd backend && npx jest credential-vault.controller.spec --no-coverage
```
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```
git add backend/src/backups/credential-vault.controller.ts
git add backend/src/backups/credential-vault.controller.spec.ts
git add backend/src/backups/backups.module.ts
git commit -m "feat: CredentialVaultController y registro en BackupsModule"
```

---

## Task 4: Backend — Modificar BackupsService para soportar vault

**Files:**
- Modify: `backend/src/backups/dto/veeam-config.dto.ts`
- Modify: `backend/src/backups/backups.service.ts`
- Modify: `backend/src/backups/backups.service.spec.ts`

**Interfaces:**
- Consumes: `CredentialVaultService.getDecryptedPassword(id)`
- Produces:
  - `CreateVeeamConfigDto`: agrega campo `credentialVaultId?: string`, hace `password` opcional
  - `BackupsService.createConfig`: acepta vault ID o password directo
  - `BackupsService.resolvePassword(config)`: private, resuelve vault → encryptedPassword

- [ ] **Step 1: Actualizar los DTOs**

Archivo: `backend/src/backups/dto/veeam-config.dto.ts`

Cambios a `CreateVeeamConfigDto`:
- `password` pasa a `@IsOptional()`
- Agregar `credentialVaultId: string` con `@IsOptional() @IsUUID()`

Cambios a `UpdateVeeamConfigDto`:
- Agregar `credentialVaultId?: string` con `@IsOptional() @IsUUID()`

```typescript
// Sección relevante del archivo actualizado:
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

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  password?: string;

  @IsUUID()
  @IsOptional()
  credentialVaultId?: string;

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

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  username?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  password?: string;

  @IsUUID()
  @IsOptional()
  credentialVaultId?: string;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}
```

- [ ] **Step 2: Agregar tests en backups.service.spec.ts**

Agregar estos casos al describe existente:

```typescript
  it('createConfig con credentialVaultId guarda la FK y no llama encrypt', async () => {
    mockConfigRepo.create.mockImplementation((d: any) => ({ ...d }));
    mockConfigRepo.save.mockResolvedValue({
      id: 'uuid', clientId: 'c1', clientName: 'Client 1',
      host: 'h', port: 9419, username: 'u',
      encryptedPassword: '', credentialVaultEntryId: 'vault-id',
      isEnabled: true, lastConnectedAt: null, createdAt: new Date(), updatedAt: new Date(),
    });
    await svc.createConfig({
      clientId: 'c1', clientName: 'Client 1', host: 'h',
      port: 9419, username: 'u', credentialVaultId: 'vault-id', isEnabled: true,
    });
    const saveArg = mockConfigRepo.save.mock.calls[0][0];
    expect(saveArg.credentialVaultEntryId).toBe('vault-id');
    expect(saveArg.encryptedPassword).toBe('');
  });

  it('createConfig sin password ni credentialVaultId lanza BadRequestException', async () => {
    const { BadRequestException } = await import('@nestjs/common');
    await expect(
      svc.createConfig({ clientId: 'c1', clientName: 'C', host: 'h', port: 9419, username: 'u', isEnabled: true }),
    ).rejects.toThrow(BadRequestException);
  });

  it('updateConfig con credentialVaultId actualiza la FK', async () => {
    const existing = {
      id: 'cfg1', clientId: 'c1', clientName: 'C', host: 'h', port: 9419,
      username: 'u', encryptedPassword: 'enc', credentialVaultEntryId: null,
      isEnabled: true, lastConnectedAt: null, updatedAt: new Date(),
    };
    mockConfigRepo.findOne.mockResolvedValue({ ...existing });
    mockConfigRepo.save.mockImplementation((d: any) => Promise.resolve({ ...d, lastConnectedAt: null }));
    await svc.updateConfig('cfg1', { credentialVaultId: 'new-vault-id' });
    const saveArg = mockConfigRepo.save.mock.calls[0][0];
    expect(saveArg.credentialVaultEntryId).toBe('new-vault-id');
  });
```

Nota: para los tests de `getClientStatus` y `testConnection` que llaman `resolvePassword`, el mock del vault service debe inyectarse. Ver paso siguiente.

- [ ] **Step 3: Agregar inyección de CredentialVaultService al test module**

En el `beforeEach` existente de `backups.service.spec.ts`, agregar:

```typescript
const mockVaultSvc = { getDecryptedPassword: jest.fn() };

// En providers del Test.createTestingModule:
{ provide: CredentialVaultService, useValue: mockVaultSvc },
```

Y agregar el import:
```typescript
import { CredentialVaultService } from './credential-vault.service';
```

- [ ] **Step 4: Ejecutar tests — los nuevos deben fallar**

```
cd backend && npx jest backups.service.spec --no-coverage
```
Expected: FAIL en los 3 nuevos tests

- [ ] **Step 5: Modificar BackupsService**

Cambios en `backend/src/backups/backups.service.ts`:

1. Agregar inyección de `CredentialVaultService`:

```typescript
constructor(
  @InjectRepository(VeeamClientConfig) private readonly configRepo: Repository<VeeamClientConfig>,
  @InjectRepository(VeeamDailySnapshot) private readonly snapshotRepo: Repository<VeeamDailySnapshot>,
  private readonly veeamService: VeeamService,
  private readonly configService: ConfigService,
  private readonly vaultService: CredentialVaultService,
) {}
```

2. Agregar método privado `resolvePassword`:

```typescript
private async resolvePassword(config: VeeamClientConfig): Promise<string> {
  if (config.credentialVaultEntryId) {
    return this.vaultService.getDecryptedPassword(config.credentialVaultEntryId);
  }
  return decrypt(config.encryptedPassword, this.encryptKey);
}
```

3. Modificar `getClientStatus` y `testConnection` para usar `resolvePassword`:

```typescript
// En getClientStatus:
const password = await this.resolvePassword(config);

// En testConnection:
const password = await this.resolvePassword(config);
```

4. Modificar `createConfig`:

```typescript
async createConfig(dto: CreateVeeamConfigDto): Promise<VeeamClientConfigResponseDto> {
  if (!dto.credentialVaultId && !dto.password) {
    throw new BadRequestException('Se requiere credentialVaultId o password');
  }
  const data: Partial<VeeamClientConfig> = {
    clientId: dto.clientId,
    clientName: dto.clientName,
    host: dto.host,
    port: dto.port,
    username: dto.username,
    isEnabled: dto.isEnabled,
    encryptedPassword: '',
    credentialVaultEntryId: null,
  };
  if (dto.credentialVaultId) {
    data.credentialVaultEntryId = dto.credentialVaultId;
  } else if (dto.password) {
    data.encryptedPassword = encrypt(dto.password, this.encryptKey);
  }
  const entity = this.configRepo.create(data);
  const saved = await this.configRepo.save(entity);
  return this.toResponseDto(saved);
}
```

5. Modificar `updateConfig`:

```typescript
if (dto.credentialVaultId !== undefined) config.credentialVaultEntryId = dto.credentialVaultId;
if (dto.password !== undefined) {
  config.encryptedPassword = encrypt(dto.password, this.encryptKey);
  config.credentialVaultEntryId = null; // password directo limpia el vault FK
}
```

6. Agregar `import { BadRequestException }` al import de `@nestjs/common`.

7. Extraer método privado `toResponseDto`:

```typescript
private toResponseDto(c: VeeamClientConfig): VeeamClientConfigResponseDto {
  return {
    id: c.id, clientId: c.clientId, clientName: c.clientName,
    host: c.host, port: c.port, username: c.username,
    isEnabled: c.isEnabled, lastConnectedAt: c.lastConnectedAt?.toISOString() ?? null,
  };
}
```

- [ ] **Step 6: Ejecutar todos los tests del módulo backups**

```
cd backend && npx jest backups --no-coverage
```
Expected: PASS todos

- [ ] **Step 7: Commit**

```
git add backend/src/backups/dto/veeam-config.dto.ts
git add backend/src/backups/backups.service.ts
git add backend/src/backups/backups.service.spec.ts
git commit -m "feat: BackupsService acepta credentialVaultId, resolvePassword soporta vault y legacy"
```

---

## Task 5: Frontend — Modelos + CredentialVaultService

**Files:**
- Modify: `frontend/src/app/features/backups/models/backup.models.ts`
- Create: `frontend/src/app/core/models/credential-vault.models.ts`
- Create: `frontend/src/app/core/services/credential-vault.service.ts`
- Create: `frontend/src/app/core/services/credential-vault.service.spec.ts`

**Interfaces:**
- Produces:
  - `CredentialVaultEntry { id: string, name: string, createdAt: string }`
  - `CredentialVaultService.list(): Observable<CredentialVaultEntry[]>`
  - `CredentialVaultService.create(name, password): Observable<CredentialVaultEntry>`
  - `CredentialVaultService.delete(id): Observable<void>`
  - `CreateVeeamConfigRequest`: reemplaza `password: string` por `credentialVaultId?: string; password?: string`
  - `UpdateVeeamConfigRequest`: agrega `credentialVaultId?: string`

- [ ] **Step 1: Crear el modelo de vault**

```typescript
// frontend/src/app/core/models/credential-vault.models.ts
export interface CredentialVaultEntry {
  id: string;
  name: string;
  createdAt: string;
}

export interface CreateCredentialVaultEntryRequest {
  name: string;
  password: string;
}
```

- [ ] **Step 2: Actualizar backup.models.ts**

En `CreateVeeamConfigRequest`, reemplazar `password: string` por:
```typescript
  password?: string;
  credentialVaultId?: string;
```

En `UpdateVeeamConfigRequest`, agregar:
```typescript
  credentialVaultId?: string;
```

- [ ] **Step 3: Escribir tests del servicio**

```typescript
// frontend/src/app/core/services/credential-vault.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { CredentialVaultService } from './credential-vault.service';

describe('CredentialVaultService', () => {
  let svc: CredentialVaultService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [CredentialVaultService],
    });
    svc = TestBed.inject(CredentialVaultService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list llama GET /api/credential-vault', () => {
    svc.list().subscribe();
    const req = http.expectOne('/api/credential-vault');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('create llama POST /api/credential-vault con name y password', () => {
    svc.create('Veeam ACME', 'pass123').subscribe();
    const req = http.expectOne('/api/credential-vault');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Veeam ACME', password: 'pass123' });
    req.flush({ id: 'u1', name: 'Veeam ACME', createdAt: '2026-01-01' });
  });

  it('delete llama DELETE /api/credential-vault/:id', () => {
    svc.delete('u1').subscribe();
    const req = http.expectOne('/api/credential-vault/u1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
```

- [ ] **Step 4: Ejecutar tests — deben fallar**

```
cd frontend && npx jest credential-vault.service.spec --no-coverage
```
Expected: FAIL

- [ ] **Step 5: Implementar el servicio**

```typescript
// frontend/src/app/core/services/credential-vault.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { CredentialVaultEntry, CreateCredentialVaultEntryRequest } from '../models/credential-vault.models';

@Injectable({ providedIn: 'root' })
export class CredentialVaultService {
  private readonly base = '/api/credential-vault';

  constructor(private readonly http: HttpClient) {}

  list(): Observable<CredentialVaultEntry[]> {
    return this.http.get<CredentialVaultEntry[]>(this.base);
  }

  create(name: string, password: string): Observable<CredentialVaultEntry> {
    const dto: CreateCredentialVaultEntryRequest = { name, password };
    return this.http.post<CredentialVaultEntry>(this.base, dto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
```

- [ ] **Step 6: Ejecutar tests — deben pasar**

```
cd frontend && npx jest credential-vault.service.spec --no-coverage
```
Expected: PASS (3 tests)

- [ ] **Step 7: Commit**

```
git add frontend/src/app/core/models/credential-vault.models.ts
git add frontend/src/app/core/services/credential-vault.service.ts
git add frontend/src/app/core/services/credential-vault.service.spec.ts
git add frontend/src/app/features/backups/models/backup.models.ts
git commit -m "feat: CredentialVaultService frontend y modelos actualizados"
```

---

## Task 6: Frontend — CredentialVaultComponent (sección en Admin Backups)

**Files:**
- Create: `frontend/src/app/features/admin/backups-config/credential-vault/credential-vault.component.ts`
- Create: `frontend/src/app/features/admin/backups-config/credential-vault/credential-vault.component.html`
- Create: `frontend/src/app/features/admin/backups-config/credential-vault/credential-vault.component.spec.ts`
- Modify: `frontend/src/app/features/admin/backups-config/backups-config.component.html` (agregar sección vault arriba de la tabla)
- Modify: `frontend/src/app/features/admin/admin.module.ts` (declarar nuevo componente)

**Interfaces:**
- Consumes: `CredentialVaultService.list()`, `.create()`, `.delete()`
- Produces: componente `<app-credential-vault>` que lista entradas y permite agregar/eliminar

- [ ] **Step 1: Escribir tests**

```typescript
// frontend/src/app/features/admin/backups-config/credential-vault/credential-vault.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { CredentialVaultComponent } from './credential-vault.component';
import { CredentialVaultService } from '../../../../core/services/credential-vault.service';

const mockEntries = [
  { id: 'u1', name: 'Veeam ACME', createdAt: '2026-01-01' },
  { id: 'u2', name: 'Veeam Beta', createdAt: '2026-02-01' },
];
const mockSvc = { list: jest.fn(), create: jest.fn(), delete: jest.fn() };

describe('CredentialVaultComponent', () => {
  let fixture: ComponentFixture<CredentialVaultComponent>;
  let comp: CredentialVaultComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CredentialVaultComponent],
      imports: [
        NoopAnimationsModule, ReactiveFormsModule,
        MatTableModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule,
      ],
      providers: [{ provide: CredentialVaultService, useValue: mockSvc }],
    }).compileComponents();
    mockSvc.list.mockReturnValue(of(mockEntries));
    fixture = TestBed.createComponent(CredentialVaultComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => jest.clearAllMocks());

  it('carga entradas del vault al init', () => {
    expect(mockSvc.list).toHaveBeenCalled();
    expect(comp.entries.length).toBe(2);
  });

  it('agregar entrada llama create y recarga', () => {
    mockSvc.create.mockReturnValue(of({ id: 'u3', name: 'Nueva', createdAt: '2026-03-01' }));
    mockSvc.list.mockReturnValue(of([...mockEntries, { id: 'u3', name: 'Nueva', createdAt: '2026-03-01' }]));
    comp.nameCtrl.setValue('Nueva');
    comp.passwordCtrl.setValue('pass123');
    comp.add();
    expect(mockSvc.create).toHaveBeenCalledWith('Nueva', 'pass123');
    expect(comp.entries.length).toBe(3);
  });

  it('add no llama create si el form es inválido', () => {
    comp.nameCtrl.setValue('');
    comp.passwordCtrl.setValue('');
    comp.add();
    expect(mockSvc.create).not.toHaveBeenCalled();
  });

  it('delete llama delete y elimina del array local', () => {
    mockSvc.delete.mockReturnValue(of(undefined));
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    comp.delete('u1');
    expect(mockSvc.delete).toHaveBeenCalledWith('u1');
    expect(comp.entries.find(e => e.id === 'u1')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Ejecutar tests — deben fallar**

```
cd frontend && npx jest credential-vault.component.spec --no-coverage
```
Expected: FAIL

- [ ] **Step 3: Implementar el componente TypeScript**

```typescript
// frontend/src/app/features/admin/backups-config/credential-vault/credential-vault.component.ts
import { Component, OnInit } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { CredentialVaultService } from '../../../../core/services/credential-vault.service';
import type { CredentialVaultEntry } from '../../../../core/models/credential-vault.models';

@Component({
  selector: 'app-credential-vault',
  templateUrl: './credential-vault.component.html',
})
export class CredentialVaultComponent implements OnInit {
  entries: CredentialVaultEntry[] = [];
  adding = false;
  nameCtrl  = new FormControl('', [Validators.required]);
  passwordCtrl = new FormControl('', [Validators.required]);
  readonly displayedColumns = ['name', 'createdAt', 'actions'];

  constructor(private readonly svc: CredentialVaultService) {}

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.svc.list().subscribe(entries => { this.entries = entries; });
  }

  add(): void {
    if (!this.nameCtrl.valid || !this.passwordCtrl.valid) return;
    this.adding = true;
    this.svc.create(this.nameCtrl.value!, this.passwordCtrl.value!).subscribe({
      next: () => {
        this.nameCtrl.reset();
        this.passwordCtrl.reset();
        this.adding = false;
        this.load();
      },
      error: () => { this.adding = false; },
    });
  }

  delete(id: string): void {
    if (!confirm('¿Eliminar esta credencial del vault?')) return;
    this.svc.delete(id).subscribe({
      next: () => { this.entries = this.entries.filter(e => e.id !== id); },
    });
  }
}
```

- [ ] **Step 4: Implementar el template HTML**

```html
<!-- frontend/src/app/features/admin/backups-config/credential-vault/credential-vault.component.html -->
<div class="vault-section">
  <div class="vault-header">
    <h3 class="vault-title">Credenciales guardadas</h3>
    <p class="vault-subtitle">Contraseñas cifradas reutilizables para configs Veeam</p>
  </div>

  <mat-table [dataSource]="entries" class="vault-table">

    <ng-container matColumnDef="name">
      <mat-header-cell *matHeaderCellDef>Nombre</mat-header-cell>
      <mat-cell *matCellDef="let row">{{ row.name }}</mat-cell>
    </ng-container>

    <ng-container matColumnDef="createdAt">
      <mat-header-cell *matHeaderCellDef>Creada</mat-header-cell>
      <mat-cell *matCellDef="let row">{{ row.createdAt | date:'dd/MM/yyyy' }}</mat-cell>
    </ng-container>

    <ng-container matColumnDef="actions">
      <mat-header-cell *matHeaderCellDef></mat-header-cell>
      <mat-cell *matCellDef="let row">
        <button mat-icon-button color="warn" (click)="delete(row.id)" matTooltip="Eliminar">
          <mat-icon>delete</mat-icon>
        </button>
      </mat-cell>
    </ng-container>

    <mat-header-row *matHeaderRowDef="displayedColumns"></mat-header-row>
    <mat-row *matRowDef="let row; columns: displayedColumns;"></mat-row>

  </mat-table>

  <div *ngIf="entries.length === 0" class="vault-empty">
    No hay credenciales guardadas.
  </div>

  <div class="vault-add-form">
    <mat-form-field appearance="outline" subscriptSizing="dynamic">
      <mat-label>Nombre de la credencial</mat-label>
      <input matInput [formControl]="nameCtrl" placeholder="Ej: Veeam ACME 2026" />
    </mat-form-field>

    <mat-form-field appearance="outline" subscriptSizing="dynamic">
      <mat-label>Contraseña</mat-label>
      <input matInput type="password" [formControl]="passwordCtrl" autocomplete="new-password" />
    </mat-form-field>

    <button mat-flat-button color="primary" (click)="add()" [disabled]="adding">
      Guardar
    </button>
  </div>
</div>
```

- [ ] **Step 5: Agregar `<app-credential-vault>` en backups-config.component.html**

Al inicio del template, antes del `<div class="section-header">` existente, agregar:

```html
<app-credential-vault></app-credential-vault>

<div class="vault-divider"></div>
```

- [ ] **Step 6: Registrar en admin.module.ts**

Agregar a `declarations`:
```typescript
import { CredentialVaultComponent } from './backups-config/credential-vault/credential-vault.component';
// ... en declarations:
CredentialVaultComponent,
```

Agregar `MatTooltipModule` si no está ya (ya está en el módulo admin actual).

- [ ] **Step 7: Ejecutar tests**

```
cd frontend && npx jest credential-vault.component.spec --no-coverage
```
Expected: PASS (4 tests)

- [ ] **Step 8: Commit**

```
git add frontend/src/app/features/admin/backups-config/credential-vault/
git add frontend/src/app/features/admin/backups-config/backups-config.component.html
git add frontend/src/app/features/admin/admin.module.ts
git commit -m "feat: CredentialVaultComponent en Admin → Backups con CRUD de credenciales"
```

---

## Task 7: Frontend — Dialog: host auto-populate + credential select

**Files:**
- Modify: `frontend/src/app/features/admin/backups-config/backups-config-dialog/backups-config-dialog.component.ts`
- Modify: `frontend/src/app/features/admin/backups-config/backups-config-dialog/backups-config-dialog.component.html`
- Modify: `frontend/src/app/features/admin/backups-config/backups-config-dialog/backups-config-dialog.component.spec.ts`

**Interfaces:**
- Consumes:
  - `InfradocService.getClientInfrastructure(clientId): Observable<ClientInfrastructure>`
  - `CredentialVaultService.list(): Observable<CredentialVaultEntry[]>`
  - `BackupsService.createConfig(dto)` donde `dto.credentialVaultId` reemplaza `dto.password`
- Produces: formulario sin campo IP libre, con host auto-llenado desde InfraDoc y selector de vault

- [ ] **Step 1: Actualizar los tests del diálogo**

Reemplazar el contenido de `backups-config-dialog.component.spec.ts`:

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
import { BackupsConfigDialogComponent } from './backups-config-dialog.component';
import { BackupsService } from '../../../../features/backups/services/backups.service';
import { ClientsService } from '../../../../core/services/clients.service';
import { InfradocService } from '../../../../core/services/infradoc.service';
import { CredentialVaultService } from '../../../../core/services/credential-vault.service';

const mockClients = [
  { id: 'c1', name: 'ACME', isActive: true, primaryAddress: null, createdAt: '2024-01-01' },
  { id: 'c2', name: 'Otra Empresa', isActive: true, primaryAddress: null, createdAt: '2024-01-01' },
];
const mockVaultEntries = [
  { id: 'v1', name: 'Veeam ACME', createdAt: '2026-01-01' },
];
const mockInfra = {
  esxiHosts: [{ assetId: 1, name: 'acme.ondravirtual.com.ar', ip: null, bmcIp: null, bmcType: null, os: null, make: null, model: null, uri1: null, uri2: null }],
  windowsVMs: [], domainControllers: [], linuxVMs: [], nas: [], routers: [],
};

const mockSvc = { createConfig: jest.fn(), updateConfig: jest.fn() };
const mockDialogRef = { close: jest.fn() };
const mockClientsSvc = { getAll: jest.fn() };
const mockInfradocSvc = { getClientInfrastructure: jest.fn() };
const mockVaultSvc = { list: jest.fn() };

describe('BackupsConfigDialogComponent', () => {
  async function setup(data: any = null) {
    mockClientsSvc.getAll.mockReturnValue(of(mockClients));
    mockVaultSvc.list.mockReturnValue(of(mockVaultEntries));
    mockInfradocSvc.getClientInfrastructure.mockReturnValue(of(mockInfra));

    await TestBed.configureTestingModule({
      declarations: [BackupsConfigDialogComponent],
      imports: [
        NoopAnimationsModule, ReactiveFormsModule, MatDialogModule,
        MatFormFieldModule, MatInputModule, MatSelectModule,
        MatCheckboxModule, MatButtonModule, MatTooltipModule, MatProgressSpinnerModule,
      ],
      providers: [
        { provide: BackupsService, useValue: mockSvc },
        { provide: ClientsService, useValue: mockClientsSvc },
        { provide: InfradocService, useValue: mockInfradocSvc },
        { provide: CredentialVaultService, useValue: mockVaultSvc },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    }).compileComponents();

    const fixture: ComponentFixture<BackupsConfigDialogComponent> = TestBed.createComponent(BackupsConfigDialogComponent);
    fixture.detectChanges();
    return { fixture, comp: fixture.componentInstance };
  }

  beforeEach(() => { jest.clearAllMocks(); });

  it('carga clientes activos y vault entries al init', async () => {
    const { comp } = await setup(null);
    expect(comp.clients.length).toBe(2);
    expect(comp.vaultEntries.length).toBe(1);
  });

  it('al seleccionar cliente auto-popula host desde InfraDoc', async () => {
    const { comp } = await setup(null);
    comp.form.controls['clientId'].setValue('c1');
    comp.onClientChange('c1');
    expect(mockInfradocSvc.getClientInfrastructure).toHaveBeenCalledWith('c1');
    expect(comp.form.controls['host'].value).toBe('acme.ondravirtual.com.ar');
  });

  it('si InfraDoc devuelve hosts vacíos, host queda en blanco', async () => {
    mockInfradocSvc.getClientInfrastructure.mockReturnValue(of({ ...mockInfra, esxiHosts: [] }));
    const { comp } = await setup(null);
    comp.onClientChange('c1');
    expect(comp.form.controls['host'].value).toBe('');
  });

  it('crea config con credentialVaultId en lugar de password', async () => {
    const { comp } = await setup(null);
    mockSvc.createConfig.mockReturnValue(of({
      id: 'new', clientId: 'c1', clientName: 'ACME',
      host: 'acme.ondravirtual.com.ar', port: 9419, username: 'admin',
      isEnabled: true, lastConnectedAt: null,
    }));
    comp.form.patchValue({
      clientId: 'c1', host: 'acme.ondravirtual.com.ar',
      port: 9419, username: 'admin', credentialVaultId: 'v1', isEnabled: true,
    });
    comp.save();
    expect(mockSvc.createConfig).toHaveBeenCalledWith(expect.objectContaining({
      credentialVaultId: 'v1',
      clientId: 'c1',
    }));
    expect(mockSvc.createConfig.mock.calls[0][0]).not.toHaveProperty('password');
  });

  it('en modo edit, muestra datos existentes y acepta cambio de vault entry', async () => {
    const existing = {
      id: 'abc', clientName: 'ACME', host: 'acme.ondravirtual.com.ar',
      port: 9419, username: 'svc_veeam', isEnabled: true, clientId: 'c1', lastConnectedAt: null,
    };
    const { comp } = await setup(existing);
    expect(comp.isEdit).toBe(true);
    expect(comp.form.controls['host'].value).toBe('acme.ondravirtual.com.ar');

    mockSvc.updateConfig.mockReturnValue(of({ ...existing, credentialVaultId: 'v1' }));
    comp.form.patchValue({ credentialVaultId: 'v1' });
    comp.save();
    expect(mockSvc.updateConfig).toHaveBeenCalledWith('abc', expect.objectContaining({
      credentialVaultId: 'v1',
    }));
  });

  it('en modo create, form inválido si no se selecciona vault entry', async () => {
    const { comp } = await setup(null);
    comp.form.patchValue({
      clientId: 'c1', host: 'acme.ondravirtual.com.ar',
      port: 9419, username: 'admin', credentialVaultId: null, isEnabled: true,
    });
    expect(comp.isValid).toBe(false);
  });

  it('carga solo clientes activos', async () => {
    mockClientsSvc.getAll.mockReturnValue(of([
      ...mockClients,
      { id: 'c3', name: 'Inactivo', isActive: false, primaryAddress: null, createdAt: '2024-01-01' },
    ]));
    const { comp } = await setup(null);
    expect(comp.clients.every(c => c.isActive)).toBe(true);
    expect(comp.clients.length).toBe(2);
  });
});
```

- [ ] **Step 2: Ejecutar tests — deben fallar**

```
cd frontend && npx jest backups-config-dialog.component.spec --no-coverage
```
Expected: FAIL (nuevos tests no compilan aún)

- [ ] **Step 3: Actualizar el componente TypeScript del diálogo**

```typescript
// frontend/src/app/features/admin/backups-config/backups-config-dialog/backups-config-dialog.component.ts
import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { BackupsService } from '../../../../features/backups/services/backups.service';
import { ClientsService } from '../../../../core/services/clients.service';
import { InfradocService } from '../../../../core/services/infradoc.service';
import { CredentialVaultService } from '../../../../core/services/credential-vault.service';
import { Client } from '../../../../core/models/client.models';
import type { CredentialVaultEntry } from '../../../../core/models/credential-vault.models';
import type { CreateVeeamConfigRequest, UpdateVeeamConfigRequest, VeeamClientConfig } from '../../../../features/backups/models/backup.models';

@Component({
  selector: 'app-backups-config-dialog',
  templateUrl: './backups-config-dialog.component.html',
})
export class BackupsConfigDialogComponent implements OnInit {
  saving = false;
  isEdit = false;
  loadingHost = false;
  clients: Client[] = [];
  vaultEntries: CredentialVaultEntry[] = [];

  form = new FormGroup({
    clientId:          new FormControl('', [Validators.required]),
    host:              new FormControl('', [Validators.required]),
    port:              new FormControl<number>(9419, [Validators.required, Validators.min(1), Validators.max(65535)]),
    username:          new FormControl('', [Validators.required]),
    credentialVaultId: new FormControl<string | null>(null),
    isEnabled:         new FormControl(true),
  });

  constructor(
    private readonly dialogRef: MatDialogRef<BackupsConfigDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: VeeamClientConfig | null,
    private readonly svc: BackupsService,
    private readonly clientsSvc: ClientsService,
    private readonly infradocSvc: InfradocService,
    private readonly vaultSvc: CredentialVaultService,
  ) {}

  ngOnInit(): void {
    this.clientsSvc.getAll().subscribe(all => {
      this.clients = all.filter(c => c.isActive);
    });
    this.vaultSvc.list().subscribe(entries => {
      this.vaultEntries = entries;
    });

    if (this.data) {
      this.isEdit = true;
      this.form.patchValue({
        clientId:  this.data.clientId,
        host:      this.data.host,
        port:      this.data.port,
        username:  this.data.username,
        isEnabled: this.data.isEnabled,
        credentialVaultId: null,
      });
      this.form.controls.clientId.disable();
    } else {
      // En modo create, credentialVaultId es obligatorio
      this.form.controls.credentialVaultId.setValidators([Validators.required]);
      this.form.controls.credentialVaultId.updateValueAndValidity();
    }
  }

  onClientChange(clientId: string): void {
    if (!clientId) return;
    this.loadingHost = true;
    this.infradocSvc.getClientInfrastructure(clientId).subscribe({
      next: infra => {
        const host = infra.esxiHosts[0]?.name ?? '';
        this.form.controls.host.setValue(host);
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
    const v = this.form.getRawValue();

    if (this.isEdit && this.data) {
      const dto: UpdateVeeamConfigRequest = {
        host:      v.host ?? undefined,
        port:      v.port ?? 9419,
        username:  v.username ?? undefined,
        isEnabled: v.isEnabled ?? true,
      };
      if (v.credentialVaultId) dto.credentialVaultId = v.credentialVaultId;

      this.svc.updateConfig(this.data.id, dto).subscribe({
        next: updated => { this.saving = false; this.dialogRef.close(updated); },
        error: () => { this.saving = false; },
      });
    } else {
      const clientName = this.clients.find(c => c.id === v.clientId)?.name ?? '';
      const dto: CreateVeeamConfigRequest = {
        clientId:  v.clientId!,
        clientName,
        host:      v.host!,
        port:      v.port ?? 9419,
        username:  v.username!,
        isEnabled: v.isEnabled ?? true,
      };
      if (v.credentialVaultId) dto.credentialVaultId = v.credentialVaultId;

      this.svc.createConfig(dto).subscribe({
        next: created => { this.saving = false; this.dialogRef.close(created); },
        error: () => { this.saving = false; },
      });
    }
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
```

- [ ] **Step 4: Actualizar el template HTML del diálogo**

```html
<!-- frontend/src/app/features/admin/backups-config/backups-config-dialog/backups-config-dialog.component.html -->
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
    <mat-label>Host (InfraDoc)</mat-label>
    <input matInput formControlName="host" placeholder="Auto-llenado al seleccionar cliente" />
    <mat-suffix *ngIf="loadingHost">
      <mat-spinner diameter="16"></mat-spinner>
    </mat-suffix>
    <mat-error *ngIf="form.controls.host.invalid">Campo requerido</mat-error>
  </mat-form-field>

  <mat-form-field appearance="outline" subscriptSizing="dynamic" style="margin-top: 16px;">
    <mat-label>Puerto</mat-label>
    <input matInput type="number" formControlName="port" min="1" max="65535" />
    <mat-error *ngIf="form.controls.port.invalid">Puerto inválido (1–65535)</mat-error>
  </mat-form-field>

  <mat-form-field appearance="outline" subscriptSizing="dynamic" style="margin-top: 16px;">
    <mat-label>Usuario</mat-label>
    <input matInput formControlName="username" placeholder="administrator" />
    <mat-error *ngIf="form.controls.username.invalid">Campo requerido</mat-error>
  </mat-form-field>

  <mat-form-field appearance="outline" subscriptSizing="dynamic" style="margin-top: 16px;">
    <mat-label>{{ isEdit ? 'Credencial (opcional: cambiar)' : 'Credencial del vault' }}</mat-label>
    <mat-select formControlName="credentialVaultId">
      <mat-option [value]="null">{{ isEdit ? '(sin cambios)' : 'Seleccioná una credencial…' }}</mat-option>
      <mat-option *ngFor="let v of vaultEntries" [value]="v.id">{{ v.name }}</mat-option>
    </mat-select>
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

- [ ] **Step 5: Ejecutar los tests del diálogo**

```
cd frontend && npx jest backups-config-dialog.component.spec --no-coverage
```
Expected: PASS (5 tests)

- [ ] **Step 6: Ejecutar todos los tests del módulo admin/backups**

```
cd frontend && npx jest backups-config --no-coverage
```
Expected: PASS todos

- [ ] **Step 7: Commit**

```
git add frontend/src/app/features/admin/backups-config/backups-config-dialog/
git commit -m "feat: diálogo Veeam con host auto-DNS desde InfraDoc y selector de vault de credenciales"
```

---

## Task 8: Verificación final

- [ ] **Step 1: Ejecutar suite completa backend**

```
cd backend && npx jest --no-coverage
```
Expected: PASS todos los tests existentes + nuevos

- [ ] **Step 2: Ejecutar suite completa frontend**

```
cd frontend && npx jest --no-coverage
```
Expected: PASS todos los tests existentes + nuevos

- [ ] **Step 3: Verificar que TypeScript compila sin errores**

```
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit final si todo OK**

```
git commit --allow-empty -m "chore: suite completa verde — backups vault + auto-DNS"
```
