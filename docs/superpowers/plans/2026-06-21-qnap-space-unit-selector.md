# QNAP Space Unit Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un selector de unidad (GB/TB) independiente por campo en los campos "Espacio total" y "Espacio utilizado" del formulario QNAP/NAS.

**Architecture:** Se agrega `totalSpaceUnit` y `usedSpaceUnit` al modelo `QNAPSection` y a cada `FormGroup` del `FormArray` de dispositivos QNAP. El valor crudo se guarda en la unidad seleccionada (sin conversión). El porcentaje en pantalla normaliza ambos a GB vía el helper `spaceRatio(i)`. El template reemplaza los `<span matTextSuffix>` por `<mat-select matSuffix>`.

**Tech Stack:** Angular 19 · Angular Material · ReactiveFormsModule · Karma/Jasmine

## Global Constraints

- `appearance="outline"` es el único estilo permitido en `mat-form-field`
- Ningún elemento interactivo nativo (`<select>`, `<button>`) — siempre Angular Material
- Sin standalone components
- TDD: test antes de implementación
- Un archivo a la vez con commit al final de cada tarea
- No usar `any` en TypeScript

---

### Task 1: Actualizar modelo QNAPSection

**Files:**
- Modify: `frontend/src/app/core/models/maintenance-log.models.ts:46-57`
- Modify: `frontend/src/app/core/models/maintenance-log.models.spec.ts`

**Interfaces:**
- Produces: `QNAPSection.totalSpaceUnit?: 'GB' | 'TB'`, `QNAPSection.usedSpaceUnit?: 'GB' | 'TB'` — campos opcionales para compatibilidad con logs existentes

- [ ] **Step 1: Escribir el test fallido**

En `maintenance-log.models.spec.ts`, agregar al final del bloque `describe('ServerMaintenancePayload', ...)` que ya existe:

```typescript
it('should accept QNAPSection with totalSpaceUnit and usedSpaceUnit', () => {
  const section: QNAPSection = {
    deviceId: 10,
    deviceName: 'QNAP',
    diskCount: 4,
    totalSpaceGB: 8,
    totalSpaceUnit: 'TB',
    usedSpaceGB: 5,
    usedSpaceUnit: 'TB',
    disksWithError: [],
    raidStatus: 'ok',
    firmwareVersion: '5.1.0.2566',
    firmwareUpdated: false,
  };
  expect(section.totalSpaceUnit).toBe('TB');
  expect(section.usedSpaceUnit).toBe('TB');
});

it('should accept QNAPSection without unit fields (backward compat)', () => {
  const section: QNAPSection = {
    deviceId: 10,
    deviceName: 'QNAP',
    diskCount: 4,
    totalSpaceGB: 16000,
    usedSpaceGB: 11200,
    disksWithError: [],
    raidStatus: 'ok',
    firmwareVersion: '5.1.0.2566',
    firmwareUpdated: false,
  };
  expect(section.totalSpaceUnit).toBeUndefined();
  expect(section.usedSpaceUnit).toBeUndefined();
});
```

Asegurarse de importar `QNAPSection` en el import al tope del spec:
```typescript
import { BmcAlertCategory, QNAPSection, ServerMaintenancePayload, TerminalPayload } from './maintenance-log.models';
```

- [ ] **Step 2: Correr el test y verificar que falla por error de compilación**

```bash
cd frontend && npx ng test --include="**/maintenance-log.models.spec.ts" --watch=false
```

Esperado: error de TypeScript — `Property 'totalSpaceUnit' does not exist on type 'QNAPSection'`

- [ ] **Step 3: Implementar — agregar campos opcionales a QNAPSection**

En `frontend/src/app/core/models/maintenance-log.models.ts`, reemplazar la interfaz `QNAPSection` (líneas 46-57):

```typescript
export interface QNAPSection {
  deviceId: number;
  deviceName: string;
  diskCount: number;
  totalSpaceGB: number;
  totalSpaceUnit?: 'GB' | 'TB';
  usedSpaceGB: number;
  usedSpaceUnit?: 'GB' | 'TB';
  disksWithError: string[];
  raidStatus: 'ok' | 'degraded' | 'failed';
  firmwareVersion: string;
  firmwareUpdated: boolean;
  firmwareNewVersion?: string;
}
```

- [ ] **Step 4: Correr tests y verificar que pasan**

```bash
cd frontend && npx ng test --include="**/maintenance-log.models.spec.ts" --watch=false
```

Esperado: todos los tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/core/models/maintenance-log.models.ts frontend/src/app/core/models/maintenance-log.models.spec.ts
git commit -m "feat(qnap): agregar totalSpaceUnit y usedSpaceUnit a QNAPSection"
```

---

### Task 2: Controles de formulario, helper spaceRatio, buildPayload y patchSavedValues

**Files:**
- Modify: `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.ts`
- Modify: `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.spec.ts`

**Interfaces:**
- Consumes: `QNAPSection.totalSpaceUnit?: 'GB' | 'TB'`, `QNAPSection.usedSpaceUnit?: 'GB' | 'TB'` (Task 1)
- Produces: `component.spaceRatio(i: number): number`, controles `totalSpaceUnit` y `usedSpaceUnit` en cada QNAP FormGroup

- [ ] **Step 1: Escribir tests fallidos — controles nuevos**

En `maintenance-form.component.spec.ts`, dentro del bloque `describe('QNAP controls', ...)` (alrededor de línea 976), actualizar el test existente de controles para incluir los nuevos campos, y agregar tests nuevos:

Reemplazar el test existente `'qnapDeviceControls should have diskCount, totalSpaceGB...'` (línea 977):

```typescript
it('qnapDeviceControls should have diskCount, totalSpaceGB, totalSpaceUnit, usedSpaceGB, usedSpaceUnit, disksWithError, raidStatus, firmwareVersion, firmwareUpdated, firmwareNewVersion controls', () => {
  init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], routers: [] }));
  const group = component.qnapDeviceControls.at(0);
  expect(group.get('diskCount')).not.toBeNull();
  expect(group.get('totalSpaceGB')).not.toBeNull();
  expect(group.get('totalSpaceUnit')).not.toBeNull();
  expect(group.get('usedSpaceGB')).not.toBeNull();
  expect(group.get('usedSpaceUnit')).not.toBeNull();
  expect(group.get('disksWithError')).not.toBeNull();
  expect(group.get('raidStatus')).not.toBeNull();
  expect(group.get('firmwareVersion')).not.toBeNull();
  expect(group.get('firmwareUpdated')).not.toBeNull();
  expect(group.get('firmwareNewVersion')).not.toBeNull();
});
```

Agregar después del bloque QNAP controls existente un nuevo bloque:

```typescript
// ── spaceRatio helper ────────────────────────────────────────────────────────

describe('spaceRatio', () => {
  it('should return 0 when totalSpaceGB is 0', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], routers: [] }));
    component.qnapDeviceControls.at(0).patchValue({ totalSpaceGB: 0, usedSpaceGB: 0, totalSpaceUnit: 'GB', usedSpaceUnit: 'GB' });
    expect(component.spaceRatio(0)).toBe(0);
  });

  it('should return 50 when used is half of total in same unit (GB)', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], routers: [] }));
    component.qnapDeviceControls.at(0).patchValue({ totalSpaceGB: 1000, usedSpaceGB: 500, totalSpaceUnit: 'GB', usedSpaceUnit: 'GB' });
    expect(component.spaceRatio(0)).toBe(50);
  });

  it('should return 50 when used is half of total in same unit (TB)', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], routers: [] }));
    component.qnapDeviceControls.at(0).patchValue({ totalSpaceGB: 8, usedSpaceGB: 4, totalSpaceUnit: 'TB', usedSpaceUnit: 'TB' });
    expect(component.spaceRatio(0)).toBe(50);
  });

  it('should normalize cross-unit: 512 GB used / 1 TB total = 50%', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], routers: [] }));
    component.qnapDeviceControls.at(0).patchValue({ totalSpaceGB: 1, usedSpaceGB: 512, totalSpaceUnit: 'TB', usedSpaceUnit: 'GB' });
    expect(component.spaceRatio(0)).toBe(50);
  });

  it('should normalize cross-unit: 1 TB used / 2 TB total = 50%', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], routers: [] }));
    component.qnapDeviceControls.at(0).patchValue({ totalSpaceGB: 2, usedSpaceGB: 1, totalSpaceUnit: 'TB', usedSpaceUnit: 'TB' });
    expect(component.spaceRatio(0)).toBe(50);
  });
});

// ── buildPayload — QNAP unit fields ─────────────────────────────────────────

describe('buildPayload — QNAP unit fields', () => {
  it('should include totalSpaceUnit and usedSpaceUnit in payload (GB default)', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], routers: [] }));
    component.qnapDeviceControls.at(0).patchValue({
      diskCount: 4, totalSpaceGB: 16000, usedSpaceGB: 11200,
      totalSpaceUnit: 'GB', usedSpaceUnit: 'GB',
      disksWithError: [], raidStatus: 'ok',
      firmwareVersion: '5.1.0.2566', firmwareUpdated: false,
    });
    const payload = component.buildPayload() as ServerMaintenancePayload;
    expect(payload.qnap![0].totalSpaceUnit).toBe('GB');
    expect(payload.qnap![0].usedSpaceUnit).toBe('GB');
  });

  it('should include totalSpaceUnit TB in payload when selected', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], routers: [] }));
    component.qnapDeviceControls.at(0).patchValue({
      diskCount: 4, totalSpaceGB: 8, usedSpaceGB: 5,
      totalSpaceUnit: 'TB', usedSpaceUnit: 'TB',
      disksWithError: [], raidStatus: 'ok',
      firmwareVersion: '5.1.0.2566', firmwareUpdated: false,
    });
    const payload = component.buildPayload() as ServerMaintenancePayload;
    expect(payload.qnap![0].totalSpaceGB).toBe(8);
    expect(payload.qnap![0].totalSpaceUnit).toBe('TB');
    expect(payload.qnap![0].usedSpaceGB).toBe(5);
    expect(payload.qnap![0].usedSpaceUnit).toBe('TB');
  });

  it('should support mixed units in payload (total TB, used GB)', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], routers: [] }));
    component.qnapDeviceControls.at(0).patchValue({
      diskCount: 4, totalSpaceGB: 8, usedSpaceGB: 3500,
      totalSpaceUnit: 'TB', usedSpaceUnit: 'GB',
      disksWithError: [], raidStatus: 'ok',
      firmwareVersion: '5.1.0.2566', firmwareUpdated: false,
    });
    const payload = component.buildPayload() as ServerMaintenancePayload;
    expect(payload.qnap![0].totalSpaceUnit).toBe('TB');
    expect(payload.qnap![0].usedSpaceUnit).toBe('GB');
  });
});

// ── patchFormFromPayload — QNAP unit fields ──────────────────────────────────

describe('patchFormFromPayload — QNAP unit fields', () => {
  it('parchea totalSpaceUnit y usedSpaceUnit cuando están presentes en el payload', () => {
    const saved: ServerMaintenancePayload = {
      type: 'SERVER_MAINTENANCE',
      windows: { servers: [], domainControllers: [] },
      qnap: [{
        deviceId: 10, deviceName: 'QNAP',
        diskCount: 4, totalSpaceGB: 8, totalSpaceUnit: 'TB',
        usedSpaceGB: 5, usedSpaceUnit: 'TB',
        disksWithError: [], raidStatus: 'ok',
        firmwareVersion: '5.1.0.2566', firmwareUpdated: false,
      }],
    };
    fixture = TestBed.createComponent(MaintenanceFormComponent);
    component = fixture.componentInstance;
    component.task = makeTask('SERVER_MAINTENANCE');
    component.infrastructure = makeInfra({ esxiHosts: [], routers: [] });
    component.savedPayload = saved;
    component.ngOnChanges({
      infrastructure: new SimpleChange(undefined, makeInfra({ esxiHosts: [], routers: [] }), true),
      savedPayload: new SimpleChange(undefined, saved, true),
    });
    fixture.detectChanges();

    expect(component.qnapDeviceControls.at(0).get('totalSpaceUnit')?.value).toBe('TB');
    expect(component.qnapDeviceControls.at(0).get('usedSpaceUnit')?.value).toBe('TB');
  });

  it('defaultea a GB cuando el payload no tiene unit fields (logs existentes)', () => {
    const saved: ServerMaintenancePayload = {
      type: 'SERVER_MAINTENANCE',
      windows: { servers: [], domainControllers: [] },
      qnap: [{
        deviceId: 10, deviceName: 'QNAP',
        diskCount: 4, totalSpaceGB: 16000, usedSpaceGB: 11200,
        disksWithError: [], raidStatus: 'ok',
        firmwareVersion: '5.1.0.2566', firmwareUpdated: false,
      }],
    };
    fixture = TestBed.createComponent(MaintenanceFormComponent);
    component = fixture.componentInstance;
    component.task = makeTask('SERVER_MAINTENANCE');
    component.infrastructure = makeInfra({ esxiHosts: [], routers: [] });
    component.savedPayload = saved;
    component.ngOnChanges({
      infrastructure: new SimpleChange(undefined, makeInfra({ esxiHosts: [], routers: [] }), true),
      savedPayload: new SimpleChange(undefined, saved, true),
    });
    fixture.detectChanges();

    expect(component.qnapDeviceControls.at(0).get('totalSpaceUnit')?.value).toBe('GB');
    expect(component.qnapDeviceControls.at(0).get('usedSpaceUnit')?.value).toBe('GB');
  });
});
```

- [ ] **Step 2: Correr tests y verificar que fallan**

```bash
cd frontend && npx ng test --include="**/maintenance-form.component.spec.ts" --watch=false
```

Esperado: FAIL — `Expected null not to be null` (controles no existen), `component.spaceRatio is not a function`

- [ ] **Step 3: Implementar — controles en FormGroup**

En `maintenance-form.component.ts`, en el `FormArray` `qnapDevices` (alrededor de línea 142), agregar `totalSpaceUnit` y `usedSpaceUnit` al `FormGroup` de cada dispositivo:

```typescript
qnapDevices: this.fb.array(
  this.infrastructure.nas.map(() => this.fb.group({
    diskCount:          [null as number | null],
    totalSpaceGB:       [null as number | null],
    totalSpaceUnit:     ['GB' as 'GB' | 'TB'],
    usedSpaceGB:        [null as number | null],
    usedSpaceUnit:      ['GB' as 'GB' | 'TB'],
    disksWithError:     [[] as string[]],
    raidStatus:         ['ok'],
    firmwareVersion:    [''],
    firmwareUpdated:    [false],
    firmwareNewVersion: [''],
  }))
),
```

- [ ] **Step 4: Implementar — helper spaceRatio**

En `maintenance-form.component.ts`, agregar el método `spaceRatio` junto a los otros helpers QNAP (después de `qnapFirmwareUpdated`, alrededor de línea 246):

```typescript
spaceRatio(index: number): number {
  const g = this.getQnapGroup(index).value;
  const total = Number(g.totalSpaceGB) * (g.totalSpaceUnit === 'TB' ? 1024 : 1);
  const used  = Number(g.usedSpaceGB)  * (g.usedSpaceUnit  === 'TB' ? 1024 : 1);
  return total ? (used / total) * 100 : 0;
}
```

- [ ] **Step 5: Implementar — buildPayload incluye unidades**

En `maintenance-form.component.ts`, en el bloque `buildPayload` donde se construye `QNAPSection` (alrededor de línea 327), agregar `totalSpaceUnit` y `usedSpaceUnit`:

```typescript
const result: QNAPSection = {
  deviceId:        nas.assetId,
  deviceName:      nas.name,
  diskCount:       Number(ctrl.diskCount),
  totalSpaceGB:    Number(ctrl.totalSpaceGB),
  totalSpaceUnit:  ctrl.totalSpaceUnit ?? 'GB',
  usedSpaceGB:     Number(ctrl.usedSpaceGB),
  usedSpaceUnit:   ctrl.usedSpaceUnit ?? 'GB',
  disksWithError:  ctrl.disksWithError ?? [],
  raidStatus:      ctrl.raidStatus,
  firmwareVersion: ctrl.firmwareVersion ?? '',
  firmwareUpdated: ctrl.firmwareUpdated,
};
```

- [ ] **Step 6: Implementar — patchSavedValues restaura unidades**

En `maintenance-form.component.ts`, en el bloque `patchSavedValues` donde se parchea `qnapDeviceControls` (alrededor de línea 422), agregar las unidades:

```typescript
this.qnapDeviceControls.at(i).patchValue({
  diskCount:          saved.diskCount,
  totalSpaceGB:       saved.totalSpaceGB,
  totalSpaceUnit:     saved.totalSpaceUnit ?? 'GB',
  usedSpaceGB:        saved.usedSpaceGB,
  usedSpaceUnit:      saved.usedSpaceUnit ?? 'GB',
  disksWithError:     saved.disksWithError,
  raidStatus:         saved.raidStatus,
  firmwareVersion:    saved.firmwareVersion,
  firmwareUpdated:    saved.firmwareUpdated,
  firmwareNewVersion: saved.firmwareNewVersion,
});
```

- [ ] **Step 7: Correr todos los tests y verificar que pasan**

```bash
cd frontend && npx ng test --include="**/maintenance-form.component.spec.ts" --watch=false
```

Esperado: todos los tests PASS

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.ts \
        frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.spec.ts
git commit -m "feat(qnap): agregar controles totalSpaceUnit/usedSpaceUnit y helper spaceRatio"
```

---

### Task 3: Template — selectores de unidad en mat-form-field

**Files:**
- Modify: `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.html:234-250`

**Interfaces:**
- Consumes: `totalSpaceUnit`, `usedSpaceUnit` (FormControls de Task 2), `spaceRatio(i)` (helper de Task 2)

- [ ] **Step 1: Reemplazar sufijo "GB" fijo en Espacio total**

En `maintenance-form.component.html`, reemplazar el bloque "Espacio total" (líneas 234-239):

```html
<!-- Espacio total -->
<mat-form-field appearance="outline" subscriptSizing="dynamic" class="mf-metric-ff">
  <mat-label>Espacio total</mat-label>
  <input matInput formControlName="totalSpaceGB" type="number" min="0" placeholder="0" />
  <span matTextSuffix>GB</span>
</mat-form-field>
```

Por:

```html
<!-- Espacio total -->
<mat-form-field appearance="outline" subscriptSizing="dynamic" class="mf-metric-ff">
  <mat-label>Espacio total</mat-label>
  <input matInput formControlName="totalSpaceGB" type="number" min="0" placeholder="0" />
  <mat-select matSuffix formControlName="totalSpaceUnit" style="width:55px">
    <mat-option value="GB">GB</mat-option>
    <mat-option value="TB">TB</mat-option>
  </mat-select>
</mat-form-field>
```

- [ ] **Step 2: Reemplazar sufijo "GB" fijo y actualizar cálculo de porcentaje en Espacio utilizado**

Reemplazar el bloque "Espacio utilizado" (líneas 241-250):

```html
<!-- Espacio utilizado -->
<mat-form-field appearance="outline" subscriptSizing="dynamic" class="mf-metric-ff"
                [ngClass]="metricClass(
                  getQnapGroup(i).get('usedSpaceGB')?.value /
                  (getQnapGroup(i).get('totalSpaceGB')?.value || 1) * 100,
                  70, 85)">
  <mat-label>Espacio utilizado</mat-label>
  <input matInput formControlName="usedSpaceGB" type="number" min="0" placeholder="0" />
  <span matTextSuffix>GB</span>
</mat-form-field>
```

Por:

```html
<!-- Espacio utilizado -->
<mat-form-field appearance="outline" subscriptSizing="dynamic" class="mf-metric-ff"
                [ngClass]="metricClass(spaceRatio(i), 70, 85)">
  <mat-label>Espacio utilizado</mat-label>
  <input matInput formControlName="usedSpaceGB" type="number" min="0" placeholder="0" />
  <mat-select matSuffix formControlName="usedSpaceUnit" style="width:55px">
    <mat-option value="GB">GB</mat-option>
    <mat-option value="TB">TB</mat-option>
  </mat-select>
</mat-form-field>
```

- [ ] **Step 3: Correr la suite completa y verificar que todo pasa**

```bash
cd frontend && npx ng test --watch=false
```

Esperado: todos los tests PASS sin regresiones

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.html
git commit -m "feat(qnap): reemplazar sufijo GB fijo por selector de unidad GB/TB en formulario"
```
