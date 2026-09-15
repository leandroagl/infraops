# ONDRA Internal Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Excluir `srv1-cloud.ondravirtual.com.ar` (y cualquier host ONDRA configurable) del mantenimiento de VMware de clientes, y generarlo como tarea interna de ONDRA.

**Architecture:** Se agrega `isInternal: boolean` a la entidad `Client` para representar a ONDRA como un cliente interno sin `infradocId`. Se agrega `ondraOwnedHosts: string[]` a `TaskTypeConfig` del tipo `SERVER_HOST_MAINTENANCE` para que el admin configure qué hosts son de ONDRA. `InfrastructureService` filtra esos hosts del inventario de clientes reales y, para el cliente ONDRA, los retorna como stubs de `InfraAssetDto`.

**Tech Stack:** NestJS · TypeORM · PostgreSQL · Angular · Angular Material (MatChipsModule)

**Spec:** conversación con el usuario 2026-09-08, branch `feature/ondra-internal-client`

## Global Constraints

- Sin standalone components en Angular
- Angular Material obligatorio para todo elemento interactivo; `appearance="outline"` en todos los `mat-form-field`
- TDD obligatorio: test antes que implementación
- Un archivo a la vez con confirmación entre cada uno
- Sin `::ng-deep`; coloring semántico via CSS custom properties
- Idioma del código: inglés; commits y docs: español

---

## File Map

**Backend — crear:**
- `backend/src/migrations/1788800000000-AddIsInternalToClients.ts`
- `backend/src/migrations/1788900000000-AddOndraOwnedHostsToTaskConfig.ts`
- `backend/src/migrations/1789000000000-SeedOndraInternalClient.ts`

**Backend — modificar:**
- `backend/src/clients/client.entity.ts` — agregar `isInternal`, hacer `infradocId` nullable
- `backend/src/clients/clients.service.ts` — agregar `findClientMeta()`, guardar internal en sync
- `backend/src/task-config/task-type-config.entity.ts` — agregar `ondraOwnedHosts`
- `backend/src/task-config/dto/update-task-config.dto.ts` — agregar `ondraOwnedHosts?`
- `backend/src/task-config/task-config.service.ts` — actualizar `upsert()` y `defaultConfig()`
- `backend/src/integrations/infradoc/infrastructure.service.ts` — lógica de filtro + path interno
- `backend/src/integrations/infradoc/infradoc-integration.module.ts` — importar `TaskConfigModule`

**Frontend — modificar:**
- `frontend/src/app/core/models/task.models.ts` — agregar `ondraOwnedHosts` a DTOs
- `frontend/src/app/features/admin/task-config/task-edit-dialog/task-edit-dialog.component.ts` — lógica de chips
- `frontend/src/app/features/admin/task-config/task-edit-dialog/task-edit-dialog.component.html` — campo chips condicional
- `frontend/src/app/features/admin/admin.module.ts` — agregar `MatChipsModule`

---

## Task 1: Client entity — isInternal + nullable infradocId

**Files:**
- Create: `backend/src/migrations/1788800000000-AddIsInternalToClients.ts`
- Modify: `backend/src/clients/client.entity.ts`
- Test: `backend/src/clients/clients.service.spec.ts` (existente)

**Interfaces:**
- Produces: `Client.isInternal: boolean`, `Client.infradocId: number | null`; método `ClientsService.findClientMeta(id): Promise<{ isInternal: boolean; infradocId: number | null } | null>`

- [ ] **Step 1: Escribir test para findClientMeta**

En `backend/src/clients/clients.service.spec.ts`, agregar describe block:

```typescript
describe('findClientMeta', () => {
  it('returns null when client not found', async () => {
    jest.spyOn(repo, 'findOne').mockResolvedValue(null);
    const result = await service.findClientMeta('non-existent-id');
    expect(result).toBeNull();
  });

  it('returns isInternal and infradocId for a regular client', async () => {
    const mockClient = { id: 'abc', isInternal: false, infradocId: 42 } as any;
    jest.spyOn(repo, 'findOne').mockResolvedValue(mockClient);
    const result = await service.findClientMeta('abc');
    expect(result).toEqual({ isInternal: false, infradocId: 42 });
  });

  it('returns isInternal=true and infradocId=null for internal client', async () => {
    const mockClient = { id: 'ondra', isInternal: true, infradocId: null } as any;
    jest.spyOn(repo, 'findOne').mockResolvedValue(mockClient);
    const result = await service.findClientMeta('ondra');
    expect(result).toEqual({ isInternal: true, infradocId: null });
  });
});
```

- [ ] **Step 2: Escribir test para que syncWithInfradoc omita clientes internos en archivado**

```typescript
it('should not archive internal clients during sync', async () => {
  const ondraClient = { id: 'ondra-id', isInternal: true, infradocId: null, isActive: true } as any;
  jest.spyOn(repo, 'find').mockResolvedValue([ondraClient]);
  jest.spyOn(infradocService, 'getClients').mockResolvedValue([]);
  jest.spyOn(infradocService, 'getLocations').mockResolvedValue([]);
  const updateSpy = jest.spyOn(repo, 'update').mockResolvedValue({} as any);

  await service.syncWithInfradoc(true);

  expect(updateSpy).not.toHaveBeenCalledWith(
    'ondra-id',
    expect.objectContaining({ isActive: false }),
  );
});
```

- [ ] **Step 3: Correr tests — verificar que fallan**

```bash
cd backend && npx jest clients.service.spec --no-coverage 2>&1 | tail -20
```

Esperado: fallan por `findClientMeta` no existe e `isInternal` no existe en la entidad.

- [ ] **Step 4: Crear la migración**

Crear `backend/src/migrations/1788800000000-AddIsInternalToClients.ts`:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsInternalToClients1788800000000 implements MigrationInterface {
  name = 'AddIsInternalToClients1788800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "clients" ADD COLUMN "is_internal" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "clients" ALTER COLUMN "infradoc_id" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "clients" ALTER COLUMN "infradoc_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "clients" DROP COLUMN "is_internal"`,
    );
  }
}
```

- [ ] **Step 5: Actualizar Client entity**

En `backend/src/clients/client.entity.ts`, reemplazar:

```typescript
@Column({ unique: true })
infradocId: number;
```

por:

```typescript
@Column({ unique: true, nullable: true, type: 'int' })
infradocId: number | null;

@Column({ default: false })
isInternal: boolean;
```

- [ ] **Step 6: Agregar findClientMeta a ClientsService**

En `backend/src/clients/clients.service.ts`, después de `findInfradocId`:

```typescript
async findClientMeta(
  id: string,
): Promise<{ isInternal: boolean; infradocId: number | null } | null> {
  const client = await this.clientRepository.findOne({
    where: { id },
    select: ['id', 'isInternal', 'infradocId'],
  });
  if (!client) return null;
  return { isInternal: client.isInternal, infradocId: client.infradocId };
}
```

- [ ] **Step 7: Guardar clientes internos del archivado en syncWithInfradoc**

En `backend/src/clients/clients.service.ts`, actualizar `syncWithInfradoc`:

**localByInfradocId** (filtrar internos para que no sobreescriban nada):
```typescript
const localByInfradocId = new Map(
  localClients
    .filter((c) => !c.isInternal)
    .map((c) => [c.infradocId, c]),
);
```

**Bucle de archivado** (agregar guard):
```typescript
for (const local of localClients) {
  if (local.isInternal) continue;
  if (!infradocIds.has(local.infradocId) && local.isActive) {
    await this.clientRepository.update(local.id, {
      isActive: false,
      lastSyncedAt: new Date(),
    });
    archived++;
  }
}
```

- [ ] **Step 8: Correr tests — verificar que pasan**

```bash
cd backend && npx jest clients.service.spec --no-coverage 2>&1 | tail -20
```

Esperado: todos pasan.

- [ ] **Step 9: Commit**

```bash
git add backend/src/migrations/1788800000000-AddIsInternalToClients.ts \
        backend/src/clients/client.entity.ts \
        backend/src/clients/clients.service.ts \
        backend/src/clients/clients.service.spec.ts
git commit -m "feat(clients): agregar isInternal y hacer infradocId nullable para clientes internos ONDRA"
```

---

## Task 2: TaskTypeConfig — ondraOwnedHosts

**Files:**
- Create: `backend/src/migrations/1788900000000-AddOndraOwnedHostsToTaskConfig.ts`
- Modify: `backend/src/task-config/task-type-config.entity.ts`
- Modify: `backend/src/task-config/dto/update-task-config.dto.ts`
- Modify: `backend/src/task-config/task-config.service.ts`
- Test: `backend/src/task-config/task-config.service.spec.ts` (crear si no existe)

**Interfaces:**
- Consumes: `TaskTypeConfig` entity
- Produces: `TaskTypeConfig.ondraOwnedHosts: string[]`; `UpdateTaskConfigDto.ondraOwnedHosts?: string[]`; `TaskConfigService.upsert()` persiste `ondraOwnedHosts`

- [ ] **Step 1: Verificar si existe el spec de task-config**

```bash
ls backend/src/task-config/*.spec.ts 2>&1
```

Si no existe, crear `backend/src/task-config/task-config.service.spec.ts`.

- [ ] **Step 2: Escribir test**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TaskConfigService } from './task-config.service';
import { TaskTypeConfig } from './task-type-config.entity';
import { TaskType } from '../tasks/task-type.enum';

describe('TaskConfigService', () => {
  let service: TaskConfigService;
  let repo: any;

  beforeEach(async () => {
    repo = { findOne: jest.fn(), save: jest.fn(), find: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskConfigService,
        { provide: getRepositoryToken(TaskTypeConfig), useValue: repo },
      ],
    }).compile();
    service = module.get<TaskConfigService>(TaskConfigService);
  });

  describe('upsert', () => {
    it('persists ondraOwnedHosts when provided', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.save.mockImplementation(async (e: TaskTypeConfig) => e);

      const result = await service.upsert(TaskType.SERVER_HOST_MAINTENANCE, {
        ondraOwnedHosts: ['srv1-cloud.ondravirtual.com.ar'],
      });

      expect(result.ondraOwnedHosts).toEqual(['srv1-cloud.ondravirtual.com.ar']);
    });

    it('defaults ondraOwnedHosts to [] when not in DB', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.save.mockImplementation(async (e: TaskTypeConfig) => e);

      const result = await service.upsert(TaskType.SERVER_HOST_MAINTENANCE, {});

      expect(result.ondraOwnedHosts).toEqual([]);
    });
  });
});
```

- [ ] **Step 3: Correr test — verificar que falla**

```bash
cd backend && npx jest task-config.service.spec --no-coverage 2>&1 | tail -20
```

Esperado: falla porque `ondraOwnedHosts` no existe en la entidad.

- [ ] **Step 4: Crear la migración**

Crear `backend/src/migrations/1788900000000-AddOndraOwnedHostsToTaskConfig.ts`:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOndraOwnedHostsToTaskConfig1788900000000 implements MigrationInterface {
  name = 'AddOndraOwnedHostsToTaskConfig1788900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task_type_config" ADD COLUMN "ondra_owned_hosts" text[] NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task_type_config" DROP COLUMN "ondra_owned_hosts"`,
    );
  }
}
```

- [ ] **Step 5: Actualizar TaskTypeConfig entity**

En `backend/src/task-config/task-type-config.entity.ts`, agregar después de `odooTagNames`:

```typescript
@Column({ name: 'ondra_owned_hosts', type: 'text', array: true, default: [] })
ondraOwnedHosts: string[];
```

- [ ] **Step 6: Actualizar UpdateTaskConfigDto**

En `backend/src/task-config/dto/update-task-config.dto.ts`, agregar:

```typescript
@IsOptional()
@IsArray()
@IsString({ each: true })
ondraOwnedHosts?: string[];
```

- [ ] **Step 7: Actualizar TaskConfigService.upsert y defaultConfig**

En `backend/src/task-config/task-config.service.ts`:

En `upsert()`, después de `if (dto.timesheetDescription !== undefined)`:
```typescript
if (dto.ondraOwnedHosts !== undefined) existing.ondraOwnedHosts = dto.ondraOwnedHosts;
```

En `defaultConfig()`, agregar:
```typescript
config.ondraOwnedHosts = [];
```

- [ ] **Step 8: Correr tests — verificar que pasan**

```bash
cd backend && npx jest task-config.service.spec --no-coverage 2>&1 | tail -20
```

Esperado: todos pasan.

- [ ] **Step 9: Commit**

```bash
git add backend/src/migrations/1788900000000-AddOndraOwnedHostsToTaskConfig.ts \
        backend/src/task-config/task-type-config.entity.ts \
        backend/src/task-config/dto/update-task-config.dto.ts \
        backend/src/task-config/task-config.service.ts \
        backend/src/task-config/task-config.service.spec.ts
git commit -m "feat(task-config): agregar ondraOwnedHosts a la configuración de SERVER_HOST_MAINTENANCE"
```

---

## Task 3: Seed cliente interno ONDRA

**Files:**
- Create: `backend/src/migrations/1789000000000-SeedOndraInternalClient.ts`

**Interfaces:**
- Consumes: `clients` table con columna `is_internal` (Task 1)
- Produces: fila en `clients` con `is_internal=true`, `name='ONDRA'`, `infradoc_id=NULL`

- [ ] **Step 1: Crear la migración seed**

Crear `backend/src/migrations/1789000000000-SeedOndraInternalClient.ts`:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedOndraInternalClient1789000000000 implements MigrationInterface {
  name = 'SeedOndraInternalClient1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "clients" (id, name, is_internal, is_active, is_lead, infradoc_id, created_at)
      VALUES (gen_random_uuid(), 'ONDRA', true, true, false, NULL, NOW())
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "clients" WHERE is_internal = true AND name = 'ONDRA'`,
    );
  }
}
```

- [ ] **Step 2: Verificar que la migración aparece en data-source**

Abrir `backend/src/data-source.ts` (o el archivo de configuración TypeORM) y confirmar que el path de migraciones incluye el directorio donde está la nueva migración. El patrón suele ser `src/migrations/*.ts`. Si es así, no se requiere cambio.

- [ ] **Step 3: Commit**

```bash
git add backend/src/migrations/1789000000000-SeedOndraInternalClient.ts
git commit -m "feat(clients): agregar migración seed para el cliente interno ONDRA"
```

---

## Task 4: InfrastructureService — filtro de hosts ONDRA

**Files:**
- Modify: `backend/src/integrations/infradoc/infrastructure.service.ts`
- Modify: `backend/src/integrations/infradoc/infradoc-integration.module.ts`
- Test: `backend/src/integrations/infradoc/infrastructure.service.spec.ts` (crear)

**Interfaces:**
- Consumes: `ClientsService.findClientMeta()` (Task 1); `TaskConfigService.findOne()` (Task 2); `InfradocAssetsService.getAssets()` (existente)
- Produces: `getClientInfrastructure()` filtrado para clientes regulares; stubs para cliente ONDRA

- [ ] **Step 1: Escribir tests**

Crear `backend/src/integrations/infradoc/infrastructure.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { InfrastructureService } from './infrastructure.service';
import { ClientsService } from '../../clients/clients.service';
import { InfradocAssetsService } from './infradoc-assets.service';
import { TaskConfigService } from '../../task-config/task-config.service';
import { TaskType } from '../../tasks/task-type.enum';

const mockRawServer = (name: string) => ({
  asset_id: '1',
  asset_name: name,
  asset_type: 'server',
  asset_make: 'Dell',
  asset_model: 'R740',
  asset_os: 'VMware ESXi',
  asset_description: null,
  interface_ip: '10.0.0.1',
  interface_name: null,
  asset_uri: null,
  asset_uri_2: null,
});

describe('InfrastructureService', () => {
  let service: InfrastructureService;
  let clientsService: jest.Mocked<Partial<ClientsService>>;
  let assetsService: jest.Mocked<Partial<InfradocAssetsService>>;
  let taskConfigService: jest.Mocked<Partial<TaskConfigService>>;

  beforeEach(async () => {
    clientsService = { findClientMeta: jest.fn() };
    assetsService = { getAssets: jest.fn(), getAssetInterfaces: jest.fn() };
    taskConfigService = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InfrastructureService,
        { provide: ClientsService, useValue: clientsService },
        { provide: InfradocAssetsService, useValue: assetsService },
        { provide: TaskConfigService, useValue: taskConfigService },
      ],
    }).compile();

    service = module.get<InfrastructureService>(InfrastructureService);
  });

  it('throws NotFoundException when client not found', async () => {
    clientsService.findClientMeta!.mockResolvedValue(null);
    await expect(service.getClientInfrastructure('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('filters ondra-owned hosts from regular client esxiHosts', async () => {
    clientsService.findClientMeta!.mockResolvedValue({ isInternal: false, infradocId: 5 });
    taskConfigService.findOne!.mockResolvedValue({
      ondraOwnedHosts: ['srv1-cloud.ondravirtual.com.ar'],
    } as any);
    assetsService.getAssets!.mockResolvedValue([
      mockRawServer('srv1-cloud.ondravirtual.com.ar'),
      mockRawServer('srv-client.cliente.com'),
    ]);
    assetsService.getAssetInterfaces!.mockResolvedValue([]);

    const result = await service.getClientInfrastructure('client-id');

    expect(result.esxiHosts.map((h) => h.name)).toEqual(['srv-client.cliente.com']);
  });

  it('returns stub esxiHosts for ONDRA internal client without calling InfraDoc', async () => {
    clientsService.findClientMeta!.mockResolvedValue({ isInternal: true, infradocId: null });
    taskConfigService.findOne!.mockResolvedValue({
      ondraOwnedHosts: ['srv1-cloud.ondravirtual.com.ar'],
    } as any);

    const result = await service.getClientInfrastructure('ondra-id');

    expect(result.esxiHosts).toHaveLength(1);
    expect(result.esxiHosts[0].name).toBe('srv1-cloud.ondravirtual.com.ar');
    expect(result.windowsVMs).toEqual([]);
    expect(assetsService.getAssets).not.toHaveBeenCalled();
  });

  it('returns empty esxiHosts for ONDRA when ondraOwnedHosts not configured', async () => {
    clientsService.findClientMeta!.mockResolvedValue({ isInternal: true, infradocId: null });
    taskConfigService.findOne!.mockResolvedValue(null);

    const result = await service.getClientInfrastructure('ondra-id');

    expect(result.esxiHosts).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr tests — verificar que fallan**

```bash
cd backend && npx jest infrastructure.service.spec --no-coverage 2>&1 | tail -30
```

Esperado: fallan porque `findClientMeta` no está inyectado y la lógica de filtro no existe.

- [ ] **Step 3: Importar TaskConfigModule en InfradocIntegrationModule**

En `backend/src/integrations/infradoc/infradoc-integration.module.ts`:

```typescript
import { TaskConfigModule } from '../../task-config/task-config.module';

@Module({
  imports: [
    HttpModule.register({ httpsAgent: new https.Agent({ rejectUnauthorized: false }) }),
    ClientsModule,
    IntegrationConfigModule,
    TaskConfigModule,   // ← agregar
  ],
  // ...
})
```

- [ ] **Step 4: Actualizar InfrastructureService**

Reemplazar el contenido de `backend/src/integrations/infradoc/infrastructure.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { ClientsService } from '../../clients/clients.service';
import {
  InfradocAssetsService,
  RawInfradocAsset,
} from './infradoc-assets.service';
import {
  ClientInfrastructureDto,
  InfraAssetDto,
} from './dto/client-infrastructure.dto';
import { TaskConfigService } from '../../task-config/task-config.service';
import { TaskType } from '../../tasks/task-type.enum';

@Injectable()
export class InfrastructureService {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly infradocAssetsService: InfradocAssetsService,
    private readonly taskConfigService: TaskConfigService,
  ) {}

  async getClientInfrastructure(
    clientId: string,
  ): Promise<ClientInfrastructureDto> {
    const meta = await this.clientsService.findClientMeta(clientId);
    if (!meta) throw new NotFoundException('Cliente no encontrado');

    const config = await this.taskConfigService.findOne(
      TaskType.SERVER_HOST_MAINTENANCE,
    );
    const ondraOwnedHosts = config?.ondraOwnedHosts ?? [];

    if (meta.isInternal) {
      return {
        esxiHosts: ondraOwnedHosts.map((name) => this.stubAsset(name)),
        windowsVMs: [],
        domainControllers: [],
        linuxVMs: [],
        nas: [],
        routers: [],
      };
    }

    if (meta.infradocId === null)
      throw new NotFoundException('Cliente no encontrado');

    const raw = await this.infradocAssetsService.getAssets(meta.infradocId);

    const rawByAsset = new Map<string, RawInfradocAsset[]>();
    for (const asset of raw) {
      const group = rawByAsset.get(asset.asset_id) ?? [];
      group.push(asset);
      rawByAsset.set(asset.asset_id, group);
    }

    const serverIds = [
      ...new Set(
        raw
          .filter((a) => (a.asset_type ?? '').trim().toLowerCase() === 'server')
          .map((a) => a.asset_id),
      ),
    ];

    const settledResults = await Promise.allSettled(
      serverIds.map((id) =>
        this.infradocAssetsService.getAssetInterfaces(Number(id)),
      ),
    );

    const interfaceArrays = settledResults.map((r) =>
      r.status === 'fulfilled' ? r.value : [],
    );

    const bmcMap = new Map<
      string,
      { bmcIp: string | null; bmcType: string | null }
    >();
    const uriMap = new Map<
      string,
      { uri1: string | null; uri2: string | null }
    >();
    serverIds.forEach((id, i) => {
      const merged = [...interfaceArrays[i], ...(rawByAsset.get(id) ?? [])];
      bmcMap.set(id, this.resolveBmc(merged));
      uriMap.set(id, this.resolveVmwareUris(merged));
    });

    const result = this.groupAssets(raw, bmcMap, uriMap);
    result.esxiHosts = result.esxiHosts.filter(
      (h) => !ondraOwnedHosts.includes(h.name),
    );
    return result;
  }

  private stubAsset(name: string): InfraAssetDto {
    return {
      assetId: 0,
      name,
      ip: null,
      bmcIp: null,
      bmcType: null,
      os: null,
      make: null,
      model: null,
      uri1: null,
      uri2: null,
    };
  }

  private resolveVmwareUris(
    interfaces: RawInfradocAsset[],
  ): { uri1: string | null; uri2: string | null } {
    const best = interfaces.find((i) => i.asset_uri || i.asset_uri_2);
    return { uri1: best?.asset_uri ?? null, uri2: best?.asset_uri_2 ?? null };
  }

  private resolveBmc(interfaces: RawInfradocAsset[]): {
    bmcIp: string | null;
    bmcType: string | null;
  } {
    const BMC_PATTERNS = ['ilo', 'idrac', 'xclarity'];
    const bmc = interfaces.find((iface) =>
      BMC_PATTERNS.some((p) =>
        (iface.interface_name ?? '').toLowerCase().includes(p),
      ),
    );
    if (!bmc) return { bmcIp: null, bmcType: null };
    return {
      bmcIp: bmc.interface_ip || null,
      bmcType: bmc.interface_name ?? null,
    };
  }

  private groupAssets(
    raw: RawInfradocAsset[],
    bmcMap: Map<string, { bmcIp: string | null; bmcType: string | null }>,
    uriMap: Map<string, { uri1: string | null; uri2: string | null }>,
  ): ClientInfrastructureDto {
    const result: ClientInfrastructureDto = {
      esxiHosts: [],
      windowsVMs: [],
      domainControllers: [],
      linuxVMs: [],
      nas: [],
      routers: [],
    };

    const seen = new Set<string>();

    for (const asset of raw) {
      if (seen.has(asset.asset_id)) continue;
      seen.add(asset.asset_id);

      const type = (asset.asset_type ?? '').trim().toLowerCase();
      const make = (asset.asset_make ?? '').trim().toLowerCase();
      const os = (asset.asset_os ?? '').trim().toLowerCase();

      if (type === 'server') {
        result.esxiHosts.push(
          this.mapAsset(asset, bmcMap.get(asset.asset_id), uriMap.get(asset.asset_id)),
        );
      } else if (
        type === 'virtual machine' &&
        os.startsWith('windows server')
      ) {
        const description = (asset.asset_description ?? '').toLowerCase();
        if (description.includes('domain controller')) {
          result.domainControllers.push(this.mapAsset(asset));
        } else {
          result.windowsVMs.push(this.mapAsset(asset));
        }
      } else if (type === 'virtual machine' && os !== '' && !os.startsWith('windows server')) {
        result.linuxVMs.push(this.mapAsset(asset));
      } else if (
        type === 'firewall/router' ||
        type === 'router' ||
        type === 'firewall'
      ) {
        result.routers.push(this.mapAsset(asset));
      } else if (type === 'nas' || make === 'qnap') {
        result.nas.push(this.mapAsset(asset));
      }
    }

    return result;
  }

  private mapAsset(
    raw: RawInfradocAsset,
    bmc?: { bmcIp: string | null; bmcType: string | null },
    uriOverride?: { uri1: string | null; uri2: string | null },
  ): InfraAssetDto {
    return {
      assetId: Number(raw.asset_id),
      name: raw.asset_name,
      ip: raw.interface_ip || null,
      bmcIp: bmc?.bmcIp ?? null,
      bmcType: bmc?.bmcType ?? null,
      os: raw.asset_os || null,
      make: raw.asset_make || null,
      model: raw.asset_model || null,
      uri1: uriOverride?.uri1 ?? raw.asset_uri ?? null,
      uri2: uriOverride?.uri2 ?? raw.asset_uri_2 ?? null,
    };
  }
}
```

- [ ] **Step 5: Correr tests — verificar que pasan**

```bash
cd backend && npx jest infrastructure.service.spec --no-coverage 2>&1 | tail -20
```

Esperado: todos pasan.

- [ ] **Step 6: Correr toda la suite backend**

```bash
cd backend && npx jest --no-coverage 2>&1 | tail -20
```

Esperado: sin regresiones.

- [ ] **Step 7: Commit**

```bash
git add backend/src/integrations/infradoc/infrastructure.service.ts \
        backend/src/integrations/infradoc/infrastructure.service.spec.ts \
        backend/src/integrations/infradoc/infradoc-integration.module.ts
git commit -m "feat(infradoc): filtrar hosts ONDRA de infraestructura de clientes y retornar stubs para cliente interno"
```

---

## Task 5: Frontend — campo ondraOwnedHosts en task-edit-dialog

**Files:**
- Modify: `frontend/src/app/core/models/task.models.ts`
- Modify: `frontend/src/app/features/admin/task-config/task-edit-dialog/task-edit-dialog.component.ts`
- Modify: `frontend/src/app/features/admin/task-config/task-edit-dialog/task-edit-dialog.component.html`
- Modify: `frontend/src/app/features/admin/admin.module.ts`

**Interfaces:**
- Consumes: `TaskTypeConfigDto` con `ondraOwnedHosts`; `UpdateTaskConfigPayload` con `ondraOwnedHosts`
- Produces: campo chips visible solo para `SERVER_HOST_MAINTENANCE` que permite al admin agregar/quitar hostnames

- [ ] **Step 1: Actualizar modelos TypeScript**

En `frontend/src/app/core/models/task.models.ts`:

Agregar `ondraOwnedHosts: string[];` a `TaskTypeConfigDto`:

```typescript
export interface TaskTypeConfigDto {
  taskType: TaskType;
  defaultTimeMinutes: number | null;
  odooTagIds: number[];
  odooTagNames: string[];
  ticketDescription: string | null;
  defaultTicketDescription?: string;
  timesheetDescription: string | null;
  defaultTimesheetDescription?: string;
  ondraOwnedHosts: string[];   // ← agregar
  updatedAt: string;
}
```

Agregar `ondraOwnedHosts?: string[];` a `UpdateTaskConfigPayload`:

```typescript
export interface UpdateTaskConfigPayload {
  defaultTimeMinutes?: number;
  odooTagIds?: number[];
  odooTagNames?: string[];
  ticketDescription?: string;
  timesheetDescription?: string;
  ondraOwnedHosts?: string[];   // ← agregar
}
```

- [ ] **Step 2: Agregar MatChipsModule al AdminModule**

En `frontend/src/app/features/admin/admin.module.ts`, agregar:

```typescript
import { MatChipsModule } from '@angular/material/chips';
```

Y en el array `imports`:
```typescript
MatChipsModule,
```

- [ ] **Step 3: Actualizar TaskEditDialogComponent**

Reemplazar `frontend/src/app/features/admin/task-config/task-edit-dialog/task-edit-dialog.component.ts`:

```typescript
import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatChipInputEvent } from '@angular/material/chips';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
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
  ondraHosts: string[] = [];
  readonly separatorKeys = [ENTER, COMMA] as const;

  form = new FormGroup({
    time:                 new FormControl('', [Validators.required, Validators.pattern(TIME_PATTERN)]),
    tagIds:               new FormControl<number[]>([]),
    ticketDescription:    new FormControl<string>(''),
    timesheetDescription: new FormControl<string>(''),
  });

  constructor(
    private dialogRef: MatDialogRef<TaskEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { config: TaskTypeConfigDto },
    private taskConfigService: TaskConfigService,
  ) {}

  ngOnInit(): void {
    const {
      defaultTimeMinutes, odooTagIds,
      ticketDescription, defaultTicketDescription,
      timesheetDescription, defaultTimesheetDescription,
      ondraOwnedHosts,
    } = this.data.config;

    this.form.patchValue({
      time:                 defaultTimeMinutes != null ? this.minutesToTime(defaultTimeMinutes) : '',
      tagIds:               odooTagIds,
      ticketDescription:    ticketDescription ?? defaultTicketDescription ?? '',
      timesheetDescription: timesheetDescription ?? defaultTimesheetDescription ?? '',
    });

    this.ondraHosts = [...(ondraOwnedHosts ?? [])];

    this.taskConfigService.getHelpdeskTags().subscribe({
      next: tags => { this.availableTags = tags; this.loadingTags = false; },
      error: () => { this.loadingTags = false; },
    });
  }

  addHost(event: MatChipInputEvent): void {
    const value = (event.value || '').trim();
    if (value) this.ondraHosts = [...this.ondraHosts, value];
    event.chipInput!.clear();
  }

  removeHost(host: string): void {
    this.ondraHosts = this.ondraHosts.filter(h => h !== host);
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving = true;

    const minutes = this.timeToMinutes(this.form.value.time!);
    const tagIds   = this.form.value.tagIds ?? [];
    const tagNames = tagIds.map(id => this.availableTags.find(t => t.id === id)?.name ?? '');
    const ticketDescription     = this.form.value.ticketDescription ?? '';
    const timesheetDescription  = this.form.value.timesheetDescription ?? '';
    const isServerHostTask = this.data.config.taskType === 'SERVER_HOST_MAINTENANCE';

    this.taskConfigService.update(this.data.config.taskType, {
      defaultTimeMinutes:  minutes,
      odooTagIds:          tagIds,
      odooTagNames:        tagNames,
      ticketDescription:   ticketDescription || undefined,
      timesheetDescription: timesheetDescription || undefined,
      ondraOwnedHosts:     isServerHostTask ? this.ondraHosts : undefined,
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

- [ ] **Step 4: Actualizar template HTML**

En `frontend/src/app/features/admin/task-config/task-edit-dialog/task-edit-dialog.component.html`, agregar el campo chips después de `timesheetDescription` y antes de `</mat-dialog-content>`:

```html
<mat-form-field
  *ngIf="data.config.taskType === 'SERVER_HOST_MAINTENANCE'"
  appearance="outline"
  subscriptSizing="dynamic"
  style="margin-top: 16px;">
  <mat-label>Hosts de infraestructura ONDRA</mat-label>
  <mat-chip-grid #chipGrid>
    <mat-chip-row
      *ngFor="let host of ondraHosts"
      (removed)="removeHost(host)">
      {{ host }}
      <button matChipRemove aria-label="Quitar host">
        <mat-icon>cancel</mat-icon>
      </button>
    </mat-chip-row>
    <input
      placeholder="ej. srv1-cloud.ondravirtual.com.ar"
      [matChipInputFor]="chipGrid"
      [matChipInputSeparatorKeyCodes]="separatorKeys"
      (matChipInputTokenEnd)="addHost($event)" />
  </mat-chip-grid>
  <mat-hint>Servidores VMware propios de ONDRA. Se excluyen del mantenimiento de clientes y se asignan al cliente interno ONDRA.</mat-hint>
</mat-form-field>
```

- [ ] **Step 5: Verificar compilación Angular**

```bash
cd frontend && npx ng build --configuration development 2>&1 | tail -20
```

Esperado: sin errores de compilación.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/core/models/task.models.ts \
        frontend/src/app/features/admin/task-config/task-edit-dialog/task-edit-dialog.component.ts \
        frontend/src/app/features/admin/task-config/task-edit-dialog/task-edit-dialog.component.html \
        frontend/src/app/features/admin/admin.module.ts
git commit -m "feat(admin): agregar campo de hosts ONDRA en configuración de SERVER_HOST_MAINTENANCE"
```

---

## Post-implementación — pasos manuales

Una vez deployado:

1. **Correr migraciones** en el entorno de desarrollo: `npm run migration:run`
2. **Configurar ondraOwnedHosts**: ir a Admin → Configuración de tareas → SERVER_HOST_MAINTENANCE → editar → agregar `srv1-cloud.ondravirtual.com.ar` en el campo de hosts ONDRA.
3. **Crear regla de schedule para ONDRA**: ir a Schedules → nueva regla para el cliente "ONDRA" con el técnico asignado.
4. **Verificar**: en el próximo ciclo generado, `srv1-cloud.ondravirtual.com.ar` no debe aparecer en los mantenimientos de clientes cloud, y sí debe aparecer en la tarea del cliente ONDRA.
