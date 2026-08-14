# Credenciales Odoo por técnico — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el único service account global de Odoo por credenciales propias por usuario, con onboarding obligatorio al primer login y cierre atómico de tareas.

**Architecture:** Se extraen dos servicios RPC (`OdooSystemRpcService` para el service account, `OdooUserRpcService` stateless por credenciales). Las API keys se cifran en reposo con AES-256-CBC. El login response incluye `mustOdooSetup`, el `AuthGuard` redirige a `/login/odoo-setup` si está en `true`, y `TasksService` descifra las credenciales del técnico asignado antes de llamar a Odoo.

**Tech Stack:** NestJS, TypeORM/PostgreSQL, Node `crypto` (built-in), Angular 17 / Angular Material, Jest, Jasmine.

## Global Constraints

- Sin standalone components Angular — todos en NgModule declarado
- `appearance="outline"` único estilo en `mat-form-field`
- Sin elementos HTML nativos en formularios — siempre Angular Material
- TDD: test primero, implementación después
- Un commit por tarea
- Idioma del código: inglés. Mensajes de error al usuario: español

---

## Mapa de archivos

### Nuevos — Backend
| Archivo | Responsabilidad |
|---|---|
| `backend/src/common/utils/crypto.util.ts` | encrypt / decrypt AES-256-CBC |
| `backend/src/common/utils/crypto.util.spec.ts` | tests round-trip, IV aleatorio, key incorrecta |
| `backend/src/migrations/1784016000000-AddOdooCredentialsToUser.ts` | 5 columnas nuevas en `users` |
| `backend/src/integrations/odoo/odoo-rpc.helpers.ts` | buildClient + rpcCall compartidos |
| `backend/src/integrations/odoo/odoo-system-rpc.service.ts` | service account RPC (reemplaza `odoo-rpc.service.ts`) |
| `backend/src/integrations/odoo/odoo-system-rpc.service.spec.ts` | tests del service account RPC |
| `backend/src/integrations/odoo/odoo-user-rpc.service.ts` | RPC stateless por credenciales + interfaz `OdooUserCredentials` |
| `backend/src/integrations/odoo/odoo-user-rpc.service.spec.ts` | tests validate + callKw con creds |
| `backend/src/integrations/odoo/odoo-user-rpc.module.ts` | módulo que exporta `OdooUserRpcService` |
| `backend/src/users/dto/update-odoo-credentials.dto.ts` | `{ odooApiEmail, odooApiKey }` |
| `backend/src/users/dto/update-odoo-exempt.dto.ts` | `{ odooExempt: boolean }` |
| `backend/src/users/dto/me-response.dto.ts` | perfil sin passwordHash ni key cifrada |
| `backend/src/users/users-me.controller.ts` | `GET /users/me`, `PUT /users/me/odoo-credentials` (sin restricción de rol) |

### Modificados — Backend
| Archivo | Cambio |
|---|---|
| `backend/src/users/user.entity.ts` | +5 columnas Odoo |
| `backend/src/users/users.service.ts` | +getMe, +updateOdooCredentials, +updateOdooExempt |
| `backend/src/users/users.module.ts` | importa OdooUserRpcModule, declara UsersMeController |
| `backend/src/users/users.controller.ts` | +PATCH `:id/odoo-exempt` |
| `backend/src/integrations/odoo/odoo-rpc.service.ts` | **ELIMINADO** (reemplazado por odoo-system-rpc.service.ts) |
| `backend/src/integrations/odoo/odoo-rpc.service.spec.ts` | **ELIMINADO** |
| `backend/src/integrations/odoo/odoo-integration.module.ts` | usa OdooSystemRpcService + OdooUserRpcModule |
| `backend/src/integrations/odoo/odoo.service.ts` | closeTicket/logTimesheet/markInProgress aceptan `OdooUserCredentials` |
| `backend/src/auth/dto/login-response.dto.ts` | +mustOdooSetup, +odooKeyValid, +odooExempt en user |
| `backend/src/auth/auth.service.ts` | popula mustOdooSetup en login |
| `backend/src/tasks/tasks.service.ts` | inyecta ConfigService, descifra creds al cerrar/iniciar tarea |

### Nuevos — Frontend
| Archivo | Responsabilidad |
|---|---|
| `frontend/src/app/core/services/profile.service.ts` | GET /users/me + PUT /users/me/odoo-credentials |
| `frontend/src/app/core/services/profile.service.spec.ts` | tests de los dos métodos |
| `frontend/src/app/features/auth/odoo-setup/odoo-setup.component.ts` | formulario de onboarding obligatorio |
| `frontend/src/app/features/auth/odoo-setup/odoo-setup.component.html` | template del formulario |
| `frontend/src/app/features/auth/odoo-setup/odoo-setup.component.scss` | estilos (mismo patrón que change-password) |
| `frontend/src/app/features/auth/odoo-setup/odoo-setup.component.spec.ts` | tests submit, error, logout |
| `frontend/src/app/features/profile/profile.component.ts` | panel de perfil con edición de credenciales |
| `frontend/src/app/features/profile/profile.component.html` | template del perfil |
| `frontend/src/app/features/profile/profile.component.scss` | estilos |
| `frontend/src/app/features/profile/profile.component.spec.ts` | tests de carga + edición |
| `frontend/src/app/features/profile/profile.module.ts` | módulo con routing a /profile |

### Modificados — Frontend
| Archivo | Cambio |
|---|---|
| `frontend/src/app/core/models/auth.models.ts` | +mustOdooSetup en LoginResponse, +odooKeyValid/odooExempt en AuthUser |
| `frontend/src/app/core/services/auth.service.ts` | +mustOdooSetup(), +clearMustOdooSetup(), persiste flag |
| `frontend/src/app/core/services/auth.service.spec.ts` | +tests del nuevo flag |
| `frontend/src/app/core/guards/auth.guard.ts` | +redirect a /login/odoo-setup |
| `frontend/src/app/core/guards/auth.guard.spec.ts` | +test del nuevo branch |
| `frontend/src/app/features/auth/auth.module.ts` | +OdooSetupComponent + ruta odoo-setup |
| `frontend/src/app/app-routing.module.ts` | +ruta /profile en shell children |
| `frontend/src/app/core/shell/shell.component.ts` | +Mi perfil en navItems |

---

## Task 1: CryptoUtil backend

**Files:**
- Create: `backend/src/common/utils/crypto.util.ts`
- Create: `backend/src/common/utils/crypto.util.spec.ts`

**Interfaces:**
- Produces: `encrypt(plain: string, keyHex: string): string` · `decrypt(stored: string, keyHex: string): string`
- Formato almacenado: `"<ivHex>:<ciphertextHex>"` (string separado por `:`)

- [ ] **Escribir el test**

```typescript
// backend/src/common/utils/crypto.util.spec.ts
import { encrypt, decrypt } from './crypto.util';

describe('crypto.util', () => {
  const KEY = 'a'.repeat(64); // 32 bytes en hex

  it('round-trip: decrypt(encrypt(x)) === x', () => {
    const plain = 'odoo-super-secret-api-key-12345';
    expect(decrypt(encrypt(plain, KEY), KEY)).toBe(plain);
  });

  it('produce ciphertext distinto en cada llamada (IV aleatorio)', () => {
    const plain = 'mismo-valor';
    expect(encrypt(plain, KEY)).not.toBe(encrypt(plain, KEY));
  });

  it('lanza con key incorrecta', () => {
    const stored = encrypt('valor', KEY);
    expect(() => decrypt(stored, 'b'.repeat(64))).toThrow();
  });

  it('lanza con formato de stored incorrecto', () => {
    expect(() => decrypt('sin-dos-puntos', KEY)).toThrow();
  });
});
```

- [ ] **Correr el test — debe fallar con "Cannot find module"**

```
cd backend && npx jest src/common/utils/crypto.util.spec.ts --no-coverage
```

- [ ] **Implementar**

```typescript
// backend/src/common/utils/crypto.util.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-cbc';

export function encrypt(plain: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(stored: string, keyHex: string): string {
  const colonIdx = stored.indexOf(':');
  if (colonIdx === -1) throw new Error('Formato de credencial cifrada inválido');
  const ivHex  = stored.slice(0, colonIdx);
  const encHex = stored.slice(colonIdx + 1);
  const key    = Buffer.from(keyHex, 'hex');
  const iv     = Buffer.from(ivHex, 'hex');
  const encBuf = Buffer.from(encHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  return Buffer.concat([decipher.update(encBuf), decipher.final()]).toString('utf8');
}
```

- [ ] **Correr el test — debe pasar**

```
cd backend && npx jest src/common/utils/crypto.util.spec.ts --no-coverage
```

Expected: 4 tests PASS

- [ ] **Commit**

```
git add backend/src/common/utils/crypto.util.ts backend/src/common/utils/crypto.util.spec.ts
git commit -m "feat(crypto): utilidad AES-256-CBC encrypt/decrypt para API keys"
```

---

## Task 2: DB migration + User entity

**Files:**
- Create: `backend/src/migrations/1784016000000-AddOdooCredentialsToUser.ts`
- Modify: `backend/src/users/user.entity.ts`

**Interfaces:**
- Produces: nuevos campos en `User` — `odooApiEmail`, `odooApiKeyEnc`, `odooKeyValid`, `odooKeyValidatedAt`, `odooExempt`

- [ ] **Crear la migración**

```typescript
// backend/src/migrations/1784016000000-AddOdooCredentialsToUser.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOdooCredentialsToUser1784016000000 implements MigrationInterface {
  name = 'AddOdooCredentialsToUser1784016000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "odoo_api_email"        VARCHAR,
        ADD COLUMN IF NOT EXISTS "odoo_api_key_enc"      VARCHAR,
        ADD COLUMN IF NOT EXISTS "odoo_key_valid"        BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS "odoo_key_validated_at" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "odoo_exempt"           BOOLEAN NOT NULL DEFAULT FALSE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "odoo_api_email",
        DROP COLUMN IF EXISTS "odoo_api_key_enc",
        DROP COLUMN IF EXISTS "odoo_key_valid",
        DROP COLUMN IF EXISTS "odoo_key_validated_at",
        DROP COLUMN IF EXISTS "odoo_exempt"
    `);
  }
}
```

- [ ] **Correr la migración**

```
cd backend && npx typeorm-ts-node-commonjs migration:run -d src/database/data-source.ts
```

Expected: `migration AddOdooCredentialsToUser1784016000000 has been executed successfully.`

- [ ] **Verificar columnas en la DB**

```
cd backend && npx typeorm-ts-node-commonjs query -d src/database/data-source.ts "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name LIKE 'odoo%' ORDER BY column_name"
```

Expected: 7 filas (`odoo_api_email`, `odoo_api_key_enc`, `odoo_employee_id`, `odoo_exempt`, `odoo_key_valid`, `odoo_key_validated_at`, `odoo_synced_at`, `odoo_user_id`)

- [ ] **Actualizar User entity**

En `backend/src/users/user.entity.ts`, agregar los 5 campos nuevos ANTES de `@CreateDateColumn()`:

```typescript
  @Column({ name: 'odoo_api_email', nullable: true, default: null })
  odooApiEmail: string | null;

  @Column({ name: 'odoo_api_key_enc', nullable: true, default: null })
  odooApiKeyEnc: string | null;

  @Column({ name: 'odoo_key_valid', default: false })
  odooKeyValid: boolean;

  @Column({
    name: 'odoo_key_validated_at',
    type: 'timestamptz',
    nullable: true,
    default: null,
  })
  odooKeyValidatedAt: Date | null;

  @Column({ name: 'odoo_exempt', default: false })
  odooExempt: boolean;
```

- [ ] **Verificar que el backend compila sin errores**

```
cd backend && npx tsc --noEmit
```

- [ ] **Commit**

```
git add backend/src/migrations/1784016000000-AddOdooCredentialsToUser.ts backend/src/users/user.entity.ts
git commit -m "feat(users): migración y campos odoo_api_email, odoo_api_key_enc, odoo_key_valid, odoo_key_validated_at, odoo_exempt"
```

---

## Task 3: Split OdooRpcService en System + User

**Files:**
- Create: `backend/src/integrations/odoo/odoo-rpc.helpers.ts`
- Create: `backend/src/integrations/odoo/odoo-system-rpc.service.ts`
- Create: `backend/src/integrations/odoo/odoo-system-rpc.service.spec.ts`
- Create: `backend/src/integrations/odoo/odoo-user-rpc.service.ts`
- Create: `backend/src/integrations/odoo/odoo-user-rpc.service.spec.ts`
- Create: `backend/src/integrations/odoo/odoo-user-rpc.module.ts`
- Modify: `backend/src/integrations/odoo/odoo-integration.module.ts`
- Delete: `backend/src/integrations/odoo/odoo-rpc.service.ts`
- Delete: `backend/src/integrations/odoo/odoo-rpc.service.spec.ts`

**Interfaces:**
- Consumes: nada (usa ConfigService via DI, xmlrpc directo)
- Produces:
  - `OdooSystemRpcService.callKw<T>(model, method, args, kwargs): Promise<T>`
  - `OdooUserCredentials { email: string; apiKey: string }`
  - `OdooUserRpcService.validateCredentials(email, apiKey): Promise<void>` — lanza si inválido
  - `OdooUserRpcService.callKw<T>(creds, model, method, args, kwargs): Promise<T>`

- [ ] **Crear odoo-rpc.helpers.ts**

```typescript
// backend/src/integrations/odoo/odoo-rpc.helpers.ts
import * as xmlrpc from 'xmlrpc';
import { ConfigService } from '@nestjs/config';

export function buildOdooClient(configService: ConfigService, path: string): xmlrpc.Client {
  const baseUrl = configService.getOrThrow<string>('ODOO_URL');
  const parsed  = new URL(baseUrl);
  const opts    = {
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

- [ ] **Escribir tests de OdooSystemRpcService**

```typescript
// backend/src/integrations/odoo/odoo-system-rpc.service.spec.ts
jest.mock('xmlrpc');
import * as xmlrpc from 'xmlrpc';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { OdooSystemRpcService } from './odoo-system-rpc.service';

describe('OdooSystemRpcService', () => {
  let service: OdooSystemRpcService;
  let mockMethodCall: jest.Mock;

  const cfg: Record<string, string> = {
    ODOO_URL: 'http://odoo.test', ODOO_DB: 'testdb',
    ODOO_USERNAME: 'admin', ODOO_API_KEY: 'sys-key',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockMethodCall = jest.fn();
    const mockClient = { methodCall: mockMethodCall };
    (xmlrpc.createClient as jest.Mock).mockReturnValue(mockClient);
    (xmlrpc.createSecureClient as jest.Mock).mockReturnValue(mockClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OdooSystemRpcService,
        { provide: ConfigService, useValue: { getOrThrow: (k: string) => cfg[k] } },
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

  it('reutiliza uid cacheado sin re-autenticar', async () => {
    mockMethodCall
      .mockImplementationOnce((_m, _p, cb) => cb(null, 7))
      .mockImplementation((_m, _p, cb) => cb(null, []));
    await service.callKw('res.partner', 'search_read', [[]], {});
    await service.callKw('res.partner', 'search_read', [[]], {});
    expect(mockMethodCall).toHaveBeenCalledTimes(3); // 1 auth + 2 data
  });

  it('lanza ServiceUnavailableException en error de red', async () => {
    mockMethodCall
      .mockImplementationOnce((_m, _p, cb) => cb(null, 7))
      .mockImplementationOnce((_m, _p, cb) => cb(new Error('net'), null));
    await expect(service.callKw('m', 'search_read', [[]], {})).rejects.toThrow(ServiceUnavailableException);
  });
});
```

- [ ] **Correr test — debe fallar con "Cannot find module"**

```
cd backend && npx jest src/integrations/odoo/odoo-system-rpc.service.spec.ts --no-coverage
```

- [ ] **Implementar OdooSystemRpcService**

```typescript
// backend/src/integrations/odoo/odoo-system-rpc.service.ts
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildOdooClient, rpcCall } from './odoo-rpc.helpers';

@Injectable()
export class OdooSystemRpcService {
  private uid: number | null = null;

  constructor(private readonly configService: ConfigService) {}

  async authenticate(): Promise<number> {
    const db       = this.configService.getOrThrow<string>('ODOO_DB');
    const username = this.configService.getOrThrow<string>('ODOO_USERNAME');
    const apiKey   = this.configService.getOrThrow<string>('ODOO_API_KEY');
    const client   = buildOdooClient(this.configService, '/xmlrpc/2/common');
    let uid: number;
    try {
      uid = await rpcCall<number>(client, 'authenticate', [db, username, apiKey, {}]);
    } catch (err) {
      throw new ServiceUnavailableException(`Odoo auth failed: ${(err as Error).message}`);
    }
    if (!uid) throw new ServiceUnavailableException('Odoo auth: uid no recibido');
    this.uid = uid;
    return uid;
  }

  async callKw<T>(model: string, method: string, args: unknown[], kwargs: Record<string, unknown>): Promise<T> {
    if (this.uid === null) this.uid = await this.authenticate();
    const db     = this.configService.getOrThrow<string>('ODOO_DB');
    const apiKey = this.configService.getOrThrow<string>('ODOO_API_KEY');
    const client = buildOdooClient(this.configService, '/xmlrpc/2/object');
    try {
      return await rpcCall<T>(client, 'execute_kw', [db, this.uid, apiKey, model, method, args, kwargs]);
    } catch (err) {
      throw new ServiceUnavailableException(`Odoo RPC ${model}.${method}: ${(err as Error).message}`);
    }
  }
}
```

- [ ] **Correr test OdooSystemRpcService — debe pasar**

```
cd backend && npx jest src/integrations/odoo/odoo-system-rpc.service.spec.ts --no-coverage
```

- [ ] **Escribir tests de OdooUserRpcService**

```typescript
// backend/src/integrations/odoo/odoo-user-rpc.service.spec.ts
jest.mock('xmlrpc');
import * as xmlrpc from 'xmlrpc';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { OdooUserRpcService } from './odoo-user-rpc.service';

const CREDS = { email: 'tech@ondra.com.ar', apiKey: 'user-key-123' };

describe('OdooUserRpcService', () => {
  let service: OdooUserRpcService;
  let mockMethodCall: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockMethodCall = jest.fn();
    const mockClient = { methodCall: mockMethodCall };
    (xmlrpc.createClient as jest.Mock).mockReturnValue(mockClient);
    (xmlrpc.createSecureClient as jest.Mock).mockReturnValue(mockClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OdooUserRpcService,
        { provide: ConfigService, useValue: { getOrThrow: (k: string) => ({ ODOO_URL: 'http://odoo.test', ODOO_DB: 'testdb' }[k]) } },
      ],
    }).compile();
    service = module.get<OdooUserRpcService>(OdooUserRpcService);
  });

  describe('validateCredentials', () => {
    it('resuelve sin error cuando uid es válido', async () => {
      mockMethodCall.mockImplementation((_m, _p, cb) => cb(null, 5));
      await expect(service.validateCredentials(CREDS.email, CREDS.apiKey)).resolves.toBeUndefined();
    });

    it('lanza BadRequestException cuando uid es 0 (credenciales incorrectas)', async () => {
      mockMethodCall.mockImplementation((_m, _p, cb) => cb(null, 0));
      await expect(service.validateCredentials(CREDS.email, CREDS.apiKey)).rejects.toThrow(BadRequestException);
    });

    it('lanza ServiceUnavailableException cuando Odoo no está disponible', async () => {
      mockMethodCall.mockImplementation((_m, _p, cb) => cb(new Error('ECONNREFUSED'), null));
      await expect(service.validateCredentials(CREDS.email, CREDS.apiKey)).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('callKw', () => {
    it('autentica con las credenciales del usuario (no con service account) y ejecuta la llamada', async () => {
      mockMethodCall
        .mockImplementationOnce((_m, _p, cb) => cb(null, 5))
        .mockImplementationOnce((_m, _p, cb) => cb(null, true));

      await service.callKw<boolean>(CREDS, 'helpdesk.ticket', 'write', [[1], { stage_id: 3 }], {});

      const authCall = mockMethodCall.mock.calls[0];
      expect(authCall[1]).toEqual(['testdb', CREDS.email, CREDS.apiKey, {}]);
      const dataCall = mockMethodCall.mock.calls[1];
      expect(dataCall[1][2]).toBe(CREDS.apiKey); // apiKey del usuario, no la del .env
    });

    it('autentica de nuevo en cada llamada (sin caché de uid)', async () => {
      mockMethodCall
        .mockImplementationOnce((_m, _p, cb) => cb(null, 5))
        .mockImplementationOnce((_m, _p, cb) => cb(null, true))
        .mockImplementationOnce((_m, _p, cb) => cb(null, 5))
        .mockImplementationOnce((_m, _p, cb) => cb(null, true));

      await service.callKw<boolean>(CREDS, 'helpdesk.ticket', 'write', [[1], {}], {});
      await service.callKw<boolean>(CREDS, 'helpdesk.ticket', 'write', [[2], {}], {});

      expect(mockMethodCall).toHaveBeenCalledTimes(4); // 2 auth + 2 data (sin caché)
    });
  });
});
```

- [ ] **Correr test — debe fallar**

```
cd backend && npx jest src/integrations/odoo/odoo-user-rpc.service.spec.ts --no-coverage
```

- [ ] **Implementar OdooUserRpcService**

```typescript
// backend/src/integrations/odoo/odoo-user-rpc.service.ts
import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildOdooClient, rpcCall } from './odoo-rpc.helpers';

export interface OdooUserCredentials {
  email: string;
  apiKey: string;
}

@Injectable()
export class OdooUserRpcService {
  constructor(private readonly configService: ConfigService) {}

  private async authenticate(creds: OdooUserCredentials): Promise<number> {
    const db     = this.configService.getOrThrow<string>('ODOO_DB');
    const client = buildOdooClient(this.configService, '/xmlrpc/2/common');
    let uid: number;
    try {
      uid = await rpcCall<number>(client, 'authenticate', [db, creds.email, creds.apiKey, {}]);
    } catch (err) {
      throw new ServiceUnavailableException(`Odoo no disponible: ${(err as Error).message}`);
    }
    if (!uid) throw new BadRequestException('Credenciales Odoo inválidas');
    return uid;
  }

  async validateCredentials(email: string, apiKey: string): Promise<void> {
    await this.authenticate({ email, apiKey });
  }

  async callKw<T>(
    creds: OdooUserCredentials,
    model: string,
    method: string,
    args: unknown[],
    kwargs: Record<string, unknown>,
  ): Promise<T> {
    const uid    = await this.authenticate(creds);
    const db     = this.configService.getOrThrow<string>('ODOO_DB');
    const client = buildOdooClient(this.configService, '/xmlrpc/2/object');
    try {
      return await rpcCall<T>(client, 'execute_kw', [db, uid, creds.apiKey, model, method, args, kwargs]);
    } catch (err) {
      throw new ServiceUnavailableException(`Odoo RPC ${model}.${method}: ${(err as Error).message}`);
    }
  }
}
```

- [ ] **Crear OdooUserRpcModule**

```typescript
// backend/src/integrations/odoo/odoo-user-rpc.module.ts
import { Module } from '@nestjs/common';
import { OdooUserRpcService } from './odoo-user-rpc.service';

@Module({
  providers: [OdooUserRpcService],
  exports: [OdooUserRpcService],
})
export class OdooUserRpcModule {}
```

- [ ] **Actualizar OdooIntegrationModule**

Reemplazar el contenido de `backend/src/integrations/odoo/odoo-integration.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ClientsModule } from '../../clients/clients.module';
import { UsersModule } from '../../users/users.module';
import { TechniciansModule } from '../../technicians/technicians.module';
import { OdooSystemRpcService } from './odoo-system-rpc.service';
import { OdooUserRpcModule } from './odoo-user-rpc.module';
import { OdooService } from './odoo.service';
import { OdooController } from './odoo.controller';

@Module({
  imports: [ClientsModule, UsersModule, TechniciansModule, OdooUserRpcModule],
  controllers: [OdooController],
  providers: [OdooSystemRpcService, OdooService],
  exports: [OdooService],
})
export class OdooIntegrationModule {}
```

- [ ] **Eliminar los archivos obsoletos**

```
git rm backend/src/integrations/odoo/odoo-rpc.service.ts
git rm backend/src/integrations/odoo/odoo-rpc.service.spec.ts
```

- [ ] **Correr todos los tests — deben pasar**

```
cd backend && npx jest src/integrations/odoo/ --no-coverage
```

- [ ] **Commit**

```
git add backend/src/integrations/odoo/
git commit -m "refactor(odoo-rpc): split en OdooSystemRpcService + OdooUserRpcService stateless"
```

---

## Task 4: OdooService — aceptar credenciales en métodos por usuario

**Files:**
- Modify: `backend/src/integrations/odoo/odoo.service.ts`

**Interfaces:**
- Consumes: `OdooSystemRpcService.callKw`, `OdooUserRpcService.callKw`, `OdooUserCredentials`
- Produces:
  - `closeTicket(ticketId, employeeId, unitAmount, creds: OdooUserCredentials): Promise<void>`
  - `markTicketInProgress(ticketId, creds: OdooUserCredentials): Promise<void>`
  - `logTimesheet(ticketId, employeeId, unitAmount, creds: OdooUserCredentials): Promise<void>` (private)
  - Todos los demás métodos sin cambios de firma

- [ ] **Actualizar constructor de OdooService**

En `backend/src/integrations/odoo/odoo.service.ts`, agregar la importación y cambiar el constructor:

```typescript
// Agregar a los imports:
import { OdooSystemRpcService } from './odoo-system-rpc.service';
import { OdooUserRpcService, OdooUserCredentials } from './odoo-user-rpc.service';
// Quitar: import { OdooRpcService } from './odoo-rpc.service';

// Cambiar el constructor — reemplazar `private readonly odooRpc: OdooRpcService` por:
constructor(
  private readonly systemRpc: OdooSystemRpcService,
  private readonly userRpc: OdooUserRpcService,
  private readonly configService: ConfigService,
  @InjectRepository(Client)
  private readonly clientRepo: Repository<Client>,
  @InjectRepository(User)
  private readonly userRepo: Repository<User>,
  @InjectRepository(Technician)
  private readonly technicianRepo: Repository<Technician>,
) {}
```

- [ ] **Sustituir todas las llamadas a `this.odooRpc` por `this.systemRpc`**

Hacer un search en el archivo por `this.odooRpc` y reemplazar por `this.systemRpc`. Afecta a: `resolveInProgressStageId`, `resolveDoneStageId`, `resolveQnapTagId`, `resolveWindowsAdDomainTagId`, `resolveWindowsServerTagId`, `resolveVirtualizationTagId`, `resolveServerManagementTagId`, `createTicket`, `resolvePartnerId`, `resolveUserId`, `resolveEmployeeId`, `resolveSaleLineId`.

- [ ] **Cambiar logTimesheet para usar userRpc**

```typescript
// Reemplazar el método logTimesheet (era private, sigue siendo private):
private async logTimesheet(
  odooTicketId: number,
  employeeId: number,
  unitAmount: number,
  creds: OdooUserCredentials,
): Promise<void> {
  await this.userRpc.callKw<number>(
    creds,
    'account.analytic.line',
    'create',
    [{
      helpdesk_ticket_id: odooTicketId,
      employee_id: employeeId,
      name: 'Mantenimiento realizado',
      unit_amount: unitAmount,
      date: new Date().toISOString().split('T')[0],
    }],
    {},
  );
}
```

- [ ] **Cambiar markTicketInProgress para usar userRpc**

```typescript
// Reemplazar el método markTicketInProgress:
async markTicketInProgress(odooTicketId: number, creds: OdooUserCredentials): Promise<void> {
  const stageId = await this.resolveInProgressStageId();
  await this.userRpc.callKw<boolean>(
    creds,
    'helpdesk.ticket',
    'write',
    [[odooTicketId], { stage_id: stageId }],
    {},
  );
}
```

- [ ] **Cambiar closeTicket para usar userRpc**

```typescript
// Reemplazar el método closeTicket:
async closeTicket(
  odooTicketId: number,
  employeeId: number,
  unitAmount: number,
  creds: OdooUserCredentials,
): Promise<void> {
  const stageId = await this.resolveDoneStageId();
  await this.logTimesheet(odooTicketId, employeeId, unitAmount, creds);
  await this.userRpc.callKw<boolean>(
    creds,
    'helpdesk.ticket',
    'write',
    [[odooTicketId], { stage_id: stageId }],
    {},
  );
}
```

- [ ] **Verificar que el backend compila**

```
cd backend && npx tsc --noEmit
```

- [ ] **Correr tests de Odoo**

```
cd backend && npx jest src/integrations/odoo/ --no-coverage
```

- [ ] **Commit**

```
git add backend/src/integrations/odoo/odoo.service.ts
git commit -m "refactor(odoo): closeTicket/markInProgress/logTimesheet usan OdooUserRpcService"
```

---

## Task 5: UsersModule — endpoints GET /me y PUT /me/odoo-credentials

**Files:**
- Create: `backend/src/users/dto/update-odoo-credentials.dto.ts`
- Create: `backend/src/users/dto/update-odoo-exempt.dto.ts`
- Create: `backend/src/users/dto/me-response.dto.ts`
- Create: `backend/src/users/users-me.controller.ts`
- Modify: `backend/src/users/users.service.ts`
- Modify: `backend/src/users/users.controller.ts`
- Modify: `backend/src/users/users.module.ts`

**Interfaces:**
- Consumes: `OdooUserRpcService.validateCredentials`, `encrypt` de crypto.util, `User` entity nuevos campos
- Produces:
  - `UsersService.getMe(userId: string): Promise<MeResponseDto>`
  - `UsersService.updateOdooCredentials(userId: string, dto: UpdateOdooCredentialsDto): Promise<void>`
  - `UsersService.updateOdooExempt(id, currentUserId, odooExempt): Promise<UserResponse>`
  - `GET /users/me` → `MeResponseDto`
  - `PUT /users/me/odoo-credentials` → `void`
  - `PATCH /users/:id/odoo-exempt` → `UserResponse` (solo ADMIN)

- [ ] **Crear DTOs**

```typescript
// backend/src/users/dto/update-odoo-credentials.dto.ts
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class UpdateOdooCredentialsDto {
  @IsEmail()
  odooApiEmail: string;

  @IsString()
  @IsNotEmpty()
  odooApiKey: string;
}
```

```typescript
// backend/src/users/dto/update-odoo-exempt.dto.ts
import { IsBoolean } from 'class-validator';

export class UpdateOdooExemptDto {
  @IsBoolean()
  odooExempt: boolean;
}
```

```typescript
// backend/src/users/dto/me-response.dto.ts
import { UserRole } from '../user-role.enum';

export class MeResponseDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  technicianId: string | null;
  odooKeyValid: boolean;
  odooKeyValidatedAt: Date | null;
  odooApiEmail: string | null;
  odooExempt: boolean;
}
```

- [ ] **Agregar métodos a UsersService**

En `backend/src/users/users.service.ts`, agregar los imports necesarios:

```typescript
import { ConfigService } from '@nestjs/config';
import { OdooUserRpcService } from '../integrations/odoo/odoo-user-rpc.service';
import { encrypt } from '../common/utils/crypto.util';
import { UpdateOdooCredentialsDto } from './dto/update-odoo-credentials.dto';
import { MeResponseDto } from './dto/me-response.dto';
```

Agregar al constructor:

```typescript
constructor(
  @InjectRepository(User)
  private readonly userRepository: Repository<User>,
  private readonly odooUserRpc: OdooUserRpcService,
  private readonly configService: ConfigService,
) {}
```

Agregar los tres métodos nuevos al final de la clase (antes del `private toResponse`):

```typescript
  async getMe(userId: string): Promise<MeResponseDto> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      technicianId: user.technicianId,
      odooKeyValid: user.odooKeyValid,
      odooKeyValidatedAt: user.odooKeyValidatedAt,
      odooApiEmail: user.odooApiEmail,
      odooExempt: user.odooExempt,
    };
  }

  async updateOdooCredentials(
    userId: string,
    dto: UpdateOdooCredentialsDto,
  ): Promise<void> {
    await this.odooUserRpc.validateCredentials(dto.odooApiEmail, dto.odooApiKey);

    const encryptKey = this.configService.getOrThrow<string>('ODOO_ENCRYPT_KEY');
    const odooApiKeyEnc = encrypt(dto.odooApiKey, encryptKey);

    await this.userRepository.update(userId, {
      odooApiEmail: dto.odooApiEmail,
      odooApiKeyEnc,
      odooKeyValid: true,
      odooKeyValidatedAt: new Date(),
    });
  }

  async updateOdooExempt(
    id: string,
    currentUserId: string,
    odooExempt: boolean,
  ): Promise<UserResponse> {
    if (id === currentUserId) throw new ForbiddenException('No podés editar tu propio usuario');
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    await this.userRepository.update(id, { odooExempt });
    return this.toResponse({ ...user, odooExempt });
  }
```

- [ ] **Crear UsersMeController**

```typescript
// backend/src/users/users-me.controller.ts
import { Body, Controller, Get, HttpCode, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.types';
import { UpdateOdooCredentialsDto } from './dto/update-odoo-credentials.dto';
import { MeResponseDto } from './dto/me-response.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersMeController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() currentUser: JwtPayload): Promise<MeResponseDto> {
    return this.usersService.getMe(currentUser.sub);
  }

  @Put('me/odoo-credentials')
  @HttpCode(200)
  updateOdooCredentials(
    @CurrentUser() currentUser: JwtPayload,
    @Body() dto: UpdateOdooCredentialsDto,
  ): Promise<void> {
    return this.usersService.updateOdooCredentials(currentUser.sub, dto);
  }
}
```

- [ ] **Agregar PATCH :id/odoo-exempt a UsersController**

En `backend/src/users/users.controller.ts`, agregar el import y el método:

```typescript
import { UpdateOdooExemptDto } from './dto/update-odoo-exempt.dto';

// Agregar dentro de la clase, al final:
  @Patch(':id/odoo-exempt')
  updateOdooExempt(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
    @Body() dto: UpdateOdooExemptDto,
  ): Promise<UserResponse> {
    return this.usersService.updateOdooExempt(id, currentUser.sub, dto.odooExempt);
  }
```

- [ ] **Actualizar UsersModule**

```typescript
// backend/src/users/users.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OdooUserRpcModule } from '../integrations/odoo/odoo-user-rpc.module';
import { User } from './user.entity';
import { UsersController } from './users.controller';
import { UsersMeController } from './users-me.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), ConfigModule, OdooUserRpcModule],
  controllers: [UsersController, UsersMeController],
  providers: [UsersService, JwtAuthGuard, RolesGuard],
  exports: [TypeOrmModule],
})
export class UsersModule {}
```

- [ ] **Verificar que compila**

```
cd backend && npx tsc --noEmit
```

- [ ] **Correr tests de users**

```
cd backend && npx jest src/users/ --no-coverage
```

- [ ] **Commit**

```
git add backend/src/users/
git commit -m "feat(users): GET /me, PUT /me/odoo-credentials, PATCH :id/odoo-exempt"
```

---

## Task 6: Auth — mustOdooSetup en login response

**Files:**
- Modify: `backend/src/auth/dto/login-response.dto.ts`
- Modify: `backend/src/auth/auth.service.ts`
- Modify: `backend/src/auth/auth.service.spec.ts`

**Interfaces:**
- Produces: `LoginResponseDto.mustOdooSetup: boolean` · `LoginResponseDto.user.odooKeyValid` · `LoginResponseDto.user.odooExempt`

- [ ] **Actualizar LoginResponseDto**

Reemplazar contenido de `backend/src/auth/dto/login-response.dto.ts`:

```typescript
import { UserRole } from '../../users/user-role.enum';

export class LoginResponseDto {
  accessToken: string;
  mustChangePassword: boolean;
  mustOdooSetup: boolean;
  user: {
    id: string;
    email: string;
    role: UserRole;
    technicianId: string | null;
    odooKeyValid: boolean;
    odooExempt: boolean;
  };
}
```

- [ ] **Actualizar AuthService.login**

En `backend/src/auth/auth.service.ts`, reemplazar el `return` de `login()`:

```typescript
    return {
      accessToken: this.jwtService.sign(payload),
      mustChangePassword: user.mustChangePassword,
      mustOdooSetup: !user.odooKeyValid && !user.odooExempt,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        technicianId: user.technicianId ?? null,
        odooKeyValid: user.odooKeyValid,
        odooExempt: user.odooExempt,
      },
    };
```

- [ ] **Actualizar auth.service.spec.ts**

En `backend/src/auth/auth.service.spec.ts`, buscar el test que verifica la respuesta de login y agregar las aserciones del nuevo campo. El usuario de prueba debe tener `odooKeyValid: false` y `odooExempt: false`, por lo que `mustOdooSetup` debe ser `true`. Agregar también un test donde `odooExempt: true` produce `mustOdooSetup: false`.

Localizar el `mockUser` en el spec y agregar:

```typescript
const mockUser = {
  id: 'user-uuid',
  email: 'test@test.com',
  passwordHash: await bcrypt.hash('password', 10),
  role: UserRole.TECHNICIAN,
  mustChangePassword: false,
  technicianId: null,
  lastLogoutAt: null,
  isActive: true,
  odooKeyValid: false,
  odooExempt: false,
  // ... resto de campos con null/false/defaults
};
```

Agregar tests:

```typescript
it('incluye mustOdooSetup=true cuando el usuario no tiene key y no es exento', async () => {
  // mockUser con odooKeyValid: false, odooExempt: false
  const result = await service.login({ email: 'test@test.com', password: 'password' });
  expect(result.mustOdooSetup).toBe(true);
});

it('incluye mustOdooSetup=false cuando el usuario es exento', async () => {
  // Override mockUser con odooExempt: true
  userRepo.findOne.mockResolvedValueOnce({ ...mockUser, odooExempt: true });
  const result = await service.login({ email: 'test@test.com', password: 'password' });
  expect(result.mustOdooSetup).toBe(false);
});

it('incluye mustOdooSetup=false cuando ya tiene key válida', async () => {
  userRepo.findOne.mockResolvedValueOnce({ ...mockUser, odooKeyValid: true });
  const result = await service.login({ email: 'test@test.com', password: 'password' });
  expect(result.mustOdooSetup).toBe(false);
});
```

- [ ] **Correr tests de auth**

```
cd backend && npx jest src/auth/ --no-coverage
```

- [ ] **Commit**

```
git add backend/src/auth/
git commit -m "feat(auth): mustOdooSetup en LoginResponseDto basado en odooKeyValid y odooExempt"
```

---

## Task 7: TasksService — cierre atómico con credenciales del técnico

**Files:**
- Modify: `backend/src/tasks/tasks.service.ts`

**Interfaces:**
- Consumes: `decrypt` de crypto.util, `OdooUserCredentials` de odoo-user-rpc.service, `ConfigService`, `OdooService.closeTicket(ticketId, employeeId, unitAmount, creds)`, `OdooService.markTicketInProgress(ticketId, creds)`

- [ ] **Agregar imports y ConfigService al constructor de TasksService**

En `backend/src/tasks/tasks.service.ts`, agregar imports:

```typescript
import { ConfigService } from '@nestjs/config';
import { decrypt } from '../common/utils/crypto.util';
import { OdooUserCredentials } from '../integrations/odoo/odoo-user-rpc.service';
```

Agregar `ConfigService` al constructor (al final de los argumentos existentes):

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
    private readonly configService: ConfigService,
  ) {}
```

- [ ] **Agregar método privado getOdooCredentials**

Al final de la clase TasksService (antes de `loadTask`):

```typescript
  private getOdooCredentials(task: Task): OdooUserCredentials {
    const user = task.technician?.user;
    if (!user?.odooKeyValid || !user.odooApiKeyEnc || !user.odooApiEmail) {
      throw new BadRequestException(
        'El técnico asignado no tiene credenciales Odoo configuradas',
      );
    }
    const encryptKey = this.configService.getOrThrow<string>('ODOO_ENCRYPT_KEY');
    return { email: user.odooApiEmail, apiKey: decrypt(user.odooApiKeyEnc, encryptKey) };
  }
```

- [ ] **Actualizar updateStatus — transición IN_PROGRESS**

Reemplazar el bloque que llama a `markTicketInProgress`:

```typescript
    if (newStatus === TaskStatus.IN_PROGRESS && task.odooTicketId !== null) {
      const creds = this.getOdooCredentials(task);
      await this.odooService.markTicketInProgress(task.odooTicketId, creds);
    }
```

- [ ] **Actualizar updateStatus — bloque shouldCloseTicket**

Reemplazar el bloque entero de cierre:

```typescript
    if (shouldCloseTicket) {
      const creds = this.getOdooCredentials(task);

      const userId = task.technician?.user?.id;
      if (!userId)
        throw new BadRequestException('La tarea no tiene técnico con usuario asociado');

      const employeeId = await this.odooService.resolveEmployeeId(userId);
      if (employeeId === null) {
        throw new BadRequestException('El técnico no tiene odooEmployeeId sincronizado');
      }

      if (newStatus === TaskStatus.DONE && !timeSpentMinutes) {
        throw new BadRequestException(
          'Se requiere timeSpentMinutes para marcar una tarea como DONE',
        );
      }
      const unitAmount = (timeSpentMinutes ?? 0) / 60;
      await this.odooService.closeTicket(
        task.odooTicketId!,
        employeeId,
        unitAmount,
        creds,
      );
    }
```

- [ ] **Verificar que compila**

```
cd backend && npx tsc --noEmit
```

- [ ] **Correr tests de tasks**

```
cd backend && npx jest src/tasks/ --no-coverage
```

Los tests existentes que mockean `odooService.closeTicket` y `markTicketInProgress` van a fallar porque las firmas cambiaron. Actualizar los mocks en `tasks.service.spec.ts` para que `closeTicket` acepte el cuarto argumento (o usar `jest.fn()` sin verificar args exactos). Agregar también los tests nuevos:

```typescript
it('lanza BadRequestException cuando el técnico no tiene credenciales configuradas', async () => {
  const taskWithoutKey = {
    ...mockTask,
    technician: { user: { odooKeyValid: false, odooApiKeyEnc: null, odooApiEmail: null } },
  };
  taskRepo.findOne.mockResolvedValue(taskWithoutKey);
  await expect(service.updateStatus('task-id', TaskStatus.IN_PROGRESS)).rejects.toThrow(BadRequestException);
});

it('no actualiza el status en DB si Odoo falla al cerrar', async () => {
  odooService.closeTicket.mockRejectedValue(new ServiceUnavailableException('Odoo down'));
  await expect(
    service.updateStatus('task-id', TaskStatus.DONE, 60)
  ).rejects.toThrow(ServiceUnavailableException);
  expect(taskRepo.update).not.toHaveBeenCalled();
});
```

- [ ] **Correr todos los tests backend**

```
cd backend && npx jest --no-coverage
```

Expected: todos pasan

- [ ] **Commit**

```
git add backend/src/tasks/
git commit -m "feat(tasks): cierre atómico — usa credenciales Odoo del técnico asignado"
```

---

## Task 8: Frontend — AuthService + AuthGuard + modelos

**Files:**
- Modify: `frontend/src/app/core/models/auth.models.ts`
- Modify: `frontend/src/app/core/services/auth.service.ts`
- Modify: `frontend/src/app/core/services/auth.service.spec.ts`
- Modify: `frontend/src/app/core/guards/auth.guard.ts`
- Modify: `frontend/src/app/core/guards/auth.guard.spec.ts`

**Interfaces:**
- Produces: `AuthService.mustOdooSetup(): boolean` · `AuthService.clearMustOdooSetup(): void` · `AuthGuard` redirige a `/login/odoo-setup`

- [ ] **Actualizar auth.models.ts**

Reemplazar contenido:

```typescript
// frontend/src/app/core/models/auth.models.ts
export type UserRole = 'ADMIN' | 'TL' | 'TECHNICIAN' | 'COORDINATOR';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  technicianId?: string | null;
  odooKeyValid: boolean;
  odooExempt: boolean;
}

export interface LoginResponse {
  accessToken: string;
  mustChangePassword: boolean;
  mustOdooSetup: boolean;
  user: AuthUser;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
  technicianId?: string | null;
  iat: number;
  exp: number;
}
```

- [ ] **Actualizar auth.service.ts**

Reemplazar contenido de `frontend/src/app/core/services/auth.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthUser, LoginResponse } from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY            = 'token';
  private readonly USER_KEY             = 'user';
  private readonly MUST_CHANGE_PASS_KEY = 'mustChangePassword';
  private readonly MUST_ODOO_SETUP_KEY  = 'mustOdooSetup';

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, { email, password })
      .pipe(
        tap(res => {
          localStorage.setItem(this.TOKEN_KEY, res.accessToken);
          localStorage.setItem(this.USER_KEY, JSON.stringify(res.user));
          localStorage.setItem(this.MUST_CHANGE_PASS_KEY, String(res.mustChangePassword));
          localStorage.setItem(this.MUST_ODOO_SETUP_KEY, String(res.mustOdooSetup));
        }),
      );
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.MUST_CHANGE_PASS_KEY);
    localStorage.removeItem(this.MUST_ODOO_SETUP_KEY);
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean { return !!this.getToken(); }

  mustChangePassword(): boolean {
    return localStorage.getItem(this.MUST_CHANGE_PASS_KEY) === 'true';
  }

  clearMustChangePassword(): void {
    localStorage.setItem(this.MUST_CHANGE_PASS_KEY, 'false');
  }

  mustOdooSetup(): boolean {
    return localStorage.getItem(this.MUST_ODOO_SETUP_KEY) === 'true';
  }

  clearMustOdooSetup(): void {
    localStorage.setItem(this.MUST_ODOO_SETUP_KEY, 'false');
  }

  getToken(): string | null { return localStorage.getItem(this.TOKEN_KEY); }

  getCurrentUser(): AuthUser | null {
    const raw = localStorage.getItem(this.USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/auth/change-password`, {
      currentPassword,
      newPassword,
    });
  }
}
```

- [ ] **Actualizar AuthGuard**

Reemplazar contenido de `frontend/src/app/core/guards/auth.guard.ts`:

```typescript
import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login']);
      return false;
    }
    if (this.auth.mustChangePassword()) {
      this.router.navigate(['/login/change-password']);
      return false;
    }
    if (this.auth.mustOdooSetup()) {
      this.router.navigate(['/login/odoo-setup']);
      return false;
    }
    return true;
  }
}
```

- [ ] **Actualizar auth.guard.spec.ts**

Reemplazar contenido:

```typescript
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AuthGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let auth: AuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule, HttpClientTestingModule],
      providers: [AuthGuard, AuthService],
    });
    guard  = TestBed.inject(AuthGuard);
    auth   = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    localStorage.clear();
  });

  afterEach(() => localStorage.clear());

  it('permite acceso cuando está autenticado y todo configurado', () => {
    spyOn(auth, 'isAuthenticated').and.returnValue(true);
    spyOn(auth, 'mustChangePassword').and.returnValue(false);
    spyOn(auth, 'mustOdooSetup').and.returnValue(false);
    expect(guard.canActivate()).toBeTrue();
  });

  it('redirige a /login cuando no está autenticado', () => {
    spyOn(auth, 'isAuthenticated').and.returnValue(false);
    const nav = spyOn(router, 'navigate');
    expect(guard.canActivate()).toBeFalse();
    expect(nav).toHaveBeenCalledWith(['/login']);
  });

  it('redirige a /login/change-password cuando mustChangePassword es true', () => {
    spyOn(auth, 'isAuthenticated').and.returnValue(true);
    spyOn(auth, 'mustChangePassword').and.returnValue(true);
    const nav = spyOn(router, 'navigate');
    expect(guard.canActivate()).toBeFalse();
    expect(nav).toHaveBeenCalledWith(['/login/change-password']);
  });

  it('redirige a /login/odoo-setup cuando mustOdooSetup es true', () => {
    spyOn(auth, 'isAuthenticated').and.returnValue(true);
    spyOn(auth, 'mustChangePassword').and.returnValue(false);
    spyOn(auth, 'mustOdooSetup').and.returnValue(true);
    const nav = spyOn(router, 'navigate');
    expect(guard.canActivate()).toBeFalse();
    expect(nav).toHaveBeenCalledWith(['/login/odoo-setup']);
  });
});
```

- [ ] **Correr tests de auth frontend**

```
cd frontend && npx ng test --include=src/app/core/guards/auth.guard.spec.ts --no-progress --watch=false
cd frontend && npx ng test --include=src/app/core/services/auth.service.spec.ts --no-progress --watch=false
```

- [ ] **Commit**

```
git add frontend/src/app/core/models/auth.models.ts frontend/src/app/core/services/auth.service.ts frontend/src/app/core/services/auth.service.spec.ts frontend/src/app/core/guards/
git commit -m "feat(auth-frontend): mustOdooSetup en AuthService + redirect en AuthGuard"
```

---

## Task 9: Frontend — ProfileService + OdooSetupComponent

**Files:**
- Create: `frontend/src/app/core/services/profile.service.ts`
- Create: `frontend/src/app/core/services/profile.service.spec.ts`
- Create: `frontend/src/app/features/auth/odoo-setup/odoo-setup.component.ts`
- Create: `frontend/src/app/features/auth/odoo-setup/odoo-setup.component.html`
- Create: `frontend/src/app/features/auth/odoo-setup/odoo-setup.component.scss`
- Create: `frontend/src/app/features/auth/odoo-setup/odoo-setup.component.spec.ts`
- Modify: `frontend/src/app/features/auth/auth.module.ts`

**Interfaces:**
- Consumes: `AuthService.getCurrentUser()`, `AuthService.clearMustOdooSetup()`
- Produces: `ProfileService.updateOdooCredentials(email, apiKey)` · `ProfileService.getMe()`

- [ ] **Crear ProfileService**

```typescript
// frontend/src/app/core/services/profile.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface MeResponse {
  id: string;
  name: string;
  email: string;
  role: string;
  technicianId: string | null;
  odooKeyValid: boolean;
  odooKeyValidatedAt: string | null;
  odooApiEmail: string | null;
  odooExempt: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  constructor(private http: HttpClient) {}

  getMe(): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${environment.apiUrl}/users/me`);
  }

  updateOdooCredentials(odooApiEmail: string, odooApiKey: string): Observable<void> {
    return this.http.put<void>(`${environment.apiUrl}/users/me/odoo-credentials`, {
      odooApiEmail,
      odooApiKey,
    });
  }
}
```

- [ ] **Crear profile.service.spec.ts**

```typescript
// frontend/src/app/core/services/profile.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ProfileService } from './profile.service';
import { environment } from '../../../environments/environment';

describe('ProfileService', () => {
  let service: ProfileService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(ProfileService);
    http    = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getMe hace GET /users/me', () => {
    const mockMe = { id: '1', name: 'Valen', email: 'v@ondra.com.ar', role: 'TECHNICIAN', technicianId: null, odooKeyValid: true, odooKeyValidatedAt: null, odooApiEmail: 'v@ondra.com.ar', odooExempt: false };
    service.getMe().subscribe(me => expect(me).toEqual(mockMe));
    const req = http.expectOne(`${environment.apiUrl}/users/me`);
    expect(req.request.method).toBe('GET');
    req.flush(mockMe);
  });

  it('updateOdooCredentials hace PUT /users/me/odoo-credentials con el body correcto', () => {
    service.updateOdooCredentials('v@ondra.com.ar', 'my-api-key').subscribe();
    const req = http.expectOne(`${environment.apiUrl}/users/me/odoo-credentials`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ odooApiEmail: 'v@ondra.com.ar', odooApiKey: 'my-api-key' });
    req.flush(null);
  });
});
```

- [ ] **Correr test de ProfileService**

```
cd frontend && npx ng test --include=src/app/core/services/profile.service.spec.ts --no-progress --watch=false
```

- [ ] **Crear OdooSetupComponent**

```typescript
// frontend/src/app/features/auth/odoo-setup/odoo-setup.component.ts
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ProfileService } from '../../../core/services/profile.service';

@Component({
  selector: 'app-odoo-setup',
  templateUrl: './odoo-setup.component.html',
  styleUrls: ['./odoo-setup.component.scss'],
})
export class OdooSetupComponent {
  form: FormGroup;
  loading      = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private profileService: ProfileService,
    private auth: AuthService,
    private router: Router,
  ) {
    const currentUser = this.auth.getCurrentUser();
    this.form = this.fb.group({
      odooApiEmail: [currentUser?.email ?? '', [Validators.required, Validators.email]],
      odooApiKey:   ['', Validators.required],
    });
  }

  submit(): void {
    if (this.form.invalid) return;
    this.loading      = true;
    this.errorMessage = '';

    const { odooApiEmail, odooApiKey } = this.form.value;
    this.profileService.updateOdooCredentials(odooApiEmail, odooApiKey).subscribe({
      next: () => {
        this.auth.clearMustOdooSetup();
        this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading      = false;
        this.errorMessage = err.error?.message ?? 'Credenciales inválidas. Verificá tu API key de Odoo.';
      },
    });
  }

  logout(): void { this.auth.logout(); }
}
```

```html
<!-- frontend/src/app/features/auth/odoo-setup/odoo-setup.component.html -->
<div class="setup-container">
  <div class="setup-card">
    <div class="step-dots">
      <span class="dot done"></span>
      <span class="dot active"></span>
      <span class="dot pending"></span>
    </div>

    <div class="badge">Paso requerido</div>
    <h1>Conectá tu cuenta de Odoo</h1>
    <p class="subtitle">
      InfraOps registra el tiempo en Odoo bajo tu nombre en cada ticket.
      Sin esta configuración no podés acceder a los módulos de tarea.
    </p>

    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Email de Odoo</mat-label>
        <input matInput formControlName="odooApiEmail" type="email" autocomplete="email" />
        <mat-hint>Usualmente el mismo que tu usuario de InfraOps</mat-hint>
      </mat-form-field>

      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>API Key de Odoo</mat-label>
        <input matInput formControlName="odooApiKey" type="password" autocomplete="off" />
        <mat-hint>Settings → Cuenta → API Keys en tu Odoo</mat-hint>
      </mat-form-field>

      <div *ngIf="errorMessage" class="error-message">{{ errorMessage }}</div>

      <button
        mat-flat-button
        color="primary"
        type="submit"
        [disabled]="form.invalid || loading"
        class="submit-btn">
        <mat-spinner *ngIf="loading" diameter="16" class="btn-spinner"></mat-spinner>
        <span *ngIf="!loading">Validar y continuar →</span>
      </button>
    </form>

    <button (click)="logout()" class="logout-link" type="button">Cerrar sesión</button>
  </div>
</div>
```

```scss
/* frontend/src/app/features/auth/odoo-setup/odoo-setup.component.scss */
.setup-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  padding: 24px;
}

.setup-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 40px 44px;
  width: 100%;
  max-width: 440px;
}

.step-dots {
  display: flex;
  gap: 6px;
  margin-bottom: 24px;

  .dot {
    height: 6px;
    border-radius: 3px;
    background: var(--border);
    width: 6px;
    &.active  { background: var(--accent); width: 18px; }
    &.done    { background: var(--ok); }
  }
}

.badge {
  display: inline-block;
  background: var(--warn-bg);
  border: 1px solid var(--warn);
  color: var(--warn);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 4px;
  margin-bottom: 16px;
}

h1 { font-size: 20px; font-weight: 600; color: var(--tx); margin: 0 0 8px; }
.subtitle { font-size: 13px; color: var(--tx-lo); line-height: 1.6; margin: 0 0 24px; }

form { display: flex; flex-direction: column; gap: 16px; }

.error-message {
  font-size: 12px;
  color: var(--crit);
  background: var(--crit-bg);
  border: 1px solid var(--crit);
  border-radius: 6px;
  padding: 10px 12px;
}

.submit-btn {
  margin-top: 8px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-spinner { display: inline-block; }

.logout-link {
  display: block;
  text-align: center;
  margin-top: 14px;
  font-size: 11px;
  color: var(--tx-lo);
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
}
```

- [ ] **Crear odoo-setup.component.spec.ts**

```typescript
// frontend/src/app/features/auth/odoo-setup/odoo-setup.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { of, throwError } from 'rxjs';

import { OdooSetupComponent } from './odoo-setup.component';
import { AuthService } from '../../../core/services/auth.service';
import { ProfileService } from '../../../core/services/profile.service';

describe('OdooSetupComponent', () => {
  let component: OdooSetupComponent;
  let fixture: ComponentFixture<OdooSetupComponent>;
  let authService: jasmine.SpyObj<AuthService>;
  let profileService: jasmine.SpyObj<ProfileService>;
  let router: Router;

  beforeEach(async () => {
    authService    = jasmine.createSpyObj('AuthService', ['getCurrentUser', 'clearMustOdooSetup', 'logout']);
    profileService = jasmine.createSpyObj('ProfileService', ['updateOdooCredentials']);
    authService.getCurrentUser.and.returnValue({ id: '1', email: 'v@ondra.com.ar', role: 'TECHNICIAN', odooKeyValid: false, odooExempt: false });

    await TestBed.configureTestingModule({
      declarations: [OdooSetupComponent],
      imports: [ReactiveFormsModule, RouterTestingModule, HttpClientTestingModule, NoopAnimationsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatProgressSpinnerModule],
      providers: [
        { provide: AuthService,    useValue: authService },
        { provide: ProfileService, useValue: profileService },
      ],
    }).compileComponents();

    fixture   = TestBed.createComponent(OdooSetupComponent);
    component = fixture.componentInstance;
    router    = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('pre-carga el email del usuario actual', () => {
    expect(component.form.get('odooApiEmail')?.value).toBe('v@ondra.com.ar');
  });

  it('no envía si el formulario es inválido', () => {
    component.form.get('odooApiKey')?.setValue('');
    component.submit();
    expect(profileService.updateOdooCredentials).not.toHaveBeenCalled();
  });

  it('en submit exitoso limpia el flag y navega a /dashboard', () => {
    profileService.updateOdooCredentials.and.returnValue(of(undefined));
    const navigateSpy = spyOn(router, 'navigate');
    component.form.setValue({ odooApiEmail: 'v@ondra.com.ar', odooApiKey: 'my-key' });
    component.submit();
    expect(authService.clearMustOdooSetup).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard']);
  });

  it('en error muestra el mensaje y no navega', () => {
    profileService.updateOdooCredentials.and.returnValue(
      throwError(() => ({ error: { message: 'Credenciales Odoo inválidas' } }))
    );
    component.form.setValue({ odooApiEmail: 'v@ondra.com.ar', odooApiKey: 'bad-key' });
    component.submit();
    expect(component.errorMessage).toBe('Credenciales Odoo inválidas');
  });

  it('logout llama a auth.logout()', () => {
    component.logout();
    expect(authService.logout).toHaveBeenCalled();
  });
});
```

- [ ] **Actualizar auth.module.ts**

```typescript
// frontend/src/app/features/auth/auth.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { LoginComponent } from './login/login.component';
import { ChangePasswordComponent } from './change-password/change-password.component';
import { OdooSetupComponent } from './odoo-setup/odoo-setup.component';

const routes: Routes = [
  { path: '',               component: LoginComponent },
  { path: 'change-password', component: ChangePasswordComponent },
  { path: 'odoo-setup',     component: OdooSetupComponent },
];

@NgModule({
  declarations: [LoginComponent, ChangePasswordComponent, OdooSetupComponent],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
})
export class AuthModule {}
```

- [ ] **Correr tests del componente**

```
cd frontend && npx ng test --include=src/app/features/auth/odoo-setup/odoo-setup.component.spec.ts --no-progress --watch=false
```

- [ ] **Commit**

```
git add frontend/src/app/core/services/profile.service.ts frontend/src/app/core/services/profile.service.spec.ts frontend/src/app/features/auth/odoo-setup/ frontend/src/app/features/auth/auth.module.ts
git commit -m "feat(frontend): ProfileService + OdooSetupComponent (onboarding obligatorio Odoo)"
```

---

## Task 10: Frontend — ProfileComponent + shell nav + routing

**Files:**
- Create: `frontend/src/app/features/profile/profile.component.ts`
- Create: `frontend/src/app/features/profile/profile.component.html`
- Create: `frontend/src/app/features/profile/profile.component.scss`
- Create: `frontend/src/app/features/profile/profile.component.spec.ts`
- Create: `frontend/src/app/features/profile/profile.module.ts`
- Modify: `frontend/src/app/core/shell/shell.component.ts`
- Modify: `frontend/src/app/app-routing.module.ts`

**Interfaces:**
- Consumes: `ProfileService.getMe()`, `ProfileService.updateOdooCredentials()`, `AuthService.clearMustOdooSetup()`

- [ ] **Crear ProfileComponent TypeScript**

```typescript
// frontend/src/app/features/profile/profile.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../core/services/auth.service';
import { MeResponse, ProfileService } from '../../core/services/profile.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit {
  me: MeResponse | null = null;
  editForm: FormGroup | null = null;
  editing   = false;
  saving    = false;
  saveError = '';

  constructor(
    private profileService: ProfileService,
    private auth: AuthService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.profileService.getMe().subscribe(me => (this.me = me));
  }

  startEdit(): void {
    this.editing   = true;
    this.saveError = '';
    this.editForm  = this.fb.group({
      odooApiEmail: [this.me?.odooApiEmail ?? this.me?.email ?? '', [Validators.required, Validators.email]],
      odooApiKey:   ['', Validators.required],
    });
  }

  cancelEdit(): void {
    this.editing  = false;
    this.editForm = null;
  }

  saveCredentials(): void {
    if (!this.editForm || this.editForm.invalid) return;
    this.saving    = true;
    this.saveError = '';
    const { odooApiEmail, odooApiKey } = this.editForm.value;
    this.profileService.updateOdooCredentials(odooApiEmail, odooApiKey).subscribe({
      next: () => {
        this.saving  = false;
        this.editing = false;
        this.auth.clearMustOdooSetup();
        this.profileService.getMe().subscribe(me => (this.me = me));
        this.snackBar.open('Credenciales actualizadas correctamente', '', { duration: 3000 });
      },
      error: (err) => {
        this.saving    = false;
        this.saveError = err.error?.message ?? 'Credenciales inválidas. Verificá tu API key.';
      },
    });
  }
}
```

- [ ] **Crear ProfileComponent template**

```html
<!-- frontend/src/app/features/profile/profile.component.html -->
<div class="profile-page" *ngIf="me">
  <div class="page-header">
    <h2>Mi perfil</h2>
    <p class="subtitle">Configuración de tu cuenta y credenciales de integración</p>
  </div>

  <!-- Cuenta InfraOps -->
  <div class="profile-section">
    <div class="section-header">
      <span class="section-title">Cuenta InfraOps</span>
    </div>
    <div class="section-body">
      <div class="kv-row"><span class="kv-label">Nombre</span><span class="kv-value">{{ me.name }}</span></div>
      <div class="kv-row"><span class="kv-label">Email</span><span class="kv-value">{{ me.email }}</span></div>
      <div class="kv-row"><span class="kv-label">Rol</span><span class="kv-value">{{ me.role }}</span></div>
    </div>
  </div>

  <!-- Integración Odoo — estado activo -->
  <div class="profile-section" *ngIf="me.odooKeyValid && !editing">
    <div class="section-header">
      <span class="section-title">Integración Odoo</span>
      <span class="status-chip ok">Activa</span>
    </div>
    <div class="section-body">
      <div class="kv-row">
        <span class="kv-label">Email Odoo</span>
        <span class="kv-value">{{ me.odooApiEmail }}</span>
      </div>
      <div class="kv-row">
        <span class="kv-label">API Key</span>
        <span class="kv-value mono">••••••••••••••••<span *ngIf="me.odooApiEmail">{{ me.odooApiEmail.slice(-4) }}</span></span>
      </div>
      <div class="validated-at" *ngIf="me.odooKeyValidatedAt">
        Última validación: {{ me.odooKeyValidatedAt | localDate }}
      </div>
      <div class="section-actions">
        <button mat-flat-button color="primary" (click)="startEdit()">Actualizar credenciales</button>
      </div>
    </div>
  </div>

  <!-- Integración Odoo — sin configurar -->
  <div class="profile-section" *ngIf="!me.odooKeyValid && !editing">
    <div class="section-header">
      <span class="section-title">Integración Odoo</span>
      <span class="status-chip crit">Sin configurar</span>
    </div>
    <div class="section-body">
      <p class="empty-msg">Sin credenciales Odoo no podés acceder a los módulos de tarea.</p>
      <button mat-flat-button color="primary" (click)="startEdit()">Configurar ahora →</button>
    </div>
  </div>

  <!-- Formulario de edición -->
  <div class="profile-section" *ngIf="editing && editForm">
    <div class="section-header">
      <span class="section-title">Actualizar credenciales Odoo</span>
    </div>
    <div class="section-body">
      <form [formGroup]="editForm" (ngSubmit)="saveCredentials()" class="edit-form">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Email de Odoo</mat-label>
          <input matInput formControlName="odooApiEmail" type="email" />
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Nueva API Key</mat-label>
          <input matInput formControlName="odooApiKey" type="password" />
        </mat-form-field>

        <div *ngIf="saveError" class="error-message">{{ saveError }}</div>

        <div class="form-actions">
          <button mat-flat-button color="primary" type="submit" [disabled]="editForm.invalid || saving">
            {{ saving ? 'Validando...' : 'Guardar' }}
          </button>
          <button mat-stroked-button type="button" (click)="cancelEdit()">Cancelar</button>
        </div>
      </form>
    </div>
  </div>
</div>
```

- [ ] **Crear ProfileComponent SCSS**

```scss
/* frontend/src/app/features/profile/profile.component.scss */
.profile-page { max-width: 640px; }

.page-header {
  margin-bottom: 24px;
  h2 { font-size: 18px; font-weight: 600; color: var(--tx); margin: 0 0 4px; }
  .subtitle { font-size: 12px; color: var(--tx-lo); margin: 0; }
}

.profile-section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 16px;
  overflow: hidden;
}

.section-header {
  padding: 12px 18px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--tx);
}

.section-body { padding: 18px; }

.kv-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
  &:last-child { margin-bottom: 0; }
}
.kv-label { width: 110px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--tx-lo); flex-shrink: 0; }
.kv-value { font-size: 13px; color: var(--tx); }
.kv-value.mono { font-family: var(--font-mono); color: var(--accent); }

.status-chip {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 4px;
  &.ok   { background: var(--ok-bg);   color: var(--ok);   border: 1px solid var(--ok); }
  &.crit { background: var(--crit-bg); color: var(--crit); border: 1px solid var(--crit); }
}

.validated-at { font-size: 11px; color: var(--tx-lo); margin: 12px 0 0; }

.section-actions { margin-top: 16px; }

.empty-msg { font-size: 12px; color: var(--tx-lo); margin: 0 0 14px; }

.edit-form { display: flex; flex-direction: column; gap: 14px; }

.error-message {
  font-size: 12px;
  color: var(--crit);
  background: var(--crit-bg);
  border: 1px solid var(--crit);
  border-radius: 6px;
  padding: 10px 12px;
}

.form-actions { display: flex; gap: 8px; }
```

- [ ] **Crear ProfileComponent spec**

```typescript
// frontend/src/app/features/profile/profile.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';

import { ProfileComponent } from './profile.component';
import { ProfileService, MeResponse } from '../../core/services/profile.service';
import { AuthService } from '../../core/services/auth.service';
import { SharedModule } from '../../shared/shared.module';

const mockMe: MeResponse = {
  id: '1', name: 'Valen', email: 'v@ondra.com.ar', role: 'TECHNICIAN',
  technicianId: null, odooKeyValid: true, odooKeyValidatedAt: '2026-07-10T09:42:00Z',
  odooApiEmail: 'v@ondra.com.ar', odooExempt: false,
};

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;
  let profileService: jasmine.SpyObj<ProfileService>;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    profileService = jasmine.createSpyObj('ProfileService', ['getMe', 'updateOdooCredentials']);
    authService    = jasmine.createSpyObj('AuthService', ['clearMustOdooSetup']);
    profileService.getMe.and.returnValue(of(mockMe));

    await TestBed.configureTestingModule({
      declarations: [ProfileComponent],
      imports: [ReactiveFormsModule, HttpClientTestingModule, NoopAnimationsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatSnackBarModule, SharedModule],
      providers: [
        { provide: ProfileService, useValue: profileService },
        { provide: AuthService,    useValue: authService },
      ],
    }).compileComponents();

    fixture   = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carga el perfil al inicializar', () => {
    expect(component.me).toEqual(mockMe);
  });

  it('startEdit crea el formulario pre-cargando el email de Odoo', () => {
    component.startEdit();
    expect(component.editForm?.get('odooApiEmail')?.value).toBe('v@ondra.com.ar');
  });

  it('saveCredentials exitoso recarga el perfil y muestra snackbar', () => {
    profileService.updateOdooCredentials.and.returnValue(of(undefined));
    profileService.getMe.and.returnValue(of({ ...mockMe, odooKeyValidatedAt: '2026-07-10T10:00:00Z' }));
    component.startEdit();
    component.editForm?.setValue({ odooApiEmail: 'v@ondra.com.ar', odooApiKey: 'new-key' });
    component.saveCredentials();
    expect(component.editing).toBeFalse();
    expect(authService.clearMustOdooSetup).toHaveBeenCalled();
  });

  it('saveCredentials con error muestra el mensaje de error', () => {
    profileService.updateOdooCredentials.and.returnValue(
      throwError(() => ({ error: { message: 'Credenciales Odoo inválidas' } }))
    );
    component.startEdit();
    component.editForm?.setValue({ odooApiEmail: 'v@ondra.com.ar', odooApiKey: 'bad' });
    component.saveCredentials();
    expect(component.saveError).toBe('Credenciales Odoo inválidas');
  });
});
```

- [ ] **Crear ProfileModule**

```typescript
// frontend/src/app/features/profile/profile.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { SharedModule } from '../../shared/shared.module';

import { ProfileComponent } from './profile.component';

const routes: Routes = [{ path: '', component: ProfileComponent }];

@NgModule({
  declarations: [ProfileComponent],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSnackBarModule,
    SharedModule,
  ],
})
export class ProfileModule {}
```

- [ ] **Actualizar AppRoutingModule**

En `frontend/src/app/app-routing.module.ts`, agregar dentro de `children` del shell (antes del redirect):

```typescript
      {
        path: 'profile',
        loadChildren: () =>
          import('./features/profile/profile.module').then(m => m.ProfileModule),
      },
```

- [ ] **Actualizar ShellComponent**

En `frontend/src/app/core/shell/shell.component.ts`, cambiar la interfaz `NavItem` y el array `navItems`:

```typescript
interface NavItem {
  route: string;
  label: string;
  icon: 'dashboard' | 'clients' | 'tasks' | 'notifications' | 'admin' | 'profile';
}

// En el array navItems, agregar al final (antes de admin o después según orden deseado):
{ route: '/profile', label: 'Mi perfil', icon: 'profile' },
```

- [ ] **Correr tests del ProfileComponent**

```
cd frontend && npx ng test --include=src/app/features/profile/profile.component.spec.ts --no-progress --watch=false
```

- [ ] **Correr todos los tests frontend**

```
cd frontend && npx ng test --no-progress --watch=false
```

Expected: todos pasan

- [ ] **Commit**

```
git add frontend/src/app/features/profile/ frontend/src/app/core/shell/shell.component.ts frontend/src/app/app-routing.module.ts
git commit -m "feat(frontend): ProfileComponent con gestión de credenciales Odoo + nav en shell"
```

---

## Verificación final

- [ ] **Agregar ODOO_ENCRYPT_KEY al .env**

```
# .env (y .env.example)
ODOO_ENCRYPT_KEY=<64 chars hex — generado con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
```

- [ ] **Correr todos los tests backend**

```
cd backend && npx jest --no-coverage
```

- [ ] **Correr todos los tests frontend**

```
cd frontend && npx ng test --no-progress --watch=false
```

- [ ] **Verificar compilación TypeScript backend**

```
cd backend && npx tsc --noEmit
```

- [ ] **Commit final (si hay cambios del .env.example)**

```
git add .env.example
git commit -m "chore: agregar ODOO_ENCRYPT_KEY a .env.example"
```
