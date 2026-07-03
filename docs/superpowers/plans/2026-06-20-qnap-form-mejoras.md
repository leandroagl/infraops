# QNAP Form — Mejoras de datos recolectados

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar los campos actuales del formulario QNAP/NAS (spaceUsed %, raidStatus, firmwareUpdated) por un conjunto más rico y útil: diskCount, totalSpaceGB, usedSpaceGB, disksWithError, raidStatus, firmwareVersion, firmwareUpdated + firmwareNewVersion condicional.

**Architecture:** Cambio puramente frontend en tres capas: modelo de tipos (`QNAPSection`), lógica del componente (`buildForm`, `buildPayload`, `patchFormFromPayload`, helpers) y template HTML. Sin nueva infraestructura, sin API externa.

**Tech Stack:** Angular 19, Angular Material, Reactive Forms (FormArray), Jest (via ng test/Karma)

## Global Constraints

- Sin standalone components Angular — usar módulo existente
- Formularios: solo `mat-form-field appearance="outline"` + elementos Angular Material
- TDD: test primero, implementación después
- Sin `any` en TypeScript
- Un archivo modificado por commit
- Idioma código: inglés — idioma commits: español

---

### Task 1: Actualizar el modelo `QNAPSection` y sus tests

**Files:**
- Modify: `frontend/src/app/core/models/maintenance-log.models.ts` (líneas 46–52)
- Modify: `frontend/src/app/core/models/maintenance-log.models.spec.ts`

**Interfaces:**
- Produces: `QNAPSection` con los nuevos campos — usada en Tasks 2 y 3

---

- [ ] **Step 1: Escribir los tests nuevos (fallarán por tipo)**

Reemplazar el test existente `'should accept optional qnap section as array with degraded status'` y agregar los nuevos en `maintenance-log.models.spec.ts`:

```typescript
it('should accept qnap section with diskCount, totalSpaceGB, usedSpaceGB and disksWithError', () => {
  const p: ServerMaintenancePayload = {
    type: 'SERVER_MAINTENANCE',
    windows: { servers: [], domainControllers: [] },
    qnap: [{
      deviceId: 10,
      deviceName: 'QNAP TS-453D',
      diskCount: 4,
      totalSpaceGB: 16000,
      usedSpaceGB: 11200,
      disksWithError: [],
      raidStatus: 'ok',
      firmwareVersion: '5.1.0.2566',
      firmwareUpdated: false,
    }],
  };
  expect(p.qnap?.[0].diskCount).toBe(4);
  expect(p.qnap?.[0].totalSpaceGB).toBe(16000);
  expect(p.qnap?.[0].usedSpaceGB).toBe(11200);
  expect(p.qnap?.[0].disksWithError).toEqual([]);
  expect(p.qnap?.[0].firmwareVersion).toBe('5.1.0.2566');
});

it('should accept qnap entry with raidStatus degraded and disksWithError list', () => {
  const p: ServerMaintenancePayload = {
    type: 'SERVER_MAINTENANCE',
    windows: { servers: [], domainControllers: [] },
    qnap: [{
      deviceId: 10,
      deviceName: 'QNAP TS-453D',
      diskCount: 4,
      totalSpaceGB: 16000,
      usedSpaceGB: 11200,
      disksWithError: ['Disk 2'],
      raidStatus: 'degraded',
      firmwareVersion: '5.1.0.2566',
      firmwareUpdated: false,
    }],
  };
  expect(p.qnap?.[0].raidStatus).toBe('degraded');
  expect(p.qnap?.[0].disksWithError).toEqual(['Disk 2']);
});

it('should accept qnap entry with firmwareUpdated true and firmwareNewVersion', () => {
  const p: ServerMaintenancePayload = {
    type: 'SERVER_MAINTENANCE',
    windows: { servers: [], domainControllers: [] },
    qnap: [{
      deviceId: 10,
      deviceName: 'QNAP TS-453D',
      diskCount: 4,
      totalSpaceGB: 16000,
      usedSpaceGB: 11200,
      disksWithError: [],
      raidStatus: 'ok',
      firmwareVersion: '5.1.0.2400',
      firmwareUpdated: true,
      firmwareNewVersion: '5.1.0.2566',
    }],
  };
  expect(p.qnap?.[0].firmwareUpdated).toBeTrue();
  expect(p.qnap?.[0].firmwareNewVersion).toBe('5.1.0.2566');
});

it('should accept qnap entry without firmwareNewVersion when not updated', () => {
  const p: ServerMaintenancePayload = {
    type: 'SERVER_MAINTENANCE',
    windows: { servers: [], domainControllers: [] },
    qnap: [{
      deviceId: 10,
      deviceName: 'QNAP TS-453D',
      diskCount: 2,
      totalSpaceGB: 8000,
      usedSpaceGB: 3200,
      disksWithError: [],
      raidStatus: 'ok',
      firmwareVersion: '4.5.4.2117',
      firmwareUpdated: false,
    }],
  };
  expect(p.qnap?.[0].firmwareNewVersion).toBeUndefined();
});

it('should accept multiple qnap entries', () => {
  const p: ServerMaintenancePayload = {
    type: 'SERVER_MAINTENANCE',
    windows: { servers: [], domainControllers: [] },
    qnap: [
      {
        deviceId: 10, deviceName: 'QNAP-A',
        diskCount: 4, totalSpaceGB: 16000, usedSpaceGB: 8000,
        disksWithError: [], raidStatus: 'ok',
        firmwareVersion: '5.1.0.2566', firmwareUpdated: false,
      },
      {
        deviceId: 11, deviceName: 'QNAP-B',
        diskCount: 2, totalSpaceGB: 4000, usedSpaceGB: 3900,
        disksWithError: ['Disk 1', 'Disk 2'], raidStatus: 'failed',
        firmwareVersion: '4.5.4.2117', firmwareUpdated: false,
      },
    ],
  };
  expect(p.qnap?.length).toBe(2);
  expect(p.qnap?.[1].disksWithError.length).toBe(2);
  expect(p.qnap?.[1].raidStatus).toBe('failed');
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

```
cd frontend && npx ng test --include=src/app/core/models/maintenance-log.models.spec.ts --watch=false
```

Esperado: errores de tipo TypeScript — `spaceUsed` no existe en nuevo tipo (tras el cambio), o bien los tests nuevos no compilan porque el tipo aún tiene la forma vieja. Nota: los tests fallarán al compilar porque `QNAPSection` todavía tiene los campos viejos y los nuevos no existen.

- [ ] **Step 3: Actualizar la interfaz `QNAPSection` en `maintenance-log.models.ts`**

Reemplazar las líneas 46–52:

```typescript
// ANTES
export interface QNAPSection {
  deviceId: number;
  deviceName: string;
  spaceUsed: number;
  raidStatus: 'ok' | 'degraded' | 'failed';
  firmwareUpdated: boolean;
}
```

Por:

```typescript
// DESPUÉS
export interface QNAPSection {
  deviceId: number;
  deviceName: string;
  diskCount: number;
  totalSpaceGB: number;
  usedSpaceGB: number;
  disksWithError: string[];
  raidStatus: 'ok' | 'degraded' | 'failed';
  firmwareVersion: string;
  firmwareUpdated: boolean;
  firmwareNewVersion?: string;
}
```

- [ ] **Step 4: Correr los tests del modelo para verificar que pasan**

```
cd frontend && npx ng test --include=src/app/core/models/maintenance-log.models.spec.ts --watch=false
```

Esperado: todos los tests del archivo pasan.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/core/models/maintenance-log.models.ts frontend/src/app/core/models/maintenance-log.models.spec.ts
git commit -m "feat(qnap): expandir QNAPSection con diskCount, espacio en GB, disksWithError, firmwareVersion"
```

---

### Task 2: Actualizar lógica del componente y sus tests

**Files:**
- Modify: `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.ts`
- Modify: `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.spec.ts`

**Interfaces:**
- Consumes: `QNAPSection` del Task 1
- Produces:
  - `diskSlotOptions(i: number): string[]` — genera ["Disk 1"…"Disk N"] según `diskCount` del control i
  - `qnapFirmwareUpdated(i: number): boolean` — true si `firmwareUpdated` del control i es true
  - `getQnapGroup(i: number): FormGroup` — devuelve el FormGroup del índice i

---

- [ ] **Step 1: Escribir los tests nuevos en el spec del componente**

Agregar un nuevo `describe('QNAP controls', ...)` en `maintenance-form.component.spec.ts`:

```typescript
describe('QNAP controls', () => {
  it('qnapDeviceControls should have diskCount, totalSpaceGB, usedSpaceGB, disksWithError, raidStatus, firmwareVersion, firmwareUpdated controls', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], routers: [] }));
    const group = component.qnapDeviceControls.at(0);
    expect(group.get('diskCount')).not.toBeNull();
    expect(group.get('totalSpaceGB')).not.toBeNull();
    expect(group.get('usedSpaceGB')).not.toBeNull();
    expect(group.get('disksWithError')).not.toBeNull();
    expect(group.get('raidStatus')).not.toBeNull();
    expect(group.get('firmwareVersion')).not.toBeNull();
    expect(group.get('firmwareUpdated')).not.toBeNull();
    expect(group.get('firmwareNewVersion')).not.toBeNull();
  });

  it('qnapDeviceControls should NOT have spaceUsed control (campo reemplazado)', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], routers: [] }));
    expect(component.qnapDeviceControls.at(0).get('spaceUsed')).toBeNull();
  });

  it('diskSlotOptions should return empty array when diskCount is null', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], routers: [] }));
    component.qnapDeviceControls.at(0).patchValue({ diskCount: null });
    expect(component.diskSlotOptions(0)).toEqual([]);
  });

  it('diskSlotOptions should return ["Disk 1", "Disk 2", "Disk 4"] for diskCount 4', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], routers: [] }));
    component.qnapDeviceControls.at(0).patchValue({ diskCount: 4 });
    expect(component.diskSlotOptions(0)).toEqual(['Disk 1', 'Disk 2', 'Disk 3', 'Disk 4']);
  });

  it('qnapFirmwareUpdated should return false when firmwareUpdated is false', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], routers: [] }));
    component.qnapDeviceControls.at(0).patchValue({ firmwareUpdated: false });
    expect(component.qnapFirmwareUpdated(0)).toBeFalse();
  });

  it('qnapFirmwareUpdated should return true when firmwareUpdated is true', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], routers: [] }));
    component.qnapDeviceControls.at(0).patchValue({ firmwareUpdated: true });
    expect(component.qnapFirmwareUpdated(0)).toBeTrue();
  });
});

describe('buildPayload — QNAP section (nuevos campos)', () => {
  it('should include diskCount, totalSpaceGB, usedSpaceGB, disksWithError, firmwareVersion in payload', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], routers: [] }));
    component.qnapDeviceControls.at(0).patchValue({
      diskCount: 4,
      totalSpaceGB: 16000,
      usedSpaceGB: 11200,
      disksWithError: [],
      raidStatus: 'ok',
      firmwareVersion: '5.1.0.2566',
      firmwareUpdated: false,
      firmwareNewVersion: '',
    });
    const payload = component.buildPayload() as ServerMaintenancePayload;
    expect(payload.qnap![0].diskCount).toBe(4);
    expect(payload.qnap![0].totalSpaceGB).toBe(16000);
    expect(payload.qnap![0].usedSpaceGB).toBe(11200);
    expect(payload.qnap![0].disksWithError).toEqual([]);
    expect(payload.qnap![0].firmwareVersion).toBe('5.1.0.2566');
  });

  it('should include firmwareNewVersion in payload only when firmwareUpdated is true', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], routers: [] }));
    component.qnapDeviceControls.at(0).patchValue({
      diskCount: 4, totalSpaceGB: 16000, usedSpaceGB: 11200,
      disksWithError: [], raidStatus: 'ok',
      firmwareVersion: '5.1.0.2400',
      firmwareUpdated: true,
      firmwareNewVersion: '5.1.0.2566',
    });
    const payload = component.buildPayload() as ServerMaintenancePayload;
    expect(payload.qnap![0].firmwareUpdated).toBeTrue();
    expect(payload.qnap![0].firmwareNewVersion).toBe('5.1.0.2566');
  });

  it('should NOT include firmwareNewVersion in payload when firmwareUpdated is false', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], routers: [] }));
    component.qnapDeviceControls.at(0).patchValue({
      diskCount: 2, totalSpaceGB: 8000, usedSpaceGB: 3000,
      disksWithError: [], raidStatus: 'ok',
      firmwareVersion: '4.5.4.2117',
      firmwareUpdated: false,
      firmwareNewVersion: '5.0.0.0000',
    });
    const payload = component.buildPayload() as ServerMaintenancePayload;
    expect(payload.qnap![0].firmwareUpdated).toBeFalse();
    expect(payload.qnap![0].firmwareNewVersion).toBeUndefined();
  });

  it('should NOT include spaceUsed in payload', () => {
    init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], routers: [] }));
    const payload = component.buildPayload() as ServerMaintenancePayload;
    expect((payload.qnap![0] as any).spaceUsed).toBeUndefined();
  });
});

describe('patchFormFromPayload — QNAP nuevos campos', () => {
  it('parchea diskCount, totalSpaceGB, usedSpaceGB, disksWithError, firmwareVersion', () => {
    const saved: ServerMaintenancePayload = {
      type: 'SERVER_MAINTENANCE',
      windows: { servers: [], domainControllers: [] },
      qnap: [{
        deviceId: 10, deviceName: 'QNAP',
        diskCount: 4, totalSpaceGB: 16000, usedSpaceGB: 11200,
        disksWithError: ['Disk 2'], raidStatus: 'degraded',
        firmwareVersion: '5.1.0.2566', firmwareUpdated: false,
      }],
    };
    // initWithSavedPayload ya existe en el spec
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

    expect(component.qnapDeviceControls.at(0).get('diskCount')?.value).toBe(4);
    expect(component.qnapDeviceControls.at(0).get('totalSpaceGB')?.value).toBe(16000);
    expect(component.qnapDeviceControls.at(0).get('usedSpaceGB')?.value).toBe(11200);
    expect(component.qnapDeviceControls.at(0).get('disksWithError')?.value).toEqual(['Disk 2']);
    expect(component.qnapDeviceControls.at(0).get('firmwareVersion')?.value).toBe('5.1.0.2566');
    expect(component.qnapDeviceControls.at(0).get('raidStatus')?.value).toBe('degraded');
  });

  it('parchea firmwareNewVersion cuando firmwareUpdated es true', () => {
    const saved: ServerMaintenancePayload = {
      type: 'SERVER_MAINTENANCE',
      windows: { servers: [], domainControllers: [] },
      qnap: [{
        deviceId: 10, deviceName: 'QNAP',
        diskCount: 4, totalSpaceGB: 16000, usedSpaceGB: 11200,
        disksWithError: [], raidStatus: 'ok',
        firmwareVersion: '5.1.0.2400',
        firmwareUpdated: true,
        firmwareNewVersion: '5.1.0.2566',
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

    expect(component.qnapDeviceControls.at(0).get('firmwareUpdated')?.value).toBeTrue();
    expect(component.qnapDeviceControls.at(0).get('firmwareNewVersion')?.value).toBe('5.1.0.2566');
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

```
cd frontend && npx ng test --include=src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.spec.ts --watch=false
```

Esperado: fallan los tests nuevos (controles no existen, métodos `diskSlotOptions`/`qnapFirmwareUpdated` no definidos, payload contiene campos viejos).

- [ ] **Step 3: Actualizar `buildForm()` en el componente**

En `maintenance-form.component.ts`, reemplazar el bloque `qnapDevices` dentro de `buildForm()`:

```typescript
// ANTES
qnapDevices: this.fb.array(
  this.infrastructure.nas.map(() => this.fb.group({
    spaceUsed:       [null as number | null],
    raidStatus:      ['ok'],
    firmwareUpdated: [false],
  }))
),
```

```typescript
// DESPUÉS
qnapDevices: this.fb.array(
  this.infrastructure.nas.map(() => this.fb.group({
    diskCount:          [null as number | null],
    totalSpaceGB:       [null as number | null],
    usedSpaceGB:        [null as number | null],
    disksWithError:     [[] as string[]],
    raidStatus:         ['ok'],
    firmwareVersion:    [''],
    firmwareUpdated:    [false],
    firmwareNewVersion: [''],
  }))
),
```

- [ ] **Step 4: Agregar métodos helper al componente**

Agregar al final de la sección `// ── Helpers ──` (antes de `// ── Payload construction ──`):

```typescript
getQnapGroup(index: number): FormGroup {
  return this.qnapDeviceControls.at(index) as FormGroup;
}

diskSlotOptions(index: number): string[] {
  const count = Number(this.qnapDeviceControls.at(index).get('diskCount')?.value);
  if (!count || isNaN(count) || count <= 0) return [];
  return Array.from({ length: count }, (_, k) => `Disk ${k + 1}`);
}

qnapFirmwareUpdated(index: number): boolean {
  return this.qnapDeviceControls.at(index).get('firmwareUpdated')?.value === true;
}
```

- [ ] **Step 5: Actualizar `buildPayload()` para la sección QNAP**

En `buildPayload()`, reemplazar el bloque `if (this.hasQNAP)`:

```typescript
// ANTES
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
```

```typescript
// DESPUÉS
if (this.hasQNAP) {
  payload.qnap = this.infrastructure.nas.map((nas, i) => {
    const ctrl = this.qnapDeviceControls.at(i).value;
    const entry: QNAPSection = {
      deviceId:       nas.assetId,
      deviceName:     nas.name,
      diskCount:      Number(ctrl.diskCount),
      totalSpaceGB:   Number(ctrl.totalSpaceGB),
      usedSpaceGB:    Number(ctrl.usedSpaceGB),
      disksWithError: ctrl.disksWithError ?? [],
      raidStatus:     ctrl.raidStatus,
      firmwareVersion: ctrl.firmwareVersion ?? '',
      firmwareUpdated: ctrl.firmwareUpdated,
    };
    if (ctrl.firmwareUpdated && ctrl.firmwareNewVersion) {
      entry.firmwareNewVersion = ctrl.firmwareNewVersion;
    }
    return entry;
  });
}
```

Asegurarse de importar `QNAPSection` en los imports del archivo si no está ya importado.

- [ ] **Step 6: Actualizar `patchFormFromPayload()` para la sección QNAP**

En `patchFormFromPayload()`, reemplazar el bloque `if (srv.qnap?.length)`:

```typescript
// ANTES
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
```

```typescript
// DESPUÉS
if (srv.qnap?.length) {
  this.infrastructure.nas.forEach((nas, i) => {
    const saved = srv.qnap!.find(d => d.deviceId === nas.assetId);
    if (saved) {
      this.qnapDeviceControls.at(i).patchValue({
        diskCount:          saved.diskCount,
        totalSpaceGB:       saved.totalSpaceGB,
        usedSpaceGB:        saved.usedSpaceGB,
        disksWithError:     saved.disksWithError ?? [],
        raidStatus:         saved.raidStatus,
        firmwareVersion:    saved.firmwareVersion ?? '',
        firmwareUpdated:    saved.firmwareUpdated,
        firmwareNewVersion: saved.firmwareNewVersion ?? '',
      });
    }
  });
}
```

- [ ] **Step 7: Correr todos los tests del componente para verificar que pasan**

```
cd frontend && npx ng test --include=src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.spec.ts --watch=false
```

Esperado: todos los tests pasan, incluyendo los tests existentes que ya cubren otros comportamientos de QNAP (el test `'parchea sección QNAP usando deviceId'` existente fallará porque referencia `spaceUsed` — actualizarlo también).

**Actualizar el test existente** `'parchea sección QNAP usando deviceId'` (línea ~862 del spec):

```typescript
// ANTES
it('parchea sección QNAP usando deviceId', () => {
  const saved: ServerMaintenancePayload = {
    type: 'SERVER_MAINTENANCE',
    windows: { servers: [], domainControllers: [] },
    qnap: [{ deviceId: 10, deviceName: 'QNAP', spaceUsed: 78, raidStatus: 'ok', firmwareUpdated: true }],
  };
  initWithSavedPayload(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], routers: [] }), saved);

  expect(component.qnapDeviceControls.at(0).get('spaceUsed')?.value).toBe(78);
  expect(component.qnapDeviceControls.at(0).get('firmwareUpdated')?.value).toBeTrue();
});
```

```typescript
// DESPUÉS
it('parchea sección QNAP usando deviceId', () => {
  const saved: ServerMaintenancePayload = {
    type: 'SERVER_MAINTENANCE',
    windows: { servers: [], domainControllers: [] },
    qnap: [{
      deviceId: 10, deviceName: 'QNAP',
      diskCount: 4, totalSpaceGB: 16000, usedSpaceGB: 11200,
      disksWithError: [], raidStatus: 'ok',
      firmwareVersion: '5.1.0.2566', firmwareUpdated: true,
    }],
  };
  initWithSavedPayload(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], routers: [] }), saved);

  expect(component.qnapDeviceControls.at(0).get('diskCount')?.value).toBe(4);
  expect(component.qnapDeviceControls.at(0).get('firmwareUpdated')?.value).toBeTrue();
});
```

También actualizar el test `'should include qnap section as array when hasQNAP is true'` (línea ~207):

```typescript
// ANTES
it('should include qnap section as array when hasQNAP is true', () => {
  init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], routers: [] }));
  component.qnapDeviceControls.at(0).patchValue({ spaceUsed: 65, raidStatus: 'ok', firmwareUpdated: false });
  const payload = component.buildPayload() as ServerMaintenancePayload;
  expect(payload.qnap).toBeDefined();
  expect(Array.isArray(payload.qnap)).toBeTrue();
  expect(payload.qnap![0].spaceUsed).toBe(65);
  expect(payload.qnap![0].deviceName).toBe('QNAP');
});
```

```typescript
// DESPUÉS
it('should include qnap section as array when hasQNAP is true', () => {
  init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], routers: [] }));
  component.qnapDeviceControls.at(0).patchValue({
    diskCount: 4, totalSpaceGB: 16000, usedSpaceGB: 10500,
    disksWithError: [], raidStatus: 'ok',
    firmwareVersion: '5.1.0.2566', firmwareUpdated: false,
  });
  const payload = component.buildPayload() as ServerMaintenancePayload;
  expect(payload.qnap).toBeDefined();
  expect(Array.isArray(payload.qnap)).toBeTrue();
  expect(payload.qnap![0].diskCount).toBe(4);
  expect(payload.qnap![0].deviceName).toBe('QNAP');
});
```

- [ ] **Step 8: Correr los tests completos del componente**

```
cd frontend && npx ng test --include=src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.spec.ts --watch=false
```

Esperado: todos pasan.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.ts frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.spec.ts
git commit -m "feat(qnap): actualizar buildForm, buildPayload y patchFormFromPayload con nuevos campos QNAP"
```

---

### Task 3: Actualizar el template HTML de la sección QNAP

**Files:**
- Modify: `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.html` (líneas 210–252)

**Interfaces:**
- Consumes: `diskSlotOptions(i)`, `qnapFirmwareUpdated(i)`, `getQnapGroup(i)` del Task 2
- No produce interfaces — es presentación pura

**Sin tests unitarios para el template** — el comportamiento ya está cubierto por el spec del componente. La verificación es visual.

---

- [ ] **Step 1: Reemplazar la sección QNAP en el HTML**

Reemplazar el bloque entre los comentarios `<!-- ── QNAP / NAS ───────────────────────────────────── -->` (líneas 210–252):

```html
<!-- ── QNAP / NAS ───────────────────────────────────── -->
<ng-container *ngIf="hasQNAP">

  <div class="mf-section-lbl">QNAP / NAS</div>

  <div class="mf-vmware-grid" formArrayName="qnapDevices">
    <div *ngFor="let _ of qnapDeviceControls.controls; let i = index"
         [formGroupName]="i"
         class="mf-cl-rpt mf-vmware-card">

      <div class="mf-cl-rpt-hdr">
        <div class="mf-cl-rpt-dot"></div>
        <div class="mf-vmware-name-block">
          <span class="mf-cl-rpt-label">{{ infrastructure.nas[i].name }}</span>
          <span class="mono mf-host-ip">{{ infrastructure.nas[i].ip ?? '—' }}</span>
        </div>
      </div>

      <!-- Discos -->
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="mf-metric-ff">
        <mat-label>Cantidad de discos</mat-label>
        <input matInput formControlName="diskCount" type="number" min="1" placeholder="0" />
      </mat-form-field>

      <!-- Espacio total -->
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="mf-metric-ff">
        <mat-label>Espacio total</mat-label>
        <input matInput formControlName="totalSpaceGB" type="number" min="0" placeholder="0" />
        <span matTextSuffix>GB</span>
      </mat-form-field>

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

      <!-- Discos con error (multi-select dinámico según diskCount) -->
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="mf-form-field"
                      [ngClass]="getQnapGroup(i).get('disksWithError')?.value?.length ? 'mf-sel--crit' : ''">
        <mat-label>Discos con error</mat-label>
        <mat-select formControlName="disksWithError" multiple>
          <mat-option *ngFor="let slot of diskSlotOptions(i)" [value]="slot">{{ slot }}</mat-option>
        </mat-select>
      </mat-form-field>

      <!-- Estado RAID -->
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="mf-form-field"
                      [ngClass]="selectClass(getQnapGroup(i).get('raidStatus')?.value)">
        <mat-label>Estado RAID</mat-label>
        <mat-select formControlName="raidStatus">
          <mat-option value="ok">OK — saludable</mat-option>
          <mat-option value="degraded">Degradado</mat-option>
          <mat-option value="failed">Error</mat-option>
        </mat-select>
      </mat-form-field>

      <!-- Versión de firmware actual -->
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="mf-form-field">
        <mat-label>Versión firmware instalada</mat-label>
        <input matInput formControlName="firmwareVersion" placeholder="Ej: 5.1.0.2566" />
      </mat-form-field>

      <!-- Checkbox: ¿se actualizó el firmware? -->
      <mat-checkbox formControlName="firmwareUpdated" class="mf-cl-mat">
        Se actualizó el firmware
      </mat-checkbox>

      <!-- Input condicional: versión nueva (solo si se actualizó) -->
      <mat-form-field *ngIf="qnapFirmwareUpdated(i)"
                      appearance="outline" subscriptSizing="dynamic" class="mf-form-field">
        <mat-label>Nueva versión aplicada</mat-label>
        <input matInput formControlName="firmwareNewVersion" placeholder="Ej: 5.2.0.2800" />
      </mat-form-field>

    </div>
  </div>

</ng-container>
```

- [ ] **Step 2: Verificar compilación TypeScript**

```
cd frontend && npx ng build --configuration=development 2>&1 | head -50
```

Esperado: sin errores de compilación.

- [ ] **Step 3: Correr el suite completo de tests**

```
cd frontend && npx ng test --watch=false 2>&1 | tail -20
```

Esperado: todos los tests pasan.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.html
git commit -m "feat(qnap): actualizar template con nuevos campos de formulario QNAP/NAS"
```
