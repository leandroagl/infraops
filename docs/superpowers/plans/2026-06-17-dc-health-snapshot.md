# DC Health Snapshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar DCDIAG + script de reinicio del formulario `SERVER_MAINTENANCE` por cards de salud de DC que aceptan el JSON del script `Get-DCHealthSnapshot.ps1` y lo visualizan agrupado por Replicación, DNS y SYSVOL.

**Architecture:** Backend detecta DCs en InfraDoc por `asset_description` y los expone como `domainControllers[]` separado de `windowsVMs`. Un nuevo `DcHealthCardComponent` gestiona el estado textarea→display por DC. `MaintenanceFormComponent` integra las cards vía FormArray de `{ rawJson: string }`.

**Tech Stack:** NestJS + Jest (backend) · Angular + Angular TestBed/Karma (frontend) · Angular Material · RxJS

> **Branch:** Crear `feat/dc-health-snapshot` antes de empezar.

---

## Mapa de archivos

| Archivo | Acción |
|---------|--------|
| `backend/src/integrations/infradoc/infradoc-assets.service.ts` | Agregar `asset_description` a `RawInfradocAsset` |
| `backend/src/integrations/infradoc/dto/client-infrastructure.dto.ts` | Agregar `domainControllers: InfraAssetDto[]` |
| `backend/src/integrations/infradoc/infrastructure.service.ts` | Detectar DCs por description; inicializar `domainControllers` |
| `backend/src/integrations/infradoc/infrastructure.service.spec.ts` | Nuevos casos DC; actualizar `makeAsset` |
| `frontend/src/app/core/models/infradoc.models.ts` | Agregar `domainControllers: InfraAsset[]` |
| `frontend/src/app/core/models/maintenance-log.models.ts` | Nuevo `DcHealthSnapshot`; actualizar `WindowsServerEntry`, `WindowsSection` |
| `frontend/src/app/features/technician/task-drawer/maintenance-form/dc-health-card/dc-health-card.component.ts` | **Crear** |
| `frontend/src/app/features/technician/task-drawer/maintenance-form/dc-health-card/dc-health-card.component.html` | **Crear** |
| `frontend/src/app/features/technician/task-drawer/maintenance-form/dc-health-card/dc-health-card.component.scss` | **Crear** |
| `frontend/src/app/features/technician/task-drawer/maintenance-form/dc-health-card/dc-health-card.component.spec.ts` | **Crear** |
| `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.ts` | Actualizar form, payload, patch |
| `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.html` | Quitar DCDIAG + col. reinicio; agregar sección DC |
| `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.spec.ts` | Remover tests obsoletos; agregar tests DC |
| `frontend/src/app/features/technician/technician.module.ts` | Declarar `DcHealthCardComponent` |

---

## Task 1: Backend — modelos de datos InfraDoc

**Files:**
- Modify: `backend/src/integrations/infradoc/infradoc-assets.service.ts`
- Modify: `backend/src/integrations/infradoc/dto/client-infrastructure.dto.ts`

- [ ] **Step 1: Agregar `asset_description` a `RawInfradocAsset`**

En `backend/src/integrations/infradoc/infradoc-assets.service.ts`, agregar el campo al interface (línea ~14):

```typescript
export interface RawInfradocAsset {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  asset_make: string | null;
  asset_os: string | null;
  asset_model: string | null;
  asset_description: string | null;   // ← nuevo
  interface_ip: string | null;
  interface_name: string | null;
}
```

- [ ] **Step 2: Agregar `domainControllers` al DTO del backend**

En `backend/src/integrations/infradoc/dto/client-infrastructure.dto.ts`:

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
  domainControllers: InfraAssetDto[];   // ← nuevo
  nas: InfraAssetDto[];
  routers: InfraAssetDto[];
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/integrations/infradoc/infradoc-assets.service.ts
git add backend/src/integrations/infradoc/dto/client-infrastructure.dto.ts
git commit -m "feat(infradoc): agregar asset_description y domainControllers al DTO"
```

---

## Task 2: Backend — detección de DCs en `InfrastructureService` (TDD)

**Files:**
- Modify: `backend/src/integrations/infradoc/infrastructure.service.spec.ts`
- Modify: `backend/src/integrations/infradoc/infrastructure.service.ts`

- [ ] **Step 1: Actualizar `makeAsset` en el spec para incluir `asset_description`**

En `backend/src/integrations/infradoc/infrastructure.service.spec.ts`, la función `makeAsset` (línea ~12) pasa a:

```typescript
const makeAsset = (override: Partial<RawInfradocAsset> = {}): RawInfradocAsset => ({
  asset_id:          '1',
  asset_name:        'host1.kemini',
  asset_type:        'Server',
  asset_make:        'HPE',
  asset_description: null,
  interface_ip:      '192.168.0.104',
  interface_name:    null,
  asset_os:          'VMware ESXi 7.0.0',
  asset_model:       'ProLiant DL380 Gen10',
  ...override,
} as RawInfradocAsset);
```

- [ ] **Step 2: Actualizar el test existente de `windowsVMs` para excluir DCs**

Reemplazar el test `'agrupa Virtual Machine con Windows Server en windowsVMs'` (línea ~82):

```typescript
it('agrupa Virtual Machine con Windows Server SIN description DC en windowsVMs', async () => {
  infradocAssetsService.getAssets.mockResolvedValue([
    makeAsset({ asset_id: '3', asset_name: 'SRV-FILE', asset_type: 'Virtual Machine', asset_os: 'Windows Server 2019', asset_make: null, asset_description: null }),
    makeAsset({ asset_id: '4', asset_name: 'SRV-APP',  asset_type: 'Virtual Machine', asset_os: 'Windows Server 2022', asset_make: null, asset_description: '' }),
  ]);

  const result = await service.getClientInfrastructure('uuid-1');

  expect(result.windowsVMs).toHaveLength(2);
  expect(result.windowsVMs[0].name).toBe('SRV-FILE');
  expect(result.windowsVMs[1].name).toBe('SRV-APP');
  expect(result.domainControllers).toHaveLength(0);
});
```

- [ ] **Step 3: Agregar tests de detección de DCs**

Agregar al final de los describe tests existentes:

```typescript
describe('domain controller detection', () => {
  it('mueve VM con description "Domain Controller" a domainControllers', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([
      makeAsset({
        asset_id: '5', asset_name: 'DC01',
        asset_type: 'Virtual Machine', asset_os: 'Windows Server 2022',
        asset_make: null, asset_description: 'Domain Controller',
      }),
    ]);

    const result = await service.getClientInfrastructure('uuid-1');

    expect(result.domainControllers).toHaveLength(1);
    expect(result.domainControllers[0].name).toBe('DC01');
    expect(result.windowsVMs).toHaveLength(0);
  });

  it('detecta DC con description en minúsculas', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([
      makeAsset({
        asset_id: '6', asset_name: 'DC02',
        asset_type: 'Virtual Machine', asset_os: 'Windows Server 2019',
        asset_make: null, asset_description: 'domain controller - Primary',
      }),
    ]);

    const result = await service.getClientInfrastructure('uuid-1');

    expect(result.domainControllers).toHaveLength(1);
    expect(result.domainControllers[0].name).toBe('DC02');
    expect(result.windowsVMs).toHaveLength(0);
  });

  it('separa correctamente DCs y VMs no-DC cuando ambos están presentes', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([
      makeAsset({ asset_id: '3', asset_name: 'SRV-FILE', asset_type: 'Virtual Machine', asset_os: 'Windows Server 2019', asset_make: null, asset_description: null }),
      makeAsset({ asset_id: '5', asset_name: 'DC01',     asset_type: 'Virtual Machine', asset_os: 'Windows Server 2022', asset_make: null, asset_description: 'Domain Controller' }),
    ]);

    const result = await service.getClientInfrastructure('uuid-1');

    expect(result.windowsVMs).toHaveLength(1);
    expect(result.windowsVMs[0].name).toBe('SRV-FILE');
    expect(result.domainControllers).toHaveLength(1);
    expect(result.domainControllers[0].name).toBe('DC01');
  });

  it('domainControllers es array vacío cuando no hay DCs', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([]);

    const result = await service.getClientInfrastructure('uuid-1');

    expect(result.domainControllers).toEqual([]);
  });
});
```

- [ ] **Step 4: Correr tests — deben FALLAR**

```bash
cd backend && npx jest --testPathPattern="infrastructure.service" --no-coverage
```

Esperado: fallos en los nuevos tests de `domain controller detection` y en el test de `windowsVMs` renombrado. Los tests de BMC y otros deben seguir pasando.

- [ ] **Step 5: Implementar la detección de DCs en `InfrastructureService`**

En `backend/src/integrations/infradoc/infrastructure.service.ts`:

**Línea ~59 — inicializar `domainControllers` en el resultado:**

```typescript
const result: ClientInfrastructureDto = {
  esxiHosts:         [],
  windowsVMs:        [],
  domainControllers: [],   // ← nuevo
  nas:               [],
  routers:           [],
};
```

**Líneas ~71-74 — separar DCs de windowsVMs:**

```typescript
} else if (type === 'virtual machine' && os.startsWith('windows server')) {
  const description = (asset.asset_description ?? '').toLowerCase();
  if (description.includes('domain controller')) {
    result.domainControllers.push(this.mapAsset(asset));
  } else {
    result.windowsVMs.push(this.mapAsset(asset));
  }
}
```

- [ ] **Step 6: Correr tests — deben PASAR**

```bash
cd backend && npx jest --testPathPattern="infrastructure.service" --no-coverage
```

Esperado: todos los tests del archivo pasan.

- [ ] **Step 7: Commit**

```bash
git add backend/src/integrations/infradoc/infrastructure.service.ts
git add backend/src/integrations/infradoc/infrastructure.service.spec.ts
git commit -m "feat(infradoc): detectar DCs por asset_description y exponerlos en domainControllers"
```

---

## Task 3: Frontend — actualizar modelos

**Files:**
- Modify: `frontend/src/app/core/models/infradoc.models.ts`
- Modify: `frontend/src/app/core/models/maintenance-log.models.ts`

- [ ] **Step 1: Agregar `domainControllers` al modelo frontend de InfraDoc**

Reemplazar todo `frontend/src/app/core/models/infradoc.models.ts` con:

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
  domainControllers: InfraAsset[];
  nas: InfraAsset[];
  routers: InfraAsset[];
}
```

- [ ] **Step 2: Actualizar `maintenance-log.models.ts`**

Reemplazar todo `frontend/src/app/core/models/maintenance-log.models.ts` con:

```typescript
// Payload jsonb structures for MaintenanceLogs

// --- DC Health Snapshot ---

export interface DcHealthSnapshot {
  is_dc: boolean;
  dc_name: string;
  domain: string | null;
  collected_at: string;
  repl_healthy: boolean | null;
  repl_failures: number | null;
  repl_partners: number | null;
  repl_max_age_hours: number | null;
  dns_test_pass: boolean | null;
  dns_service_ok: boolean | null;
  dns_srv_ok: boolean | null;
  dns_zone_count: number | null;
  sysvol_state_ok: boolean | null;
  sysvol_backlog: number | null;
  sysvol_replication: string | null;
  warnings: string[];
}

// --- Server Maintenance ---

export interface WindowsServerEntry {
  serverId: number;
  serverName: string;
  updates: 'ok' | 'pending' | 'failed';
  notes?: string;
}

export interface WindowsSection {
  servers: WindowsServerEntry[];
  domainControllers: DcHealthSnapshot[];
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

export interface RouterEntry {
  routerId: number;
  routerName: string;
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
  router?: RouterEntry[];
  bmc?: BmcEntry[];
  notes?: string;
}

// --- Terminal Maintenance ---

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

- [ ] **Step 3: Compilar para verificar que no hay errores de tipos**

```bash
cd frontend && npx tsc --noEmit
```

Esperado: 0 errores. Si hay errores, es porque algún archivo consume `rebootScript`, `dcdiag` o `dcdiagDetail` — se arreglarán en la Task 6.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/core/models/infradoc.models.ts
git add frontend/src/app/core/models/maintenance-log.models.ts
git commit -m "feat(models): agregar DcHealthSnapshot; quitar rebootScript/dcdiag de WindowsSection"
```

---

## Task 4: Frontend — `DcHealthCardComponent` (TDD)

**Files:**
- Create: `frontend/src/app/features/technician/task-drawer/maintenance-form/dc-health-card/dc-health-card.component.spec.ts`
- Create: `frontend/src/app/features/technician/task-drawer/maintenance-form/dc-health-card/dc-health-card.component.ts`
- Create: `frontend/src/app/features/technician/task-drawer/maintenance-form/dc-health-card/dc-health-card.component.html`
- Create: `frontend/src/app/features/technician/task-drawer/maintenance-form/dc-health-card/dc-health-card.component.scss`

- [ ] **Step 1: Crear el spec**

Crear `frontend/src/app/features/technician/task-drawer/maintenance-form/dc-health-card/dc-health-card.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { Pipe, PipeTransform } from '@angular/core';
import { DcHealthCardComponent } from './dc-health-card.component';
import { InfraAsset } from '../../../../../core/models/infradoc.models';
import { DcHealthSnapshot } from '../../../../../core/models/maintenance-log.models';

@Pipe({ name: 'localDate' })
class MockLocalDatePipe implements PipeTransform {
  transform(value: string): string { return value; }
}

const makeDc = (): InfraAsset => ({
  assetId: 4,
  name: 'DC01',
  ip: '192.168.1.18',
  bmcIp: null,
  bmcType: null,
  os: 'Windows Server 2022',
  model: null,
});

const makeSnapshot = (overrides: Partial<DcHealthSnapshot> = {}): DcHealthSnapshot => ({
  is_dc: true,
  dc_name: 'DC01',
  domain: 'contoso.local',
  collected_at: '2026-06-12T08:43:25.263Z',
  repl_healthy: true,
  repl_failures: 0,
  repl_partners: 0,
  repl_max_age_hours: null,
  dns_test_pass: true,
  dns_service_ok: true,
  dns_srv_ok: true,
  dns_zone_count: 6,
  sysvol_state_ok: true,
  sysvol_backlog: null,
  sysvol_replication: 'DFSR',
  warnings: [],
  ...overrides,
});

describe('DcHealthCardComponent', () => {
  let component: DcHealthCardComponent;
  let fixture: ComponentFixture<DcHealthCardComponent>;
  let fb: FormBuilder;

  function makeFormGroup(rawJson = ''): FormGroup {
    return fb.group({ rawJson: [rawJson] });
  }

  function init(rawJson = '', readOnly = false): void {
    fixture = TestBed.createComponent(DcHealthCardComponent);
    component = fixture.componentInstance;
    component.dc = makeDc();
    component.formGroup = makeFormGroup(rawJson);
    component.readOnly = readOnly;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DcHealthCardComponent, MockLocalDatePipe],
      imports: [
        ReactiveFormsModule,
        NoopAnimationsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
      ],
    }).compileComponents();

    fb = TestBed.inject(FormBuilder);
  });

  // ── Estado vacío ───────────────────────────────────────────────────────────

  it('parsed es null cuando rawJson está vacío', () => {
    init('');
    expect(component.parsed).toBeNull();
    expect(component.parseError).toBeNull();
  });

  // ── Parseo exitoso ────────────────────────────────────────────────────────

  it('popula parsed con snapshot válido con is_dc true en el valor inicial', () => {
    const snapshot = makeSnapshot();
    init(JSON.stringify(snapshot));
    expect(component.parsed).not.toBeNull();
    expect(component.parsed!.dc_name).toBe('DC01');
    expect(component.parseError).toBeNull();
  });

  it('popula parsed cuando rawJson cambia vía valueChanges', () => {
    init('');
    const snapshot = makeSnapshot();
    component.formGroup.get('rawJson')!.setValue(JSON.stringify(snapshot));
    expect(component.parsed).not.toBeNull();
    expect(component.parsed!.domain).toBe('contoso.local');
  });

  // ── Error semántico ───────────────────────────────────────────────────────

  it('setea parseError cuando is_dc es false', () => {
    const snapshot = makeSnapshot({ is_dc: false });
    init(JSON.stringify(snapshot));
    expect(component.parsed).toBeNull();
    expect(component.parseError).toContain('no es un controlador de dominio');
  });

  // ── Error de parseo ───────────────────────────────────────────────────────

  it('setea parseError cuando el JSON es inválido', () => {
    init('{ esto no es json }');
    expect(component.parsed).toBeNull();
    expect(component.parseError).toContain('JSON inválido');
  });

  it('limpia parsed y parseError cuando rawJson vuelve a estar vacío', () => {
    const snapshot = makeSnapshot();
    init(JSON.stringify(snapshot));
    expect(component.parsed).not.toBeNull();

    component.formGroup.get('rawJson')!.setValue('');
    expect(component.parsed).toBeNull();
    expect(component.parseError).toBeNull();
  });

  // ── edit() ────────────────────────────────────────────────────────────────

  it('edit() limpia parsed y parseError sin borrar el rawJson del form', () => {
    const snapshot = makeSnapshot();
    const json = JSON.stringify(snapshot);
    init(json);
    expect(component.parsed).not.toBeNull();

    component.edit();

    expect(component.parsed).toBeNull();
    expect(component.parseError).toBeNull();
    expect(component.formGroup.get('rawJson')!.value).toBe(json);
  });

  // ── readOnly ─────────────────────────────────────────────────────────────

  it('deshabilita el formGroup cuando readOnly es true', () => {
    init('', true);
    expect(component.formGroup.disabled).toBeTrue();
  });

  it('mantiene el formGroup habilitado cuando readOnly es false', () => {
    init('', false);
    expect(component.formGroup.disabled).toBeFalse();
  });

  // ── statusClass ───────────────────────────────────────────────────────────

  it('statusClass retorna dc-badge--ok para true', () => {
    init('');
    expect(component.statusClass(true)).toBe('dc-badge--ok');
  });

  it('statusClass retorna dc-badge--crit para false', () => {
    init('');
    expect(component.statusClass(false)).toBe('dc-badge--crit');
  });

  it('statusClass retorna dc-badge--na para null', () => {
    init('');
    expect(component.statusClass(null)).toBe('dc-badge--na');
  });

  // ── statusLabel ───────────────────────────────────────────────────────────

  it('statusLabel retorna OK para true', () => {
    init('');
    expect(component.statusLabel(true)).toBe('OK');
  });

  it('statusLabel retorna FALLO para false', () => {
    init('');
    expect(component.statusLabel(false)).toBe('FALLO');
  });

  it('statusLabel retorna — para null', () => {
    init('');
    expect(component.statusLabel(null)).toBe('—');
  });
});
```

- [ ] **Step 2: Correr el spec — debe FALLAR (componente no existe)**

```bash
cd frontend && npx ng test --include="**/dc-health-card.component.spec.ts" --watch=false
```

Esperado: error de compilación porque `DcHealthCardComponent` no existe.

- [ ] **Step 3: Crear `dc-health-card.component.ts`**

Crear `frontend/src/app/features/technician/task-drawer/maintenance-form/dc-health-card/dc-health-card.component.ts`:

```typescript
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { InfraAsset } from '../../../../../core/models/infradoc.models';
import { DcHealthSnapshot } from '../../../../../core/models/maintenance-log.models';

@Component({
  selector: 'app-dc-health-card',
  templateUrl: './dc-health-card.component.html',
  styleUrl: './dc-health-card.component.scss',
})
export class DcHealthCardComponent implements OnInit, OnDestroy {
  @Input() dc!: InfraAsset;
  @Input() formGroup!: FormGroup;
  @Input() readOnly = false;

  parsed: DcHealthSnapshot | null = null;
  parseError: string | null = null;

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.formGroup.get('rawJson')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => this.tryParse(value));

    const initial: string = this.formGroup.get('rawJson')?.value ?? '';
    if (initial) this.tryParse(initial);

    if (this.readOnly) {
      this.formGroup.disable({ emitEvent: false });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  edit(): void {
    this.parsed = null;
    this.parseError = null;
  }

  statusClass(value: boolean | null): string {
    if (value === null) return 'dc-badge--na';
    return value ? 'dc-badge--ok' : 'dc-badge--crit';
  }

  statusLabel(value: boolean | null): string {
    if (value === null) return '—';
    return value ? 'OK' : 'FALLO';
  }

  private tryParse(raw: string): void {
    if (!raw?.trim()) {
      this.parsed = null;
      this.parseError = null;
      return;
    }
    try {
      const snapshot = JSON.parse(raw) as DcHealthSnapshot;
      if (!snapshot.is_dc) {
        this.parseError = 'Este equipo no es un controlador de dominio según el script.';
        this.parsed = null;
        return;
      }
      this.parsed = snapshot;
      this.parseError = null;
    } catch {
      this.parsed = null;
      this.parseError = 'JSON inválido. Pegá la salida completa del script Get-DCHealthSnapshot.ps1.';
    }
  }
}
```

- [ ] **Step 4: Crear `dc-health-card.component.html`**

Crear `frontend/src/app/features/technician/task-drawer/maintenance-form/dc-health-card/dc-health-card.component.html`:

```html
<div class="dc-card mf-cl-rpt">

  <!-- ── Header ─────────────────────────────────────────────── -->
  <div class="mf-cl-rpt-hdr">
    <div class="mf-cl-rpt-dot" style="background:var(--srv)"></div>
    <div class="dc-header-info">
      <span class="mf-cl-rpt-label">{{ dc.name }}</span>
      <span class="mono mf-host-ip">{{ dc.ip ?? '—' }}</span>
      <span *ngIf="parsed" class="dc-domain mono">{{ parsed.domain ?? '—' }}</span>
    </div>
    <span *ngIf="parsed" class="dc-collected-at">{{ parsed.collected_at | localDate }}</span>
    <button *ngIf="parsed && !readOnly" mat-icon-button type="button"
            class="dc-edit-btn" (click)="edit()" title="Editar JSON">
      <svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    </button>
  </div>

  <!-- ── Textarea (cuando no hay snapshot parseado) ─────────── -->
  <div *ngIf="!parsed" [formGroup]="formGroup" class="dc-input-area">
    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="dc-json-ff">
      <mat-label>Snapshot JSON — Get-DCHealthSnapshot.ps1</mat-label>
      <textarea matInput formControlName="rawJson" rows="6"
                placeholder='{ "is_dc": true, "dc_name": "DC01", ... }'></textarea>
    </mat-form-field>
    <div *ngIf="parseError" class="mf-alert dc-parse-error">
      <svg viewBox="0 0 24 24" style="width:11px;height:11px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;flex-shrink:0">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      {{ parseError }}
    </div>
  </div>

  <!-- ── Display visual (cuando hay snapshot parseado) ──────── -->
  <ng-container *ngIf="parsed">

    <div class="mf-section-lbl">Replicación AD</div>
    <div class="dc-metrics-grid">
      <div class="dc-metric">
        <span class="mf-lbl">Estado</span>
        <span class="dc-badge" [ngClass]="statusClass(parsed.repl_healthy)">
          {{ statusLabel(parsed.repl_healthy) }}
        </span>
      </div>
      <div class="dc-metric">
        <span class="mf-lbl">Fallos</span>
        <span class="mono">{{ parsed.repl_failures ?? '—' }}</span>
      </div>
      <div class="dc-metric">
        <span class="mf-lbl">Partners</span>
        <span class="mono">{{ parsed.repl_partners ?? '—' }}</span>
      </div>
      <div class="dc-metric">
        <span class="mf-lbl">Edad máx.</span>
        <span class="mono">{{ parsed.repl_max_age_hours !== null ? (parsed.repl_max_age_hours + ' h') : 'N/A' }}</span>
      </div>
    </div>

    <div class="mf-section-lbl">DNS</div>
    <div class="dc-metrics-grid">
      <div class="dc-metric">
        <span class="mf-lbl">Test DNS</span>
        <span class="dc-badge" [ngClass]="statusClass(parsed.dns_test_pass)">
          {{ statusLabel(parsed.dns_test_pass) }}
        </span>
      </div>
      <div class="dc-metric">
        <span class="mf-lbl">Servicio</span>
        <span class="dc-badge" [ngClass]="statusClass(parsed.dns_service_ok)">
          {{ statusLabel(parsed.dns_service_ok) }}
        </span>
      </div>
      <div class="dc-metric">
        <span class="mf-lbl">SRV crítico</span>
        <span class="dc-badge" [ngClass]="statusClass(parsed.dns_srv_ok)">
          {{ statusLabel(parsed.dns_srv_ok) }}
        </span>
      </div>
      <div class="dc-metric">
        <span class="mf-lbl">Zonas</span>
        <span class="mono">{{ parsed.dns_zone_count ?? '—' }}</span>
      </div>
    </div>

    <div class="mf-section-lbl">SYSVOL / DFSR</div>
    <div class="dc-metrics-grid">
      <div class="dc-metric">
        <span class="mf-lbl">Estado SYSVOL</span>
        <span class="dc-badge" [ngClass]="statusClass(parsed.sysvol_state_ok)">
          {{ statusLabel(parsed.sysvol_state_ok) }}
        </span>
      </div>
      <div class="dc-metric">
        <span class="mf-lbl">Replicación</span>
        <span class="mono">{{ parsed.sysvol_replication ?? '—' }}</span>
      </div>
      <div class="dc-metric">
        <span class="mf-lbl">Backlog</span>
        <span class="mono">{{ parsed.sysvol_backlog !== null ? parsed.sysvol_backlog : 'N/A' }}</span>
      </div>
    </div>

    <ng-container *ngIf="parsed.warnings?.length > 0">
      <div class="mf-section-lbl">Advertencias</div>
      <div *ngFor="let w of parsed.warnings" class="mf-alert dc-warning">
        <svg viewBox="0 0 24 24" style="width:11px;height:11px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;flex-shrink:0">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        {{ w }}
      </div>
    </ng-container>

  </ng-container>

</div>
```

- [ ] **Step 5: Crear `dc-health-card.component.scss`**

Crear `frontend/src/app/features/technician/task-drawer/maintenance-form/dc-health-card/dc-health-card.component.scss`:

```scss
.dc-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dc-header-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.dc-domain {
  font-size: 10px;
  color: var(--tx-lo);
}

.dc-collected-at {
  font-size: 10px;
  color: var(--tx-lo);
  margin-left: auto;
  white-space: nowrap;
}

.dc-edit-btn {
  width: 24px;
  height: 24px;
  color: var(--tx-lo);
}

.dc-input-area {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dc-json-ff {
  width: 100%;
}

.dc-parse-error {
  margin-top: 2px;
}

.dc-metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 8px;
  padding: 2px 0 6px;
}

.dc-metric {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dc-badge {
  font-size: 10px;
  font-family: var(--font-mono);
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 3px;
  display: inline-block;
  width: fit-content;

  &.dc-badge--ok {
    background: var(--ok-bg);
    color: var(--ok);
  }

  &.dc-badge--crit {
    background: var(--crit-bg);
    color: var(--crit);
  }

  &.dc-badge--na {
    background: var(--surface-2, rgba(255,255,255,0.05));
    color: var(--tx-lo);
  }
}

.dc-warning {
  margin-top: 2px;
}
```

- [ ] **Step 6: Correr el spec — debe PASAR**

```bash
cd frontend && npx ng test --include="**/dc-health-card.component.spec.ts" --watch=false
```

Esperado: todos los tests pasan.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/features/technician/task-drawer/maintenance-form/dc-health-card/
git commit -m "feat(dc-health-card): crear componente de salud de DC con parseo JSON y display visual"
```

---

## Task 5: Frontend — actualizar spec de `MaintenanceFormComponent` (TDD)

**Files:**
- Modify: `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.spec.ts`

- [ ] **Step 1: Actualizar `makeInfra()` y las referencias a `rebootScript`/`dcdiag`**

Al inicio del archivo (línea ~30), reemplazar la función `makeInfra` para incluir `domainControllers` y cambiar `windowsVMs` a un servidor no-DC:

```typescript
const makeInfra = (overrides: Partial<ClientInfrastructure> = {}): ClientInfrastructure => ({
  esxiHosts: [{ assetId: 2, name: 'host1.kemini', ip: '192.168.0.104', bmcIp: '192.168.0.200', bmcType: 'iLO', os: 'VMware ESXi 7.0', model: 'HPE DL380' }],
  windowsVMs: [{ assetId: 3, name: 'SRV-FILE', ip: '192.168.1.19', bmcIp: null, bmcType: null, os: 'Windows Server 2019', model: null }],
  domainControllers: [{ assetId: 4, name: 'DC01', ip: '192.168.1.18', bmcIp: null, bmcType: null, os: 'Windows Server 2022', model: null }],
  nas: [{ assetId: 10, name: 'QNAP', ip: '192.168.1.21', bmcIp: null, bmcType: null, os: null, model: 'QNAP TS-453D' }],
  routers: [{ assetId: 1, name: 'MikroTik', ip: '192.168.99.1', bmcIp: null, bmcType: null, os: 'RouterOS', model: 'CCR2004' }],
  ...overrides,
});
```

- [ ] **Step 2: Eliminar los tests obsoletos de `rebootScript` y `dcdiag`**

Eliminar completamente los siguientes bloques `it(...)` del `describe('buildPayload — SERVER_MAINTENANCE', ...)`:
- `'should include windows.servers with rebootScript and updates per VM'`
- `'should capture rebootScript error value'`
- `'should include windows.dcdiag from form value'`
- `'should include windows.dcdiagDetail only when dcdiag starts with ERROR'`
- `'should NOT include windows.dcdiagDetail when dcdiag does not start with ERROR'`

Eliminar el `describe('dcdiagHasError', ...)` completo.

En `describe('serverRowClass', ...)`, eliminar los tests que referencian `rebootScript`:
- `'should return mf-srv-row--crit when rebootScript is error'`
- `'should return mf-srv-row--warn when rebootScript is falta_configurar'`
- `'should return mf-srv-row--crit when one field is crit and other is warn'`

Y actualizar los restantes tests de `serverRowClass` (que solo usan `updates`):

```typescript
describe('serverRowClass', () => {
  it('should return empty string when updates is ok', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [], domainControllers: [] }));
    component.serverControls.at(0).patchValue({ updates: 'ok' });
    expect(component.serverRowClass(0)).toBe('');
  });

  it('should return mf-srv-row--crit when updates is failed', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [], domainControllers: [] }));
    component.serverControls.at(0).patchValue({ updates: 'failed' });
    expect(component.serverRowClass(0)).toBe('mf-srv-row--crit');
  });

  it('should return mf-srv-row--warn when updates is pending', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [], domainControllers: [] }));
    component.serverControls.at(0).patchValue({ updates: 'pending' });
    expect(component.serverRowClass(0)).toBe('mf-srv-row--warn');
  });
});
```

- [ ] **Step 3: Actualizar los tests de `patchFormFromPayload` que referencian el payload antiguo**

En `describe('patchFormFromPayload via savedPayload input', ...)`:

Eliminar `'parchea dcdiag y dcdiagDetail desde el payload guardado'` y `'parchea rebootScript y updates del servidor correcto usando serverId'`.

Reemplazar el test que verifica `no modifica el formulario cuando savedPayload es null` (al final) para quitar la referencia a `dcdiag`:

```typescript
it('no modifica el formulario cuando savedPayload es null', () => {
  initWithSavedPayload(
    makeTask('SERVER_MAINTENANCE'),
    makeInfra({ esxiHosts: [], nas: [], routers: [], domainControllers: [] }),
    null,
  );

  expect(component.serverControls.at(0).get('updates')?.value).toBe('ok');
});
```

En todos los `SavedPayload` usados en los tests, reemplazar el payload antiguo:

```typescript
// ANTES (obsoleto):
windows: { servers: [], dcdiag: 'ERROR (DNS)', dcdiagDetail: 'lookup failed' },

// DESPUÉS:
windows: { servers: [], domainControllers: [] },
```

Buscar y reemplazar TODAS las ocurrencias de `dcdiag` y `dcdiagDetail` en los `ServerMaintenancePayload` inline del archivo spec.

Reemplazar el test de `readOnly` que referencia `dcdiag`:

```typescript
it('should patch savedPayload values and still disable form when readOnly is true', () => {
  fixture = TestBed.createComponent(MaintenanceFormComponent);
  component = fixture.componentInstance;
  const task = makeTask('SERVER_MAINTENANCE');
  const infra = makeInfra({ esxiHosts: [], nas: [], routers: [], domainControllers: [] });
  const savedPayload: ServerMaintenancePayload = {
    type: 'SERVER_MAINTENANCE',
    windows: { servers: [], domainControllers: [] },
  };
  component.task = task;
  component.infrastructure = infra;
  component.savedPayload = savedPayload;
  component.readOnly = true;
  component.ngOnChanges({
    infrastructure: new SimpleChange(undefined, infra, true),
    savedPayload: new SimpleChange(undefined, savedPayload, true),
  });
  fixture.detectChanges();

  expect(component.form.disabled).toBeTrue();
});
```

- [ ] **Step 4: Agregar los nuevos tests de DC al spec**

Agregar el siguiente bloque `describe` dentro del describe principal de `MaintenanceFormComponent`:

```typescript
// ── Controladores de dominio ────────────────────────────────────────────────

describe('domain controllers', () => {
  it('hasDomainControllers es true cuando domainControllers.length > 0', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }));
    expect(component.hasDomainControllers).toBeTrue();
  });

  it('hasDomainControllers es false cuando domainControllers está vacío', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [], domainControllers: [] }));
    expect(component.hasDomainControllers).toBeFalse();
  });

  it('dcControls tiene un FormGroup por cada DC en infrastructure', () => {
    const infra = makeInfra({
      esxiHosts: [], nas: [], routers: [],
      domainControllers: [
        { assetId: 4, name: 'DC01', ip: null, bmcIp: null, bmcType: null, os: null, model: null },
        { assetId: 5, name: 'DC02', ip: null, bmcIp: null, bmcType: null, os: null, model: null },
      ],
    });
    init(makeTask('SERVER_MAINTENANCE'), infra);
    expect(component.dcControls.length).toBe(2);
    expect(component.dcControls.at(0).get('rawJson')).not.toBeNull();
  });

  it('buildPayload incluye el snapshot del DC cuando rawJson es JSON válido con is_dc true', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }));
    const snapshot = {
      is_dc: true, dc_name: 'DC01', domain: 'contoso.local',
      collected_at: '2026-06-12T08:43:25.263Z',
      repl_healthy: true, repl_failures: 0, repl_partners: 0, repl_max_age_hours: null,
      dns_test_pass: true, dns_service_ok: true, dns_srv_ok: true, dns_zone_count: 6,
      sysvol_state_ok: true, sysvol_backlog: null, sysvol_replication: 'DFSR',
      warnings: [],
    };
    component.dcControls.at(0).patchValue({ rawJson: JSON.stringify(snapshot) });
    const payload = component.buildPayload() as ServerMaintenancePayload;
    expect(payload.windows.domainControllers).toHaveLength(1);
    expect(payload.windows.domainControllers[0].dc_name).toBe('DC01');
  });

  it('buildPayload omite DC con rawJson vacío', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }));
    component.dcControls.at(0).patchValue({ rawJson: '' });
    const payload = component.buildPayload() as ServerMaintenancePayload;
    expect(payload.windows.domainControllers).toHaveLength(0);
  });

  it('buildPayload omite DC con JSON malformado', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }));
    component.dcControls.at(0).patchValue({ rawJson: '{ no es json }' });
    const payload = component.buildPayload() as ServerMaintenancePayload;
    expect(payload.windows.domainControllers).toHaveLength(0);
  });

  it('patchFormFromPayload rellena rawJson con JSON.stringify del snapshot guardado', () => {
    const snapshot = {
      is_dc: true, dc_name: 'DC01', domain: 'contoso.local',
      collected_at: '2026-06-12T08:43:25.263Z',
      repl_healthy: true, repl_failures: 0, repl_partners: 0, repl_max_age_hours: null,
      dns_test_pass: true, dns_service_ok: true, dns_srv_ok: true, dns_zone_count: 6,
      sysvol_state_ok: true, sysvol_backlog: null, sysvol_replication: 'DFSR',
      warnings: [],
    };
    const infra = makeInfra({ esxiHosts: [], nas: [], routers: [] });
    const saved: ServerMaintenancePayload = {
      type: 'SERVER_MAINTENANCE',
      windows: { servers: [], domainControllers: [snapshot as any] },
    };

    fixture = TestBed.createComponent(MaintenanceFormComponent);
    component = fixture.componentInstance;
    component.task = makeTask('SERVER_MAINTENANCE');
    component.infrastructure = infra;
    component.savedPayload = saved;
    component.ngOnChanges({
      infrastructure: new SimpleChange(undefined, infra, true),
      savedPayload: new SimpleChange(undefined, saved, true),
    });
    fixture.detectChanges();

    const rawJson = component.dcControls.at(0).get('rawJson')?.value;
    expect(rawJson).toBe(JSON.stringify(snapshot, null, 2));
    const reparsed = JSON.parse(rawJson);
    expect(reparsed.dc_name).toBe('DC01');
  });

  it('windows.servers no contiene el campo rebootScript', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [], domainControllers: [] }));
    const payload = component.buildPayload() as ServerMaintenancePayload;
    expect((payload.windows.servers[0] as any).rebootScript).toBeUndefined();
  });
});
```

- [ ] **Step 5: Correr el spec — debe FALLAR**

```bash
cd frontend && npx ng test --include="**/maintenance-form.component.spec.ts" --watch=false
```

Esperado: fallos en los nuevos tests de DC y en los tests que referencian el modelo actualizado. Los tests existentes de VMware, BMC, QNAP, router, terminal deben seguir pasando o fallar solo por referencias al modelo viejo.

---

## Task 6: Frontend — actualizar `MaintenanceFormComponent` (implementación)

**Files:**
- Modify: `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.ts`
- Modify: `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.html`

- [ ] **Step 1: Actualizar `maintenance-form.component.ts`**

Reemplazar el archivo completo con:

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
  DcHealthSnapshot,
  MaintenancePayload,
  RouterEntry,
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
  @Input() savedPayload: MaintenancePayload | null = null;
  @Input() readOnly = false;

  @Output() requestComplete = new EventEmitter<ServerMaintenancePayload | TerminalPayload>();
  @Output() requestSave = new EventEmitter<ServerMaintenancePayload | TerminalPayload>();
  @Output() requestNotDone = new EventEmitter<void>();

  form!: FormGroup;

  constructor(private fb: FormBuilder) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['infrastructure'] && this.infrastructure) {
      this.buildForm();
      if (this.savedPayload) {
        this.patchFormFromPayload(this.savedPayload);
      }
      this.applyReadOnlyState();
    } else if (changes['savedPayload'] && this.savedPayload && this.form) {
      this.patchFormFromPayload(this.savedPayload);
      this.applyReadOnlyState();
    } else if (changes['readOnly'] && this.form) {
      this.applyReadOnlyState();
    }
  }

  // ── Getters condicionales ────────────────────────────────────────────────────

  get hasServers(): boolean { return this.infrastructure?.windowsVMs?.length > 0; }
  get hasVMware(): boolean  { return this.infrastructure?.esxiHosts?.length > 0; }
  get hasQNAP(): boolean    { return this.infrastructure?.nas?.length > 0; }
  get hasVeeam(): boolean   { return this.infrastructure?.esxiHosts?.length > 0; }
  get hasRouter(): boolean  { return this.infrastructure?.routers?.length > 0; }

  get hasDomainControllers(): boolean {
    return this.infrastructure?.domainControllers?.length > 0;
  }

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

  get routerDeviceControls(): FormArray {
    return this.form.get('routerDevices') as FormArray;
  }

  get dcControls(): FormArray {
    return this.form.get('domainControllers') as FormArray;
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

  // ── Read-only state ─────────────────────────────────────────────────────────

  private applyReadOnlyState(): void {
    if (!this.form) return;
    if (this.readOnly) {
      this.form.disable({ emitEvent: false });
    } else {
      this.form.enable({ emitEvent: false });
    }
  }

  // ── Form construction ───────────────────────────────────────────────────────

  private buildForm(): void {
    this.form = this.fb.group({
      servers: this.fb.array(
        this.infrastructure.windowsVMs.map(() => this.fb.group({
          updates:  ['ok'],
          notes:    [''],
          expanded: [false],
        }))
      ),
      domainControllers: this.fb.array(
        this.infrastructure.domainControllers.map(() => this.fb.group({
          rawJson: [''],
        }))
      ),
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
      routerDevices: this.fb.array(
        this.infrastructure.routers.map(() => this.fb.group({
          firmwareUpdated: [false],
          firmwareVersion: [''],
          backupDone:      [false],
        }))
      ),
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

  selectClass(value: string): string {
    if (!value) return 'mf-sel--na';
    if (value === 'ok' || value === 'OK') return 'mf-sel--ok';
    if (value === 'pending' || value === 'degraded' || value === 'falta_configurar' || value === 'ERROR Systemlog') return 'mf-sel--warn';
    if (value === 'error' || value === 'failed' || value === 'ERROR' || value === 'alerta') return 'mf-sel--crit';
    return 'mf-sel--na';
  }

  serverRowClass(i: number): string {
    const group = this.getServerGroup(i);
    const sc = this.selectClass(group.get('updates')?.value);
    if (sc === 'mf-sel--crit') return 'mf-srv-row--crit';
    if (sc === 'mf-sel--warn') return 'mf-srv-row--warn';
    return '';
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

  getDcGroup(index: number): FormGroup {
    return this.dcControls.at(index) as FormGroup;
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
      serverId:   vm.assetId,
      serverName: vm.name,
      updates:    v.servers[i]?.updates ?? 'ok',
      notes:      v.servers[i]?.notes || undefined,
    }));

    const domainControllers: DcHealthSnapshot[] = this.infrastructure.domainControllers
      .map((_, i) => {
        const raw: string = this.dcControls.at(i).get('rawJson')?.value ?? '';
        try { return JSON.parse(raw) as DcHealthSnapshot; }
        catch { return null; }
      })
      .filter((s): s is DcHealthSnapshot => s !== null);

    const payload: ServerMaintenancePayload = {
      type: 'SERVER_MAINTENANCE',
      windows: { servers, domainControllers },
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
      payload.router = this.infrastructure.routers.map((router, i): RouterEntry => {
        const ctrl = this.routerDeviceControls.at(i).value;
        return {
          routerId:        router.assetId,
          routerName:      router.name,
          firmwareUpdated: ctrl.firmwareUpdated,
          firmwareVersion: ctrl.firmwareVersion || undefined,
          backupDone:      ctrl.backupDone,
        };
      });
    }

    return payload;
  }

  private patchFormFromPayload(payload: MaintenancePayload): void {
    if (payload.type === 'SERVER_MAINTENANCE') {
      const srv = payload as ServerMaintenancePayload;

      this.form.patchValue({
        notes:        srv.notes ?? '',
        veeamStatus:  srv.veeam?.status ?? 'ok',
        veeamMissing: srv.veeam?.missingVMs ?? [],
      });

      if (srv.windows.domainControllers?.length) {
        srv.windows.domainControllers.forEach((snapshot, i) => {
          this.dcControls.at(i)?.patchValue({
            rawJson: JSON.stringify(snapshot, null, 2),
          });
        });
      }

      if (srv.router?.length) {
        this.infrastructure.routers.forEach((router, i) => {
          const saved = srv.router!.find(r => r.routerId === router.assetId);
          if (saved) {
            this.routerDeviceControls.at(i).patchValue({
              firmwareUpdated: saved.firmwareUpdated,
              firmwareVersion: saved.firmwareVersion ?? '',
              backupDone:      saved.backupDone,
            });
          }
        });
      }

      if (srv.windows.servers?.length) {
        this.infrastructure.windowsVMs.forEach((vm, i) => {
          const saved = srv.windows.servers.find(s => s.serverId === vm.assetId);
          if (saved) {
            this.serverControls.at(i).patchValue({
              updates: saved.updates,
              notes:   saved.notes ?? '',
            });
          }
        });
      }

      if (srv.vmware?.length) {
        this.infrastructure.esxiHosts.forEach((host, i) => {
          const saved = srv.vmware!.find(h => h.hostId === host.assetId);
          if (saved) {
            this.vmwareHostControls.at(i).patchValue({
              cpuUsage:     saved.cpuUsage,
              memUsage:     saved.memUsage,
              storageUsage: saved.storageUsage,
              highUsageVMs: saved.highUsageVMs ?? [],
              snapshotsOk:  saved.snapshotsOk,
            });
          }
        });
      }

      if (srv.qnap?.length) {
        this.infrastructure.nas.forEach((nas, i) => {
          const saved = srv.qnap!.find(d => d.deviceId === nas.assetId);
          if (saved) {
            this.qnapDeviceControls.at(i).patchValue({
              spaceUsed:       saved.spaceUsed,
              raidStatus:      saved.raidStatus,
              firmwareUpdated: saved.firmwareUpdated,
            });
          }
        });
      }

      if (srv.bmc?.length) {
        this.infrastructure.esxiHosts.forEach((host, i) => {
          const saved = srv.bmc!.find(b => b.hostId === host.assetId);
          if (saved) {
            this.bmcHostControls.at(i).patchValue({
              firmwareVersion: saved.firmwareVersion ?? '',
              biosVersion:     saved.biosVersion ?? '',
              alertStatus:     saved.alertStatus,
              alertNote:       saved.alertNote ?? '',
            });
          }
        });
      }
    } else if (payload.type === 'TERMINAL_MAINTENANCE') {
      const t = payload as TerminalPayload;
      this.form.patchValue({
        cleanedTemp:    t.checks?.cleanedTemp    ?? false,
        windowsUpdates: t.checks?.windowsUpdates ?? false,
        antivirusOk:    t.checks?.antivirusOk    ?? false,
        diskSpace:      t.checks?.diskSpace      ?? false,
        licenses:       t.checks?.licenses       ?? false,
        connectivity:   t.network?.connectivity  ?? false,
        switches:       t.network?.switches      ?? false,
        observations:   t.observations ?? '',
        notes:          t.notes ?? '',
      });
    }
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  submit(): void {
    this.requestComplete.emit(this.buildPayload());
  }

  save(): void {
    this.requestSave.emit(this.buildPayload());
  }

  submitNotDone(): void {
    this.requestNotDone.emit();
  }
}
```

- [ ] **Step 2: Actualizar `maintenance-form.component.html`**

Reemplazar solo las secciones que cambian. En la sección de Servidores Windows:

**Eliminar** el bloque completo del `<!-- DCDIAG -->` (desde `<div class="mf-cl-rpt">` que envuelve DCDIAG hasta el `</div>` que cierra ese bloque, ~líneas 9–36).

**En `mf-srv-head`**, eliminar la columna `<span class="mf-srv-th">Script reinicio</span>`.

**En cada fila de servidor** (`ng-container formGroupName`), eliminar el `mat-form-field` del `rebootScript` (~líneas 66–73).

**Agregar** la nueva sección de DCs antes de la sección VMware. Insertar después del cierre de `</ng-container>` de servidores y antes de `<!-- ── VMware ESXi -->`:

```html
<!-- ── Controladores de dominio ──────────────────────── -->
<ng-container *ngIf="hasDomainControllers">

  <div class="mf-section-lbl">Controladores de dominio</div>

  <app-dc-health-card
    *ngFor="let _ of dcControls.controls; let i = index"
    [dc]="infrastructure.domainControllers[i]"
    [formGroup]="getDcGroup(i)"
    [readOnly]="readOnly">
  </app-dc-health-card>

</ng-container>
```

El resultado de la sección de servidores windows quedará así (para referencia):

```html
<!-- ── Servidores Windows ─────────────────────────────── -->
<ng-container *ngIf="hasServers">

  <div class="mf-section-lbl">Servidores</div>

  <div class="mf-srv-table">
    <div class="mf-srv-head">
      <span></span>
      <span class="mf-srv-th" style="padding-left:8px">Servidor</span>
      <span class="mf-srv-th">Win Updates</span>
      <span></span>
    </div>

    <ng-container formArrayName="servers">
      <ng-container *ngFor="let _ of serverControls.controls; let i = index"
                    [formGroupName]="i">

        <div class="mf-srv-row"
             [class.mf-srv-row--expanded]="getServerGroup(i).get('expanded')?.value"
             [ngClass]="serverRowClass(i)">

          <div class="mf-srv-icon">
            <svg viewBox="0 0 24 24" style="width:8px;height:8px;stroke:var(--srv);fill:none;stroke-width:1.8;stroke-linecap:round">
              <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
            </svg>
          </div>

          <div class="mf-srv-name-cell">
            <div class="mf-srv-name">{{ infrastructure.windowsVMs[i].name }}</div>
            <div class="mf-srv-access">{{ infrastructure.windowsVMs[i].ip ?? '—' }}</div>
          </div>

          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="mf-srv-ff"
                          [ngClass]="selectClass(getServerGroup(i).get('updates')?.value)">
            <mat-select formControlName="updates">
              <mat-option value="ok">Al día</mat-option>
              <mat-option value="pending">Pendientes</mat-option>
              <mat-option value="failed">Error</mat-option>
            </mat-select>
          </mat-form-field>

          <button mat-icon-button type="button" class="mf-expand-btn" (click)="toggleExpand(i)">
            <svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round">
              <polyline *ngIf="!getServerGroup(i).get('expanded')?.value" points="6 9 12 15 18 9"/>
              <polyline *ngIf="getServerGroup(i).get('expanded')?.value"  points="18 15 12 9 6 15"/>
            </svg>
          </button>

        </div>

        <div class="mf-expand-panel" [class.mf-expand-panel--open]="getServerGroup(i).get('expanded')?.value">
          <div class="mf-expand-detail">
            <span class="mf-lbl">S.O.</span>
            <span class="mf-expand-os">{{ infrastructure.windowsVMs[i].os ?? '—' }}</span>
          </div>
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="mf-form-field" style="margin-top:6px">
            <mat-label>Nota</mat-label>
            <input matInput formControlName="notes" placeholder="Detalles, error puntual, acción tomada..." />
          </mat-form-field>
        </div>

      </ng-container>
    </ng-container>
  </div>

</ng-container>
```

- [ ] **Step 3: Correr el spec — debe PASAR**

```bash
cd frontend && npx ng test --include="**/maintenance-form.component.spec.ts" --watch=false
```

Esperado: todos los tests del archivo pasan.

- [ ] **Step 4: Verificar que no hay errores de compilación TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Esperado: 0 errores.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.ts
git add frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.html
git add frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.spec.ts
git commit -m "feat(maintenance-form): reemplazar DCDIAG y rebootScript por cards de DC health snapshot"
```

---

## Task 7: Frontend — registrar `DcHealthCardComponent` en el módulo

**Files:**
- Modify: `frontend/src/app/features/technician/technician.module.ts`

- [ ] **Step 1: Declarar `DcHealthCardComponent` en `TechnicianModule`**

En `frontend/src/app/features/technician/technician.module.ts`, agregar el import y la declaración:

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { TechnicianRoutingModule } from './technician-routing.module';
import { TaskListComponent } from './task-list/task-list.component';
import { TaskDrawerComponent } from './task-drawer/task-drawer.component';
import { MaintenanceFormComponent } from './task-drawer/maintenance-form/maintenance-form.component';
import { DcHealthCardComponent } from './task-drawer/maintenance-form/dc-health-card/dc-health-card.component';
import { ConfirmMaintenanceDialogComponent } from './task-drawer/confirm-maintenance-dialog/confirm-maintenance-dialog.component';
import { TimeSpentDialogComponent } from './task-drawer/time-spent-dialog/time-spent-dialog.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [
    TaskListComponent,
    TaskDrawerComponent,
    MaintenanceFormComponent,
    DcHealthCardComponent,
    ConfirmMaintenanceDialogComponent,
    TimeSpentDialogComponent,
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatSnackBarModule,
    TechnicianRoutingModule,
    SharedModule,
  ],
})
export class TechnicianModule {}
```

- [ ] **Step 2: Correr todos los tests del frontend**

```bash
cd frontend && npx ng test --watch=false
```

Esperado: todos los tests pasan (incluyendo los tests de módulos que ahora podrían detectar referencias a `DcHealthCardComponent` en el template de `MaintenanceFormComponent`).

- [ ] **Step 3: Correr todos los tests del backend**

```bash
cd backend && npx jest --no-coverage
```

Esperado: todos los tests pasan.

- [ ] **Step 4: Commit final**

```bash
git add frontend/src/app/features/technician/technician.module.ts
git commit -m "feat(technician): registrar DcHealthCardComponent en el módulo"
```

---

## Self-review

**Spec coverage:**
- ✅ Backend: `asset_description` en `RawInfradocAsset` → Task 1
- ✅ Backend: detección de DCs por description → Task 2
- ✅ Backend: `domainControllers` en DTO → Task 1
- ✅ Frontend models: `DcHealthSnapshot`, `WindowsSection` actualizado → Task 3
- ✅ Frontend: `DcHealthCardComponent` estados (vacío, parseo, error, readOnly) → Task 4
- ✅ Frontend: `MaintenanceFormComponent` FormArray DC, payload, patch → Task 6
- ✅ Frontend: template sin DCDIAG, sin rebootScript, con sección DC → Task 6
- ✅ Frontend: `TechnicianModule` registra el nuevo componente → Task 7

**Tipos consistentes:**
- `DcHealthSnapshot` definido en Task 3 y usado en Tasks 4 y 6 ✓
- `getDcGroup(i)` definido en Task 6 y referenciado en el template de Task 6 ✓
- `infrastructure.domainControllers` disponible desde Task 3 en adelante ✓
- `dcControls` getter devuelve el FormArray correcto ✓

**Sin placeholders:** Todos los pasos tienen código completo. ✓
