# VMware ESXi Health Check — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un control de salud VMware ESXi por host en el drawer de mantenimiento de servidores, ejecutado via script Python/pyVmomi desde NestJS, con resultados inline y persistidos en el MaintenanceLog.

**Architecture:** Script Python (`collectors/vmware/vmware_health.py`) ejecutado por `VmwareService` via `child_process.spawn`. El frontend muestra resultados inline por host en `EsxiHostCardComponent`. Al completar la tarea, los resultados se incluyen en el payload `jsonb` del `MaintenanceLog`. El contenido obsoleto de `ServerHostFormComponent` se reemplaza completamente.

**Tech Stack:** Python 3 + pyVmomi 8.x · NestJS child_process · Angular + Angular Material · TypeScript

## Global Constraints

- Sin standalone components Angular — todo declarado en `TechnicianModule`
- `appearance="outline"` en todos los `mat-form-field`
- Sin elementos HTML nativos en templates Angular (usar Angular Material)
- TDD: test antes que implementación en cada tarea
- Un archivo a la vez — confirmación entre tareas
- Idioma código: inglés; commits: español
- `providedIn: 'root'` para servicios Angular nuevos
- `JwtAuthGuard` en todos los endpoints NestJS nuevos

---

## Mapa de archivos

| Archivo | Acción |
|---|---|
| `collectors/vmware/requirements.txt` | Crear |
| `collectors/vmware/vmware_health.py` | Crear |
| `backend/Dockerfile` | Crear |
| `docker-compose.yml` | Crear (raíz del repo) |
| `backend/src/integrations/infradoc/infradoc-assets.service.ts` | Modificar — agregar `uri1`/`uri2` a `RawInfradocAsset` |
| `backend/src/integrations/infradoc/dto/client-infrastructure.dto.ts` | Modificar — agregar `uri1`/`uri2` a `InfraAssetDto` |
| `backend/src/integrations/infradoc/infrastructure.service.ts` | Modificar — propagar `uri1`/`uri2` en `mapAsset()` |
| `backend/src/integrations/infradoc/infradoc-assets.service.spec.ts` | Modificar — agregar test uri1/uri2 |
| `backend/src/integrations/infradoc/infrastructure.service.spec.ts` | Modificar — agregar test uri1/uri2 en mapAsset |
| `backend/src/integrations/vmware/dto/health-check-request.dto.ts` | Crear |
| `backend/src/integrations/vmware/dto/vmware-health-result.dto.ts` | Crear |
| `backend/src/integrations/vmware/vmware.service.ts` | Crear |
| `backend/src/integrations/vmware/vmware.controller.ts` | Crear |
| `backend/src/integrations/vmware/vmware-integration.module.ts` | Crear |
| `backend/src/integrations/vmware/vmware.service.spec.ts` | Crear |
| `backend/src/integrations/vmware/vmware.controller.spec.ts` | Crear |
| `backend/src/app.module.ts` | Modificar — registrar `VmwareIntegrationModule` |
| `frontend/src/app/core/models/infradoc.models.ts` | Modificar — agregar `uri1`/`uri2` a `InfraAsset` |
| `frontend/src/app/core/models/maintenance-log.models.ts` | Modificar — agregar `VmwareHealthResult`, `EsxiHostEntry`, refactorizar `ServerHostPayload` |
| `frontend/src/app/features/technician/utils/vmware-uri.ts` | Crear |
| `frontend/src/app/features/technician/utils/vmware-uri.spec.ts` | Crear |
| `frontend/src/app/features/technician/services/vmware-api.service.ts` | Crear |
| `frontend/src/app/features/technician/services/vmware-api.service.spec.ts` | Crear |
| `frontend/.../server-host-form/esxi-host-card/esxi-host-card.component.ts` | Crear |
| `frontend/.../server-host-form/esxi-host-card/esxi-host-card.component.html` | Crear |
| `frontend/.../server-host-form/esxi-host-card/esxi-host-card.component.scss` | Crear |
| `frontend/.../server-host-form/esxi-host-card/esxi-host-card.component.spec.ts` | Crear |
| `frontend/.../server-host-form/server-host-form.component.ts` | Refactorizar |
| `frontend/.../server-host-form/server-host-form.component.html` | Refactorizar |
| `frontend/.../server-host-form/server-host-form.component.spec.ts` | Refactorizar |
| `frontend/src/app/features/technician/technician.module.ts` | Modificar — declarar `EsxiHostCardComponent` |

---

## Task 1: Script Python vmware_health.py

**Files:**
- Create: `collectors/vmware/requirements.txt`
- Create: `collectors/vmware/vmware_health.py`

**Interfaces:**
- Produces: ejecutable `python3 collectors/vmware/vmware_health.py --host <h> --port <p> --user <u> --pass <pw>` → JSON a stdout, exit 0; error a stderr, exit 1

- [ ] **Step 1: Crear requirements.txt**

```
collectors/vmware/requirements.txt
```
```
pyVmomi==8.0.3.0.1
```

- [ ] **Step 2: Crear vmware_health.py**

```python
#!/usr/bin/env python3
"""VMware ESXi standalone health collector. JSON a stdout, errores a stderr."""
import argparse
import json
import ssl
import sys
from datetime import datetime, timezone

from pyVim.connect import SmartConnect, Disconnect
from pyVmomi import vim


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument('--host', required=True)
    p.add_argument('--port', type=int, required=True)
    p.add_argument('--user', required=True)
    p.add_argument('--pass', dest='password', required=True)
    return p.parse_args()


def get_all(content, vimtype):
    view = content.viewManager.CreateContainerView(content.rootFolder, vimtype, True)
    objs = list(view.view)
    view.Destroy()
    return objs


def collect_host(host):
    summary = host.summary
    qs = summary.quickStats
    hw = summary.hardware

    boot = getattr(summary.runtime, 'bootTime', None)
    if boot:
        now = datetime.now(timezone.utc)
        boot_utc = boot.replace(tzinfo=timezone.utc) if boot.tzinfo is None else boot
        uptime_hours = round((now - boot_utc).total_seconds() / 3600, 1)
    else:
        uptime_hours = 0.0

    if hw and hw.numCpuCores and hw.cpuMhz:
        cpu_pct = round((qs.overallCpuUsage / (hw.numCpuCores * hw.cpuMhz)) * 100, 1)
    else:
        cpu_pct = 0.0

    if hw and hw.memorySize:
        mem_pct = round((qs.overallMemoryUsage / (hw.memorySize / (1024 * 1024))) * 100, 1)
    else:
        mem_pct = 0.0

    raw_status = str(summary.overallStatus)
    if raw_status not in ('green', 'yellow', 'red'):
        raw_status = 'green'

    alerts = []
    health_runtime = getattr(summary.runtime, 'healthSystemRuntime', None)
    if health_runtime:
        sys_health = getattr(health_runtime, 'systemHealthInfo', None)
        if sys_health:
            for sensor in (sys_health.numericSensorInfo or []):
                if str(sensor.healthState.key) in ('red', 'yellow'):
                    alerts.append(f"{sensor.name}: {sensor.healthState.label}")

    return {
        'name': summary.config.name,
        'esxiVersion': (
            f"VMware ESXi {summary.config.product.version} "
            f"build-{summary.config.product.build}"
        ),
        'uptimeHours': uptime_hours,
        'cpuUsagePct': cpu_pct,
        'memUsagePct': mem_pct,
        'overallStatus': raw_status,
        'hardwareAlerts': alerts,
    }


def collect_mem_overcommit(host, all_vms):
    host_id = host._moId
    host_vms = [
        vm for vm in all_vms
        if vm.runtime.host and vm.runtime.host._moId == host_id and vm.config
    ]
    total_vm_mb = sum(vm.config.hardware.memoryMB for vm in host_vms)
    host_mb = host.hardware.memorySize / (1024 * 1024)
    return round(total_vm_mb / host_mb, 2) if host_mb else 0.0


def collect_datastores(host):
    result = []
    for ds in (host.datastore or []):
        s = ds.summary
        cap = s.capacity or 0
        free = s.freeSpace or 0
        used_pct = round(((cap - free) / cap) * 100, 1) if cap else 0.0
        result.append({
            'name': s.name,
            'type': s.type,
            'capacityGb': round(cap / (1024 ** 3), 1),
            'freeGb': round(free / (1024 ** 3), 1),
            'usedPct': used_pct,
            'accessible': bool(s.accessible),
        })
    return result


def _flatten_snaptree(tree_list):
    result = []
    for node in (tree_list or []):
        result.append(node)
        result.extend(_flatten_snaptree(node.childSnapshotList))
    return result


def collect_vms(host, all_vms):
    host_id = host._moId
    host_vms = [
        vm for vm in all_vms
        if vm.runtime.host and vm.runtime.host._moId == host_id
    ]

    states = {'poweredOn': 0, 'poweredOff': 0, 'suspended': 0}
    for vm in host_vms:
        raw = str(vm.runtime.powerState)
        for key in states:
            if key in raw:
                states[key] += 1
                break

    now = datetime.now(timezone.utc)
    snapshots = []
    for vm in host_vms:
        if not vm.snapshot:
            continue
        nodes = _flatten_snaptree(vm.snapshot.rootSnapshotList)
        if not nodes:
            continue
        oldest = min(nodes, key=lambda n: n.createTime)
        ct = oldest.createTime
        if ct.tzinfo is None:
            ct = ct.replace(tzinfo=timezone.utc)
        snapshots.append({
            'vmName': vm.name,
            'count': len(nodes),
            'oldestDays': (now - ct).days,
        })

    tools_not_ok = sum(
        1 for vm in host_vms
        if 'poweredOn' in str(vm.runtime.powerState)
        and (vm.guest is None or str(vm.guest.toolsStatus) not in ('toolsOk', 'toolsOld'))
    )

    return {
        'poweredOn': states['poweredOn'],
        'poweredOff': states['poweredOff'],
        'suspended': states['suspended'],
        'snapshots': snapshots,
        'toolsNotOk': tools_not_ok,
    }


def collect_network(host):
    net = host.config.network
    vswitch_errors = [
        f"{vs.name}: sin uplinks físicos"
        for vs in (net.vswitch or [])
        if not vs.pnic
    ]
    nics_failed = [
        pnic.device
        for pnic in (net.pnic or [])
        if not pnic.linkSpeed
    ]
    return {'vswitchErrors': vswitch_errors, 'nicsFailed': nics_failed}


def main():
    args = parse_args()

    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    si = SmartConnect(
        host=args.host, port=args.port,
        user=args.user, pwd=args.password,
        sslContext=ctx,
    )
    try:
        content = si.RetrieveContent()
        all_vms = get_all(content, [vim.VirtualMachine])
        hosts = get_all(content, [vim.HostSystem])

        if not hosts:
            raise RuntimeError('No se encontró ningún host ESXi en el inventario')

        host = hosts[0]
        host_data = collect_host(host)
        host_data['memOvercommitRatio'] = collect_mem_overcommit(host, all_vms)

        print(json.dumps({
            'host': host_data,
            'datastores': collect_datastores(host),
            'vms': collect_vms(host, all_vms),
            'network': collect_network(host),
            'collectedAt': datetime.now(timezone.utc).isoformat(),
        }))
    finally:
        Disconnect(si)


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
```

- [ ] **Step 3: Verificar que el script es invocable (dry-run de sintaxis)**

```bash
python3 -c "import ast; ast.parse(open('collectors/vmware/vmware_health.py').read()); print('OK')"
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add collectors/
git commit -m "feat(vmware): script Python de health check con pyVmomi"
```

---

## Task 2: Docker setup

**Files:**
- Create: `backend/Dockerfile`
- Create: `docker-compose.yml`

**Interfaces:**
- Produces: imagen Docker de backend con Python 3 + pyVmomi disponibles

- [ ] **Step 1: Crear backend/Dockerfile**

```dockerfile
FROM node:20-alpine
RUN apk add --no-cache python3 py3-pip && \
    pip3 install --no-cache-dir pyVmomi==8.0.3.0.1 --break-system-packages
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
COPY collectors/ ./collectors/
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
```

- [ ] **Step 2: Crear docker-compose.yml en la raíz del repo**

```yaml
services:
  backend:
    build: ./backend
    env_file: ./backend/.env
    ports:
      - "3000:3000"
    depends_on:
      - db

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: infraops
      POSTGRES_USER: infraops
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

- [ ] **Step 3: Verificar que el Dockerfile parsea bien**

```bash
docker build --no-cache -f backend/Dockerfile backend/ --target=base 2>&1 | head -5
```

Si no hay Docker disponible en el entorno de desarrollo, verificar al menos que el archivo no tiene errores de sintaxis revisando la indentación y keywords.

- [ ] **Step 4: Commit**

```bash
git add backend/Dockerfile docker-compose.yml
git commit -m "feat(docker): Dockerfile backend con Python3/pyVmomi y docker-compose base"
```

---

## Task 3: Backend — extensión InfraDoc (uri1/uri2)

**Files:**
- Modify: `backend/src/integrations/infradoc/infradoc-assets.service.ts`
- Modify: `backend/src/integrations/infradoc/dto/client-infrastructure.dto.ts`
- Modify: `backend/src/integrations/infradoc/infrastructure.service.ts`
- Modify: `backend/src/integrations/infradoc/infradoc-assets.service.spec.ts`
- Modify: `backend/src/integrations/infradoc/infrastructure.service.spec.ts`

**Interfaces:**
- Produces: `InfraAssetDto.uri1: string | null`, `InfraAssetDto.uri2: string | null` propagados desde InfraDoc API

- [ ] **Step 1: Agregar test en infradoc-assets.service.spec.ts**

Al final del `describe('InfradocAssetsService')`, antes del cierre `});`, agregar:

```typescript
it('propaga uri1 y uri2 desde la respuesta de InfraDoc', async () => {
  httpService.get.mockReturnValue(
    of(axiosRes({
      success: 'True', count: 1,
      data: [makeRawAsset({ uri1: 'esxi.cliente.com:344', uri2: null })],
    })),
  );
  const result = await service.getAssets(42);
  expect(result[0].uri1).toBe('esxi.cliente.com:344');
  expect(result[0].uri2).toBeNull();
});
```

- [ ] **Step 2: Correr test — verificar que falla**

```bash
cd backend && npx jest infradoc-assets.service.spec --no-coverage
```
Expected: FAIL — `uri1` es `undefined`

- [ ] **Step 3: Agregar uri1/uri2 a RawInfradocAsset en infradoc-assets.service.ts**

Reemplazar la interfaz `RawInfradocAsset`:

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
  uri1: string | null;
  uri2: string | null;
}
```

- [ ] **Step 4: Correr test — verificar que pasa**

```bash
cd backend && npx jest infradoc-assets.service.spec --no-coverage
```
Expected: PASS

- [ ] **Step 5: Agregar test en infrastructure.service.spec.ts**

Buscar el describe principal y agregar un test que verifique que `mapAsset` propaga `uri1`/`uri2`. Agregar antes del cierre del describe principal:

```typescript
it('propaga uri1 y uri2 al mapear un server asset', async () => {
  const rawServer = {
    asset_id: '10', asset_name: 'ESXi-01', asset_type: 'server',
    asset_make: null, asset_os: null, asset_model: null,
    asset_description: null, interface_ip: '192.168.1.10',
    interface_name: null,
    uri1: 'esxi.cliente.com:344', uri2: 'esxi2.cliente.com:345',
  };

  // Asumir que infradocAssetsService y clientsService ya están mockeados
  // siguiendo el patrón del spec existente:
  infradocAssetsService.getAssets.mockResolvedValue([rawServer]);
  infradocAssetsService.getAssetInterfaces.mockResolvedValue([]);
  clientsService.findInfradocId.mockResolvedValue(42);

  const result = await service.getClientInfrastructure('uuid-client');
  expect(result.esxiHosts[0].uri1).toBe('esxi.cliente.com:344');
  expect(result.esxiHosts[0].uri2).toBe('esxi2.cliente.com:345');
});
```

- [ ] **Step 6: Correr test — verificar que falla**

```bash
cd backend && npx jest infrastructure.service.spec --no-coverage
```
Expected: FAIL

- [ ] **Step 7: Actualizar InfraAssetDto en client-infrastructure.dto.ts**

```typescript
export class InfraAssetDto {
  assetId: number;
  name: string;
  ip: string | null;
  bmcIp: string | null;
  bmcType: string | null;
  os: string | null;
  model: string | null;
  uri1: string | null;
  uri2: string | null;
}
```

`ClientInfrastructureDto` no cambia.

- [ ] **Step 8: Actualizar mapAsset() en infrastructure.service.ts**

Reemplazar el bloque `return` en `mapAsset()`:

```typescript
private mapAsset(
  raw: RawInfradocAsset,
  bmc?: { bmcIp: string | null; bmcType: string | null },
): InfraAssetDto {
  return {
    assetId: Number(raw.asset_id),
    name: raw.asset_name,
    ip: raw.interface_ip || null,
    bmcIp: bmc?.bmcIp ?? null,
    bmcType: bmc?.bmcType ?? null,
    os: raw.asset_os || null,
    model: raw.asset_model || null,
    uri1: raw.uri1 ?? null,
    uri2: raw.uri2 ?? null,
  };
}
```

- [ ] **Step 9: Correr todos los tests del módulo infradoc**

```bash
cd backend && npx jest integrations/infradoc --no-coverage
```
Expected: todos PASS

- [ ] **Step 10: Commit**

```bash
git add backend/src/integrations/infradoc/
git commit -m "feat(infradoc): propagar uri1/uri2 de assets en InfraAssetDto"
```

---

## Task 4: Backend — módulo VMware NestJS

**Files:**
- Create: `backend/src/integrations/vmware/dto/health-check-request.dto.ts`
- Create: `backend/src/integrations/vmware/dto/vmware-health-result.dto.ts`
- Create: `backend/src/integrations/vmware/vmware.service.ts`
- Create: `backend/src/integrations/vmware/vmware.service.spec.ts`
- Create: `backend/src/integrations/vmware/vmware.controller.ts`
- Create: `backend/src/integrations/vmware/vmware.controller.spec.ts`
- Create: `backend/src/integrations/vmware/vmware-integration.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Produces: `POST /integrations/vmware/health-check` body `{ hostUri: string }` → `VmwareHealthResult`
- Produces: `VmwareService.runHealthCheck(hostUri: string): Promise<VmwareHealthResult>`

- [ ] **Step 1: Crear DTOs**

`backend/src/integrations/vmware/dto/health-check-request.dto.ts`:
```typescript
import { IsNotEmpty, IsString } from 'class-validator';

export class HealthCheckRequestDto {
  @IsString()
  @IsNotEmpty()
  hostUri: string;
}
```

`backend/src/integrations/vmware/dto/vmware-health-result.dto.ts`:
```typescript
export interface VmwareHostInfo {
  name: string;
  esxiVersion: string;
  uptimeHours: number;
  cpuUsagePct: number;
  memUsagePct: number;
  memOvercommitRatio: number;
  overallStatus: 'green' | 'yellow' | 'red';
  hardwareAlerts: string[];
}

export interface VmwareDatastore {
  name: string;
  type: string;
  capacityGb: number;
  freeGb: number;
  usedPct: number;
  accessible: boolean;
}

export interface VmwareSnapshot {
  vmName: string;
  count: number;
  oldestDays: number;
}

export interface VmwareVmsInfo {
  poweredOn: number;
  poweredOff: number;
  suspended: number;
  snapshots: VmwareSnapshot[];
  toolsNotOk: number;
}

export interface VmwareNetworkInfo {
  vswitchErrors: string[];
  nicsFailed: string[];
}

export interface VmwareHealthResult {
  host: VmwareHostInfo;
  datastores: VmwareDatastore[];
  vms: VmwareVmsInfo;
  network: VmwareNetworkInfo;
  collectedAt: string;
}
```

- [ ] **Step 2: Escribir tests de VmwareService**

Crear `backend/src/integrations/vmware/vmware.service.spec.ts`:

```typescript
import { BadGatewayException, GatewayTimeoutException } from '@nestjs/common';
import * as cp from 'child_process';
import { EventEmitter } from 'events';
import { VmwareService } from './vmware.service';

jest.mock('child_process');

const mockSpawn = cp.spawn as jest.MockedFunction<typeof cp.spawn>;

const MOCK_RESULT = {
  host: {
    name: 'esxi01', esxiVersion: 'VMware ESXi 7.0.3 build-21930508',
    uptimeHours: 100, cpuUsagePct: 20, memUsagePct: 50,
    memOvercommitRatio: 1.2, overallStatus: 'green', hardwareAlerts: [],
  },
  datastores: [], vms: { poweredOn: 3, poweredOff: 1, suspended: 0, snapshots: [], toolsNotOk: 0 },
  network: { vswitchErrors: [], nicsFailed: [] },
  collectedAt: '2026-06-29T00:00:00.000Z',
};

function makeProc(opts: { stdout?: string; stderr?: string; exitCode?: number; hang?: boolean }) {
  const stdoutEm = new EventEmitter();
  const stderrEm = new EventEmitter();
  const procEm   = new EventEmitter();
  const proc = {
    stdout: stdoutEm,
    stderr: stderrEm,
    on: (ev: string, fn: (...args: any[]) => void) => procEm.on(ev, fn),
    kill: jest.fn(),
  };
  mockSpawn.mockReturnValue(proc as any);
  if (!opts.hang) {
    setImmediate(() => {
      if (opts.stdout) stdoutEm.emit('data', Buffer.from(opts.stdout));
      if (opts.stderr) stderrEm.emit('data', Buffer.from(opts.stderr ?? ''));
      procEm.emit('close', opts.exitCode ?? 0);
    });
  }
  return proc;
}

describe('VmwareService', () => {
  let service: VmwareService;

  beforeEach(() => {
    service = new VmwareService();
    jest.clearAllMocks();
  });

  it('retorna VmwareHealthResult cuando el script finaliza con exit code 0', async () => {
    makeProc({ stdout: JSON.stringify(MOCK_RESULT), exitCode: 0 });
    const result = await service.runHealthCheck('192.168.1.10:344');
    expect(result.host.name).toBe('esxi01');
    expect(result.datastores).toEqual([]);
  });

  it('parsea host y puerto de hostUri correctamente', async () => {
    makeProc({ stdout: JSON.stringify(MOCK_RESULT), exitCode: 0 });
    await service.runHealthCheck('esxi.cliente.com:346');
    expect(mockSpawn).toHaveBeenCalledWith(
      'python3',
      expect.arrayContaining(['--host', 'esxi.cliente.com', '--port', '346']),
    );
  });

  it('lanza BadGatewayException cuando exit code es 1', async () => {
    makeProc({ stderr: 'Error de conexión al host', exitCode: 1 });
    await expect(service.runHealthCheck('192.168.1.10:344'))
      .rejects.toThrow(BadGatewayException);
  });

  it('incluye el mensaje de stderr en BadGatewayException', async () => {
    makeProc({ stderr: 'Authentication failed', exitCode: 1 });
    await expect(service.runHealthCheck('192.168.1.10:344'))
      .rejects.toThrow('Authentication failed');
  });

  it('lanza BadGatewayException cuando stdout no es JSON válido', async () => {
    makeProc({ stdout: 'no es json', exitCode: 0 });
    await expect(service.runHealthCheck('192.168.1.10:344'))
      .rejects.toThrow(BadGatewayException);
  });

  it('lanza GatewayTimeoutException y mata el proceso después de 30 segundos', async () => {
    jest.useFakeTimers();
    const proc = makeProc({ hang: true });
    const promise = service.runHealthCheck('192.168.1.10:344');
    jest.advanceTimersByTime(30_001);
    await expect(promise).rejects.toThrow(GatewayTimeoutException);
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
    jest.useRealTimers();
  });
});
```

- [ ] **Step 3: Correr tests — verificar que fallan**

```bash
cd backend && npx jest vmware.service.spec --no-coverage
```
Expected: FAIL — `VmwareService` no existe

- [ ] **Step 4: Implementar VmwareService**

Crear `backend/src/integrations/vmware/vmware.service.ts`:

```typescript
import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
} from '@nestjs/common';
import { spawn } from 'child_process';
import { join } from 'path';
import { VmwareHealthResult } from './dto/vmware-health-result.dto';

const TIMEOUT_MS = 30_000;

@Injectable()
export class VmwareService {
  async runHealthCheck(hostUri: string): Promise<VmwareHealthResult> {
    const colonIdx = hostUri.lastIndexOf(':');
    const host = colonIdx > 0 ? hostUri.slice(0, colonIdx) : hostUri;
    const port = colonIdx > 0 ? hostUri.slice(colonIdx + 1) : '443';
    const script = join(process.cwd(), 'collectors', 'vmware', 'vmware_health.py');

    return new Promise<VmwareHealthResult>((resolve, reject) => {
      const proc = spawn('python3', [
        script,
        '--host', host,
        '--port', port,
        '--user', process.env.VMWARE_USER ?? '',
        '--pass', process.env.VMWARE_PASS ?? '',
      ]);

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      const timer = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new GatewayTimeoutException('El host ESXi no respondió en 30 segundos'));
      }, TIMEOUT_MS);

      proc.on('close', (code: number | null) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new BadGatewayException(stderr.trim() || 'Error al ejecutar el health check de VMware'));
          return;
        }
        try {
          resolve(JSON.parse(stdout) as VmwareHealthResult);
        } catch {
          reject(new BadGatewayException('Respuesta inválida del script Python'));
        }
      });
    });
  }
}
```

- [ ] **Step 5: Correr tests de VmwareService — verificar que pasan**

```bash
cd backend && npx jest vmware.service.spec --no-coverage
```
Expected: todos PASS

- [ ] **Step 6: Escribir tests de VmwareController**

Crear `backend/src/integrations/vmware/vmware.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BadGatewayException } from '@nestjs/common';
import { VmwareController } from './vmware.controller';
import { VmwareService } from './vmware.service';
import { VmwareHealthResult } from './dto/vmware-health-result.dto';

const MOCK_RESULT: VmwareHealthResult = {
  host: {
    name: 'esxi01', esxiVersion: 'VMware ESXi 7.0.3', uptimeHours: 100,
    cpuUsagePct: 20, memUsagePct: 50, memOvercommitRatio: 1.2,
    overallStatus: 'green', hardwareAlerts: [],
  },
  datastores: [],
  vms: { poweredOn: 3, poweredOff: 1, suspended: 0, snapshots: [], toolsNotOk: 0 },
  network: { vswitchErrors: [], nicsFailed: [] },
  collectedAt: '2026-06-29T00:00:00.000Z',
};

describe('VmwareController', () => {
  let controller: VmwareController;
  let vmwareService: { runHealthCheck: jest.Mock };

  beforeEach(async () => {
    vmwareService = { runHealthCheck: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VmwareController],
      providers: [{ provide: VmwareService, useValue: vmwareService }],
    }).compile();
    controller = module.get<VmwareController>(VmwareController);
  });

  it('llama a runHealthCheck con hostUri del body y retorna el resultado', async () => {
    vmwareService.runHealthCheck.mockResolvedValue(MOCK_RESULT);
    const result = await controller.healthCheck({ hostUri: '192.168.1.10:344' });
    expect(vmwareService.runHealthCheck).toHaveBeenCalledWith('192.168.1.10:344');
    expect(result).toEqual(MOCK_RESULT);
  });

  it('propaga BadGatewayException del service', async () => {
    vmwareService.runHealthCheck.mockRejectedValue(new BadGatewayException('Error'));
    await expect(controller.healthCheck({ hostUri: '192.168.1.10:344' }))
      .rejects.toThrow(BadGatewayException);
  });
});
```

- [ ] **Step 7: Correr tests de controller — verificar que fallan**

```bash
cd backend && npx jest vmware.controller.spec --no-coverage
```
Expected: FAIL

- [ ] **Step 8: Implementar VmwareController**

Crear `backend/src/integrations/vmware/vmware.controller.ts`:

```typescript
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { HealthCheckRequestDto } from './dto/health-check-request.dto';
import { VmwareHealthResult } from './dto/vmware-health-result.dto';
import { VmwareService } from './vmware.service';

@Controller('integrations/vmware')
@UseGuards(JwtAuthGuard)
export class VmwareController {
  constructor(private readonly vmwareService: VmwareService) {}

  @Post('health-check')
  healthCheck(@Body() dto: HealthCheckRequestDto): Promise<VmwareHealthResult> {
    return this.vmwareService.runHealthCheck(dto.hostUri);
  }
}
```

- [ ] **Step 9: Crear VmwareIntegrationModule**

Crear `backend/src/integrations/vmware/vmware-integration.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { VmwareController } from './vmware.controller';
import { VmwareService } from './vmware.service';

@Module({
  controllers: [VmwareController],
  providers: [VmwareService],
})
export class VmwareIntegrationModule {}
```

- [ ] **Step 10: Registrar en AppModule**

En `backend/src/app.module.ts`, agregar el import:

```typescript
import { VmwareIntegrationModule } from './integrations/vmware/vmware-integration.module';
```

Y en el array `imports` del `@Module`, después de `OdooIntegrationModule`:

```typescript
VmwareIntegrationModule,
```

- [ ] **Step 11: Correr todos los tests VMware**

```bash
cd backend && npx jest integrations/vmware --no-coverage
```
Expected: todos PASS

- [ ] **Step 12: Correr suite completa del backend**

```bash
cd backend && npx jest --no-coverage
```
Expected: todos PASS (sin regresiones)

- [ ] **Step 13: Commit**

```bash
git add backend/src/integrations/vmware/ backend/src/app.module.ts
git commit -m "feat(vmware): módulo NestJS VmwareService + controller para health check ESXi"
```

---

## Task 5: Frontend — actualizar modelos

**Files:**
- Modify: `frontend/src/app/core/models/infradoc.models.ts`
- Modify: `frontend/src/app/core/models/maintenance-log.models.ts`

**Interfaces:**
- Produces: `InfraAsset.uri1`, `InfraAsset.uri2`
- Produces: `VmwareHealthResult`, `EsxiHostEntry`, `ServerHostPayload` (nueva estructura)

- [ ] **Step 1: Agregar uri1/uri2 a InfraAsset en infradoc.models.ts**

Reemplazar la interfaz `InfraAsset`:

```typescript
export interface InfraAsset {
  assetId: number;
  name: string;
  ip: string | null;
  bmcIp: string | null;
  bmcType: string | null;
  os: string | null;
  model: string | null;
  uri1: string | null;
  uri2: string | null;
}
```

`ClientInfrastructure` no cambia.

- [ ] **Step 2: Actualizar maintenance-log.models.ts**

Agregar `VmwareHealthResult` y `EsxiHostEntry` (antes de `ServerHostPayload`), y reemplazar `ServerHostPayload`.

Agregar estas interfaces **antes** de `ServerHostPayload` (se puede colocar antes de `ServerMaintenancePayload` para agrupar con VMware):

```typescript
export interface VmwareHealthResult {
  host: {
    name: string;
    esxiVersion: string;
    uptimeHours: number;
    cpuUsagePct: number;
    memUsagePct: number;
    memOvercommitRatio: number;
    overallStatus: 'green' | 'yellow' | 'red';
    hardwareAlerts: string[];
  };
  datastores: Array<{
    name: string;
    type: string;
    capacityGb: number;
    freeGb: number;
    usedPct: number;
    accessible: boolean;
  }>;
  vms: {
    poweredOn: number;
    poweredOff: number;
    suspended: number;
    snapshots: Array<{ vmName: string; count: number; oldestDays: number }>;
    toolsNotOk: number;
  };
  network: {
    vswitchErrors: string[];
    nicsFailed: string[];
  };
  collectedAt: string;
}

export interface EsxiHostEntry {
  assetId: number;
  vmwareCheck: VmwareHealthResult | null;
  notes?: string;
}
```

Reemplazar la interfaz `ServerHostPayload` existente:

```typescript
export interface ServerHostPayload {
  type: 'SERVER_HOST_MAINTENANCE';
  esxiHosts: EsxiHostEntry[];
  notes?: string;
}
```

> **Nota:** `VMwareHostEntry` y `BmcEntry` se conservan porque los usa `ServerMaintenancePayload`. Solo `ServerHostPayload` cambia.

- [ ] **Step 3: Verificar compilación TypeScript del frontend**

```bash
cd frontend && npx tsc --noEmit
```
Expected: sin errores de tipo. Si hay errores, son en `server-host-form.component.ts` (que se refactoriza en Task 9) — ignorar esos por ahora.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/core/models/
git commit -m "feat(models): agregar VmwareHealthResult, EsxiHostEntry y uri1/uri2 a InfraAsset"
```

---

## Task 6: Frontend — utilidad resolveVmwareUri

**Files:**
- Create: `frontend/src/app/features/technician/utils/vmware-uri.ts`
- Create: `frontend/src/app/features/technician/utils/vmware-uri.spec.ts`

**Interfaces:**
- Produces: `resolveVmwareUri(asset: InfraAsset): string | null`

- [ ] **Step 1: Escribir tests**

Crear `frontend/src/app/features/technician/utils/vmware-uri.spec.ts`:

```typescript
import { resolveVmwareUri } from './vmware-uri';
import { InfraAsset } from '../../../core/models/infradoc.models';

const makeAsset = (uri1: string | null, uri2: string | null): InfraAsset => ({
  assetId: 1, name: 'host1', ip: null, bmcIp: null,
  bmcType: null, os: null, model: null, uri1, uri2,
});

describe('resolveVmwareUri', () => {
  it('retorna uri1 cuando tiene puerto 344', () => {
    expect(resolveVmwareUri(makeAsset('esxi.cliente.com:344', null)))
      .toBe('esxi.cliente.com:344');
  });

  it('retorna uri2 cuando uri1 no tiene puerto VMware pero uri2 sí', () => {
    expect(resolveVmwareUri(makeAsset('app.cliente.com:443', 'esxi.cliente.com:346')))
      .toBe('esxi.cliente.com:346');
  });

  it('retorna null cuando ninguna URI tiene puerto VMware', () => {
    expect(resolveVmwareUri(makeAsset('app.cliente.com:443', 'db.cliente.com:5432')))
      .toBeNull();
  });

  it('retorna null cuando ambas URIs son null', () => {
    expect(resolveVmwareUri(makeAsset(null, null))).toBeNull();
  });

  it('retorna null cuando la URI no tiene puerto', () => {
    expect(resolveVmwareUri(makeAsset('esxi.cliente.com', null))).toBeNull();
  });

  it.each([344, 345, 346, 347, 348])('acepta puerto %i', (port) => {
    expect(resolveVmwareUri(makeAsset(`esxi.cliente.com:${port}`, null)))
      .toBe(`esxi.cliente.com:${port}`);
  });

  it('no acepta puerto 343 (fuera del rango)', () => {
    expect(resolveVmwareUri(makeAsset('esxi.cliente.com:343', null))).toBeNull();
  });

  it('no acepta puerto 349 (fuera del rango)', () => {
    expect(resolveVmwareUri(makeAsset('esxi.cliente.com:349', null))).toBeNull();
  });
});
```

- [ ] **Step 2: Correr tests — verificar que fallan**

```bash
cd frontend && npx jest vmware-uri.spec --no-coverage
```
Expected: FAIL — módulo no encontrado

- [ ] **Step 3: Implementar resolveVmwareUri**

Crear `frontend/src/app/features/technician/utils/vmware-uri.ts`:

```typescript
import { InfraAsset } from '../../../core/models/infradoc.models';

const VMWARE_PORTS = new Set([344, 345, 346, 347, 348]);

export function resolveVmwareUri(asset: InfraAsset): string | null {
  for (const uri of [asset.uri1, asset.uri2]) {
    if (!uri) continue;
    const colonIdx = uri.lastIndexOf(':');
    if (colonIdx < 0) continue;
    const port = parseInt(uri.slice(colonIdx + 1), 10);
    if (VMWARE_PORTS.has(port)) return uri;
  }
  return null;
}
```

- [ ] **Step 4: Correr tests — verificar que pasan**

```bash
cd frontend && npx jest vmware-uri.spec --no-coverage
```
Expected: todos PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/features/technician/utils/
git commit -m "feat(vmware): función resolveVmwareUri para detectar URI ESXi por puerto"
```

---

## Task 7: Frontend — VmwareApiService

**Files:**
- Create: `frontend/src/app/features/technician/services/vmware-api.service.ts`
- Create: `frontend/src/app/features/technician/services/vmware-api.service.spec.ts`

**Interfaces:**
- Produces: `VmwareApiService.healthCheck(hostUri: string): Observable<VmwareHealthResult>`

- [ ] **Step 1: Escribir test**

Crear `frontend/src/app/features/technician/services/vmware-api.service.spec.ts`:

```typescript
import { of } from 'rxjs';
import { VmwareApiService } from './vmware-api.service';

describe('VmwareApiService', () => {
  let service: VmwareApiService;
  let mockHttp: { post: jest.Mock };

  beforeEach(() => {
    mockHttp = { post: jest.fn() };
    service = new VmwareApiService(mockHttp as any);
  });

  it('llama a POST /integrations/vmware/health-check con el hostUri', () => {
    mockHttp.post.mockReturnValue(of({ host: { name: 'esxi01' } }));
    service.healthCheck('esxi.cliente.com:344').subscribe();
    expect(mockHttp.post).toHaveBeenCalledWith(
      expect.stringContaining('/integrations/vmware/health-check'),
      { hostUri: 'esxi.cliente.com:344' },
    );
  });

  it('retorna el Observable del HttpClient directamente', (done) => {
    const mockResult = { host: { name: 'esxi01' } };
    mockHttp.post.mockReturnValue(of(mockResult));
    service.healthCheck('esxi.cliente.com:344').subscribe((result) => {
      expect(result).toEqual(mockResult);
      done();
    });
  });
});
```

- [ ] **Step 2: Correr test — verificar que falla**

```bash
cd frontend && npx jest vmware-api.service.spec --no-coverage
```
Expected: FAIL

- [ ] **Step 3: Implementar VmwareApiService**

Crear `frontend/src/app/features/technician/services/vmware-api.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { VmwareHealthResult } from '../../../core/models/maintenance-log.models';

@Injectable({ providedIn: 'root' })
export class VmwareApiService {
  constructor(private readonly http: HttpClient) {}

  healthCheck(hostUri: string): Observable<VmwareHealthResult> {
    return this.http.post<VmwareHealthResult>(
      `${environment.apiUrl}/integrations/vmware/health-check`,
      { hostUri },
    );
  }
}
```

- [ ] **Step 4: Correr tests — verificar que pasan**

```bash
cd frontend && npx jest vmware-api.service.spec --no-coverage
```
Expected: todos PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/features/technician/services/
git commit -m "feat(vmware): VmwareApiService — POST /integrations/vmware/health-check"
```

---

## Task 8: Frontend — EsxiHostCardComponent

**Files:**
- Create: `frontend/src/app/features/technician/task-drawer/server-host-form/esxi-host-card/esxi-host-card.component.ts`
- Create: `frontend/src/app/features/technician/task-drawer/server-host-form/esxi-host-card/esxi-host-card.component.html`
- Create: `frontend/src/app/features/technician/task-drawer/server-host-form/esxi-host-card/esxi-host-card.component.scss`
- Create: `frontend/src/app/features/technician/task-drawer/server-host-form/esxi-host-card/esxi-host-card.component.spec.ts`

**Interfaces:**
- Consumes: `InfraAsset` (con uri1/uri2), `VmwareHealthResult`, `resolveVmwareUri`
- Produces: `@Output() runCheck: EventEmitter<string>` — emite la URI VMware al hacer click

- [ ] **Step 1: Escribir tests del componente**

Crear `esxi-host-card.component.spec.ts`:

```typescript
import { EsxiHostCardComponent } from './esxi-host-card.component';
import { InfraAsset } from '../../../../../core/models/infradoc.models';
import { VmwareHealthResult } from '../../../../../core/models/maintenance-log.models';

const makeHost = (uri1: string | null = null, uri2: string | null = null): InfraAsset => ({
  assetId: 1, name: 'esxi01', ip: '192.168.1.10',
  bmcIp: null, bmcType: null, os: null, model: null, uri1, uri2,
});

const MOCK_RESULT: VmwareHealthResult = {
  host: {
    name: 'esxi01', esxiVersion: 'VMware ESXi 7.0.3 build-21930508',
    uptimeHours: 120, cpuUsagePct: 25, memUsagePct: 60,
    memOvercommitRatio: 1.3, overallStatus: 'green', hardwareAlerts: [],
  },
  datastores: [{ name: 'datastore1', type: 'VMFS', capacityGb: 500, freeGb: 200, usedPct: 60, accessible: true }],
  vms: { poweredOn: 3, poweredOff: 1, suspended: 0, snapshots: [], toolsNotOk: 0 },
  network: { vswitchErrors: [], nicsFailed: [] },
  collectedAt: '2026-06-29T10:00:00.000Z',
};

describe('EsxiHostCardComponent', () => {
  let component: EsxiHostCardComponent;

  beforeEach(() => {
    component = new EsxiHostCardComponent();
    component.host = makeHost();
  });

  describe('vmwareUri', () => {
    it('retorna null cuando el host no tiene URIs con puerto VMware', () => {
      expect(component.vmwareUri).toBeNull();
    });

    it('retorna la URI cuando uri1 tiene puerto en rango 344-348', () => {
      component.host = makeHost('esxi.cliente.com:344', null);
      expect(component.vmwareUri).toBe('esxi.cliente.com:344');
    });

    it('retorna uri2 cuando solo uri2 tiene puerto VMware', () => {
      component.host = makeHost('app.cliente.com:443', 'esxi.cliente.com:346');
      expect(component.vmwareUri).toBe('esxi.cliente.com:346');
    });
  });

  describe('canRun', () => {
    it('es false cuando no hay URI VMware', () => {
      expect(component.canRun).toBe(false);
    });

    it('es false cuando loading es true aunque haya URI VMware', () => {
      component.host = makeHost('esxi.cliente.com:344', null);
      component.loading = true;
      expect(component.canRun).toBe(false);
    });

    it('es false cuando readOnly es true', () => {
      component.host = makeHost('esxi.cliente.com:344', null);
      component.readOnly = true;
      expect(component.canRun).toBe(false);
    });

    it('es true cuando hay URI VMware, loading false, readOnly false', () => {
      component.host = makeHost('esxi.cliente.com:344', null);
      expect(component.canRun).toBe(true);
    });
  });

  describe('onRunClick', () => {
    it('emite la URI VMware via runCheck', () => {
      component.host = makeHost('esxi.cliente.com:344', null);
      let emitted: string | undefined;
      component.runCheck.subscribe(v => (emitted = v));
      component.onRunClick();
      expect(emitted).toBe('esxi.cliente.com:344');
    });

    it('no emite cuando no hay URI VMware', () => {
      let emitted = false;
      component.runCheck.subscribe(() => (emitted = true));
      component.onRunClick();
      expect(emitted).toBe(false);
    });
  });

  describe('statusBadgeClass', () => {
    it('retorna badge--crit para overallStatus red', () => {
      expect(component.statusBadgeClass('red')).toBe('badge--crit');
    });
    it('retorna badge--warn para overallStatus yellow', () => {
      expect(component.statusBadgeClass('yellow')).toBe('badge--warn');
    });
    it('retorna badge--ok para overallStatus green', () => {
      expect(component.statusBadgeClass('green')).toBe('badge--ok');
    });
  });

  describe('datastoreClass', () => {
    it('retorna metric--crit cuando el datastore no es accesible', () => {
      expect(component.datastoreClass(50, false)).toBe('metric--crit');
    });
    it('retorna metric--crit cuando usedPct > 85', () => {
      expect(component.datastoreClass(86, true)).toBe('metric--crit');
    });
    it('retorna metric--warn cuando usedPct > 70', () => {
      expect(component.datastoreClass(75, true)).toBe('metric--warn');
    });
    it('retorna metric--ok para uso normal accesible', () => {
      expect(component.datastoreClass(60, true)).toBe('metric--ok');
    });
  });

  describe('snapshotClass', () => {
    it('retorna badge--crit para snapshots con más de 90 días', () => {
      expect(component.snapshotClass(91)).toBe('badge--crit');
    });
    it('retorna badge--warn para snapshots entre 31 y 90 días', () => {
      expect(component.snapshotClass(45)).toBe('badge--warn');
    });
    it('retorna badge--ok para snapshots de 30 días o menos', () => {
      expect(component.snapshotClass(30)).toBe('badge--ok');
    });
  });
});
```

- [ ] **Step 2: Correr tests — verificar que fallan**

```bash
cd frontend && npx jest esxi-host-card.component.spec --no-coverage
```
Expected: FAIL

- [ ] **Step 3: Implementar EsxiHostCardComponent (TS)**

Crear `esxi-host-card.component.ts`:

```typescript
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { InfraAsset } from '../../../../../core/models/infradoc.models';
import { VmwareHealthResult } from '../../../../../core/models/maintenance-log.models';
import { resolveVmwareUri } from '../../utils/vmware-uri';

@Component({
  selector: 'app-esxi-host-card',
  templateUrl: './esxi-host-card.component.html',
  styleUrl: './esxi-host-card.component.scss',
})
export class EsxiHostCardComponent {
  @Input() host!: InfraAsset;
  @Input() result: VmwareHealthResult | null = null;
  @Input() loading = false;
  @Input() error: string | null = null;
  @Input() readOnly = false;
  @Output() runCheck = new EventEmitter<string>();

  get vmwareUri(): string | null {
    return resolveVmwareUri(this.host);
  }

  get canRun(): boolean {
    return !!this.vmwareUri && !this.loading && !this.readOnly;
  }

  onRunClick(): void {
    const uri = this.vmwareUri;
    if (uri) this.runCheck.emit(uri);
  }

  statusBadgeClass(status: 'green' | 'yellow' | 'red'): string {
    if (status === 'red')    return 'badge--crit';
    if (status === 'yellow') return 'badge--warn';
    return 'badge--ok';
  }

  datastoreClass(usedPct: number, accessible: boolean): string {
    if (!accessible)     return 'metric--crit';
    if (usedPct > 85)    return 'metric--crit';
    if (usedPct > 70)    return 'metric--warn';
    return 'metric--ok';
  }

  snapshotClass(oldestDays: number): string {
    if (oldestDays > 90) return 'badge--crit';
    if (oldestDays > 30) return 'badge--warn';
    return 'badge--ok';
  }
}
```

- [ ] **Step 4: Correr tests — verificar que pasan**

```bash
cd frontend && npx jest esxi-host-card.component.spec --no-coverage
```
Expected: todos PASS

- [ ] **Step 5: Crear template HTML**

Crear `esxi-host-card.component.html`:

```html
<div class="ehc">

  <!-- Header -->
  <div class="ehc-hdr">
    <div class="ehc-dot"></div>
    <div class="ehc-name-block">
      <span class="ehc-name">{{ host.name }}</span>
      <span class="mono ehc-ip">{{ host.ip ?? '—' }}</span>
    </div>
    <span *ngIf="!vmwareUri" class="badge badge--neutral ehc-no-vmware">Sin VMware</span>
    <button mat-flat-button color="primary" class="ehc-btn"
            [disabled]="!canRun"
            (click)="onRunClick()">
      <mat-progress-spinner *ngIf="loading" diameter="14" mode="indeterminate"
                            class="ehc-spinner"></mat-progress-spinner>
      {{ result ? 'Re-ejecutar' : 'Ejecutar control VMware' }}
    </button>
  </div>

  <!-- Error -->
  <div *ngIf="error" class="ehc-error">{{ error }}</div>

  <!-- Results -->
  <ng-container *ngIf="result">

    <!-- Host -->
    <div class="ehc-section-lbl">Host</div>
    <div class="ehc-metrics-row">
      <div class="ehc-kv">
        <span class="kpi__label">Versión</span>
        <span class="mono ehc-val-sm">{{ result.host.esxiVersion }}</span>
      </div>
      <div class="ehc-kv">
        <span class="kpi__label">Uptime</span>
        <span>{{ result.host.uptimeHours | number:'1.0-0' }} h</span>
      </div>
      <div class="ehc-kv" [class.metric--crit]="result.host.cpuUsagePct > 80"
           [class.metric--warn]="result.host.cpuUsagePct > 60 && result.host.cpuUsagePct <= 80">
        <span class="kpi__label">CPU</span>
        <span>{{ result.host.cpuUsagePct }}%</span>
      </div>
      <div class="ehc-kv" [class.metric--crit]="result.host.memUsagePct > 85"
           [class.metric--warn]="result.host.memUsagePct > 70 && result.host.memUsagePct <= 85">
        <span class="kpi__label">Mem</span>
        <span>{{ result.host.memUsagePct }}%</span>
      </div>
      <div class="ehc-kv">
        <span class="kpi__label">Overcommit</span>
        <span>{{ result.host.memOvercommitRatio | number:'1.2-2' }}x</span>
      </div>
      <span class="badge" [ngClass]="statusBadgeClass(result.host.overallStatus)">
        HW: {{ result.host.overallStatus | uppercase }}
      </span>
    </div>
    <div *ngIf="result.host.hardwareAlerts.length" class="ehc-alerts-row">
      <span *ngFor="let alert of result.host.hardwareAlerts" class="badge badge--crit ehc-alert-badge">
        {{ alert }}
      </span>
    </div>

    <!-- Datastores -->
    <div class="ehc-section-lbl">Datastores</div>
    <div *ngFor="let ds of result.datastores" class="ehc-ds-row">
      <span class="ehc-ds-name">{{ ds.name }}</span>
      <span class="badge badge--neutral">{{ ds.type }}</span>
      <span *ngIf="!ds.accessible" class="badge badge--crit">Inaccesible</span>
      <div class="ehc-bar">
        <div class="ehc-bar-fill" [ngClass]="datastoreClass(ds.usedPct, ds.accessible)"
             [style.width.%]="ds.usedPct"></div>
      </div>
      <span class="mono ehc-ds-pct" [ngClass]="datastoreClass(ds.usedPct, ds.accessible)">
        {{ ds.usedPct }}%
      </span>
      <span class="ehc-ds-free">{{ ds.freeGb | number:'1.0-1' }} GB libres</span>
    </div>

    <!-- VMs -->
    <div class="ehc-section-lbl">VMs</div>
    <div class="ehc-vms-row">
      <span class="badge badge--ok">ON: {{ result.vms.poweredOn }}</span>
      <span class="badge badge--neutral">OFF: {{ result.vms.poweredOff }}</span>
      <span *ngIf="result.vms.suspended" class="badge badge--warn">SUSP: {{ result.vms.suspended }}</span>
      <span *ngIf="result.vms.toolsNotOk" class="badge badge--warn">
        Tools N/A: {{ result.vms.toolsNotOk }}
      </span>
    </div>
    <div *ngIf="result.vms.snapshots.length" class="ehc-snaps">
      <div *ngFor="let snap of result.vms.snapshots" class="ehc-snap-row">
        <span class="ehc-snap-name">{{ snap.vmName }}</span>
        <span class="badge" [ngClass]="snapshotClass(snap.oldestDays)">
          {{ snap.count }} snap{{ snap.count !== 1 ? 's' : '' }} · {{ snap.oldestDays }}d
        </span>
      </div>
    </div>

    <!-- Red -->
    <div class="ehc-section-lbl">Red</div>
    <div class="ehc-net-row">
      <span *ngIf="!result.network.vswitchErrors.length && !result.network.nicsFailed.length"
            class="badge badge--ok">OK</span>
      <span *ngFor="let e of result.network.vswitchErrors" class="badge badge--crit">{{ e }}</span>
      <span *ngFor="let n of result.network.nicsFailed" class="badge badge--crit">NIC caída: {{ n }}</span>
    </div>

    <div class="ehc-footer">
      Recolectado: {{ result.collectedAt | date:'dd/MM/yyyy HH:mm' }}
    </div>

  </ng-container>
</div>
```

- [ ] **Step 6: Crear SCSS mínimo**

Crear `esxi-host-card.component.scss`:

```scss
.ehc {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px 14px;
  background: var(--bg-card);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ehc-hdr {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ehc-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--srv);
  flex-shrink: 0;
}

.ehc-name-block {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.ehc-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--tx-hi);
}

.ehc-ip {
  font-size: 11px;
  color: var(--tx-lo);
}

.ehc-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.ehc-spinner {
  display: inline-block;
}

.ehc-section-lbl {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--tx-lo);
  margin-top: 4px;
}

.ehc-metrics-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.ehc-kv {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ehc-val-sm {
  font-size: 11px;
}

.ehc-alerts-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.ehc-ds-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 4px 0;
}

.ehc-ds-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ehc-bar {
  width: 80px;
  height: 6px;
  background: var(--bg-2);
  border-radius: 3px;
  overflow: hidden;
  flex-shrink: 0;
}

.ehc-bar-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--ok);
  &.metric--warn { background: var(--warn); }
  &.metric--crit { background: var(--crit); }
}

.ehc-ds-pct { font-size: 12px; width: 36px; text-align: right; }
.ehc-ds-free { font-size: 11px; color: var(--tx-lo); }

.ehc-vms-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ehc-snaps {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ehc-snap-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.ehc-snap-name {
  flex: 1;
  color: var(--tx-md);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ehc-net-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ehc-error {
  color: var(--crit);
  font-size: 12px;
  padding: 4px 0;
}

.ehc-footer {
  font-size: 10px;
  color: var(--tx-lo);
  margin-top: 4px;
}

.metric--crit { color: var(--crit); }
.metric--warn { color: var(--warn); }
.metric--ok   { color: var(--ok); }
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/features/technician/task-drawer/server-host-form/esxi-host-card/
git commit -m "feat(vmware): EsxiHostCardComponent — card por host con resultados inline"
```

---

## Task 9: Frontend — refactorizar ServerHostFormComponent

**Files:**
- Modify: `frontend/src/app/features/technician/task-drawer/server-host-form/server-host-form.component.ts`
- Modify: `frontend/src/app/features/technician/task-drawer/server-host-form/server-host-form.component.html`
- Modify: `frontend/src/app/features/technician/task-drawer/server-host-form/server-host-form.component.spec.ts`

**Interfaces:**
- Consumes: `VmwareApiService.healthCheck()`, `EsxiHostCardComponent`
- Produces: `buildPayload(): ServerHostPayload` con `esxiHosts: EsxiHostEntry[]`

- [ ] **Step 1: Reemplazar el spec**

Reemplazar el contenido completo de `server-host-form.component.spec.ts`:

```typescript
import { FormControl } from '@angular/forms';
import { of, Subject, throwError } from 'rxjs';
import { ServerHostFormComponent } from './server-host-form.component';
import { ClientInfrastructure, InfraAsset } from '../../../../core/models/infradoc.models';
import { ServerHostPayload, VmwareHealthResult } from '../../../../core/models/maintenance-log.models';
import { Task } from '../../../../core/models/task.models';

const makeTask = (): Task => ({
  id: '1', clientId: '10', technicianId: '2',
  type: 'SERVER_HOST_MAINTENANCE', status: 'PENDING',
  scheduledDate: '2026-06-01T00:00:00.000Z',
  completedDate: null, odooTicketId: null,
  createdAt: '2026-05-01T00:00:00.000Z',
});

const makeHost = (overrides: Partial<InfraAsset> = {}): InfraAsset => ({
  assetId: 1, name: 'esxi01', ip: '192.168.1.10',
  bmcIp: null, bmcType: null, os: null, model: null,
  uri1: 'esxi.cliente.com:344', uri2: null,
  ...overrides,
});

const makeInfra = (hosts: InfraAsset[] = [makeHost()]): ClientInfrastructure => ({
  esxiHosts: hosts, windowsVMs: [], domainControllers: [], linuxVMs: [], nas: [], routers: [],
});

const MOCK_RESULT: VmwareHealthResult = {
  host: {
    name: 'esxi01', esxiVersion: '7.0.3', uptimeHours: 100,
    cpuUsagePct: 20, memUsagePct: 50, memOvercommitRatio: 1.0,
    overallStatus: 'green', hardwareAlerts: [],
  },
  datastores: [],
  vms: { poweredOn: 1, poweredOff: 0, suspended: 0, snapshots: [], toolsNotOk: 0 },
  network: { vswitchErrors: [], nicsFailed: [] },
  collectedAt: '2026-06-29T00:00:00Z',
};

describe('ServerHostFormComponent', () => {
  let component: ServerHostFormComponent;
  let mockVmwareApi: { healthCheck: jest.Mock };

  beforeEach(() => {
    mockVmwareApi = { healthCheck: jest.fn() };
    component = new ServerHostFormComponent(mockVmwareApi as any);
    component.task = makeTask();
    component.infrastructure = makeInfra();
  });

  describe('buildPayload()', () => {
    it('retorna payload con type SERVER_HOST_MAINTENANCE', () => {
      expect(component.buildPayload().type).toBe('SERVER_HOST_MAINTENANCE');
    });

    it('incluye vmwareCheck null cuando no se ejecutó el check', () => {
      const payload = component.buildPayload();
      expect(payload.esxiHosts[0].vmwareCheck).toBeNull();
    });

    it('incluye vmwareCheck cuando el resultado está disponible', () => {
      component.vmwareResults.set(1, MOCK_RESULT);
      expect(component.buildPayload().esxiHosts[0].vmwareCheck).toEqual(MOCK_RESULT);
    });

    it('permite completar sin haber ejecutado el check (vmwareCheck null es válido)', () => {
      const payload = component.buildPayload();
      expect(payload.type).toBe('SERVER_HOST_MAINTENANCE');
      expect(payload.esxiHosts[0].vmwareCheck).toBeNull();
    });

    it('mapea un entry por cada esxiHost de la infrastructure', () => {
      component.infrastructure = makeInfra([makeHost(), makeHost({ assetId: 2, name: 'esxi02' })]);
      expect(component.buildPayload().esxiHosts).toHaveLength(2);
    });

    it('incluye notes cuando tiene valor', () => {
      component.notesControl.setValue('revisar próxima semana');
      expect(component.buildPayload().notes).toBe('revisar próxima semana');
    });

    it('omite notes cuando está vacío', () => {
      component.notesControl.setValue('');
      expect(component.buildPayload().notes).toBeUndefined();
    });
  });

  describe('onRunCheck()', () => {
    it('agrega assetId a loadingHosts mientras espera respuesta', () => {
      mockVmwareApi.healthCheck.mockReturnValue(new Subject());
      component.onRunCheck('esxi.cliente.com:344', 1);
      expect(component.loadingHosts.has(1)).toBe(true);
    });

    it('almacena resultado en vmwareResults y elimina de loadingHosts al tener éxito', () => {
      mockVmwareApi.healthCheck.mockReturnValue(of(MOCK_RESULT));
      component.onRunCheck('esxi.cliente.com:344', 1);
      expect(component.vmwareResults.get(1)).toEqual(MOCK_RESULT);
      expect(component.loadingHosts.has(1)).toBe(false);
    });

    it('almacena error en hostErrors y elimina de loadingHosts al fallar', () => {
      mockVmwareApi.healthCheck.mockReturnValue(
        throwError(() => ({ error: { message: 'Host inaccesible' } })),
      );
      component.onRunCheck('esxi.cliente.com:344', 1);
      expect(component.hostErrors.get(1)).toBe('Host inaccesible');
      expect(component.loadingHosts.has(1)).toBe(false);
    });

    it('limpia error previo al re-ejecutar', () => {
      component.hostErrors.set(1, 'error anterior');
      mockVmwareApi.healthCheck.mockReturnValue(new Subject());
      component.onRunCheck('esxi.cliente.com:344', 1);
      expect(component.hostErrors.has(1)).toBe(false);
    });
  });

  describe('ngOnChanges — restoreFromPayload', () => {
    it('restaura vmwareResults desde payload guardado', () => {
      component.savedPayload = {
        type: 'SERVER_HOST_MAINTENANCE',
        esxiHosts: [{ assetId: 1, vmwareCheck: MOCK_RESULT }],
      };
      component.ngOnChanges({ savedPayload: {} as any });
      expect(component.vmwareResults.get(1)).toEqual(MOCK_RESULT);
    });

    it('restaura notes desde payload guardado', () => {
      component.savedPayload = {
        type: 'SERVER_HOST_MAINTENANCE',
        esxiHosts: [],
        notes: 'notas de prueba',
      };
      component.ngOnChanges({ savedPayload: {} as any });
      expect(component.notesControl.value).toBe('notas de prueba');
    });

    it('ignora payload de otro tipo', () => {
      component.savedPayload = { type: 'QNAP_MAINTENANCE', qnap: [] };
      component.ngOnChanges({ savedPayload: {} as any });
      expect(component.vmwareResults.size).toBe(0);
    });
  });

  describe('outputs', () => {
    it('submit() emite requestComplete con el payload', () => {
      let emitted: ServerHostPayload | undefined;
      component.requestComplete.subscribe(p => (emitted = p));
      component.submit();
      expect(emitted?.type).toBe('SERVER_HOST_MAINTENANCE');
    });

    it('save() emite requestSave con el payload', () => {
      let emitted: ServerHostPayload | undefined;
      component.requestSave.subscribe(p => (emitted = p));
      component.save();
      expect(emitted?.type).toBe('SERVER_HOST_MAINTENANCE');
    });

    it('submitNotDone() emite requestNotDone', () => {
      let emitted = false;
      component.requestNotDone.subscribe(() => (emitted = true));
      component.submitNotDone();
      expect(emitted).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Correr tests — verificar que fallan**

```bash
cd frontend && npx jest server-host-form.component.spec --no-coverage
```
Expected: FAIL — firmas de métodos cambiaron

- [ ] **Step 3: Reemplazar server-host-form.component.ts**

```typescript
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { Task } from '../../../../core/models/task.models';
import { ClientInfrastructure } from '../../../../core/models/infradoc.models';
import {
  EsxiHostEntry,
  MaintenancePayload,
  ServerHostPayload,
  VmwareHealthResult,
} from '../../../../core/models/maintenance-log.models';
import { VmwareApiService } from '../../services/vmware-api.service';

@Component({
  selector: 'app-server-host-form',
  templateUrl: './server-host-form.component.html',
  styleUrl: './server-host-form.component.scss',
})
export class ServerHostFormComponent implements OnChanges {
  @Input() task!: Task;
  @Input() infrastructure!: ClientInfrastructure;
  @Input() savedPayload: MaintenancePayload | null = null;
  @Input() readOnly = false;

  @Output() requestComplete = new EventEmitter<ServerHostPayload>();
  @Output() requestSave     = new EventEmitter<ServerHostPayload>();
  @Output() requestNotDone  = new EventEmitter<void>();

  vmwareResults = new Map<number, VmwareHealthResult>();
  loadingHosts  = new Set<number>();
  hostErrors    = new Map<number, string>();
  notesControl  = new FormControl('');

  constructor(private readonly vmwareApiService: VmwareApiService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['savedPayload'] && this.savedPayload) {
      this.restoreFromPayload(this.savedPayload);
    }
    if (changes['readOnly']) {
      if (this.readOnly) {
        this.notesControl.disable({ emitEvent: false });
      } else {
        this.notesControl.enable({ emitEvent: false });
      }
    }
  }

  onRunCheck(uri: string, assetId: number): void {
    this.loadingHosts.add(assetId);
    this.hostErrors.delete(assetId);
    this.vmwareApiService.healthCheck(uri).subscribe({
      next: (result) => {
        this.vmwareResults.set(assetId, result);
        this.loadingHosts.delete(assetId);
      },
      error: (err) => {
        this.hostErrors.set(assetId, err?.error?.message ?? 'Error al ejecutar el control');
        this.loadingHosts.delete(assetId);
      },
    });
  }

  submit(): void {
    this.requestComplete.emit(this.buildPayload());
  }

  save(): void {
    this.requestSave.emit(this.buildPayload());
  }

  submitNotDone(): void {
    this.requestNotDone.emit();
  }

  buildPayload(): ServerHostPayload {
    return {
      type: 'SERVER_HOST_MAINTENANCE',
      esxiHosts: this.infrastructure.esxiHosts.map((host): EsxiHostEntry => ({
        assetId: host.assetId,
        vmwareCheck: this.vmwareResults.get(host.assetId) ?? null,
      })),
      notes: this.notesControl.value || undefined,
    };
  }

  private restoreFromPayload(payload: MaintenancePayload): void {
    if (payload.type !== 'SERVER_HOST_MAINTENANCE') return;
    const srv = payload as ServerHostPayload;
    this.notesControl.setValue(srv.notes ?? '', { emitEvent: false });
    for (const entry of (srv.esxiHosts ?? [])) {
      if (entry.vmwareCheck) {
        this.vmwareResults.set(entry.assetId, entry.vmwareCheck);
      }
    }
  }
}
```

- [ ] **Step 4: Reemplazar server-host-form.component.html**

```html
<div class="shf">

  <div class="shf-section-lbl">VMware ESXi</div>

  <div class="shf-host-list">
    <app-esxi-host-card
      *ngFor="let host of infrastructure.esxiHosts"
      [host]="host"
      [result]="vmwareResults.get(host.assetId) ?? null"
      [loading]="loadingHosts.has(host.assetId)"
      [error]="hostErrors.get(host.assetId) ?? null"
      [readOnly]="readOnly"
      (runCheck)="onRunCheck($event, host.assetId)"
    ></app-esxi-host-card>
  </div>

  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="shf-form-field">
    <mat-label>Notas</mat-label>
    <textarea matInput [formControl]="notesControl" cdkTextareaAutosize
              placeholder="Observaciones generales..."></textarea>
  </mat-form-field>

</div>
```

- [ ] **Step 5: Correr tests — verificar que pasan**

```bash
cd frontend && npx jest server-host-form.component.spec --no-coverage
```
Expected: todos PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/features/technician/task-drawer/server-host-form/
git commit -m "refactor(server-host-form): reemplazar form manual obsoleto con EsxiHostCardComponent"
```

---

## Task 10: Frontend — TechnicianModule wiring

**Files:**
- Modify: `frontend/src/app/features/technician/technician.module.ts`

**Interfaces:**
- Consumes: `EsxiHostCardComponent`

- [ ] **Step 1: Agregar EsxiHostCardComponent al módulo**

En `technician.module.ts`, agregar el import:

```typescript
import { EsxiHostCardComponent } from './task-drawer/server-host-form/esxi-host-card/esxi-host-card.component';
```

Y agregar `EsxiHostCardComponent` al array `declarations`:

```typescript
declarations: [
  TaskListComponent, TaskDrawerComponent, MaintenanceFormComponent,
  ConfirmMaintenanceDialogComponent, TimeSpentDialogComponent,
  DcHealthCardComponent, QnapFormComponent, QnapDeviceCardComponent,
  VeeamFormComponent, ServerHostFormComponent, RouterFormComponent,
  RouterDeviceCardComponent,
  EsxiHostCardComponent,   // ← agregar
],
```

No se necesitan módulos Material adicionales — `MatButtonModule` y `MatProgressSpinnerModule` ya están importados.

- [ ] **Step 2: Verificar compilación**

```bash
cd frontend && npx tsc --noEmit
```
Expected: sin errores

- [ ] **Step 3: Correr suite completa del frontend**

```bash
cd frontend && npx jest --no-coverage
```
Expected: todos PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/features/technician/technician.module.ts
git commit -m "feat(technician): declarar EsxiHostCardComponent en TechnicianModule"
```
