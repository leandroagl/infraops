# Odoo Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar OdooIntegrationModule en NestJS que sincroniza IDs de partners y usuarios entre Odoo y la DB de InfraOps, exponiendo tres endpoints ADMIN y cuatro métodos de servicio consumibles por otros módulos.

**Architecture:** `OdooRpcService` encapsula toda la comunicación HTTP/JSON-RPC con Odoo (auth + llamadas genéricas). `OdooService` orquesta la lógica de negocio (sync + resolve) usando los repositorios de Client, User y Technician. `OdooController` expone los tres endpoints ADMIN. El módulo se importa en AppModule y exporta OdooService para que TasksModule lo consuma.

**Tech Stack:** NestJS · `@nestjs/axios` HttpModule · ConfigService · TypeORM Repository · Jest con mocks de HttpService

---

## File Map

| Acción | Archivo |
|---|---|
| Modify | `backend/src/clients/client.entity.ts` |
| Modify | `backend/src/technicians/technician.entity.ts` |
| Modify | `backend/src/clients/clients.service.spec.ts` (helper `makeLocal`) |
| Modify | `backend/src/app.module.ts` |
| Create | `backend/src/integrations/odoo/dto/odoo-sync-result.dto.ts` |
| Create | `backend/src/integrations/odoo/dto/odoo-partner.dto.ts` |
| Create | `backend/src/integrations/odoo/dto/odoo-user.dto.ts` |
| Create | `backend/src/integrations/odoo/dto/odoo-sync-status.dto.ts` |
| Create | `backend/src/integrations/odoo/odoo-rpc.service.ts` |
| Create | `backend/src/integrations/odoo/odoo-rpc.service.spec.ts` |
| Create | `backend/src/integrations/odoo/odoo.service.ts` |
| Create | `backend/src/integrations/odoo/odoo.service.spec.ts` |
| Create | `backend/src/integrations/odoo/odoo.controller.ts` |
| Create | `backend/src/integrations/odoo/odoo.controller.spec.ts` |
| Create | `backend/src/integrations/odoo/odoo-integration.module.ts` |

---

## Task 1: Agregar campos Odoo a Client entity

**Files:**
- Modify: `backend/src/clients/client.entity.ts`
- Modify: `backend/src/clients/clients.service.spec.ts`

- [ ] **Step 1: Agregar columnas en Client entity**

Reemplazar el bloque de columnas en `client.entity.ts` — agregar justo antes de `@Column({ default: true }) isActive`:

```typescript
  @Column({ type: 'int', nullable: true, default: null })
  odooPartnerId: number | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  odooSyncedAt: Date | null;
```

El archivo completo quedará:

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  infradocId: number;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  abbreviation: string | null;

  @Column({ type: 'varchar', nullable: true })
  type: string | null;

  @Column({ type: 'varchar', nullable: true })
  website: string | null;

  @Column({ type: 'varchar', nullable: true })
  referral: string | null;

  @Column({
    type: 'numeric',
    nullable: true,
    transformer: {
      to: (v: number | null) => v,
      from: (v: string | null) => (v !== null ? parseFloat(v) : null),
    },
  })
  rate: number | null;

  @Column({ type: 'varchar', nullable: true })
  currencyCode: string | null;

  @Column({ type: 'int', nullable: true })
  netTerms: number | null;

  @Column({ type: 'varchar', nullable: true })
  taxIdNumber: string | null;

  @Column({ default: false })
  isLead: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  primaryAddress: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'int', nullable: true, default: null })
  odooPartnerId: number | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  odooSyncedAt: Date | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  lastSyncedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
```

- [ ] **Step 2: Actualizar helper makeLocal en clients.service.spec.ts**

El helper `makeLocal` en `clients.service.spec.ts` construye objetos `Client` completos. Agregar los dos campos nuevos con valor `null`:

```typescript
  const makeLocal = (override: Partial<Client> = {}): Client => ({
    id: 'uuid-1',
    infradocId: 1,
    name: 'ACME Corp',
    abbreviation: 'ACME',
    type: 'Empresa',
    website: 'acme.com',
    referral: null,
    rate: null,
    currencyCode: null,
    netTerms: null,
    taxIdNumber: null,
    isLead: false,
    primaryAddress: null,
    notes: null,
    odooPartnerId: null,   // <-- agregar
    odooSyncedAt: null,    // <-- agregar
    isActive: true,
    lastSyncedAt: null,
    createdAt: new Date('2026-01-01'),
    ...override,
  });
```

- [ ] **Step 3: Correr tests existentes para verificar que no se rompió nada**

```bash
cd backend && npx jest clients.service.spec.ts --no-coverage
```

Esperado: todos los tests en verde.

- [ ] **Step 4: Commit**

```bash
git add backend/src/clients/client.entity.ts backend/src/clients/clients.service.spec.ts
git commit -m "feat(clients): agregar odooPartnerId y odooSyncedAt a entidad Client"
```

---

## Task 2: Agregar campos Odoo a Technician entity

**Files:**
- Modify: `backend/src/technicians/technician.entity.ts`

- [ ] **Step 1: Agregar columnas en Technician entity**

El archivo completo quedará:

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('technicians')
export class Technician {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (user) => user.technician)
  user: User;

  @Column({ type: 'int', nullable: true, default: null })
  odooUserId: number | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  odooSyncedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
```

- [ ] **Step 2: Correr todos los tests del proyecto para verificar**

```bash
cd backend && npx jest --no-coverage
```

Esperado: todos en verde (los tests de technicians no usan los campos nuevos explícitamente).

- [ ] **Step 3: Commit**

```bash
git add backend/src/technicians/technician.entity.ts
git commit -m "feat(technicians): agregar odooUserId y odooSyncedAt a entidad Technician"
```

---

## Task 3: Crear DTOs del módulo Odoo

**Files:**
- Create: `backend/src/integrations/odoo/dto/odoo-sync-result.dto.ts`
- Create: `backend/src/integrations/odoo/dto/odoo-partner.dto.ts`
- Create: `backend/src/integrations/odoo/dto/odoo-user.dto.ts`
- Create: `backend/src/integrations/odoo/dto/odoo-sync-status.dto.ts`

Estos son tipos puros — no requieren tests propios.

- [ ] **Step 1: Crear odoo-sync-result.dto.ts**

```typescript
export interface OdooSyncResult {
  matched: number;
  unmatched: string[];
  total: number;
}
```

- [ ] **Step 2: Crear odoo-partner.dto.ts**

```typescript
export interface OdooPartner {
  id: number;
  name: string | false;
  vat: string | false;
}
```

- [ ] **Step 3: Crear odoo-user.dto.ts**

```typescript
export interface OdooUser {
  id: number;
  login: string | false;
  name: string | false;
}
```

- [ ] **Step 4: Crear odoo-sync-status.dto.ts**

```typescript
export interface OdooSyncStatusDto {
  clientsWithoutOdooId: number;
  techniciansWithoutOdooId: number;
}
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/integrations/odoo/dto/
git commit -m "feat(odoo): agregar DTOs de sincronización Odoo"
```

---

## Task 4: OdooRpcService (TDD)

**Files:**
- Create: `backend/src/integrations/odoo/odoo-rpc.service.spec.ts`
- Create: `backend/src/integrations/odoo/odoo-rpc.service.ts`

`OdooRpcService` es el cliente HTTP para Odoo JSON-RPC. Gestiona la autenticación (cachea uid en memoria) y expone un método genérico `callKw` para llamadas a modelos de Odoo.

- [ ] **Step 1: Escribir el test failing**

```typescript
// backend/src/integrations/odoo/odoo-rpc.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { AxiosHeaders, AxiosResponse } from 'axios';
import { of } from 'rxjs';
import { OdooRpcService } from './odoo-rpc.service';

describe('OdooRpcService', () => {
  let service: OdooRpcService;
  let httpService: { post: jest.Mock };
  let configService: { getOrThrow: jest.Mock };

  const axiosRes = (data: object): AxiosResponse => ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

  beforeEach(async () => {
    httpService = { post: jest.fn() };
    configService = {
      getOrThrow: jest.fn((key: string) => {
        const cfg: Record<string, string> = {
          ODOO_URL: 'http://odoo.test',
          ODOO_DB: 'testdb',
          ODOO_USERNAME: 'admin',
          ODOO_API_KEY: 'test-key',
        };
        if (!(key in cfg)) throw new Error(`Missing config: ${key}`);
        return cfg[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OdooRpcService,
        { provide: HttpService, useValue: httpService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<OdooRpcService>(OdooRpcService);
  });

  describe('authenticate', () => {
    it('POST al endpoint de autenticación con credenciales y devuelve uid', async () => {
      httpService.post.mockReturnValue(of(axiosRes({ result: 7 })));

      const uid = await service.authenticate();

      expect(uid).toBe(7);
      expect(httpService.post).toHaveBeenCalledWith(
        'http://odoo.test/web/dataset/call_kw',
        expect.objectContaining({
          jsonrpc: '2.0',
          method: 'call',
          params: expect.objectContaining({
            model: 'res.users',
            method: 'authenticate',
            args: ['testdb', 'admin', 'test-key', {}],
            kwargs: {},
          }),
        }),
      );
    });

    it('lanza ServiceUnavailableException cuando la respuesta devuelve result false', async () => {
      httpService.post.mockReturnValue(of(axiosRes({ result: false })));

      await expect(service.authenticate()).rejects.toThrow(ServiceUnavailableException);
    });

    it('lanza ServiceUnavailableException cuando la respuesta tiene error', async () => {
      httpService.post.mockReturnValue(
        of(axiosRes({ error: { message: 'Access Denied' } })),
      );

      await expect(service.authenticate()).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('callKw', () => {
    it('autentica antes de la primera llamada y devuelve result', async () => {
      httpService.post
        .mockReturnValueOnce(of(axiosRes({ result: 7 })))
        .mockReturnValueOnce(of(axiosRes({ result: [{ id: 1, name: 'ACME' }] })));

      const result = await service.callKw<{ id: number; name: string }[]>(
        'res.partner',
        'search_read',
        [[['is_company', '=', true]]],
        { fields: ['id', 'name'] },
      );

      expect(httpService.post).toHaveBeenCalledTimes(2);
      expect(result).toEqual([{ id: 1, name: 'ACME' }]);
    });

    it('reutiliza el uid cacheado sin re-autenticar en llamadas subsiguientes', async () => {
      httpService.post
        .mockReturnValueOnce(of(axiosRes({ result: 7 })))
        .mockReturnValue(of(axiosRes({ result: [] })));

      await service.callKw('res.partner', 'search_read', [[]], {});
      await service.callKw('res.partner', 'search_read', [[]], {});

      // 1 auth + 2 data calls
      expect(httpService.post).toHaveBeenCalledTimes(3);
    });

    it('lanza ServiceUnavailableException cuando la respuesta tiene campo error', async () => {
      httpService.post
        .mockReturnValueOnce(of(axiosRes({ result: 7 })))
        .mockReturnValueOnce(of(axiosRes({ error: { message: 'Model not found' } })));

      await expect(
        service.callKw('res.partner', 'search_read', [[]], {}),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('POST al endpoint con model, method, args, kwargs y uid en el body', async () => {
      httpService.post
        .mockReturnValueOnce(of(axiosRes({ result: 7 })))
        .mockReturnValueOnce(of(axiosRes({ result: [] })));

      await service.callKw(
        'res.partner',
        'search_read',
        [[['is_company', '=', true]]],
        { fields: ['id', 'vat'] },
      );

      const dataCall = httpService.post.mock.calls[1];
      expect(dataCall[0]).toBe('http://odoo.test/web/dataset/call_kw');
      expect(dataCall[1].params.model).toBe('res.partner');
      expect(dataCall[1].params.method).toBe('search_read');
      expect(dataCall[1].params.kwargs.uid).toBe(7);
      expect(dataCall[1].params.kwargs.password).toBe('test-key');
      expect(dataCall[1].params.kwargs.db).toBe('testdb');
    });
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
cd backend && npx jest odoo-rpc.service.spec.ts --no-coverage
```

Esperado: FAIL — "Cannot find module './odoo-rpc.service'"

- [ ] **Step 3: Implementar OdooRpcService**

```typescript
// backend/src/integrations/odoo/odoo-rpc.service.ts
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OdooRpcService {
  private uid: number | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async authenticate(): Promise<number> {
    const url = this.configService.getOrThrow<string>('ODOO_URL');
    const db = this.configService.getOrThrow<string>('ODOO_DB');
    const username = this.configService.getOrThrow<string>('ODOO_USERNAME');
    const apiKey = this.configService.getOrThrow<string>('ODOO_API_KEY');

    const response = await firstValueFrom(
      this.httpService.post(`${url}/web/dataset/call_kw`, {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'res.users',
          method: 'authenticate',
          args: [db, username, apiKey, {}],
          kwargs: {},
        },
      }),
    );

    if (response.data.error || !response.data.result) {
      throw new ServiceUnavailableException(
        `Odoo authentication failed: ${response.data.error?.message ?? 'uid no recibido'}`,
      );
    }

    this.uid = response.data.result as number;
    return this.uid;
  }

  async callKw<T>(
    model: string,
    method: string,
    args: unknown[],
    kwargs: Record<string, unknown>,
  ): Promise<T> {
    if (!this.uid) {
      this.uid = await this.authenticate();
    }

    const url = this.configService.getOrThrow<string>('ODOO_URL');
    const db = this.configService.getOrThrow<string>('ODOO_DB');
    const apiKey = this.configService.getOrThrow<string>('ODOO_API_KEY');

    const response = await firstValueFrom(
      this.httpService.post(`${url}/web/dataset/call_kw`, {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model,
          method,
          args,
          kwargs: { ...kwargs, uid: this.uid, password: apiKey, db },
        },
      }),
    );

    if (response.data.error) {
      throw new ServiceUnavailableException(
        `Odoo RPC error en ${model}.${method}: ${response.data.error.message ?? 'desconocido'}`,
      );
    }

    return response.data.result as T;
  }
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

```bash
cd backend && npx jest odoo-rpc.service.spec.ts --no-coverage
```

Esperado: todos los tests en verde.

- [ ] **Step 5: Commit**

```bash
git add backend/src/integrations/odoo/odoo-rpc.service.ts backend/src/integrations/odoo/odoo-rpc.service.spec.ts
git commit -m "feat(odoo): implementar OdooRpcService con autenticación y callKw"
```

---

## Task 5: OdooService — syncPartners y syncUsers (TDD)

**Files:**
- Create: `backend/src/integrations/odoo/odoo.service.spec.ts` (parte 1)
- Create: `backend/src/integrations/odoo/odoo.service.ts` (parte 1)

- [ ] **Step 1: Escribir tests failing para syncPartners y syncUsers**

```typescript
// backend/src/integrations/odoo/odoo.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Client } from '../../clients/client.entity';
import { User } from '../../users/user.entity';
import { Technician } from '../../technicians/technician.entity';
import { OdooRpcService } from './odoo-rpc.service';
import { OdooService } from './odoo.service';
import { OdooPartner } from './dto/odoo-partner.dto';
import { OdooUser } from './dto/odoo-user.dto';

describe('OdooService', () => {
  let service: OdooService;
  let odooRpc: { callKw: jest.Mock };
  let clientRepo: { find: jest.Mock; findOne: jest.Mock; update: jest.Mock; count: jest.Mock };
  let userRepo: { find: jest.Mock };
  let technicianRepo: { update: jest.Mock; findOne: jest.Mock; count: jest.Mock };

  const makeClient = (override: Partial<Client> = {}): Client =>
    ({
      id: 'client-uuid-1',
      infradocId: 1,
      name: 'ACME Corp',
      taxIdNumber: '20-12345678-0',
      odooPartnerId: null,
      odooSyncedAt: null,
      isActive: true,
      ...override,
    }) as Client;

  const makeOdooPartner = (override: Partial<OdooPartner> = {}): OdooPartner => ({
    id: 101,
    name: 'ACME Corp',
    vat: '20-12345678-0',
    ...override,
  });

  const makeUser = (override: Partial<User> = {}): User =>
    ({
      id: 'user-uuid-1',
      email: 'tecnico@ondra.com',
      technicianId: 'tech-uuid-1',
      isActive: true,
      ...override,
    }) as User;

  const makeOdooUser = (override: Partial<OdooUser> = {}): OdooUser => ({
    id: 201,
    login: 'tecnico@ondra.com',
    name: 'Técnico Demo',
    ...override,
  });

  beforeEach(async () => {
    odooRpc = { callKw: jest.fn() };
    clientRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      count: jest.fn(),
    };
    userRepo = { find: jest.fn() };
    technicianRepo = {
      update: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
      count: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OdooService,
        { provide: OdooRpcService, useValue: odooRpc },
        { provide: getRepositoryToken(Client), useValue: clientRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Technician), useValue: technicianRepo },
      ],
    }).compile();

    service = module.get<OdooService>(OdooService);
  });

  describe('syncPartners', () => {
    it('actualiza odooPartnerId cuando CUIT coincide con un cliente de InfraOps', async () => {
      clientRepo.find.mockResolvedValue([makeClient()]);
      odooRpc.callKw.mockResolvedValue([makeOdooPartner()]);

      const result = await service.syncPartners();

      expect(clientRepo.update).toHaveBeenCalledWith(
        'client-uuid-1',
        expect.objectContaining({ odooPartnerId: 101, odooSyncedAt: expect.any(Date) }),
      );
      expect(result.matched).toBe(1);
      expect(result.unmatched).toEqual([]);
      expect(result.total).toBe(1);
    });

    it('registra en unmatched el nombre del partner que no matchea ningún cliente', async () => {
      clientRepo.find.mockResolvedValue([]);
      odooRpc.callKw.mockResolvedValue([makeOdooPartner()]);

      const result = await service.syncPartners();

      expect(clientRepo.update).not.toHaveBeenCalled();
      expect(result.matched).toBe(0);
      expect(result.unmatched).toEqual(['ACME Corp']);
      expect(result.total).toBe(1);
    });

    it('consulta Odoo con filtros is_company=true y vat!=false', async () => {
      clientRepo.find.mockResolvedValue([]);
      odooRpc.callKw.mockResolvedValue([]);

      await service.syncPartners();

      expect(odooRpc.callKw).toHaveBeenCalledWith(
        'res.partner',
        'search_read',
        expect.arrayContaining([
          expect.arrayContaining([
            ['is_company', '=', true],
            ['vat', '!=', false],
          ]),
        ]),
        expect.objectContaining({ fields: expect.arrayContaining(['id', 'name', 'vat']) }),
      );
    });

    it('maneja correctamente vat false de Odoo sin crashear', async () => {
      clientRepo.find.mockResolvedValue([makeClient()]);
      odooRpc.callKw.mockResolvedValue([makeOdooPartner({ vat: false })]);

      const result = await service.syncPartners();

      expect(clientRepo.update).not.toHaveBeenCalled();
      expect(result.matched).toBe(0);
      expect(result.total).toBe(1);
    });

    it('no falla cuando Odoo no responde — propaga error descriptivo', async () => {
      clientRepo.find.mockResolvedValue([]);
      odooRpc.callKw.mockRejectedValue(new Error('Connection refused'));

      await expect(service.syncPartners()).rejects.toThrow('Connection refused');
    });
  });

  describe('syncUsers', () => {
    it('actualiza odooUserId del técnico cuando email coincide', async () => {
      userRepo.find.mockResolvedValue([makeUser()]);
      odooRpc.callKw.mockResolvedValue([makeOdooUser()]);

      const result = await service.syncUsers();

      expect(technicianRepo.update).toHaveBeenCalledWith(
        'tech-uuid-1',
        expect.objectContaining({ odooUserId: 201, odooSyncedAt: expect.any(Date) }),
      );
      expect(result.matched).toBe(1);
      expect(result.unmatched).toEqual([]);
      expect(result.total).toBe(1);
    });

    it('registra en unmatched el login del usuario de Odoo que no matchea ningún técnico', async () => {
      userRepo.find.mockResolvedValue([]);
      odooRpc.callKw.mockResolvedValue([makeOdooUser()]);

      const result = await service.syncUsers();

      expect(technicianRepo.update).not.toHaveBeenCalled();
      expect(result.matched).toBe(0);
      expect(result.unmatched).toEqual(['tecnico@ondra.com']);
      expect(result.total).toBe(1);
    });

    it('consulta solo usuarios con technicianId para construir el mapa de email', async () => {
      userRepo.find.mockResolvedValue([makeUser()]);
      odooRpc.callKw.mockResolvedValue([]);

      await service.syncUsers();

      expect(userRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ technicianId: expect.anything() }),
        }),
      );
    });

    it('ignora usuarios de Odoo con login false', async () => {
      userRepo.find.mockResolvedValue([makeUser()]);
      odooRpc.callKw.mockResolvedValue([makeOdooUser({ login: false })]);

      const result = await service.syncUsers();

      expect(technicianRepo.update).not.toHaveBeenCalled();
      expect(result.matched).toBe(0);
    });
  });
});
```

- [ ] **Step 2: Correr tests para verificar que fallan**

```bash
cd backend && npx jest odoo.service.spec.ts --no-coverage
```

Esperado: FAIL — "Cannot find module './odoo.service'"

- [ ] **Step 3: Implementar OdooService (syncPartners + syncUsers)**

```typescript
// backend/src/integrations/odoo/odoo.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, IsNull, Repository } from 'typeorm';
import { Client } from '../../clients/client.entity';
import { User } from '../../users/user.entity';
import { Technician } from '../../technicians/technician.entity';
import { OdooRpcService } from './odoo-rpc.service';
import { OdooPartner } from './dto/odoo-partner.dto';
import { OdooUser } from './dto/odoo-user.dto';
import { OdooSyncResult } from './dto/odoo-sync-result.dto';
import { OdooSyncStatusDto } from './dto/odoo-sync-status.dto';

@Injectable()
export class OdooService {
  constructor(
    private readonly odooRpc: OdooRpcService,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Technician)
    private readonly technicianRepo: Repository<Technician>,
  ) {}

  async syncPartners(): Promise<OdooSyncResult> {
    const [odooPartners, localClients] = await Promise.all([
      this.odooRpc.callKw<OdooPartner[]>(
        'res.partner',
        'search_read',
        [[['is_company', '=', true], ['vat', '!=', false]]],
        { fields: ['id', 'name', 'vat'] },
      ),
      this.clientRepo.find(),
    ]);

    const clientByCuit = new Map(
      localClients
        .filter((c) => c.taxIdNumber)
        .map((c) => [c.taxIdNumber!, c]),
    );

    let matched = 0;
    const unmatched: string[] = [];

    for (const partner of odooPartners) {
      if (!partner.vat) {
        unmatched.push(typeof partner.name === 'string' ? partner.name : `id:${partner.id}`);
        continue;
      }
      const client = clientByCuit.get(partner.vat as string);
      if (client) {
        await this.clientRepo.update(client.id, {
          odooPartnerId: partner.id,
          odooSyncedAt: new Date(),
        });
        matched++;
      } else {
        unmatched.push(typeof partner.name === 'string' ? partner.name : partner.vat as string);
      }
    }

    return { matched, unmatched, total: odooPartners.length };
  }

  async syncUsers(): Promise<OdooSyncResult> {
    const [odooUsers, localUsers] = await Promise.all([
      this.odooRpc.callKw<OdooUser[]>(
        'res.users',
        'search_read',
        [[['active', '=', true]]],
        { fields: ['id', 'login', 'name'] },
      ),
      this.userRepo.find({ where: { technicianId: Not(IsNull()) } }),
    ]);

    const userByEmail = new Map(localUsers.map((u) => [u.email, u]));

    let matched = 0;
    const unmatched: string[] = [];

    for (const odooUser of odooUsers) {
      if (!odooUser.login) continue;
      const login = odooUser.login as string;
      const user = userByEmail.get(login);
      if (user && user.technicianId) {
        await this.technicianRepo.update(user.technicianId, {
          odooUserId: odooUser.id,
          odooSyncedAt: new Date(),
        });
        matched++;
      } else {
        unmatched.push(login);
      }
    }

    return { matched, unmatched, total: odooUsers.length };
  }

  async getSyncStatus(): Promise<OdooSyncStatusDto> {
    const [clientsWithoutOdooId, techniciansWithoutOdooId] = await Promise.all([
      this.clientRepo.count({ where: { odooPartnerId: IsNull() } }),
      this.technicianRepo.count({ where: { odooUserId: IsNull() } }),
    ]);
    return { clientsWithoutOdooId, techniciansWithoutOdooId };
  }

  async resolvePartnerId(clientId: string): Promise<number | null> {
    const client = await this.clientRepo.findOne({ where: { id: clientId } });
    if (!client) return null;
    if (client.odooPartnerId !== null) return client.odooPartnerId;
    if (!client.taxIdNumber) return null;

    const partners = await this.odooRpc.callKw<OdooPartner[]>(
      'res.partner',
      'search_read',
      [[['vat', '=', client.taxIdNumber], ['is_company', '=', true]]],
      { fields: ['id', 'vat'], limit: 1 },
    );

    if (partners.length === 0) return null;

    await this.clientRepo.update(clientId, {
      odooPartnerId: partners[0].id,
      odooSyncedAt: new Date(),
    });
    return partners[0].id;
  }

  async resolveUserId(technicianId: string): Promise<number | null> {
    const technician = await this.technicianRepo.findOne({ where: { id: technicianId } });
    if (!technician) return null;
    if (technician.odooUserId !== null) return technician.odooUserId;

    const user = await this.userRepo.findOne({ where: { technicianId } });
    if (!user) return null;

    const odooUsers = await this.odooRpc.callKw<OdooUser[]>(
      'res.users',
      'search_read',
      [[['login', '=', user.email]]],
      { fields: ['id', 'login'], limit: 1 },
    );

    if (odooUsers.length === 0) return null;

    await this.technicianRepo.update(technicianId, {
      odooUserId: odooUsers[0].id,
      odooSyncedAt: new Date(),
    });
    return odooUsers[0].id;
  }
}
```

- [ ] **Step 4: Correr tests de syncPartners y syncUsers**

```bash
cd backend && npx jest odoo.service.spec.ts --no-coverage
```

Esperado: todos en verde.

- [ ] **Step 5: Commit**

```bash
git add backend/src/integrations/odoo/odoo.service.ts backend/src/integrations/odoo/odoo.service.spec.ts
git commit -m "feat(odoo): implementar OdooService con syncPartners y syncUsers"
```

---

## Task 6: OdooService — resolvePartnerId y resolveUserId (TDD)

**Files:**
- Modify: `backend/src/integrations/odoo/odoo.service.spec.ts` (agregar describe blocks)

Los métodos ya están implementados en Task 5. Aquí se agregan los tests para cubrirlos.

- [ ] **Step 1: Agregar tests de resolvePartnerId al spec existente**

Agregar dentro del `describe('OdooService', ...)` existente:

```typescript
  describe('resolvePartnerId', () => {
    it('devuelve odooPartnerId existente sin llamar a Odoo', async () => {
      clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: 101 }));

      const result = await service.resolvePartnerId('client-uuid-1');

      expect(result).toBe(101);
      expect(odooRpc.callKw).not.toHaveBeenCalled();
    });

    it('intenta sync puntual cuando odooPartnerId es null y retorna el id encontrado', async () => {
      clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: null, taxIdNumber: '20-12345678-0' }));
      odooRpc.callKw.mockResolvedValue([{ id: 101, vat: '20-12345678-0' }]);

      const result = await service.resolvePartnerId('client-uuid-1');

      expect(result).toBe(101);
      expect(clientRepo.update).toHaveBeenCalledWith(
        'client-uuid-1',
        expect.objectContaining({ odooPartnerId: 101 }),
      );
    });

    it('devuelve null cuando el cliente no existe', async () => {
      clientRepo.findOne.mockResolvedValue(null);

      const result = await service.resolvePartnerId('uuid-no-existe');

      expect(result).toBeNull();
    });

    it('devuelve null cuando el cliente no tiene CUIT', async () => {
      clientRepo.findOne.mockResolvedValue(makeClient({ taxIdNumber: null }));

      const result = await service.resolvePartnerId('client-uuid-1');

      expect(result).toBeNull();
      expect(odooRpc.callKw).not.toHaveBeenCalled();
    });

    it('devuelve null cuando Odoo no encuentra el partner por CUIT', async () => {
      clientRepo.findOne.mockResolvedValue(makeClient({ taxIdNumber: '20-12345678-0' }));
      odooRpc.callKw.mockResolvedValue([]);

      const result = await service.resolvePartnerId('client-uuid-1');

      expect(result).toBeNull();
      expect(clientRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('resolveUserId', () => {
    it('devuelve odooUserId existente sin llamar a Odoo', async () => {
      technicianRepo.findOne.mockResolvedValue({ id: 'tech-uuid-1', odooUserId: 201, odooSyncedAt: new Date() });

      const result = await service.resolveUserId('tech-uuid-1');

      expect(result).toBe(201);
      expect(odooRpc.callKw).not.toHaveBeenCalled();
    });

    it('intenta sync puntual por email cuando odooUserId es null y retorna el id encontrado', async () => {
      technicianRepo.findOne.mockResolvedValue({ id: 'tech-uuid-1', odooUserId: null });
      userRepo.find = jest.fn(); // no usado en esta path — se usa findOne
      const userFindOneMock = jest.fn().mockResolvedValue(makeUser());
      userRepo['findOne'] = userFindOneMock;
      odooRpc.callKw.mockResolvedValue([{ id: 201, login: 'tecnico@ondra.com' }]);

      const result = await service.resolveUserId('tech-uuid-1');

      expect(result).toBe(201);
      expect(technicianRepo.update).toHaveBeenCalledWith(
        'tech-uuid-1',
        expect.objectContaining({ odooUserId: 201 }),
      );
    });

    it('devuelve null cuando el técnico no existe', async () => {
      technicianRepo.findOne.mockResolvedValue(null);

      const result = await service.resolveUserId('uuid-no-existe');

      expect(result).toBeNull();
    });

    it('devuelve null cuando Odoo no encuentra usuario por email', async () => {
      technicianRepo.findOne.mockResolvedValue({ id: 'tech-uuid-1', odooUserId: null });
      userRepo['findOne'] = jest.fn().mockResolvedValue(makeUser());
      odooRpc.callKw.mockResolvedValue([]);

      const result = await service.resolveUserId('tech-uuid-1');

      expect(result).toBeNull();
      expect(technicianRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('getSyncStatus', () => {
    it('devuelve conteo de clientes y técnicos sin odoo id', async () => {
      clientRepo.count.mockResolvedValue(5);
      technicianRepo.count.mockResolvedValue(2);

      const result = await service.getSyncStatus();

      expect(result).toEqual({ clientsWithoutOdooId: 5, techniciansWithoutOdooId: 2 });
    });
  });
```

**Nota:** el `userRepo` del spec tiene `find` y `findOne` como jest.Mock separados. Para el path de `resolveUserId` se usa `userRepo.findOne`. El `beforeEach` ya define `userRepo = { find: jest.fn() }` — agregar `findOne: jest.fn()` al objeto en el `beforeEach`:

```typescript
    userRepo = { find: jest.fn(), findOne: jest.fn() };
```

- [ ] **Step 2: Correr tests**

```bash
cd backend && npx jest odoo.service.spec.ts --no-coverage
```

Esperado: todos en verde.

- [ ] **Step 3: Commit**

```bash
git add backend/src/integrations/odoo/odoo.service.spec.ts
git commit -m "test(odoo): agregar tests de resolvePartnerId, resolveUserId y getSyncStatus"
```

---

## Task 7: OdooController (TDD)

**Files:**
- Create: `backend/src/integrations/odoo/odoo.controller.spec.ts`
- Create: `backend/src/integrations/odoo/odoo.controller.ts`

- [ ] **Step 1: Escribir tests failing para el controller**

```typescript
// backend/src/integrations/odoo/odoo.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OdooController } from './odoo.controller';
import { OdooService } from './odoo.service';
import { OdooSyncResult } from './dto/odoo-sync-result.dto';
import { OdooSyncStatusDto } from './dto/odoo-sync-status.dto';

describe('OdooController', () => {
  let controller: OdooController;
  let odooService: {
    syncPartners: jest.Mock;
    syncUsers: jest.Mock;
    getSyncStatus: jest.Mock;
  };

  const mockSyncResult: OdooSyncResult = { matched: 10, unmatched: ['Sin CUIT'], total: 11 };
  const mockStatus: OdooSyncStatusDto = { clientsWithoutOdooId: 3, techniciansWithoutOdooId: 1 };

  beforeEach(async () => {
    odooService = {
      syncPartners: jest.fn().mockResolvedValue(mockSyncResult),
      syncUsers: jest.fn().mockResolvedValue(mockSyncResult),
      getSyncStatus: jest.fn().mockResolvedValue(mockStatus),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OdooController],
      providers: [
        { provide: OdooService, useValue: odooService },
        Reflector,
      ],
    }).compile();

    controller = module.get<OdooController>(OdooController);
  });

  describe('syncPartners', () => {
    it('llama a odooService.syncPartners y devuelve el resultado', async () => {
      const result = await controller.syncPartners();

      expect(odooService.syncPartners).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockSyncResult);
    });
  });

  describe('syncUsers', () => {
    it('llama a odooService.syncUsers y devuelve el resultado', async () => {
      const result = await controller.syncUsers();

      expect(odooService.syncUsers).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockSyncResult);
    });
  });

  describe('getSyncStatus', () => {
    it('llama a odooService.getSyncStatus y devuelve conteos', async () => {
      const result = await controller.getSyncStatus();

      expect(odooService.getSyncStatus).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockStatus);
    });
  });

  describe('guards', () => {
    it('tiene @UseGuards aplicado a nivel de clase', () => {
      const guards = Reflect.getMetadata('__guards__', OdooController);
      expect(guards).toBeDefined();
      expect(guards.length).toBeGreaterThan(0);
    });

    it('POST /sync/partners requiere rol ADMIN', () => {
      const roles = Reflect.getMetadata('roles', controller.syncPartners);
      expect(roles).toContain('ADMIN');
    });

    it('POST /sync/users requiere rol ADMIN', () => {
      const roles = Reflect.getMetadata('roles', controller.syncUsers);
      expect(roles).toContain('ADMIN');
    });

    it('GET /sync/status requiere rol ADMIN', () => {
      const roles = Reflect.getMetadata('roles', controller.getSyncStatus);
      expect(roles).toContain('ADMIN');
    });
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
cd backend && npx jest odoo.controller.spec.ts --no-coverage
```

Esperado: FAIL — "Cannot find module './odoo.controller'"

- [ ] **Step 3: Implementar OdooController**

```typescript
// backend/src/integrations/odoo/odoo.controller.ts
import { Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/user-role.enum';
import { OdooService } from './odoo.service';
import { OdooSyncResult } from './dto/odoo-sync-result.dto';
import { OdooSyncStatusDto } from './dto/odoo-sync-status.dto';

@Controller('admin/odoo')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class OdooController {
  constructor(private readonly odooService: OdooService) {}

  @Post('sync/partners')
  @HttpCode(200)
  syncPartners(): Promise<OdooSyncResult> {
    return this.odooService.syncPartners();
  }

  @Post('sync/users')
  @HttpCode(200)
  syncUsers(): Promise<OdooSyncResult> {
    return this.odooService.syncUsers();
  }

  @Get('sync/status')
  getSyncStatus(): Promise<OdooSyncStatusDto> {
    return this.odooService.getSyncStatus();
  }
}
```

- [ ] **Step 4: Correr tests del controller**

```bash
cd backend && npx jest odoo.controller.spec.ts --no-coverage
```

Esperado: todos en verde.

- [ ] **Step 5: Commit**

```bash
git add backend/src/integrations/odoo/odoo.controller.ts backend/src/integrations/odoo/odoo.controller.spec.ts
git commit -m "feat(odoo): implementar OdooController con endpoints de sync y status"
```

---

## Task 8: OdooIntegrationModule + registro en AppModule

**Files:**
- Create: `backend/src/integrations/odoo/odoo-integration.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Crear OdooIntegrationModule**

```typescript
// backend/src/integrations/odoo/odoo-integration.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ClientsModule } from '../../clients/clients.module';
import { TechniciansModule } from '../../technicians/technicians.module';
import { UsersModule } from '../../users/users.module';
import { OdooRpcService } from './odoo-rpc.service';
import { OdooService } from './odoo.service';
import { OdooController } from './odoo.controller';

@Module({
  imports: [
    HttpModule,
    ClientsModule,
    TechniciansModule,
    UsersModule,
  ],
  controllers: [OdooController],
  providers: [OdooRpcService, OdooService],
  exports: [OdooService],
})
export class OdooIntegrationModule {}
```

- [ ] **Step 2: Registrar OdooIntegrationModule en AppModule**

En `backend/src/app.module.ts`, agregar el import:

```typescript
import { OdooIntegrationModule } from './integrations/odoo/odoo-integration.module';
```

Y agregar `OdooIntegrationModule` al array `imports`:

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({ ... }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    ClientsModule,
    TechniciansModule,
    TasksModule,
    MaintenanceLogsModule,
    InfradocIntegrationModule,
    OdooIntegrationModule,  // <-- agregar
  ],
})
export class AppModule {}
```

- [ ] **Step 3: Correr todos los tests del proyecto**

```bash
cd backend && npx jest --no-coverage
```

Esperado: todos los tests en verde.

- [ ] **Step 4: Verificar que el servidor arranca sin errores**

```bash
cd backend && npx ts-node -r tsconfig-paths/register src/main.ts
```

Esperado: `Application is running on: http://[::1]:3000` sin errores de módulo o TypeORM.
Detener con Ctrl+C.

- [ ] **Step 5: Commit final**

```bash
git add backend/src/integrations/odoo/ backend/src/app.module.ts
git commit -m "feat(odoo): OdooIntegrationModule completo — sync partners/users + resolve IDs"
```

---

## Self-Review

### Spec coverage

| Requisito del spec | Task que lo implementa |
|---|---|
| `syncPartners()` — match por CUIT, actualiza DB, retorna SyncResult | Task 5 |
| `syncUsers()` — match por email, actualiza Technician, retorna SyncResult | Task 5 |
| `resolvePartnerId(clientId)` — devuelve id o intenta sync puntual | Task 6 |
| `resolveUserId(technicianId)` — devuelve id o intenta sync puntual | Task 6 |
| `POST /admin/odoo/sync/partners` — solo ADMIN | Task 7 |
| `POST /admin/odoo/sync/users` — solo ADMIN | Task 7 |
| `GET /admin/odoo/sync/status` — conteo de nulos | Task 7 |
| Config desde ConfigService (ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY) | Task 4 |
| `odoo_partner_id` + `odoo_synced_at` en Client | Task 1 |
| `odoo_user_id` + `odoo_synced_at` en Technician | Task 2 |
| Odoo devuelve `false` — manejar sin crashear | Task 5 (syncPartners + syncUsers) |
| HttpModule de @nestjs/axios | Task 8 |
| Módulo exporta OdooService para consumo externo | Task 8 |
| TDD — tests antes de implementación | Todas las tasks de servicio y controller |

### Gaps: ninguno detectado.

### Placeholder scan: ninguno — todo el código es completo y concreto.

### Type consistency
- `OdooSyncResult` definido en Task 3, usado en Task 5 (service) y Task 7 (controller) — consistente.
- `OdooPartner.vat: string | false` — accedido con guard `!partner.vat` — correcto.
- `Technician.odooUserId` definido en Task 2, actualizado en `technicianRepo.update` — consistente.
- `Client.odooPartnerId` definido en Task 1, actualizado en `clientRepo.update` — consistente.
- `resolvePartnerId(clientId: string)` — usa string UUID, consistente con el resto del proyecto.
