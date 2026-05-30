# Sección BMC en el formulario de mantenimiento — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una sección "BMC / Gestión remota" al formulario de mantenimiento de servidores que muestra la IP del BMC (iLO/iDRAC/xClarity) obtenida de InfraDoc y permite registrar versión de firmware, versión de BIOS y alertas detectadas.

**Architecture:** El backend agrega un método `getAssetInterfaces(assetId)` que hace una llamada extra a InfraDoc por cada servidor físico para obtener todas sus interfaces de red. La capa de infraestructura identifica la interfaz BMC por nombre ("iLO", "iDRAC", "xClarity") y la expone como `bmcIp`/`bmcType` en el DTO. El frontend agrega un `FormArray bmcHosts` sincronizado con `esxiHosts`, visible bajo la misma condición que la sección VMware.

**Tech Stack:** NestJS · TypeORM · Axios/RxJS · Angular 19 · Angular Material · ReactiveFormsModule · Jest (backend) · Karma/Jasmine (frontend)

---

## Mapa de archivos

| Archivo | Acción |
|---|---|
| `backend/src/integrations/infradoc/infradoc-assets.service.ts` | Modificar: `interface_name` a `RawInfradocAsset`, nuevo método `getAssetInterfaces()` |
| `backend/src/integrations/infradoc/infradoc-assets.service.spec.ts` | Modificar: tests para `getAssetInterfaces()` |
| `backend/src/integrations/infradoc/dto/client-infrastructure.dto.ts` | Modificar: `bmcIp`, `bmcType` a `InfraAssetDto` |
| `backend/src/integrations/infradoc/infrastructure.service.ts` | Modificar: `resolveBmc()`, actualizar `groupAssets()` + `getClientInfrastructure()` |
| `backend/src/integrations/infradoc/infrastructure.service.spec.ts` | Modificar: mock `getAssetInterfaces`, tests BMC, actualizar fixtures existentes |
| `backend/src/maintenance-logs/log-item.interface.ts` | Modificar: nueva interfaz `BmcEntry`, campo `bmc?` en `ServerMaintenancePayload` |
| `frontend/src/app/core/models/infradoc.models.ts` | Modificar: `bmcIp`, `bmcType` a `InfraAsset` |
| `frontend/src/app/core/models/maintenance-log.models.ts` | Modificar: `BmcEntry`, campo `bmc?` en `ServerMaintenancePayload` |
| `frontend/src/app/core/models/maintenance-log.models.spec.ts` | Modificar: test para campo `bmc` |
| `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.ts` | Modificar: `bmcHosts` FormArray, getters, `bmcHasAlert()`, `selectClass()`, `buildPayload()` |
| `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.spec.ts` | Modificar: actualizar fixtures, tests BMC |
| `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.html` | Modificar: sección BMC |

---

## Task 1: `InfradocAssetsService` — `interface_name` y `getAssetInterfaces()`

**Files:**
- Modify: `backend/src/integrations/infradoc/infradoc-assets.service.ts`
- Modify: `backend/src/integrations/infradoc/infradoc-assets.service.spec.ts`

- [ ] **Step 1.1 — Escribir el test que falla**

En `infradoc-assets.service.spec.ts`, agregar al final del `describe` existente:

```typescript
describe('getAssetInterfaces', () => {
  it('llama al endpoint con asset_id y devuelve array de interfaces', async () => {
    const iface = { ...makeRawAsset(), interface_name: 'iLO', interface_ip: '10.0.1.200' };
    httpService.get.mockReturnValue(
      of(axiosRes({ success: 'True', count: 1, data: [iface] })),
    );

    const result = await service.getAssetInterfaces(101);

    expect(result).toHaveLength(1);
    expect(result[0].interface_ip).toBe('10.0.1.200');
    expect(httpService.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/assets/read.php'),
      expect.objectContaining({
        params: expect.objectContaining({ asset_id: 101 }),
      }),
    );
  });

  it('devuelve array vacío cuando data no es array', async () => {
    httpService.get.mockReturnValue(
      of(axiosRes({ success: 'True', count: 0, data: null })),
    );

    const result = await service.getAssetInterfaces(101);

    expect(result).toEqual([]);
  });

  it('lanza ServiceUnavailableException cuando InfraDoc devuelve success False', async () => {
    httpService.get.mockReturnValue(
      of(axiosRes({ success: 'False', message: 'Not found' })),
    );

    await expect(service.getAssetInterfaces(101)).rejects.toThrow(ServiceUnavailableException);
  });
});
```

- [ ] **Step 1.2 — Ejecutar tests y confirmar que fallan**

```
cd e:\develop\infraops\backend && npx jest infradoc-assets --no-coverage
```

Esperado: FAIL — `getAssetInterfaces is not a function`

- [ ] **Step 1.3 — Implementar: agregar `interface_name` y `getAssetInterfaces()`**

En `infradoc-assets.service.ts`, reemplazar el contenido completo con:

```typescript
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface RawInfradocAsset {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  asset_make: string | null;
  asset_os: string | null;
  asset_model: string | null;
  interface_ip: string | null;
  interface_name: string | null;
}

@Injectable()
export class InfradocAssetsService {
  constructor(private readonly httpService: HttpService) {}

  async getAssets(infradocClientId: number): Promise<RawInfradocAsset[]> {
    const baseUrl = process.env.INFRADOC_URL;
    const apiKey  = process.env.INFRADOC_API_KEY;
    if (!baseUrl || !apiKey) {
      throw new Error('INFRADOC_URL and INFRADOC_API_KEY deben estar configurados');
    }
    const url = `${baseUrl}/api/v1/assets/read.php`;
    const response = await firstValueFrom(
      this.httpService.get(url, {
        params: { api_key: apiKey, client_id: infradocClientId, limit: 500 },
      }),
    );

    if (response.data.success !== 'True') {
      throw new ServiceUnavailableException(
        `InfraDoc API error: ${response.data.message}`,
      );
    }

    const data = response.data.data;
    if (!Array.isArray(data)) return [];
    return data as RawInfradocAsset[];
  }

  async getAssetInterfaces(assetId: number): Promise<RawInfradocAsset[]> {
    const baseUrl = process.env.INFRADOC_URL;
    const apiKey  = process.env.INFRADOC_API_KEY;
    if (!baseUrl || !apiKey) {
      throw new Error('INFRADOC_URL and INFRADOC_API_KEY deben estar configurados');
    }
    const url = `${baseUrl}/api/v1/assets/read.php`;
    const response = await firstValueFrom(
      this.httpService.get(url, {
        params: { api_key: apiKey, asset_id: assetId, limit: 500 },
      }),
    );

    if (response.data.success !== 'True') {
      throw new ServiceUnavailableException(
        `InfraDoc API error: ${response.data.message}`,
      );
    }

    const data = response.data.data;
    if (!Array.isArray(data)) return [];
    return data as RawInfradocAsset[];
  }
}
```

- [ ] **Step 1.4 — Ejecutar tests y confirmar que pasan**

```
cd e:\develop\infraops\backend && npx jest infradoc-assets --no-coverage
```

Esperado: PASS (todos los tests del archivo)

- [ ] **Step 1.5 — Commit**

```
cd e:\develop\infraops && git add backend/src/integrations/infradoc/infradoc-assets.service.ts backend/src/integrations/infradoc/infradoc-assets.service.spec.ts && git commit -m "feat(infradoc): agregar interface_name y getAssetInterfaces al servicio de assets"
```

---

## Task 2: DTOs — agregar `bmcIp` y `bmcType`

**Files:**
- Modify: `backend/src/integrations/infradoc/dto/client-infrastructure.dto.ts`
- Modify: `frontend/src/app/core/models/infradoc.models.ts`

*(Cambios de tipo puro — sin tests unitarios propios. Son verificados por los tests de las capas superiores.)*

- [ ] **Step 2.1 — Actualizar `InfraAssetDto` (backend)**

Reemplazar el contenido de `backend/src/integrations/infradoc/dto/client-infrastructure.dto.ts`:

```typescript
export class InfraAssetDto {
  assetId: number;
  name: string;
  ip: string | null;
  bmcIp: string | null;
  bmcType: string | null;
  os: string | null;
  model: string | null;
}

export class ClientInfrastructureDto {
  esxiHosts: InfraAssetDto[];
  windowsVMs: InfraAssetDto[];
  nas: InfraAssetDto[];
  routers: InfraAssetDto[];
}
```

- [ ] **Step 2.2 — Actualizar `InfraAsset` (frontend)**

Reemplazar el contenido de `frontend/src/app/core/models/infradoc.models.ts`:

```typescript
export interface InfraAsset {
  assetId: number;
  name: string;
  ip: string | null;
  bmcIp: string | null;
  bmcType: string | null;
  os: string | null;
  model: string | null;
}

export interface ClientInfrastructure {
  esxiHosts: InfraAsset[];
  windowsVMs: InfraAsset[];
  nas: InfraAsset[];
  routers: InfraAsset[];
}
```

- [ ] **Step 2.3 — Commit**

```
cd e:\develop\infraops && git add backend/src/integrations/infradoc/dto/client-infrastructure.dto.ts frontend/src/app/core/models/infradoc.models.ts && git commit -m "feat(infradoc): agregar bmcIp y bmcType a InfraAsset y InfraAssetDto"
```

---

## Task 3: `InfrastructureService` — resolver BMC IP

**Files:**
- Modify: `backend/src/integrations/infradoc/infrastructure.service.ts`
- Modify: `backend/src/integrations/infradoc/infrastructure.service.spec.ts`

- [ ] **Step 3.1 — Actualizar fixtures y `beforeEach` en el spec**

En `infrastructure.service.spec.ts`, hacer los siguientes cambios:

**1. Actualizar `makeAsset` para incluir `interface_name`:**

```typescript
const makeAsset = (override: Partial<RawInfradocAsset> = {}): RawInfradocAsset => ({
  asset_id:       '1',
  asset_name:     'host1.kemini',
  asset_type:     'Server',
  asset_make:     'HPE',
  interface_ip:   '192.168.0.104',
  interface_name: null,
  asset_os:       'VMware ESXi 7.0.0',
  asset_model:    'ProLiant DL380 Gen10',
  ...override,
} as RawInfradocAsset);
```

**2. Actualizar `beforeEach` para incluir `getAssetInterfaces` en el mock:**

```typescript
infradocAssetsService = {
  getAssets:          jest.fn().mockResolvedValue([]),
  getAssetInterfaces: jest.fn().mockResolvedValue([]),
};
```

**3. Actualizar el test `'agrupa hosts ESXi'` para incluir los nuevos campos en `toEqual`:**

```typescript
it('agrupa hosts ESXi (asset_type=Server) en esxiHosts', async () => {
  infradocAssetsService.getAssets.mockResolvedValue([
    makeAsset({ asset_id: '2', asset_name: 'host1.kemini', asset_type: 'Server', asset_os: 'VMware ESXi 7.0.0' }),
  ]);

  const result = await service.getClientInfrastructure('uuid-1');

  expect(result.esxiHosts).toHaveLength(1);
  expect(result.esxiHosts[0]).toEqual({
    assetId: 2,
    name:    'host1.kemini',
    ip:      '192.168.0.104',
    bmcIp:   null,
    bmcType: null,
    os:      'VMware ESXi 7.0.0',
    model:   'ProLiant DL380 Gen10',
  });
});
```

**4. Actualizar el test `'mapea ip, os y model como null'`:**

```typescript
it('mapea ip, os y model como null cuando InfraDoc devuelve null', async () => {
  infradocAssetsService.getAssets.mockResolvedValue([
    makeAsset({ interface_ip: null, asset_os: null, asset_model: null }),
  ]);

  const result = await service.getClientInfrastructure('uuid-1');

  expect(result.esxiHosts[0].ip).toBeNull();
  expect(result.esxiHosts[0].bmcIp).toBeNull();
  expect(result.esxiHosts[0].bmcType).toBeNull();
  expect(result.esxiHosts[0].os).toBeNull();
  expect(result.esxiHosts[0].model).toBeNull();
});
```

**5. Actualizar el test `'normaliza ip, os y model a null'`:**

```typescript
it('normaliza ip, os y model a null cuando InfraDoc devuelve string vacío', async () => {
  infradocAssetsService.getAssets.mockResolvedValue([
    makeAsset({ interface_ip: '', asset_os: '', asset_model: '' }),
  ]);

  const result = await service.getClientInfrastructure('uuid-1');

  expect(result.esxiHosts[0].ip).toBeNull();
  expect(result.esxiHosts[0].bmcIp).toBeNull();
  expect(result.esxiHosts[0].bmcType).toBeNull();
  expect(result.esxiHosts[0].os).toBeNull();
  expect(result.esxiHosts[0].model).toBeNull();
});
```

- [ ] **Step 3.2 — Escribir los tests nuevos para BMC**

Agregar al final del `describe('InfrastructureService')` en el spec:

```typescript
describe('BMC resolution', () => {
  it('llama a getAssetInterfaces para cada servidor físico', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([
      makeAsset({ asset_id: '2', asset_type: 'Server' }),
      makeAsset({ asset_id: '3', asset_type: 'Server' }),
    ]);

    await service.getClientInfrastructure('uuid-1');

    expect(infradocAssetsService.getAssetInterfaces).toHaveBeenCalledTimes(2);
    expect(infradocAssetsService.getAssetInterfaces).toHaveBeenCalledWith(2);
    expect(infradocAssetsService.getAssetInterfaces).toHaveBeenCalledWith(3);
  });

  it('NO llama a getAssetInterfaces para Virtual Machines ni NAS ni Routers', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([
      makeAsset({ asset_id: '3', asset_type: 'Virtual Machine', asset_os: 'Windows Server 2019', asset_make: null }),
      makeAsset({ asset_id: '10', asset_type: 'Other', asset_make: 'QNAP', asset_os: null }),
      makeAsset({ asset_id: '1', asset_type: 'Firewall/Router', asset_os: null }),
    ]);

    await service.getClientInfrastructure('uuid-1');

    expect(infradocAssetsService.getAssetInterfaces).not.toHaveBeenCalled();
  });

  it('popula bmcIp y bmcType cuando existe interfaz iLO', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([
      makeAsset({ asset_id: '2', asset_type: 'Server' }),
    ]);
    infradocAssetsService.getAssetInterfaces.mockResolvedValue([
      makeAsset({ interface_name: 'VMware',  interface_ip: '192.168.0.104' }),
      makeAsset({ interface_name: 'iLO',     interface_ip: '192.168.0.200' }),
    ]);

    const result = await service.getClientInfrastructure('uuid-1');

    expect(result.esxiHosts[0].bmcIp).toBe('192.168.0.200');
    expect(result.esxiHosts[0].bmcType).toBe('iLO');
  });

  it('popula bmcIp y bmcType cuando existe interfaz iDRAC', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([
      makeAsset({ asset_id: '5', asset_type: 'Server' }),
    ]);
    infradocAssetsService.getAssetInterfaces.mockResolvedValue([
      makeAsset({ interface_name: 'iDRAC', interface_ip: '10.0.0.50' }),
    ]);

    const result = await service.getClientInfrastructure('uuid-1');

    expect(result.esxiHosts[0].bmcIp).toBe('10.0.0.50');
    expect(result.esxiHosts[0].bmcType).toBe('iDRAC');
  });

  it('popula bmcIp y bmcType cuando existe interfaz xClarity (case-insensitive)', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([
      makeAsset({ asset_id: '6', asset_type: 'Server' }),
    ]);
    infradocAssetsService.getAssetInterfaces.mockResolvedValue([
      makeAsset({ interface_name: 'XClarity', interface_ip: '10.0.1.99' }),
    ]);

    const result = await service.getClientInfrastructure('uuid-1');

    expect(result.esxiHosts[0].bmcIp).toBe('10.0.1.99');
    expect(result.esxiHosts[0].bmcType).toBe('XClarity');
  });

  it('devuelve bmcIp null y bmcType null cuando no hay interfaz BMC', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([
      makeAsset({ asset_id: '7', asset_type: 'Server' }),
    ]);
    infradocAssetsService.getAssetInterfaces.mockResolvedValue([
      makeAsset({ interface_name: 'VMware', interface_ip: '192.168.0.104' }),
    ]);

    const result = await service.getClientInfrastructure('uuid-1');

    expect(result.esxiHosts[0].bmcIp).toBeNull();
    expect(result.esxiHosts[0].bmcType).toBeNull();
  });

  it('devuelve bmcIp null cuando la interfaz BMC existe pero no tiene IP', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([
      makeAsset({ asset_id: '8', asset_type: 'Server' }),
    ]);
    infradocAssetsService.getAssetInterfaces.mockResolvedValue([
      makeAsset({ interface_name: 'iLO', interface_ip: null }),
    ]);

    const result = await service.getClientInfrastructure('uuid-1');

    expect(result.esxiHosts[0].bmcIp).toBeNull();
    expect(result.esxiHosts[0].bmcType).toBeNull();
  });

  it('toma la primera interfaz BMC cuando hay múltiples coincidencias', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([
      makeAsset({ asset_id: '9', asset_type: 'Server' }),
    ]);
    infradocAssetsService.getAssetInterfaces.mockResolvedValue([
      makeAsset({ interface_name: 'iLO', interface_ip: '10.0.0.1' }),
      makeAsset({ interface_name: 'iLO-2', interface_ip: '10.0.0.2' }),
    ]);

    const result = await service.getClientInfrastructure('uuid-1');

    expect(result.esxiHosts[0].bmcIp).toBe('10.0.0.1');
  });
});
```

- [ ] **Step 3.3 — Ejecutar tests y confirmar que fallan**

```
cd e:\develop\infraops\backend && npx jest infrastructure.service --no-coverage
```

Esperado: FAIL — errores de TypeScript en fixtures y tests BMC sin implementar

- [ ] **Step 3.4 — Implementar la actualización de `InfrastructureService`**

Reemplazar el contenido completo de `backend/src/integrations/infradoc/infrastructure.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { ClientsService } from '../../clients/clients.service';
import { InfradocAssetsService, RawInfradocAsset } from './infradoc-assets.service';
import { ClientInfrastructureDto, InfraAssetDto } from './dto/client-infrastructure.dto';

@Injectable()
export class InfrastructureService {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly infradocAssetsService: InfradocAssetsService,
  ) {}

  async getClientInfrastructure(clientId: string): Promise<ClientInfrastructureDto> {
    const infradocId = await this.clientsService.findInfradocId(clientId);
    if (infradocId === null) throw new NotFoundException('Cliente no encontrado');

    const raw = await this.infradocAssetsService.getAssets(infradocId);

    const serverIds = [
      ...new Set(
        raw
          .filter(a => (a.asset_type ?? '').trim().toLowerCase() === 'server')
          .map(a => a.asset_id),
      ),
    ];

    const interfaceArrays = await Promise.all(
      serverIds.map(id => this.infradocAssetsService.getAssetInterfaces(Number(id))),
    );

    const bmcMap = new Map<string, { bmcIp: string | null; bmcType: string | null }>();
    serverIds.forEach((id, i) => {
      bmcMap.set(id, this.resolveBmc(interfaceArrays[i]));
    });

    return this.groupAssets(raw, bmcMap);
  }

  private resolveBmc(interfaces: RawInfradocAsset[]): { bmcIp: string | null; bmcType: string | null } {
    const BMC_PATTERNS = ['ilo', 'idrac', 'xclarity'];
    const bmc = interfaces.find(iface =>
      BMC_PATTERNS.some(p => (iface.interface_name ?? '').toLowerCase().includes(p)),
    );
    if (!bmc || !bmc.interface_ip) return { bmcIp: null, bmcType: null };
    return { bmcIp: bmc.interface_ip, bmcType: bmc.interface_name ?? null };
  }

  private groupAssets(
    raw: RawInfradocAsset[],
    bmcMap: Map<string, { bmcIp: string | null; bmcType: string | null }>,
  ): ClientInfrastructureDto {
    const result: ClientInfrastructureDto = {
      esxiHosts:  [],
      windowsVMs: [],
      nas:        [],
      routers:    [],
    };

    for (const asset of raw) {
      const type = (asset.asset_type ?? '').trim().toLowerCase();
      const make = (asset.asset_make ?? '').trim().toLowerCase();
      const os   = (asset.asset_os   ?? '').trim().toLowerCase();

      if (type === 'server') {
        result.esxiHosts.push(this.mapAsset(asset, bmcMap.get(asset.asset_id)));
      } else if (type === 'virtual machine' && os.startsWith('windows server')) {
        result.windowsVMs.push(this.mapAsset(asset));
      } else if (type === 'firewall/router' || type === 'router' || type === 'firewall') {
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
  ): InfraAssetDto {
    return {
      assetId: Number(raw.asset_id),
      name:    raw.asset_name,
      ip:      raw.interface_ip  || null,
      bmcIp:   bmc?.bmcIp  ?? null,
      bmcType: bmc?.bmcType ?? null,
      os:      raw.asset_os    || null,
      model:   raw.asset_model || null,
    };
  }
}
```

- [ ] **Step 3.5 — Ejecutar tests y confirmar que pasan**

```
cd e:\develop\infraops\backend && npx jest infrastructure.service --no-coverage
```

Esperado: PASS (todos los tests del archivo)

- [ ] **Step 3.6 — Commit**

```
cd e:\develop\infraops && git add backend/src/integrations/infradoc/infrastructure.service.ts backend/src/integrations/infradoc/infrastructure.service.spec.ts && git commit -m "feat(infradoc): resolver IP y tipo de BMC desde interfaces de InfraDoc"
```

---

## Task 4: Payload interfaces — agregar `BmcEntry`

**Files:**
- Modify: `backend/src/maintenance-logs/log-item.interface.ts`
- Modify: `frontend/src/app/core/models/maintenance-log.models.ts`
- Modify: `frontend/src/app/core/models/maintenance-log.models.spec.ts`

- [ ] **Step 4.1 — Escribir el test que falla**

En `frontend/src/app/core/models/maintenance-log.models.spec.ts`, agregar dentro de `describe('ServerMaintenancePayload')`:

```typescript
it('should accept optional bmc section as array of BmcEntry', () => {
  const p: ServerMaintenancePayload = {
    type: 'SERVER_MAINTENANCE',
    windows: { servers: [], dcdiag: 'OK' },
    bmc: [
      { hostId: 2, hostName: 'host1.kemini', firmwareVersion: '2.82', biosVersion: 'U30 v2.86', alertStatus: 'ok' },
      { hostId: 3, hostName: 'host2.kemini', alertStatus: 'alerta', alertNote: 'Fan sensor warning' },
    ],
  };
  expect(p.bmc?.length).toBe(2);
  expect(p.bmc?.[0].alertStatus).toBe('ok');
  expect(p.bmc?.[1].alertNote).toBe('Fan sensor warning');
});

it('should accept BmcEntry without optional fields', () => {
  const p: ServerMaintenancePayload = {
    type: 'SERVER_MAINTENANCE',
    windows: { servers: [], dcdiag: 'OK' },
    bmc: [{ hostId: 1, hostName: 'host1', alertStatus: 'ok' }],
  };
  expect(p.bmc?.[0].firmwareVersion).toBeUndefined();
  expect(p.bmc?.[0].biosVersion).toBeUndefined();
  expect(p.bmc?.[0].alertNote).toBeUndefined();
});
```

- [ ] **Step 4.2 — Ejecutar el test y confirmar que falla**

```
cd e:\develop\infraops\frontend && npx ng test --no-watch --no-progress 2>&1 | grep -A5 "bmc"
```

Esperado: error de TypeScript — `bmc` no existe en `ServerMaintenancePayload`

- [ ] **Step 4.3 — Actualizar `log-item.interface.ts` (backend)**

Agregar `BmcEntry` y el campo `bmc?` en `backend/src/maintenance-logs/log-item.interface.ts`:

```typescript
export interface WindowsServerEntry {
  serverId: number;
  serverName: string;
  rebootScript: 'ok' | 'error' | 'falta_configurar';
  updates: 'ok' | 'pending' | 'failed';
  notes?: string;
}

export interface WindowsSection {
  servers: WindowsServerEntry[];
  dcdiag: string;
  dcdiagDetail?: string;
}

export interface VMwareHostEntry {
  hostId: number;
  hostName: string;
  cpuUsage: number;
  memUsage: number;
  storageUsage: number;
  highUsageVMs?: string[];
  snapshotsOk: boolean;
}

export interface QNAPSection {
  deviceId: number;
  deviceName: string;
  spaceUsed: number;
  raidStatus: 'ok' | 'degraded' | 'failed';
  firmwareUpdated: boolean;
}

export interface VeeamSection {
  status: 'ok' | 'partial' | 'missing';
  missingVMs?: string[];
}

export interface RouterSection {
  firmwareUpdated: boolean;
  firmwareVersion?: string;
  backupDone: boolean;
}

export interface BmcEntry {
  hostId:           number;
  hostName:         string;
  firmwareVersion?: string;
  biosVersion?:     string;
  alertStatus:      'ok' | 'alerta';
  alertNote?:       string;
}

export interface ServerMaintenancePayload {
  type: 'SERVER_MAINTENANCE';
  windows: WindowsSection;
  vmware?: VMwareHostEntry[];
  qnap?: QNAPSection[];
  veeam?: VeeamSection;
  router?: RouterSection;
  bmc?: BmcEntry[];
  notes?: string;
}

export interface TerminalChecks {
  cleanedTemp: boolean;
  windowsUpdates: boolean;
  antivirusOk: boolean;
  diskSpace: boolean;
  licenses: boolean;
}

export interface NetworkChecks {
  connectivity: boolean;
  switches: boolean;
}

export interface TerminalPayload {
  type: 'TERMINAL_MAINTENANCE';
  checks: TerminalChecks;
  network: NetworkChecks;
  observations?: string;
  notes?: string;
}

export type MaintenancePayload = ServerMaintenancePayload | TerminalPayload;
```

- [ ] **Step 4.4 — Actualizar `maintenance-log.models.ts` (frontend)**

Reemplazar el contenido de `frontend/src/app/core/models/maintenance-log.models.ts`:

```typescript
export interface WindowsServerEntry {
  serverId: number;
  serverName: string;
  rebootScript: 'ok' | 'error' | 'falta_configurar';
  updates: 'ok' | 'pending' | 'failed';
  notes?: string;
}

export interface WindowsSection {
  servers: WindowsServerEntry[];
  dcdiag: string;
  dcdiagDetail?: string;
}

export interface VMwareHostEntry {
  hostId: number;
  hostName: string;
  cpuUsage: number;
  memUsage: number;
  storageUsage: number;
  highUsageVMs?: string[];
  snapshotsOk: boolean;
}

export interface QNAPSection {
  deviceId: number;
  deviceName: string;
  spaceUsed: number;
  raidStatus: 'ok' | 'degraded' | 'failed';
  firmwareUpdated: boolean;
}

export interface VeeamSection {
  status: 'ok' | 'partial' | 'missing';
  missingVMs?: string[];
}

export interface RouterSection {
  firmwareUpdated: boolean;
  firmwareVersion?: string;
  backupDone: boolean;
}

export interface BmcEntry {
  hostId:           number;
  hostName:         string;
  firmwareVersion?: string;
  biosVersion?:     string;
  alertStatus:      'ok' | 'alerta';
  alertNote?:       string;
}

export interface ServerMaintenancePayload {
  type: 'SERVER_MAINTENANCE';
  windows: WindowsSection;
  vmware?: VMwareHostEntry[];
  qnap?: QNAPSection[];
  veeam?: VeeamSection;
  router?: RouterSection;
  bmc?: BmcEntry[];
  notes?: string;
}

export interface TerminalChecks {
  cleanedTemp: boolean;
  windowsUpdates: boolean;
  antivirusOk: boolean;
  diskSpace: boolean;
  licenses: boolean;
}

export interface NetworkChecks {
  connectivity: boolean;
  switches: boolean;
}

export interface TerminalPayload {
  type: 'TERMINAL_MAINTENANCE';
  checks: TerminalChecks;
  network: NetworkChecks;
  observations?: string;
  notes?: string;
}

export type MaintenancePayload = ServerMaintenancePayload | TerminalPayload;
```

- [ ] **Step 4.5 — Ejecutar los tests del modelo**

```
cd e:\develop\infraops\frontend && npx ng test --no-watch --no-progress 2>&1 | grep -E "SUMMARY|maintenance-log"
```

Esperado: tests de `maintenance-log.models.spec.ts` pasan

- [ ] **Step 4.6 — Commit**

```
cd e:\develop\infraops && git add backend/src/maintenance-logs/log-item.interface.ts frontend/src/app/core/models/maintenance-log.models.ts frontend/src/app/core/models/maintenance-log.models.spec.ts && git commit -m "feat(logs): agregar BmcEntry y campo bmc a ServerMaintenancePayload"
```

---

## Task 5: `MaintenanceFormComponent` TS — controles BMC + payload

**Files:**
- Modify: `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.ts`
- Modify: `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.spec.ts`

- [ ] **Step 5.1 — Actualizar fixtures en el spec**

En `maintenance-form.component.spec.ts`, actualizar `makeInfra` para incluir `bmcIp`/`bmcType`:

```typescript
const makeInfra = (overrides: Partial<ClientInfrastructure> = {}): ClientInfrastructure => ({
  esxiHosts: [{ assetId: 2, name: 'host1.kemini', ip: '192.168.0.104', bmcIp: '192.168.0.200', bmcType: 'iLO', os: 'VMware ESXi 7.0', model: 'HPE DL380' }],
  windowsVMs: [{ assetId: 3, name: '47DC', ip: '192.168.1.18', bmcIp: null, bmcType: null, os: 'Windows Server 2019', model: null }],
  nas: [{ assetId: 10, name: 'QNAP', ip: '192.168.1.21', bmcIp: null, bmcType: null, os: null, model: 'QNAP TS-453D' }],
  routers: [{ assetId: 1, name: 'MikroTik', ip: '192.168.99.1', bmcIp: null, bmcType: null, os: 'RouterOS', model: 'CCR2004' }],
  ...overrides,
});
```

También actualizar todos los objetos `InfraAsset` literales dentro de los tests de `ngOnChanges`:

```typescript
// En 'should rebuild serverControls when infrastructure input changes'
const infra1 = makeInfra({ windowsVMs: [{ assetId: 1, name: 'VM-A', ip: null, bmcIp: null, bmcType: null, os: 'Windows Server 2019', model: null }] });
// ...
const infra2: ClientInfrastructure = {
  ...infra1,
  windowsVMs: [
    { assetId: 1, name: 'VM-A', ip: null, bmcIp: null, bmcType: null, os: 'Windows Server 2019', model: null },
    { assetId: 2, name: 'VM-B', ip: null, bmcIp: null, bmcType: null, os: 'Windows Server 2022', model: null },
  ],
};

// En 'should rebuild qnapDeviceControls matching nas count'
const infra1 = makeInfra({ esxiHosts: [], nas: [{ assetId: 10, name: 'NAS1', ip: null, bmcIp: null, bmcType: null, os: null, model: null }] });
// ...
const infra2: ClientInfrastructure = {
  ...infra1,
  nas: [
    { assetId: 10, name: 'NAS1', ip: null, bmcIp: null, bmcType: null, os: null, model: null },
    { assetId: 11, name: 'NAS2', ip: null, bmcIp: null, bmcType: null, os: null, model: null },
  ],
};

// En 'should rebuild vmwareHostControls matching esxiHosts count'
const infra1 = makeInfra({ esxiHosts: [{ assetId: 2, name: 'host1', ip: null, bmcIp: null, bmcType: null, os: 'VMware ESXi 7.0', model: null }] });
// ...
const infra2: ClientInfrastructure = {
  ...infra1,
  esxiHosts: [
    { assetId: 2, name: 'host1', ip: null, bmcIp: null, bmcType: null, os: 'VMware ESXi 7.0', model: null },
    { assetId: 22, name: 'host2', ip: null, bmcIp: null, bmcType: null, os: 'VMware ESXi 6.7', model: null },
  ],
};
```

- [ ] **Step 5.2 — Escribir los tests nuevos para BMC**

Agregar un nuevo `describe` en `maintenance-form.component.spec.ts`:

```typescript
// ── BMC controls ────────────────────────────────────────────────────────────

describe('BMC controls', () => {
  it('bmcHostControls should have one entry per esxiHost', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ windowsVMs: [], nas: [], routers: [] }));
    expect(component.bmcHostControls.length).toBe(1);
  });

  it('bmcHostControls should be empty when esxiHosts is empty', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [] }));
    expect(component.bmcHostControls.length).toBe(0);
  });

  it('bmcHasAlert should return false when alertStatus is ok', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ windowsVMs: [], nas: [], routers: [] }));
    component.getBmcGroup(0).patchValue({ alertStatus: 'ok' });
    expect(component.bmcHasAlert(0)).toBeFalse();
  });

  it('bmcHasAlert should return true when alertStatus is alerta', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ windowsVMs: [], nas: [], routers: [] }));
    component.getBmcGroup(0).patchValue({ alertStatus: 'alerta' });
    expect(component.bmcHasAlert(0)).toBeTrue();
  });

  it('getBmcGroup should return the FormGroup for the given index', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ windowsVMs: [], nas: [], routers: [] }));
    const group = component.getBmcGroup(0);
    expect(group.get('firmwareVersion')).not.toBeNull();
    expect(group.get('biosVersion')).not.toBeNull();
    expect(group.get('alertStatus')).not.toBeNull();
    expect(group.get('alertNote')).not.toBeNull();
  });

  it('should rebuild bmcHostControls when infrastructure changes', () => {
    const infra1 = makeInfra({ esxiHosts: [{ assetId: 2, name: 'h1', ip: null, bmcIp: null, bmcType: null, os: null, model: null }] });
    init(makeTask('SERVER_MAINTENANCE'), infra1);
    expect(component.bmcHostControls.length).toBe(1);

    const infra2: ClientInfrastructure = {
      ...infra1,
      esxiHosts: [
        { assetId: 2, name: 'h1', ip: null, bmcIp: null, bmcType: null, os: null, model: null },
        { assetId: 22, name: 'h2', ip: null, bmcIp: null, bmcType: null, os: null, model: null },
      ],
    };
    component.infrastructure = infra2;
    component.ngOnChanges({ infrastructure: { currentValue: infra2, previousValue: infra1, firstChange: false, isFirstChange: () => false } });

    expect(component.bmcHostControls.length).toBe(2);
  });
});

// ── buildPayload — BMC section ───────────────────────────────────────────────

describe('buildPayload — BMC section', () => {
  it('should include bmc array when hasVMware is true', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ windowsVMs: [], nas: [], routers: [] }));
    const payload = component.buildPayload() as ServerMaintenancePayload;
    expect(payload.bmc).toBeDefined();
    expect(Array.isArray(payload.bmc)).toBeTrue();
    expect(payload.bmc!.length).toBe(1);
    expect(payload.bmc![0].hostId).toBe(2);
    expect(payload.bmc![0].hostName).toBe('host1.kemini');
  });

  it('should NOT include bmc when hasVMware is false', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }));
    const payload = component.buildPayload() as ServerMaintenancePayload;
    expect(payload.bmc).toBeUndefined();
  });

  it('should include firmwareVersion and biosVersion when filled', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ windowsVMs: [], nas: [], routers: [] }));
    component.getBmcGroup(0).patchValue({ firmwareVersion: '2.82', biosVersion: 'U30 v2.86' });
    const payload = component.buildPayload() as ServerMaintenancePayload;
    expect(payload.bmc![0].firmwareVersion).toBe('2.82');
    expect(payload.bmc![0].biosVersion).toBe('U30 v2.86');
  });

  it('should omit firmwareVersion and biosVersion when empty', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ windowsVMs: [], nas: [], routers: [] }));
    component.getBmcGroup(0).patchValue({ firmwareVersion: '', biosVersion: '' });
    const payload = component.buildPayload() as ServerMaintenancePayload;
    expect(payload.bmc![0].firmwareVersion).toBeUndefined();
    expect(payload.bmc![0].biosVersion).toBeUndefined();
  });

  it('should include alertNote when alertStatus is alerta', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ windowsVMs: [], nas: [], routers: [] }));
    component.getBmcGroup(0).patchValue({ alertStatus: 'alerta', alertNote: 'Fan warning' });
    const payload = component.buildPayload() as ServerMaintenancePayload;
    expect(payload.bmc![0].alertStatus).toBe('alerta');
    expect(payload.bmc![0].alertNote).toBe('Fan warning');
  });

  it('should NOT include alertNote when alertStatus is ok', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ windowsVMs: [], nas: [], routers: [] }));
    component.getBmcGroup(0).patchValue({ alertStatus: 'ok', alertNote: 'should be ignored' });
    const payload = component.buildPayload() as ServerMaintenancePayload;
    expect(payload.bmc![0].alertStatus).toBe('ok');
    expect(payload.bmc![0].alertNote).toBeUndefined();
  });
});

// ── selectClass — alerta ─────────────────────────────────────────────────────

describe('selectClass — alerta', () => {
  it('should return mf-sel--crit for "alerta"', () => {
    init(makeTask(), makeInfra());
    expect(component.selectClass('alerta')).toBe('mf-sel--crit');
  });
});
```

- [ ] **Step 5.3 — Ejecutar tests y confirmar que fallan**

```
cd e:\develop\infraops\frontend && npx ng test --no-watch --no-progress 2>&1 | grep -E "FAILED|bmcHostControls|bmcHasAlert|getBmcGroup"
```

Esperado: FAIL — `bmcHostControls`, `bmcHasAlert`, `getBmcGroup` no existen

- [ ] **Step 5.4 — Implementar la actualización del componente TS**

Reemplazar el contenido completo de `maintenance-form.component.ts`:

```typescript
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormArray, FormBuilder, FormGroup } from '@angular/forms';
import { Task } from '../../../../core/models/task.models';
import { ClientInfrastructure } from '../../../../core/models/infradoc.models';
import {
  BmcEntry,
  ServerMaintenancePayload,
  TerminalPayload,
} from '../../../../core/models/maintenance-log.models';

@Component({
  selector: 'app-maintenance-form',
  templateUrl: './maintenance-form.component.html',
  styleUrl: './maintenance-form.component.scss',
})
export class MaintenanceFormComponent implements OnChanges {
  @Input() task!: Task;
  @Input() infrastructure!: ClientInfrastructure;

  @Output() requestComplete = new EventEmitter<ServerMaintenancePayload | TerminalPayload>();
  @Output() requestNotDone = new EventEmitter<void>();

  form!: FormGroup;

  constructor(private fb: FormBuilder) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['infrastructure'] && this.infrastructure) {
      this.buildForm();
    }
  }

  // ── Getters condicionales ────────────────────────────────────────────────────

  get hasServers(): boolean { return this.infrastructure?.windowsVMs?.length > 0; }
  get hasVMware(): boolean  { return this.infrastructure?.esxiHosts?.length > 0; }
  get hasQNAP(): boolean    { return this.infrastructure?.nas?.length > 0; }
  get hasVeeam(): boolean   { return this.infrastructure?.esxiHosts?.length > 0; }
  get hasRouter(): boolean  { return this.infrastructure?.routers?.length > 0; }

  get serverControls(): FormArray {
    return this.form.get('servers') as FormArray;
  }

  get vmwareHostControls(): FormArray {
    return this.form.get('vmwareHosts') as FormArray;
  }

  get qnapDeviceControls(): FormArray {
    return this.form.get('qnapDevices') as FormArray;
  }

  get bmcHostControls(): FormArray {
    return this.form.get('bmcHosts') as FormArray;
  }

  get isTerminalType(): boolean {
    return this.task?.type === 'TERMINAL_MAINTENANCE' || this.task?.type === 'SITE_VISIT';
  }

  get isServerType(): boolean {
    return this.task?.type === 'SERVER_MAINTENANCE';
  }

  get isUnsupported(): boolean {
    return this.task?.type === 'AV_CONTROL'
      || this.task?.type === 'UPS_CONTROL'
      || this.task?.type === 'ENDPOINT_INVENTORY';
  }

  // ── Form construction ───────────────────────────────────────────────────────

  private buildForm(): void {
    this.form = this.fb.group({
      servers: this.fb.array(
        this.infrastructure.windowsVMs.map(() => this.fb.group({
          rebootScript: ['ok'],
          updates:      ['ok'],
          notes:        [''],
          expanded:     [false],
        }))
      ),
      dcdiag:       ['OK'],
      dcdiagDetail: [''],
      vmwareHosts: this.fb.array(
        this.infrastructure.esxiHosts.map(() => this.fb.group({
          cpuUsage:     [null as number | null],
          memUsage:     [null as number | null],
          storageUsage: [null as number | null],
          highUsageVMs: [[] as string[]],
          snapshotsOk:  [false],
        }))
      ),
      qnapDevices: this.fb.array(
        this.infrastructure.nas.map(() => this.fb.group({
          spaceUsed:       [null as number | null],
          raidStatus:      ['ok'],
          firmwareUpdated: [false],
        }))
      ),
      bmcHosts: this.fb.array(
        this.infrastructure.esxiHosts.map(() => this.fb.group({
          firmwareVersion: [''],
          biosVersion:     [''],
          alertStatus:     ['ok'],
          alertNote:       [''],
        }))
      ),
      veeamStatus:  ['ok'],
      veeamMissing: [[] as string[]],
      routerFirmwareUpdated: [false],
      routerFirmwareVersion: [''],
      routerBackupDone:      [false],
      cleanedTemp:    [false],
      windowsUpdates: [false],
      antivirusOk:    [false],
      diskSpace:      [false],
      licenses:       [false],
      connectivity: [false],
      switches:     [false],
      observations: [''],
      notes: [''],
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  dcdiagHasError(): boolean {
    return this.form.get('dcdiag')?.value?.startsWith('ERROR') ?? false;
  }

  selectClass(value: string): string {
    if (!value) return 'mf-sel--na';
    if (value === 'ok' || value === 'OK') return 'mf-sel--ok';
    if (value === 'pending' || value === 'degraded' || value === 'falta_configurar' || value === 'ERROR Systemlog') return 'mf-sel--warn';
    if (value === 'error' || value === 'failed' || value === 'ERROR' || value === 'alerta') return 'mf-sel--crit';
    return 'mf-sel--na';
  }

  metricClass(value: number | null, warnThreshold: number, critThreshold: number): string {
    if (value === null || value === undefined || isNaN(value)) return '';
    if (value >= critThreshold) return 'mf-inp--crit';
    if (value >= warnThreshold) return 'mf-inp--warn';
    return 'mf-inp--ok';
  }

  showHighVMsForHost(i: number): boolean {
    const ctrl = this.vmwareHostControls.at(i);
    const cpu     = Number(ctrl.get('cpuUsage')?.value);
    const mem     = Number(ctrl.get('memUsage')?.value);
    const storage = Number(ctrl.get('storageUsage')?.value);
    return cpu >= 60 || mem >= 70 || storage >= 70;
  }

  toggleExpand(index: number): void {
    const ctrl = this.serverControls.at(index).get('expanded');
    ctrl?.setValue(!ctrl.value);
  }

  getServerGroup(index: number): FormGroup {
    return this.serverControls.at(index) as FormGroup;
  }

  getBmcGroup(index: number): FormGroup {
    return this.bmcHostControls.at(index) as FormGroup;
  }

  bmcHasAlert(index: number): boolean {
    return this.getBmcGroup(index).get('alertStatus')?.value === 'alerta';
  }

  // ── Payload construction ────────────────────────────────────────────────────

  buildPayload(): ServerMaintenancePayload | TerminalPayload {
    const v = this.form.value;

    if (this.isTerminalType) {
      const payload: TerminalPayload = {
        type: 'TERMINAL_MAINTENANCE',
        checks: {
          cleanedTemp:    v.cleanedTemp,
          windowsUpdates: v.windowsUpdates,
          antivirusOk:    v.antivirusOk,
          diskSpace:      v.diskSpace,
          licenses:       v.licenses,
        },
        network: {
          connectivity: v.connectivity,
          switches:     v.switches,
        },
        observations: v.observations || undefined,
        notes:        v.notes || undefined,
      };
      return payload;
    }

    const servers = this.infrastructure.windowsVMs.map((vm, i) => ({
      serverId:     vm.assetId,
      serverName:   vm.name,
      rebootScript: v.servers[i]?.rebootScript ?? 'ok',
      updates:      v.servers[i]?.updates ?? 'ok',
      notes:        v.servers[i]?.notes || undefined,
    }));

    const payload: ServerMaintenancePayload = {
      type: 'SERVER_MAINTENANCE',
      windows: {
        servers,
        dcdiag:       v.dcdiag,
        dcdiagDetail: this.dcdiagHasError() ? (v.dcdiagDetail || undefined) : undefined,
      },
      notes: v.notes || undefined,
    };

    if (this.hasVMware) {
      payload.vmware = this.infrastructure.esxiHosts.map((host, i) => {
        const ctrl = this.vmwareHostControls.at(i).value;
        return {
          hostId:       host.assetId,
          hostName:     host.name,
          cpuUsage:     Number(ctrl.cpuUsage),
          memUsage:     Number(ctrl.memUsage),
          storageUsage: Number(ctrl.storageUsage),
          highUsageVMs: ctrl.highUsageVMs?.length ? ctrl.highUsageVMs : undefined,
          snapshotsOk:  ctrl.snapshotsOk,
        };
      });

      payload.bmc = this.infrastructure.esxiHosts.map((host, i) => {
        const ctrl = this.bmcHostControls.at(i).value;
        const entry: BmcEntry = {
          hostId:      host.assetId,
          hostName:    host.name,
          alertStatus: ctrl.alertStatus,
        };
        if (ctrl.firmwareVersion) entry.firmwareVersion = ctrl.firmwareVersion;
        if (ctrl.biosVersion)     entry.biosVersion     = ctrl.biosVersion;
        if (ctrl.alertStatus === 'alerta' && ctrl.alertNote) entry.alertNote = ctrl.alertNote;
        return entry;
      });
    }

    if (this.hasQNAP) {
      payload.qnap = this.infrastructure.nas.map((nas, i) => {
        const ctrl = this.qnapDeviceControls.at(i).value;
        return {
          deviceId:        nas.assetId,
          deviceName:      nas.name,
          spaceUsed:       Number(ctrl.spaceUsed),
          raidStatus:      ctrl.raidStatus,
          firmwareUpdated: ctrl.firmwareUpdated,
        };
      });
    }

    if (this.hasVeeam) {
      payload.veeam = {
        status:     v.veeamStatus,
        missingVMs: v.veeamStatus !== 'ok' ? (v.veeamMissing ?? []) : undefined,
      };
    }

    if (this.hasRouter) {
      payload.router = {
        firmwareUpdated: v.routerFirmwareUpdated,
        firmwareVersion: v.routerFirmwareVersion || undefined,
        backupDone:      v.routerBackupDone,
      };
    }

    return payload;
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  submit(): void {
    this.requestComplete.emit(this.buildPayload());
  }

  submitNotDone(): void {
    this.requestNotDone.emit();
  }
}
```

- [ ] **Step 5.5 — Ejecutar todos los tests del componente y confirmar que pasan**

```
cd e:\develop\infraops\frontend && npx ng test --no-watch --no-progress 2>&1 | grep -E "SUMMARY|maintenance-form"
```

Esperado: PASS (todos los tests del componente)

- [ ] **Step 5.6 — Commit**

```
cd e:\develop\infraops && git add frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.ts frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.spec.ts && git commit -m "feat(maintenance-form): agregar FormArray bmcHosts, getters y payload BMC"
```

---

## Task 6: `MaintenanceFormComponent` HTML — sección BMC

**Files:**
- Modify: `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.html`

- [ ] **Step 6.1 — Agregar la sección BMC al template**

En `maintenance-form.component.html`, agregar el bloque siguiente **inmediatamente después** del bloque `<!-- ── VMware ESXi ──... -->` (después de su `</ng-container>` de cierre, antes del bloque `<!-- ── QNAP / NAS ──... -->`):

```html
  <!-- ── BMC / Gestión remota ───────────────────────────── -->
  <ng-container *ngIf="hasVMware">

    <div class="mf-section-lbl">BMC / Gestión remota</div>

    <div class="mf-vmware-grid" formArrayName="bmcHosts">
      <div *ngFor="let _ of bmcHostControls.controls; let i = index"
           [formGroupName]="i"
           class="mf-cl-rpt mf-vmware-card">

        <div class="mf-cl-rpt-hdr">
          <div class="mf-cl-rpt-dot" style="background:var(--srv)"></div>
          <span class="mf-cl-rpt-label">{{ infrastructure.esxiHosts[i].name }}</span>
          <span *ngIf="infrastructure.esxiHosts[i].bmcType"
                class="badge badge--srv">{{ infrastructure.esxiHosts[i].bmcType }}</span>
          <span class="mono mf-host-ip">{{ infrastructure.esxiHosts[i].bmcIp ?? '—' }}</span>
        </div>

        <mat-form-field appearance="fill" subscriptSizing="dynamic" class="mf-form-field">
          <mat-label>Versión firmware</mat-label>
          <input matInput formControlName="firmwareVersion" placeholder="Ej: 2.82" />
        </mat-form-field>

        <mat-form-field appearance="fill" subscriptSizing="dynamic" class="mf-form-field">
          <mat-label>Versión BIOS</mat-label>
          <input matInput formControlName="biosVersion" placeholder="Ej: U30 v2.86" />
        </mat-form-field>

        <mat-form-field appearance="fill" subscriptSizing="dynamic" class="mf-form-field"
                        [ngClass]="selectClass(getBmcGroup(i).get('alertStatus')?.value)">
          <mat-label>Alertas detectadas</mat-label>
          <mat-select formControlName="alertStatus">
            <mat-option value="ok">OK</mat-option>
            <mat-option value="alerta">ALERTA</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field *ngIf="bmcHasAlert(i)"
                        appearance="fill" subscriptSizing="dynamic"
                        class="mf-form-field mf-dcdiag-detail-ff">
          <mat-label>Nota de alerta</mat-label>
          <input matInput formControlName="alertNote"
                 placeholder="Describí la alerta detectada..." />
        </mat-form-field>

      </div>
    </div>

  </ng-container>
```

- [ ] **Step 6.2 — Verificar que los tests del componente siguen pasando**

```
cd e:\develop\infraops\frontend && npx ng test --no-watch --no-progress 2>&1 | grep -E "SUMMARY|ERROR"
```

Esperado: PASS — sin errores de compilación ni tests rotos

- [ ] **Step 6.3 — Commit final**

```
cd e:\develop\infraops && git add frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.html && git commit -m "feat(maintenance-form): agregar sección BMC al formulario de mantenimiento de servidores"
```

---

## Self-review del plan

**Cobertura del spec:**
- ✅ `getAssetInterfaces()` en `InfradocAssetsService` — Task 1
- ✅ `bmcIp`/`bmcType` en DTOs — Task 2
- ✅ Resolución de BMC en `InfrastructureService` (iLO/iDRAC/xClarity, case-insensitive, primera coincidencia, null si no hay) — Task 3
- ✅ `BmcEntry` en interfaces de payload — Task 4
- ✅ FormArray `bmcHosts` + getters + `bmcHasAlert` + `buildPayload` — Task 5
- ✅ Sección BMC en el template con `alertNote` condicional — Task 6
- ✅ `ip` (VMware) sigue tomándose de `getAssets` sin cambios — Task 3/Step 3.4

**Consistencia de tipos:**
- `BmcEntry.alertStatus: 'ok' | 'alerta'` — definido en Task 4, usado en Task 5
- `bmcIp: string | null`, `bmcType: string | null` — definidos en Task 2, usados en Tasks 3 y 5
- `getBmcGroup(i)` y `bmcHasAlert(i)` — definidos en Task 5, usados en Task 6
- `selectClass('alerta')` → `'mf-sel--crit'` — añadido en Task 5, usado en Task 6
