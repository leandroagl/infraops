# QNAP Auto-Probe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un botón "Obtener datos" por dispositivo QNAP/NAS en el formulario de mantenimiento que consulta la API QTS automáticamente, pre-pobla campos read-only, y persiste el snapshot completo en el payload del MaintenanceLog para historial.

**Architecture:** El técnico presiona "Obtener datos" → frontend llama `GET /infradoc/qnap-probe/:assetId` → backend recupera `asset_uri` de InfraDoc, autentica contra QNAP QTS CGI API, agrega sysinfo/volumes/disks, y retorna un `QnapSnapshot`. Los datos auto-obtenidos viven en estado del componente (`qnapFetchedData[]`) y se fusionan con los campos manuales al guardar. En modo readOnly (historial), el snapshot se reconstruye desde el payload.

**Tech Stack:** NestJS + `@nestjs/axios` (HttpService) · Angular 19 · Angular Material · Reactive Forms · Jest (backend) · Angular TestBed (frontend)

## Global Constraints

- TDD obligatorio: escribir test fallando antes de implementar
- Sin standalone components Angular
- Solo `appearance="outline"` en `mat-form-field`
- Sin `::ng-deep` — usar CSS custom properties
- Credenciales QNAP vía env vars: `QNAP_READER_USER` / `QNAP_READER_PASS`
- SSL skip en QNAP: `httpsAgent: new https.Agent({ rejectUnauthorized: false })`
- Los endpoints exactos de QNAP QTS **deben verificarse contra dispositivos reales** antes de deploy — el plan usa los endpoints CGI API documentados (funciona en QTS 4.x y 5.x), con fallbacks en comentarios donde la respuesta puede variar
- Un archivo a la vez: commitear al finalizar cada tarea

---

## File Map

**Backend — crear:**
- `backend/src/integrations/qnap/dto/qnap-snapshot.dto.ts`
- `backend/src/integrations/qnap/qnap-api.service.ts`
- `backend/src/integrations/qnap/qnap-api.service.spec.ts`
- `backend/src/integrations/qnap/qnap-probe.service.ts`
- `backend/src/integrations/qnap/qnap-probe.service.spec.ts`
- `backend/src/integrations/qnap/qnap-probe.controller.ts`
- `backend/src/integrations/qnap/qnap-probe.controller.spec.ts`
- `backend/src/integrations/qnap/qnap-probe.module.ts`

**Backend — modificar:**
- `backend/src/integrations/infradoc/infradoc-assets.service.ts` — agregar `asset_uri` a `RawInfradocAsset` + método `getAssetById`
- `backend/src/integrations/infradoc/infradoc-assets.service.spec.ts` — tests del nuevo método
- `backend/src/app.module.ts` — importar `QnapProbeModule`

**Frontend — crear:**
- `frontend/src/app/core/services/qnap-probe.service.ts`
- `frontend/src/app/features/technician/task-drawer/maintenance-form/qnap-health-card/qnap-health-card.component.ts`
- `frontend/src/app/features/technician/task-drawer/maintenance-form/qnap-health-card/qnap-health-card.component.html`
- `frontend/src/app/features/technician/task-drawer/maintenance-form/qnap-health-card/qnap-health-card.component.scss`
- `frontend/src/app/features/technician/task-drawer/maintenance-form/qnap-health-card/qnap-health-card.component.spec.ts`

**Frontend — modificar:**
- `frontend/src/app/core/models/maintenance-log.models.ts` — actualizar `QNAPSection`
- `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.ts` — `qnapFetchedData`, FormArray simplificado, `buildPayload`, `patchFormFromPayload`
- `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.html` — reemplazar sección QNAP con `app-qnap-health-card`
- `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.spec.ts` — actualizar tests QNAP
- `frontend/src/app/features/technician/technician.module.ts` — declarar `QnapHealthCardComponent`, agregar `MatProgressSpinnerModule`

---

## Task 1: Branch de trabajo

**Files:** ninguno (git)

- [ ] **Paso 1: Crear branch**

```bash
git checkout -b feature/qnap-probe
```

- [ ] **Paso 2: Verificar branch activo**

```bash
git branch --show-current
```

Expected: `feature/qnap-probe`

---

## Task 2: Backend — `asset_uri` en `InfradocAssetsService`

**Files:**
- Modify: `backend/src/integrations/infradoc/infradoc-assets.service.ts`
- Modify: `backend/src/integrations/infradoc/infradoc-assets.service.spec.ts`

**Interfaces:**
- Produces: `RawInfradocAsset.asset_uri: string | null`, `InfradocAssetsService.getAssetById(id: number): Promise<RawInfradocAsset | null>`

- [ ] **Paso 1: Escribir los tests fallando**

Agregar al final del archivo `infradoc-assets.service.spec.ts`, dentro del `describe('InfradocAssetsService')` existente:

```typescript
describe('getAssetById', () => {
  it('devuelve el asset con asset_uri cuando InfraDoc lo encuentra', async () => {
    const asset = makeRawAsset({ asset_uri: 'http://192.168.1.10:8080' });
    httpService.get.mockReturnValue(
      of(axiosRes({ success: 'True', count: 1, data: [asset] })),
    );

    const result = await service.getAssetById(101);

    expect(result).not.toBeNull();
    expect(result!.asset_id).toBe('101');
    expect(result!.asset_uri).toBe('http://192.168.1.10:8080');
    expect(httpService.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/assets/read.php'),
      expect.objectContaining({
        params: expect.objectContaining({ asset_id: 101 }),
      }),
    );
  });

  it('devuelve null cuando InfraDoc no encuentra el asset', async () => {
    httpService.get.mockReturnValue(
      of(axiosRes({ success: 'True', count: 0, data: [] })),
    );

    const result = await service.getAssetById(999);

    expect(result).toBeNull();
  });

  it('devuelve null cuando InfraDoc devuelve success False', async () => {
    httpService.get.mockReturnValue(
      of(axiosRes({ success: 'False', message: 'Not found' })),
    );

    const result = await service.getAssetById(101);

    expect(result).toBeNull();
  });

  it('devuelve asset con asset_uri null cuando el campo no está en la respuesta', async () => {
    const asset = makeRawAsset(); // sin asset_uri
    httpService.get.mockReturnValue(
      of(axiosRes({ success: 'True', count: 1, data: [asset] })),
    );

    const result = await service.getAssetById(101);

    expect(result).not.toBeNull();
    expect(result!.asset_uri).toBeNull();
  });
});
```

También actualizar `makeRawAsset` para incluir `asset_uri`:

```typescript
const makeRawAsset = (override: Record<string, unknown> = {}) => ({
  asset_id: '101',
  asset_name: 'SRV-DC01',
  asset_type: 'Server',
  asset_ip: '10.0.1.5',
  asset_os: 'Windows Server 2019',
  asset_model: 'Dell PowerEdge R640',
  asset_uri: null,
  ...override,
});
```

- [ ] **Paso 2: Correr tests y verificar que fallan**

```bash
cd backend && npx jest infradoc-assets.service.spec.ts --no-coverage
```

Expected: falla con `service.getAssetById is not a function`

- [ ] **Paso 3: Implementar los cambios en `infradoc-assets.service.ts`**

Agregar `asset_uri` a `RawInfradocAsset`:

```typescript
export interface RawInfradocAsset {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  asset_make: string | null;
  asset_os: string | null;
  asset_model: string | null;
  asset_description: string | null;
  interface_ip: string | null;
  interface_name: string | null;
  asset_uri: string | null;  // URL de gestión del dispositivo (ej: http://192.168.1.10:8080)
}
```

Agregar método `getAssetById` al final de la clase `InfradocAssetsService`:

```typescript
async getAssetById(assetId: number): Promise<RawInfradocAsset | null> {
  const baseUrl = process.env.INFRADOC_URL;
  const apiKey = process.env.INFRADOC_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error(
      'INFRADOC_URL and INFRADOC_API_KEY deben estar configurados',
    );
  }
  const url = `${baseUrl}/api/v1/assets/read.php`;
  const response = await firstValueFrom(
    this.httpService.get(url, {
      params: { api_key: apiKey, asset_id: assetId },
    }),
  );

  if (response.data.success !== 'True') return null;

  const data = response.data.data;
  if (!Array.isArray(data) || data.length === 0) return null;

  const raw = data[0] as RawInfradocAsset;
  return {
    ...raw,
    asset_uri: (raw.asset_uri as string) || null,
  };
}
```

- [ ] **Paso 4: Correr tests y verificar que pasan**

```bash
cd backend && npx jest infradoc-assets.service.spec.ts --no-coverage
```

Expected: todos los tests pasan

- [ ] **Paso 5: Commit**

```bash
git add backend/src/integrations/infradoc/infradoc-assets.service.ts \
        backend/src/integrations/infradoc/infradoc-assets.service.spec.ts
git commit -m "feat(infradoc): agregar asset_uri a RawInfradocAsset y método getAssetById"
```

---

## Task 3: Backend — `QnapSnapshot` DTO + `QnapApiService`

**Files:**
- Create: `backend/src/integrations/qnap/dto/qnap-snapshot.dto.ts`
- Create: `backend/src/integrations/qnap/qnap-api.service.ts`
- Create: `backend/src/integrations/qnap/qnap-api.service.spec.ts`

**Interfaces:**
- Consumes: `HttpService` de `@nestjs/axios`
- Produces: `QnapSnapshotDto`, `QnapApiService.probe(baseUrl, user, pass): Promise<QnapSnapshotDto>`

- [ ] **Paso 1: Crear el DTO**

Crear `backend/src/integrations/qnap/dto/qnap-snapshot.dto.ts`:

```typescript
export class QnapSnapshotDto {
  spaceUsedPercent: number;
  totalSpaceGb: number;
  raidStatus: 'ok' | 'degraded' | 'failed';
  diskCount: number;
  diskErrors: number;
  currentFirmware: string;
  collectedAt: string;
}
```

- [ ] **Paso 2: Escribir los tests fallando**

Crear `backend/src/integrations/qnap/qnap-api.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { AxiosHeaders, AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';
import { QnapApiService } from './qnap-api.service';

const axiosRes = (data: object): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: { headers: new AxiosHeaders() },
});

// Respuestas simuladas de QNAP QTS CGI API
// NOTA: verificar campos exactos contra dispositivos reales antes de deploy
const AUTH_RESPONSE = {
  authSid: 'test-sid-abc123',
  version: '5.1.5.2647',
};

const VOLUME_RESPONSE = {
  // QTS 4.x usa 'volumeList', QTS 5.x puede usar 'volumes' — ambos soportados
  volumes: [
    { totalSize: 8000000, freeSize: 5600000, volumeStatus: 0 }, // OK, ~8TB total, ~30% usado
  ],
};

const DISK_RESPONSE = {
  // QTS puede usar 'disks' o 'diskList' — ambos soportados
  disks: [
    { diskStatus: '0' }, // normal
    { diskStatus: '0' }, // normal
    { diskStatus: '0' }, // normal
    { diskStatus: '0' }, // normal
  ],
};

describe('QnapApiService', () => {
  let service: QnapApiService;
  let httpService: { get: jest.Mock; post: jest.Mock };

  beforeEach(async () => {
    httpService = { get: jest.fn(), post: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QnapApiService,
        { provide: HttpService, useValue: httpService },
      ],
    }).compile();

    service = module.get<QnapApiService>(QnapApiService);
  });

  it('retorna QnapSnapshot con datos correctos cuando QTS responde OK', async () => {
    httpService.post.mockReturnValueOnce(of(axiosRes(AUTH_RESPONSE)));
    httpService.get
      .mockReturnValueOnce(of(axiosRes(VOLUME_RESPONSE))) // volumes
      .mockReturnValueOnce(of(axiosRes(DISK_RESPONSE)))   // disks
      .mockReturnValueOnce(of(axiosRes({})));             // logout

    const result = await service.probe('http://192.168.1.10:8080', 'admin', 'pass');

    expect(result.spaceUsedPercent).toBe(30);
    expect(result.totalSpaceGb).toBeGreaterThan(0);
    expect(result.raidStatus).toBe('ok');
    expect(result.diskCount).toBe(4);
    expect(result.diskErrors).toBe(0);
    expect(result.currentFirmware).toBe('5.1.5.2647');
    expect(result.collectedAt).toBeTruthy();
  });

  it('detecta raidStatus degraded cuando algún volumen tiene volumeStatus 1', async () => {
    httpService.post.mockReturnValueOnce(of(axiosRes(AUTH_RESPONSE)));
    httpService.get
      .mockReturnValueOnce(of(axiosRes({
        volumes: [{ totalSize: 8000000, freeSize: 5600000, volumeStatus: 1 }],
      })))
      .mockReturnValueOnce(of(axiosRes(DISK_RESPONSE)))
      .mockReturnValueOnce(of(axiosRes({})));

    const result = await service.probe('http://192.168.1.10:8080', 'admin', 'pass');

    expect(result.raidStatus).toBe('degraded');
  });

  it('detecta raidStatus failed cuando algún volumen tiene volumeStatus 2 o mayor', async () => {
    httpService.post.mockReturnValueOnce(of(axiosRes(AUTH_RESPONSE)));
    httpService.get
      .mockReturnValueOnce(of(axiosRes({
        volumes: [{ totalSize: 8000000, freeSize: 5600000, volumeStatus: 2 }],
      })))
      .mockReturnValueOnce(of(axiosRes(DISK_RESPONSE)))
      .mockReturnValueOnce(of(axiosRes({})));

    const result = await service.probe('http://192.168.1.10:8080', 'admin', 'pass');

    expect(result.raidStatus).toBe('failed');
  });

  it('cuenta diskErrors correctamente cuando hay discos con estado distinto de 0/normal', async () => {
    httpService.post.mockReturnValueOnce(of(axiosRes(AUTH_RESPONSE)));
    httpService.get
      .mockReturnValueOnce(of(axiosRes(VOLUME_RESPONSE)))
      .mockReturnValueOnce(of(axiosRes({
        disks: [
          { diskStatus: '0' },    // normal
          { diskStatus: '1' },    // warning
          { diskStatus: 'error' }, // error
          { diskStatus: '0' },    // normal
        ],
      })))
      .mockReturnValueOnce(of(axiosRes({})));

    const result = await service.probe('http://192.168.1.10:8080', 'admin', 'pass');

    expect(result.diskErrors).toBe(2);
  });

  it('soporta respuesta de volúmenes en campo volumeList (QTS 4.x)', async () => {
    httpService.post.mockReturnValueOnce(of(axiosRes(AUTH_RESPONSE)));
    httpService.get
      .mockReturnValueOnce(of(axiosRes({
        volumeList: [{ totalSize: 4000000, freeSize: 3000000, volumeStatus: 0 }],
      })))
      .mockReturnValueOnce(of(axiosRes(DISK_RESPONSE)))
      .mockReturnValueOnce(of(axiosRes({})));

    const result = await service.probe('http://192.168.1.10:8080', 'admin', 'pass');

    expect(result.totalSpaceGb).toBeGreaterThan(0);
    expect(result.raidStatus).toBe('ok');
  });

  it('soporta respuesta de discos en campo diskList (QTS 4.x)', async () => {
    httpService.post.mockReturnValueOnce(of(axiosRes(AUTH_RESPONSE)));
    httpService.get
      .mockReturnValueOnce(of(axiosRes(VOLUME_RESPONSE)))
      .mockReturnValueOnce(of(axiosRes({
        diskList: [{ diskStatus: '0' }, { diskStatus: '0' }],
      })))
      .mockReturnValueOnce(of(axiosRes({})));

    const result = await service.probe('http://192.168.1.10:8080', 'admin', 'pass');

    expect(result.diskCount).toBe(2);
  });

  it('lanza error cuando auth falla (no retorna authSid)', async () => {
    httpService.post.mockReturnValueOnce(of(axiosRes({ error: 'invalid_user' })));

    await expect(
      service.probe('http://192.168.1.10:8080', 'admin', 'wrong'),
    ).rejects.toThrow('QNAP auth failed');
  });

  it('llama logout incluso si volumes falla (try/finally)', async () => {
    // Llamadas secuenciales: auth → volumes (falla) → logout (via finally)
    // disks no se llama porque volumes falló primero
    httpService.post.mockReturnValueOnce(of(axiosRes(AUTH_RESPONSE)));
    httpService.get
      .mockReturnValueOnce(throwError(() => new Error('network error'))) // volumes falla
      .mockReturnValueOnce(of(axiosRes({}))); // logout (via finally)

    await expect(
      service.probe('http://192.168.1.10:8080', 'admin', 'pass'),
    ).rejects.toThrow();

    expect(httpService.get).toHaveBeenCalledTimes(2); // volumes + logout
  });

  it('usa currentFirmware unknown cuando auth response no incluye version', async () => {
    httpService.post.mockReturnValueOnce(
      of(axiosRes({ authSid: 'test-sid', /* sin version */ })),
    );
    httpService.get
      .mockReturnValueOnce(of(axiosRes(VOLUME_RESPONSE)))
      .mockReturnValueOnce(of(axiosRes(DISK_RESPONSE)))
      .mockReturnValueOnce(of(axiosRes({})));

    const result = await service.probe('http://192.168.1.10:8080', 'admin', 'pass');

    expect(result.currentFirmware).toBe('unknown');
  });
});
```

- [ ] **Paso 3: Correr tests y verificar que fallan**

```bash
cd backend && npx jest qnap-api.service.spec.ts --no-coverage
```

Expected: falla con `Cannot find module './qnap-api.service'`

- [ ] **Paso 4: Implementar `QnapApiService`**

Crear `backend/src/integrations/qnap/qnap-api.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { QnapSnapshotDto } from './dto/qnap-snapshot.dto';

@Injectable()
export class QnapApiService {
  constructor(private readonly httpService: HttpService) {}

  async probe(baseUrl: string, user: string, pass: string): Promise<QnapSnapshotDto> {
    const { sid, firmware } = await this.authenticate(baseUrl, user, pass);
    try {
      return await this.fetchData(baseUrl, sid, firmware);
    } finally {
      await this.logout(baseUrl, sid);
    }
  }

  private async authenticate(
    baseUrl: string,
    user: string,
    pass: string,
  ): Promise<{ sid: string; firmware: string }> {
    // QNAP QTS CGI auth — funciona en QTS 4.x y 5.x
    // Verificar contra dispositivo real: algunos requieren MD5(pass) en lugar de plain text
    const res = await firstValueFrom(
      this.httpService.post(
        `${baseUrl}/cgi-bin/authLogin.cgi`,
        new URLSearchParams({ user, passwd: pass, serviceKey: '1' }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      ),
    );

    // Respuesta puede venir como { authSid: '...' } o anidada en QDocRoot
    const data = res.data ?? {};
    const sid: string | undefined =
      data.authSid ?? data?.QDocRoot?.authSid ?? data.auth_sid;

    if (!sid) throw new Error('QNAP auth failed — verificar credenciales o endpoint');

    const firmware: string = data.version ?? data.firmware_version ?? 'unknown';
    return { sid, firmware };
  }

  private async fetchData(
    baseUrl: string,
    sid: string,
    firmware: string,
  ): Promise<QnapSnapshotDto> {
    // Llamadas secuenciales para simplificar el manejo de errores y logout
    const volRes = await firstValueFrom(
      this.httpService.get(`${baseUrl}/cgi-bin/storage/qbox.cgi`, {
        // Verificar: algunos QTS usan 'getVolumeList', otros 'volumeList'
        params: { func: 'getVolumeList', sid },
      }),
    );

    const diskRes = await firstValueFrom(
      this.httpService.get(`${baseUrl}/cgi-bin/storage/disk_info.cgi`, {
        params: { sid },
      }),
    );

    // Soporte dual: QTS 5.x usa 'volumes', QTS 4.x usa 'volumeList'
    const volumes: Array<{ totalSize: unknown; freeSize: unknown; volumeStatus: unknown }> =
      volRes.data?.volumes ?? volRes.data?.volumeList ?? [];

    const totalKb = volumes.reduce((sum, v) => sum + (Number(v.totalSize) || 0), 0);
    const usedKb = volumes.reduce(
      (sum, v) => sum + (Number(v.totalSize) - Number(v.freeSize) || 0),
      0,
    );
    const totalSpaceGb = Math.round(totalKb / 1024 / 1024);
    const spaceUsedPercent = totalKb > 0 ? Math.round((usedKb / totalKb) * 100) : 0;

    // volumeStatus: 0=normal, 1=degraded, ≥2=failed (verificar contra dispositivo real)
    const maxVolumeStatus = volumes.reduce(
      (max, v) => Math.max(max, Number(v.volumeStatus) || 0),
      0,
    );
    const raidStatus: 'ok' | 'degraded' | 'failed' =
      maxVolumeStatus >= 2 ? 'failed' : maxVolumeStatus === 1 ? 'degraded' : 'ok';

    // Soporte dual: QTS 5.x usa 'disks', QTS 4.x usa 'diskList'
    const disks: Array<{ diskStatus: unknown }> =
      diskRes.data?.disks ?? diskRes.data?.diskList ?? [];

    const diskCount = disks.length;
    // diskStatus: '0' o 'normal' = OK; cualquier otro valor = error/warning
    const diskErrors = disks.filter(
      (d) => String(d.diskStatus) !== '0' && String(d.diskStatus) !== 'normal',
    ).length;

    return {
      spaceUsedPercent,
      totalSpaceGb,
      raidStatus,
      diskCount,
      diskErrors,
      currentFirmware: firmware,
      collectedAt: new Date().toISOString(),
    };
  }

  private async logout(baseUrl: string, sid: string): Promise<void> {
    await firstValueFrom(
      this.httpService.get(`${baseUrl}/cgi-bin/authLogout.cgi`, {
        params: { sid },
      }),
    ).catch(() => {}); // Best effort — no fallar si logout falla
  }
}
```

- [ ] **Paso 5: Correr tests y verificar que pasan**

```bash
cd backend && npx jest qnap-api.service.spec.ts --no-coverage
```

Expected: todos los tests pasan

- [ ] **Paso 6: Commit**

```bash
git add backend/src/integrations/qnap/
git commit -m "feat(qnap): agregar QnapSnapshotDto y QnapApiService con soporte QTS 4.x/5.x"
```

---

## Task 4: Backend — `QnapProbeService` + Controller + Module

**Files:**
- Create: `backend/src/integrations/qnap/qnap-probe.service.ts`
- Create: `backend/src/integrations/qnap/qnap-probe.service.spec.ts`
- Create: `backend/src/integrations/qnap/qnap-probe.controller.ts`
- Create: `backend/src/integrations/qnap/qnap-probe.controller.spec.ts`
- Create: `backend/src/integrations/qnap/qnap-probe.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `QnapApiService.probe(baseUrl, user, pass)` · `InfradocAssetsService.getAssetById(id)` · env vars `QNAP_READER_USER` / `QNAP_READER_PASS`
- Produces: endpoint `GET /infradoc/qnap-probe/:assetId` → `QnapSnapshotDto`

- [ ] **Paso 1: Escribir test de `QnapProbeService`**

Crear `backend/src/integrations/qnap/qnap-probe.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { QnapProbeService } from './qnap-probe.service';
import { QnapApiService } from './qnap-api.service';
import { InfradocAssetsService } from '../infradoc/infradoc-assets.service';
import { QnapSnapshotDto } from './dto/qnap-snapshot.dto';

const makeAsset = (override = {}) => ({
  asset_id: '10',
  asset_name: 'QNAP-NAS',
  asset_type: 'NAS',
  asset_make: 'QNAP',
  asset_os: null,
  asset_model: 'TS-453D',
  asset_description: null,
  interface_ip: '192.168.1.10',
  interface_name: null,
  asset_uri: 'http://192.168.1.10:8080',
  ...override,
});

const makeSnapshot = (): QnapSnapshotDto => ({
  spaceUsedPercent: 30,
  totalSpaceGb: 8000,
  raidStatus: 'ok',
  diskCount: 4,
  diskErrors: 0,
  currentFirmware: '5.1.5.2647',
  collectedAt: '2026-06-20T14:32:00.000Z',
});

describe('QnapProbeService', () => {
  let service: QnapProbeService;
  let infradocAssets: { getAssetById: jest.Mock };
  let qnapApi: { probe: jest.Mock };
  let savedUser: string | undefined;
  let savedPass: string | undefined;

  beforeEach(async () => {
    savedUser = process.env.QNAP_READER_USER;
    savedPass = process.env.QNAP_READER_PASS;
    process.env.QNAP_READER_USER = 'reader';
    process.env.QNAP_READER_PASS = 'secret';

    infradocAssets = { getAssetById: jest.fn() };
    qnapApi = { probe: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QnapProbeService,
        { provide: InfradocAssetsService, useValue: infradocAssets },
        { provide: QnapApiService, useValue: qnapApi },
      ],
    }).compile();

    service = module.get<QnapProbeService>(QnapProbeService);
  });

  afterEach(() => {
    process.env.QNAP_READER_USER = savedUser;
    process.env.QNAP_READER_PASS = savedPass;
  });

  it('retorna QnapSnapshot cuando asset existe y QNAP responde', async () => {
    infradocAssets.getAssetById.mockResolvedValue(makeAsset());
    qnapApi.probe.mockResolvedValue(makeSnapshot());

    const result = await service.probe(10);

    expect(result).toEqual(makeSnapshot());
    expect(qnapApi.probe).toHaveBeenCalledWith(
      'http://192.168.1.10:8080',
      'reader',
      'secret',
    );
  });

  it('lanza NotFoundException cuando el asset no existe en InfraDoc', async () => {
    infradocAssets.getAssetById.mockResolvedValue(null);

    await expect(service.probe(999)).rejects.toThrow(NotFoundException);
  });

  it('lanza ServiceUnavailableException cuando el asset no tiene asset_uri', async () => {
    infradocAssets.getAssetById.mockResolvedValue(makeAsset({ asset_uri: null }));

    await expect(service.probe(10)).rejects.toThrow(ServiceUnavailableException);
  });

  it('lanza ServiceUnavailableException cuando QNAP API falla', async () => {
    infradocAssets.getAssetById.mockResolvedValue(makeAsset());
    qnapApi.probe.mockRejectedValue(new Error('QNAP auth failed'));

    await expect(service.probe(10)).rejects.toThrow(ServiceUnavailableException);
  });

  it('lanza Error cuando QNAP_READER_USER no está configurado', async () => {
    delete process.env.QNAP_READER_USER;
    infradocAssets.getAssetById.mockResolvedValue(makeAsset());

    await expect(service.probe(10)).rejects.toThrow(
      'QNAP_READER_USER y QNAP_READER_PASS deben estar configurados',
    );
  });
});
```

- [ ] **Paso 2: Correr test y verificar que falla**

```bash
cd backend && npx jest qnap-probe.service.spec.ts --no-coverage
```

Expected: falla con `Cannot find module './qnap-probe.service'`

- [ ] **Paso 3: Implementar `QnapProbeService`**

Crear `backend/src/integrations/qnap/qnap-probe.service.ts`:

```typescript
import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InfradocAssetsService } from '../infradoc/infradoc-assets.service';
import { QnapApiService } from './qnap-api.service';
import { QnapSnapshotDto } from './dto/qnap-snapshot.dto';

@Injectable()
export class QnapProbeService {
  constructor(
    private readonly infradocAssets: InfradocAssetsService,
    private readonly qnapApi: QnapApiService,
  ) {}

  async probe(assetId: number): Promise<QnapSnapshotDto> {
    const user = process.env.QNAP_READER_USER;
    const pass = process.env.QNAP_READER_PASS;
    if (!user || !pass) {
      throw new Error(
        'QNAP_READER_USER y QNAP_READER_PASS deben estar configurados',
      );
    }

    const asset = await this.infradocAssets.getAssetById(assetId);
    if (!asset) {
      throw new NotFoundException(
        `Asset ${assetId} no encontrado en InfraDoc`,
      );
    }

    if (!asset.asset_uri) {
      throw new ServiceUnavailableException(
        `El asset ${assetId} no tiene asset_uri configurado en InfraDoc`,
      );
    }

    try {
      return await this.qnapApi.probe(asset.asset_uri, user, pass);
    } catch (err) {
      throw new ServiceUnavailableException(
        `No se pudo conectar al dispositivo QNAP: ${(err as Error).message}`,
      );
    }
  }
}
```

- [ ] **Paso 4: Correr test y verificar que pasa**

```bash
cd backend && npx jest qnap-probe.service.spec.ts --no-coverage
```

Expected: todos los tests pasan

- [ ] **Paso 5: Escribir test del controller**

Crear `backend/src/integrations/qnap/qnap-probe.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { QnapProbeController } from './qnap-probe.controller';
import { QnapProbeService } from './qnap-probe.service';
import { QnapSnapshotDto } from './dto/qnap-snapshot.dto';

const makeSnapshot = (): QnapSnapshotDto => ({
  spaceUsedPercent: 30,
  totalSpaceGb: 8000,
  raidStatus: 'ok',
  diskCount: 4,
  diskErrors: 0,
  currentFirmware: '5.1.5.2647',
  collectedAt: '2026-06-20T14:32:00.000Z',
});

describe('QnapProbeController', () => {
  let controller: QnapProbeController;
  let probeService: { probe: jest.Mock };

  beforeEach(async () => {
    probeService = { probe: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [QnapProbeController],
      providers: [{ provide: QnapProbeService, useValue: probeService }],
    }).compile();

    controller = module.get<QnapProbeController>(QnapProbeController);
  });

  it('retorna QnapSnapshot cuando el servicio responde', async () => {
    probeService.probe.mockResolvedValue(makeSnapshot());

    const result = await controller.probe(10);

    expect(result).toEqual(makeSnapshot());
    expect(probeService.probe).toHaveBeenCalledWith(10);
  });

  it('propaga NotFoundException del servicio', async () => {
    probeService.probe.mockRejectedValue(new NotFoundException());

    await expect(controller.probe(999)).rejects.toThrow(NotFoundException);
  });

  it('propaga ServiceUnavailableException del servicio', async () => {
    probeService.probe.mockRejectedValue(new ServiceUnavailableException());

    await expect(controller.probe(10)).rejects.toThrow(ServiceUnavailableException);
  });
});
```

- [ ] **Paso 6: Correr test y verificar que falla**

```bash
cd backend && npx jest qnap-probe.controller.spec.ts --no-coverage
```

Expected: falla con `Cannot find module './qnap-probe.controller'`

- [ ] **Paso 7: Implementar controller y module**

Crear `backend/src/integrations/qnap/qnap-probe.controller.ts`:

```typescript
import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { QnapProbeService } from './qnap-probe.service';
import { QnapSnapshotDto } from './dto/qnap-snapshot.dto';

@Controller('infradoc')
@UseGuards(JwtAuthGuard)
export class QnapProbeController {
  constructor(private readonly qnapProbeService: QnapProbeService) {}

  @Get('qnap-probe/:assetId')
  probe(@Param('assetId', ParseIntPipe) assetId: number): Promise<QnapSnapshotDto> {
    return this.qnapProbeService.probe(assetId);
  }
}
```

Crear `backend/src/integrations/qnap/qnap-probe.module.ts`:

```typescript
import * as https from 'https';
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { QnapApiService } from './qnap-api.service';
import { QnapProbeService } from './qnap-probe.service';
import { QnapProbeController } from './qnap-probe.controller';
import { InfradocAssetsService } from '../infradoc/infradoc-assets.service';

@Module({
  imports: [
    HttpModule.register({
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    }),
  ],
  controllers: [QnapProbeController],
  providers: [QnapApiService, QnapProbeService, InfradocAssetsService],
})
export class QnapProbeModule {}
```

- [ ] **Paso 8: Registrar `QnapProbeModule` en `AppModule`**

En `backend/src/app.module.ts`, agregar import:

```typescript
import { QnapProbeModule } from './integrations/qnap/qnap-probe.module';
```

Y agregar `QnapProbeModule` al array `imports`:

```typescript
imports: [
  // ...existing imports...
  InfradocIntegrationModule,
  OdooIntegrationModule,
  QnapProbeModule,   // <-- agregar
],
```

- [ ] **Paso 9: Correr todos los tests del backend**

```bash
cd backend && npx jest qnap-probe.controller.spec.ts qnap-probe.service.spec.ts --no-coverage
```

Expected: todos los tests pasan

- [ ] **Paso 10: Verificar que el backend compila**

```bash
cd backend && npx tsc --noEmit
```

Expected: sin errores

- [ ] **Paso 11: Commit**

```bash
git add backend/src/integrations/qnap/ backend/src/app.module.ts
git commit -m "feat(qnap): agregar QnapProbeService, controller y módulo con endpoint /infradoc/qnap-probe/:assetId"
```

---

## Task 5: Frontend — modelo `QNAPSection` + `QnapProbeService`

**Files:**
- Modify: `frontend/src/app/core/models/maintenance-log.models.ts`
- Create: `frontend/src/app/core/services/qnap-probe.service.ts`

**Interfaces:**
- Produces: interfaz `QnapSnapshot` · `QnapProbeService.probe(assetId: number): Observable<QnapSnapshot>`

- [ ] **Paso 1: Actualizar `QNAPSection` en el modelo**

En `frontend/src/app/core/models/maintenance-log.models.ts`, reemplazar la interfaz `QNAPSection` existente:

```typescript
// reemplazar:
export interface QNAPSection {
  deviceId: number;
  deviceName: string;
  spaceUsed: number;
  raidStatus: 'ok' | 'degraded' | 'failed';
  firmwareUpdated: boolean;
}

// por:
export interface QnapSnapshot {
  spaceUsedPercent: number;
  totalSpaceGb: number;
  raidStatus: 'ok' | 'degraded' | 'failed';
  diskCount: number;
  diskErrors: number;
  currentFirmware: string;
  collectedAt: string;
}

export interface QNAPSection {
  deviceId: number;
  deviceName: string;
  // Auto-obtenidos — null si el probe no se ejecutó
  spaceUsedPercent: number | null;
  totalSpaceGb: number | null;
  raidStatus: 'ok' | 'degraded' | 'failed' | null;
  diskCount: number | null;
  diskErrors: number | null;
  currentFirmware: string | null;
  probeAt: string | null;
  // Manuales
  firmwareUpdated: boolean;
  firmwareVersion?: string;
}
```

- [ ] **Paso 2: Verificar que el cambio de modelo no rompe la compilación**

```bash
cd frontend && npx tsc --noEmit
```

Expected: puede haber errores en `maintenance-form.component.ts` por campos `spaceUsed` — se resolverán en Task 7. Por ahora solo verificar que no hay errores en otros módulos.

- [ ] **Paso 3: Escribir test de `QnapProbeService`**

Crear `frontend/src/app/core/services/qnap-probe.service.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { QnapProbeService } from './qnap-probe.service';
import { QnapSnapshot } from '../models/maintenance-log.models';
import { environment } from '../../../environments/environment';

const makeSnapshot = (): QnapSnapshot => ({
  spaceUsedPercent: 30,
  totalSpaceGb: 8000,
  raidStatus: 'ok',
  diskCount: 4,
  diskErrors: 0,
  currentFirmware: '5.1.5.2647',
  collectedAt: '2026-06-20T14:32:00.000Z',
});

describe('QnapProbeService', () => {
  let service: QnapProbeService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [QnapProbeService],
    });
    service = TestBed.inject(QnapProbeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('llama a GET /infradoc/qnap-probe/:assetId y retorna QnapSnapshot', () => {
    const snapshot = makeSnapshot();

    service.probe(10).subscribe((result) => {
      expect(result).toEqual(snapshot);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/infradoc/qnap-probe/10`);
    expect(req.request.method).toBe('GET');
    req.flush(snapshot);
  });
});
```

- [ ] **Paso 4: Correr test y verificar que falla**

```bash
cd frontend && npx ng test --include="**/qnap-probe.service.spec.ts" --watch=false --browsers=ChromeHeadless
```

Expected: falla con `QnapProbeService is not defined`

- [ ] **Paso 5: Implementar `QnapProbeService`**

Crear `frontend/src/app/core/services/qnap-probe.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { QnapSnapshot } from '../models/maintenance-log.models';

@Injectable({ providedIn: 'root' })
export class QnapProbeService {
  private readonly base = `${environment.apiUrl}/infradoc`;

  constructor(private readonly http: HttpClient) {}

  probe(assetId: number): Observable<QnapSnapshot> {
    return this.http.get<QnapSnapshot>(`${this.base}/qnap-probe/${assetId}`);
  }
}
```

- [ ] **Paso 6: Correr tests y verificar que pasan**

```bash
cd frontend && npx ng test --include="**/qnap-probe.service.spec.ts" --watch=false --browsers=ChromeHeadless
```

Expected: todos los tests pasan

- [ ] **Paso 7: Commit**

```bash
git add frontend/src/app/core/models/maintenance-log.models.ts \
        frontend/src/app/core/services/qnap-probe.service.ts \
        frontend/src/app/core/services/qnap-probe.service.spec.ts
git commit -m "feat(qnap): actualizar QNAPSection con campos auto-probe y agregar QnapProbeService"
```

---

## Task 6: Frontend — `QnapHealthCardComponent`

**Files:**
- Create: `frontend/src/app/features/technician/task-drawer/maintenance-form/qnap-health-card/qnap-health-card.component.ts`
- Create: `frontend/src/app/features/technician/task-drawer/maintenance-form/qnap-health-card/qnap-health-card.component.html`
- Create: `frontend/src/app/features/technician/task-drawer/maintenance-form/qnap-health-card/qnap-health-card.component.scss`
- Create: `frontend/src/app/features/technician/task-drawer/maintenance-form/qnap-health-card/qnap-health-card.component.spec.ts`

**Interfaces:**
- Consumes: `QnapProbeService.probe(assetId)` · `InfraAsset` · `QnapSnapshot`
- Produces: `@Output() snapshotLoaded: EventEmitter<QnapSnapshot>`

- [ ] **Paso 1: Escribir los tests fallando**

Crear `frontend/src/app/features/technician/task-drawer/maintenance-form/qnap-health-card/qnap-health-card.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CommonModule } from '@angular/common';
import { of, throwError } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { QnapHealthCardComponent } from './qnap-health-card.component';
import { QnapProbeService } from '../../../../../core/services/qnap-probe.service';
import { InfraAsset } from '../../../../../core/models/infradoc.models';
import { QnapSnapshot } from '../../../../../core/models/maintenance-log.models';

const makeNas = (): InfraAsset => ({
  assetId: 10,
  name: 'NAS-CLIENTE-01',
  ip: '192.168.1.10',
  bmcIp: null,
  bmcType: null,
  os: null,
  model: 'QNAP TS-453D',
});

const makeSnapshot = (): QnapSnapshot => ({
  spaceUsedPercent: 30,
  totalSpaceGb: 8000,
  raidStatus: 'ok',
  diskCount: 4,
  diskErrors: 0,
  currentFirmware: '5.1.5.2647',
  collectedAt: '2026-06-20T14:32:00.000Z',
});

const makeFormGroup = () => new FormGroup({
  firmwareUpdated: new FormControl(false),
  firmwareVersion: new FormControl(''),
});

describe('QnapHealthCardComponent', () => {
  let component: QnapHealthCardComponent;
  let fixture: ComponentFixture<QnapHealthCardComponent>;
  let probeService: { probe: jest.Mock };

  const createComponent = (readOnly = false, savedSnapshot: QnapSnapshot | null = null) => {
    fixture = TestBed.createComponent(QnapHealthCardComponent);
    component = fixture.componentInstance;
    component.nas = makeNas();
    component.formGroup = makeFormGroup();
    component.readOnly = readOnly;
    component.savedSnapshot = savedSnapshot;
    fixture.detectChanges();
  };

  beforeEach(async () => {
    probeService = { probe: jest.fn() };

    await TestBed.configureTestingModule({
      declarations: [QnapHealthCardComponent],
      imports: [
        CommonModule,
        ReactiveFormsModule,
        NoopAnimationsModule,
        MatButtonModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatInputModule,
        MatProgressSpinnerModule,
      ],
      providers: [
        { provide: QnapProbeService, useValue: probeService },
      ],
    }).compileComponents();
  });

  it('muestra el nombre e IP del dispositivo', () => {
    createComponent();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('NAS-CLIENTE-01');
    expect(text).toContain('192.168.1.10');
  });

  it('muestra botón "Obtener datos" en estado idle', () => {
    createComponent();
    expect(component.probeStatus).toBe('idle');
    const btn = fixture.nativeElement.querySelector('[data-testid="btn-probe"]');
    expect(btn).toBeTruthy();
  });

  it('no muestra botón en modo readOnly con snapshot null', () => {
    createComponent(true, null);
    const btn = fixture.nativeElement.querySelector('[data-testid="btn-probe"]');
    expect(btn).toBeNull();
  });

  it('pasa a estado loaded con savedSnapshot cuando se inicializa en readOnly', () => {
    createComponent(true, makeSnapshot());
    expect(component.probeStatus).toBe('loaded');
    expect(component.snapshot).toEqual(makeSnapshot());
  });

  it('pasa a estado loaded con savedSnapshot en modo edición también', () => {
    createComponent(false, makeSnapshot());
    expect(component.probeStatus).toBe('loaded');
  });

  it('muestra spinner durante loading', () => {
    probeService.probe.mockReturnValue(of(makeSnapshot()).pipe());
    createComponent();
    component.runProbe();
    expect(component.probeStatus).toBe('loading');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('mat-spinner')).toBeTruthy();
  });

  it('pasa a loaded y emite snapshotLoaded al completar probe', () => {
    probeService.probe.mockReturnValue(of(makeSnapshot()));
    createComponent();
    const emitted: QnapSnapshot[] = [];
    component.snapshotLoaded.subscribe((s) => emitted.push(s));

    component.runProbe();
    fixture.detectChanges();

    expect(component.probeStatus).toBe('loaded');
    expect(component.snapshot).toEqual(makeSnapshot());
    expect(emitted.length).toBe(1);
    expect(emitted[0]).toEqual(makeSnapshot());
  });

  it('pasa a estado error cuando el probe falla', () => {
    probeService.probe.mockReturnValue(throwError(() => new Error('timeout')));
    createComponent();

    component.runProbe();
    fixture.detectChanges();

    expect(component.probeStatus).toBe('error');
    expect(component.errorMessage).toBeTruthy();
  });

  it('muestra botón reintentar en estado error', () => {
    probeService.probe.mockReturnValue(throwError(() => new Error('timeout')));
    createComponent();
    component.runProbe();
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector('[data-testid="btn-retry"]');
    expect(btn).toBeTruthy();
  });

  it('en estado loaded muestra los datos del snapshot', () => {
    createComponent(false, makeSnapshot());
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('30');   // spaceUsedPercent
    expect(text).toContain('5.1.5.2647'); // currentFirmware
  });

  it('campo firmwareVersion es visible solo cuando firmwareUpdated está activo', () => {
    createComponent(false, makeSnapshot());
    fixture.detectChanges();

    const beforeCheck = fixture.nativeElement.querySelector('[data-testid="firmware-version-field"]');
    expect(beforeCheck).toBeNull();

    component.formGroup.get('firmwareUpdated')!.setValue(true);
    fixture.detectChanges();

    const afterCheck = fixture.nativeElement.querySelector('[data-testid="firmware-version-field"]');
    expect(afterCheck).toBeTruthy();
  });
});
```

- [ ] **Paso 2: Correr tests y verificar que fallan**

```bash
cd frontend && npx ng test --include="**/qnap-health-card.component.spec.ts" --watch=false --browsers=ChromeHeadless
```

Expected: falla con `Cannot find module './qnap-health-card.component'`

- [ ] **Paso 3: Implementar el componente TypeScript**

Crear `frontend/src/app/features/technician/task-drawer/maintenance-form/qnap-health-card/qnap-health-card.component.ts`:

```typescript
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormGroup } from '@angular/forms';
import { QnapProbeService } from '../../../../../core/services/qnap-probe.service';
import { InfraAsset } from '../../../../../core/models/infradoc.models';
import { QnapSnapshot } from '../../../../../core/models/maintenance-log.models';

type ProbeStatus = 'idle' | 'loading' | 'error' | 'loaded';

@Component({
  selector: 'app-qnap-health-card',
  templateUrl: './qnap-health-card.component.html',
  styleUrl: './qnap-health-card.component.scss',
})
export class QnapHealthCardComponent implements OnChanges {
  @Input() nas!: InfraAsset;
  @Input() formGroup!: FormGroup;
  @Input() savedSnapshot: QnapSnapshot | null = null;
  @Input() readOnly = false;
  @Output() snapshotLoaded = new EventEmitter<QnapSnapshot>();

  probeStatus: ProbeStatus = 'idle';
  snapshot: QnapSnapshot | null = null;
  errorMessage: string | null = null;

  constructor(private readonly qnapProbe: QnapProbeService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['savedSnapshot'] && this.savedSnapshot && this.probeStatus === 'idle') {
      this.snapshot = this.savedSnapshot;
      this.probeStatus = 'loaded';
    }
  }

  runProbe(): void {
    this.probeStatus = 'loading';
    this.errorMessage = null;
    this.qnapProbe.probe(this.nas.assetId).subscribe({
      next: (snap) => {
        this.snapshot = snap;
        this.probeStatus = 'loaded';
        this.snapshotLoaded.emit(snap);
      },
      error: (err: Error) => {
        this.probeStatus = 'error';
        this.errorMessage = err?.message ?? 'No se pudo conectar al dispositivo';
      },
    });
  }

  get firmwareUpdated(): boolean {
    return !!this.formGroup.get('firmwareUpdated')?.value;
  }

  spaceClass(): string {
    const pct = this.snapshot?.spaceUsedPercent ?? 0;
    if (pct >= 85) return 'qnap-badge--crit';
    if (pct >= 70) return 'qnap-badge--warn';
    return 'qnap-badge--ok';
  }

  raidClass(): string {
    const s = this.snapshot?.raidStatus;
    if (s === 'failed') return 'qnap-badge--crit';
    if (s === 'degraded') return 'qnap-badge--warn';
    return 'qnap-badge--ok';
  }

  diskErrorClass(): string {
    return (this.snapshot?.diskErrors ?? 0) > 0 ? 'qnap-badge--crit' : 'qnap-badge--ok';
  }

  formatStorage(gb: number): string {
    if (gb >= 1000) return `${(gb / 1000).toFixed(1)} TB`;
    return `${gb} GB`;
  }
}
```

- [ ] **Paso 4: Crear el template HTML**

Crear `frontend/src/app/features/technician/task-drawer/maintenance-form/qnap-health-card/qnap-health-card.component.html`:

```html
<div class="qnap-card">

  <div class="qnap-card-header">
    <div class="qnap-card-dot"></div>
    <div class="qnap-name-block">
      <span class="qnap-card-name">{{ nas.name }}</span>
      <span class="mono qnap-card-ip">{{ nas.ip ?? '—' }}</span>
    </div>
    <span *ngIf="probeStatus === 'loaded' && snapshot" class="qnap-card-timestamp">
      {{ snapshot.collectedAt | date:'HH:mm' }}
    </span>
  </div>

  <!-- idle -->
  <ng-container *ngIf="probeStatus === 'idle' && !readOnly">
    <button mat-stroked-button type="button" class="qnap-probe-btn"
            data-testid="btn-probe"
            (click)="runProbe()">
      Obtener datos
    </button>
  </ng-container>

  <!-- loading -->
  <ng-container *ngIf="probeStatus === 'loading'">
    <div class="qnap-loading">
      <mat-spinner diameter="16"></mat-spinner>
      <span>Consultando...</span>
    </div>
  </ng-container>

  <!-- error -->
  <ng-container *ngIf="probeStatus === 'error'">
    <div class="qnap-error">
      <span class="qnap-error-msg">{{ errorMessage }}</span>
      <button mat-stroked-button type="button" class="qnap-retry-btn"
              data-testid="btn-retry"
              (click)="runProbe()">
        Reintentar
      </button>
    </div>
  </ng-container>

  <!-- readOnly idle — sin datos -->
  <ng-container *ngIf="probeStatus === 'idle' && readOnly">
    <div class="qnap-empty">Sin datos automáticos</div>
  </ng-container>

  <!-- loaded -->
  <ng-container *ngIf="probeStatus === 'loaded' && snapshot">

    <div class="qnap-section">
      <div class="qnap-section-lbl">Almacenamiento</div>
      <div class="qnap-metrics-grid">
        <div class="qnap-metric">
          <span class="qnap-metric-lbl">Total</span>
          <span class="qnap-metric-val">{{ formatStorage(snapshot.totalSpaceGb) }}</span>
        </div>
        <div class="qnap-metric">
          <span class="qnap-metric-lbl">Usado</span>
          <span class="qnap-metric-val">{{ formatStorage(snapshot.totalSpaceGb * snapshot.spaceUsedPercent / 100) }}</span>
        </div>
        <div class="qnap-metric">
          <span class="qnap-metric-lbl">%</span>
          <span class="qnap-badge" [ngClass]="spaceClass()">{{ snapshot.spaceUsedPercent }}%</span>
        </div>
      </div>
    </div>

    <div class="qnap-section">
      <div class="qnap-metrics-grid">
        <div class="qnap-metric">
          <span class="qnap-metric-lbl">RAID</span>
          <span class="qnap-badge" [ngClass]="raidClass()">{{ snapshot.raidStatus | uppercase }}</span>
        </div>
        <div class="qnap-metric">
          <span class="qnap-metric-lbl">Discos</span>
          <span class="qnap-metric-val">{{ snapshot.diskCount }}</span>
        </div>
        <div class="qnap-metric">
          <span class="qnap-metric-lbl">Errores</span>
          <span class="qnap-badge" [ngClass]="diskErrorClass()">{{ snapshot.diskErrors }}</span>
        </div>
      </div>
    </div>

    <div class="qnap-section">
      <div class="qnap-section-lbl">Firmware</div>
      <span class="mono qnap-firmware-ver">{{ snapshot.currentFirmware }}</span>
    </div>

  </ng-container>

  <!-- campos manuales — siempre visibles si no readOnly -->
  <ng-container *ngIf="!readOnly" [formGroup]="formGroup">
    <div class="qnap-divider"></div>
    <mat-checkbox formControlName="firmwareUpdated" class="qnap-fw-check">
      Firmware actualizado
    </mat-checkbox>
    <mat-form-field *ngIf="firmwareUpdated"
                    appearance="outline" subscriptSizing="dynamic"
                    class="qnap-fw-version-field"
                    data-testid="firmware-version-field">
      <mat-label>Versión aplicada</mat-label>
      <input matInput formControlName="firmwareVersion" placeholder="Ej: 5.2.0.2830" />
    </mat-form-field>
  </ng-container>

  <!-- campos manuales readOnly — solo si hay datos guardados -->
  <ng-container *ngIf="readOnly && savedSnapshot">
    <div class="qnap-divider"></div>
    <div class="qnap-readonly-field">
      <span class="qnap-metric-lbl">Firmware actualizado</span>
      <span class="qnap-metric-val">{{ formGroup.get('firmwareUpdated')?.value ? 'Sí' : 'No' }}</span>
    </div>
    <div *ngIf="formGroup.get('firmwareUpdated')?.value" class="qnap-readonly-field">
      <span class="qnap-metric-lbl">Versión aplicada</span>
      <span class="mono qnap-metric-val">{{ formGroup.get('firmwareVersion')?.value || '—' }}</span>
    </div>
  </ng-container>

</div>
```

- [ ] **Paso 5: Crear los estilos SCSS**

Crear `frontend/src/app/features/technician/task-drawer/maintenance-form/qnap-health-card/qnap-health-card.component.scss`:

```scss
.qnap-card {
  background: var(--surface-card);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.qnap-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.qnap-card-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}

.qnap-name-block {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 1px;
}

.qnap-card-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--tx-hi);
}

.qnap-card-ip {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--tx-lo);
}

.qnap-card-timestamp {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--tx-lo);
}

.qnap-probe-btn,
.qnap-retry-btn {
  align-self: flex-start;
  height: 28px;
  font-size: 12px;
}

.qnap-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--tx-lo);
}

.qnap-error {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.qnap-error-msg {
  font-size: 12px;
  color: var(--crit);
  flex: 1;
}

.qnap-empty {
  font-size: 12px;
  color: var(--tx-lo);
  font-style: italic;
}

.qnap-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.qnap-section-lbl {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--tx-lo);
}

.qnap-metrics-grid {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.qnap-metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.qnap-metric-lbl {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--tx-lo);
}

.qnap-metric-val {
  font-size: 12px;
  color: var(--tx-hi);
}

.qnap-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 3px;
  letter-spacing: 0.4px;
  align-self: flex-start;
}

.qnap-badge--ok   { background: var(--ok-bg);   color: var(--ok);   }
.qnap-badge--warn { background: var(--warn-bg);  color: var(--warn); }
.qnap-badge--crit { background: var(--crit-bg);  color: var(--crit); }

.qnap-firmware-ver {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--tx-hi);
}

.qnap-divider {
  height: 1px;
  background: var(--border);
  margin: 2px 0;
}

.qnap-fw-check {
  font-size: 12px;
}

.qnap-fw-version-field {
  width: 100%;
}

.qnap-readonly-field {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 12px;
}
```

- [ ] **Paso 6: Correr tests y verificar que pasan**

```bash
cd frontend && npx ng test --include="**/qnap-health-card.component.spec.ts" --watch=false --browsers=ChromeHeadless
```

Expected: todos los tests pasan

- [ ] **Paso 7: Commit**

```bash
git add frontend/src/app/features/technician/task-drawer/maintenance-form/qnap-health-card/
git commit -m "feat(qnap): agregar QnapHealthCardComponent con estados idle/loading/error/loaded"
```

---

## Task 7: Frontend — integrar `QnapHealthCardComponent` en `MaintenanceFormComponent`

**Files:**
- Modify: `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.ts`
- Modify: `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.html`
- Modify: `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.spec.ts`
- Modify: `frontend/src/app/features/technician/technician.module.ts`

**Interfaces:**
- Consumes: `QnapHealthCardComponent` · `QnapSnapshot` · `QNAPSection`

- [ ] **Paso 1: Declarar el componente y agregar módulo en `TechnicianModule`**

En `frontend/src/app/features/technician/technician.module.ts`:

```typescript
// Agregar import al principio del archivo:
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { QnapHealthCardComponent } from './task-drawer/maintenance-form/qnap-health-card/qnap-health-card.component';

// En declarations, agregar QnapHealthCardComponent junto a DcHealthCardComponent:
declarations: [
  TaskListComponent,
  TaskDrawerComponent,
  MaintenanceFormComponent,
  ConfirmMaintenanceDialogComponent,
  TimeSpentDialogComponent,
  DcHealthCardComponent,
  QnapHealthCardComponent,  // <-- agregar
],

// En imports, agregar MatProgressSpinnerModule:
imports: [
  // ...existing...
  MatProgressSpinnerModule,  // <-- agregar
],
```

- [ ] **Paso 2: Actualizar `MaintenanceFormComponent` TypeScript**

En `maintenance-form.component.ts`:

**2a. Agregar import del modelo:**
`QnapSnapshot` ya estará disponible desde `maintenance-log.models` (fue agregado en Task 5).

**2b. Actualizar `buildForm()` — sección qnapDevices:**

Reemplazar el bloque `qnapDevices` en `buildForm()`:

```typescript
// reemplazar:
qnapDevices: this.fb.array(
  this.infrastructure.nas.map(() => this.fb.group({
    spaceUsed:       [null as number | null],
    raidStatus:      ['ok'],
    firmwareUpdated: [false],
  }))
),

// por:
qnapDevices: this.fb.array(
  this.infrastructure.nas.map(() => this.fb.group({
    firmwareUpdated: [false],
    firmwareVersion: [''],
  }))
),
```

**2c. Agregar `qnapFetchedData` como propiedad y método al componente:**

Agregar después de las propiedades de formulario existentes:

```typescript
qnapFetchedData: (QnapSnapshot | null)[] = [];
```

Actualizar `buildForm()` para inicializar `qnapFetchedData` justo antes del `return` o al final:

```typescript
private buildForm(): void {
  this.qnapFetchedData = this.infrastructure.nas.map(() => null);
  this.form = this.fb.group({
    // ...resto igual...
  });
}
```

Agregar método `onQnapSnapshotLoaded`:

```typescript
onQnapSnapshotLoaded(index: number, snap: QnapSnapshot): void {
  this.qnapFetchedData[index] = snap;
}
```

**2d. Actualizar `buildPayload()` — sección QNAP:**

Reemplazar el bloque `if (this.hasQNAP)` en `buildPayload()`:

```typescript
if (this.hasQNAP) {
  payload.qnap = this.infrastructure.nas.map((nas, i) => {
    const ctrl = this.qnapDeviceControls.at(i).value;
    const snap = this.qnapFetchedData[i];
    return {
      deviceId:         nas.assetId,
      deviceName:       nas.name,
      spaceUsedPercent: snap?.spaceUsedPercent ?? null,
      totalSpaceGb:     snap?.totalSpaceGb ?? null,
      raidStatus:       snap?.raidStatus ?? null,
      diskCount:        snap?.diskCount ?? null,
      diskErrors:       snap?.diskErrors ?? null,
      currentFirmware:  snap?.currentFirmware ?? null,
      probeAt:          snap?.collectedAt ?? null,
      firmwareUpdated:  ctrl.firmwareUpdated,
      firmwareVersion:  ctrl.firmwareVersion || undefined,
    };
  });
}
```

**2e. Actualizar `patchFormFromPayload()` — sección QNAP:**

Reemplazar el bloque `if (srv.qnap?.length)` en `patchFormFromPayload()`:

```typescript
if (srv.qnap?.length) {
  this.infrastructure.nas.forEach((nas, i) => {
    const saved = srv.qnap!.find(d => d.deviceId === nas.assetId);
    if (saved) {
      this.qnapDeviceControls.at(i).patchValue({
        firmwareUpdated: saved.firmwareUpdated,
        firmwareVersion: saved.firmwareVersion ?? '',
      });
      if (saved.probeAt) {
        this.qnapFetchedData[i] = {
          spaceUsedPercent: saved.spaceUsedPercent ?? 0,
          totalSpaceGb:     saved.totalSpaceGb ?? 0,
          raidStatus:       saved.raidStatus ?? 'ok',
          diskCount:        saved.diskCount ?? 0,
          diskErrors:       saved.diskErrors ?? 0,
          currentFirmware:  saved.currentFirmware ?? 'unknown',
          collectedAt:      saved.probeAt,
        };
      }
    }
  });
}
```

- [ ] **Paso 3: Actualizar el template HTML — sección QNAP**

En `maintenance-form.component.html`, reemplazar toda la sección `<!-- ── QNAP / NAS ───────────────────────────────────── -->`:

```html
<!-- ── QNAP / NAS ───────────────────────────────────── -->
<ng-container *ngIf="hasQNAP">

  <div class="mf-section-lbl">QNAP / NAS</div>

  <div class="mf-vmware-grid" formArrayName="qnapDevices">
    <app-qnap-health-card
      *ngFor="let _ of qnapDeviceControls.controls; let i = index"
      [nas]="infrastructure.nas[i]"
      [formGroup]="$any(qnapDeviceControls.at(i))"
      [savedSnapshot]="qnapFetchedData[i]"
      [readOnly]="readOnly"
      (snapshotLoaded)="onQnapSnapshotLoaded(i, $event)">
    </app-qnap-health-card>
  </div>

</ng-container>
```

- [ ] **Paso 4: Actualizar los tests de `MaintenanceFormComponent`**

En `maintenance-form.component.spec.ts`, buscar y actualizar los tests relacionados con QNAP:

**4a. Actualizar la función `makeInfra` — ya incluye `nas` con `assetId: 10`, no requiere cambios.**

**4b. Agregar test de `qnapFetchedData` inicializado:**

```typescript
it('qnapFetchedData se inicializa con nulls del mismo largo que nas', () => {
  init(makeTask('SERVER_MAINTENANCE'), makeInfra());
  expect(component.qnapFetchedData.length).toBe(1);
  expect(component.qnapFetchedData[0]).toBeNull();
});

it('onQnapSnapshotLoaded guarda el snapshot en qnapFetchedData[i]', () => {
  init(makeTask('SERVER_MAINTENANCE'), makeInfra());
  const snap: QnapSnapshot = {
    spaceUsedPercent: 30,
    totalSpaceGb: 8000,
    raidStatus: 'ok',
    diskCount: 4,
    diskErrors: 0,
    currentFirmware: '5.1.5.2647',
    collectedAt: '2026-06-20T14:32:00Z',
  };

  component.onQnapSnapshotLoaded(0, snap);

  expect(component.qnapFetchedData[0]).toEqual(snap);
});
```

**4c. Agregar import de `QnapSnapshot` al spec:**

```typescript
import {
  DcHealthSnapshot,
  QnapSnapshot,
  ServerMaintenancePayload,
  TerminalPayload,
} from '../../../../core/models/maintenance-log.models';
```

**4d. Actualizar test de buildPayload QNAP (buscar test que use `spaceUsed` y actualizarlo):**

Agregar test nuevo para el payload QNAP con datos del probe:

```typescript
it('buildPayload incluye qnap con datos del snapshot cuando probe fue ejecutado', () => {
  const infra = makeInfra();
  init(makeTask('SERVER_MAINTENANCE'), infra);

  const snap: QnapSnapshot = {
    spaceUsedPercent: 45,
    totalSpaceGb: 8000,
    raidStatus: 'degraded',
    diskCount: 4,
    diskErrors: 1,
    currentFirmware: '5.1.5.2647',
    collectedAt: '2026-06-20T14:32:00Z',
  };
  component.onQnapSnapshotLoaded(0, snap);
  component.qnapDeviceControls.at(0).patchValue({ firmwareUpdated: true, firmwareVersion: '5.2.0' });

  const payload = component.buildPayload() as ServerMaintenancePayload;

  expect(payload.qnap).toBeDefined();
  expect(payload.qnap![0].spaceUsedPercent).toBe(45);
  expect(payload.qnap![0].raidStatus).toBe('degraded');
  expect(payload.qnap![0].diskErrors).toBe(1);
  expect(payload.qnap![0].firmwareUpdated).toBe(true);
  expect(payload.qnap![0].firmwareVersion).toBe('5.2.0');
  expect(payload.qnap![0].probeAt).toBe('2026-06-20T14:32:00Z');
});

it('buildPayload incluye qnap con nulls cuando probe no fue ejecutado', () => {
  const infra = makeInfra();
  init(makeTask('SERVER_MAINTENANCE'), infra);
  // no ejecutar probe — qnapFetchedData[0] = null

  const payload = component.buildPayload() as ServerMaintenancePayload;

  expect(payload.qnap![0].spaceUsedPercent).toBeNull();
  expect(payload.qnap![0].raidStatus).toBeNull();
  expect(payload.qnap![0].probeAt).toBeNull();
  expect(payload.qnap![0].firmwareUpdated).toBe(false);
});
```

- [ ] **Paso 5: Correr todos los tests del frontend**

```bash
cd frontend && npx ng test --include="**/maintenance-form.component.spec.ts" --watch=false --browsers=ChromeHeadless
```

Expected: todos los tests pasan

- [ ] **Paso 6: Correr el suite completo de frontend**

```bash
cd frontend && npx ng test --watch=false --browsers=ChromeHeadless
```

Expected: sin regresiones

- [ ] **Paso 7: Verificar compilación TypeScript del frontend**

```bash
cd frontend && npx tsc --noEmit
```

Expected: sin errores

- [ ] **Paso 8: Commit final**

```bash
git add frontend/src/app/features/technician/technician.module.ts \
        frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.ts \
        frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.html \
        frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.spec.ts
git commit -m "feat(qnap): integrar QnapHealthCardComponent en formulario de mantenimiento"
```
