# Veeam Backup Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la `VeeamSection` actual (status + missingVMs) por una sección con lista dinámica de jobs de backup (nombre, fulls disponibles, restore points) y checklist de cobertura de VMs contra InfraDoc — incluyendo VMs Linux que hoy no se exponen.

**Architecture:** Backend agrega `linuxVMs` al DTO de InfraDoc. Frontend crea `VeeamFormComponent` presentacional que recibe un `FormGroup` y la lista de VMs; `MaintenanceFormComponent` lo integra como hijo creando el subgrupo y leyendo el payload.

**Tech Stack:** NestJS · Jest (backend) · Angular 17 · Angular Material · ReactiveFormsModule · Jasmine/Karma · Storybook 8

## Global Constraints

- No standalone components — NgModule declarations únicamente
- `appearance="outline"` es el único estilo permitido en `mat-form-field`
- No `::ng-deep` — coloring semántico via CSS custom properties con `[ngClass]`
- No `any` en TypeScript
- TDD: spec antes de implementación
- Commits frecuentes — uno por task
- Branch: `feat/veeam-backup-section`

---

## Mapa de archivos

| Acción | Archivo |
|---|---|
| Modificar | `backend/src/integrations/infradoc/dto/client-infrastructure.dto.ts` |
| Modificar | `backend/src/integrations/infradoc/infrastructure.service.ts` |
| Modificar | `backend/src/integrations/infradoc/infrastructure.service.spec.ts` |
| Modificar | `frontend/src/app/core/models/infradoc.models.ts` |
| Modificar | `frontend/src/app/core/models/maintenance-log.models.ts` |
| Crear | `frontend/src/app/features/technician/task-drawer/veeam-form/veeam-form.component.ts` |
| Crear | `frontend/src/app/features/technician/task-drawer/veeam-form/veeam-form.component.html` |
| Crear | `frontend/src/app/features/technician/task-drawer/veeam-form/veeam-form.component.scss` |
| Crear | `frontend/src/app/features/technician/task-drawer/veeam-form/veeam-form.component.spec.ts` |
| Crear | `frontend/src/app/features/technician/task-drawer/veeam-form/veeam-form.component.stories.ts` |
| Modificar | `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.ts` |
| Modificar | `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.html` |
| Modificar | `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.spec.ts` |
| Modificar | `frontend/src/app/features/technician/technician.module.ts` |

---

## Task 1: Backend — `linuxVMs` en InfraDoc (TDD)

**Files:**
- Modify: `backend/src/integrations/infradoc/dto/client-infrastructure.dto.ts`
- Modify: `backend/src/integrations/infradoc/infrastructure.service.spec.ts`
- Modify: `backend/src/integrations/infradoc/infrastructure.service.ts`

**Interfaces:**
- Produce: `ClientInfrastructureDto.linuxVMs: InfraAssetDto[]`

- [ ] **Step 1: Agregar `linuxVMs` al DTO del backend**

En `backend/src/integrations/infradoc/dto/client-infrastructure.dto.ts`, reemplazar el contenido completo:

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
  domainControllers: InfraAssetDto[];
  linuxVMs: InfraAssetDto[];
  nas: InfraAssetDto[];
  routers: InfraAssetDto[];
}
```

- [ ] **Step 2: Agregar tests de detección de VMs Linux en el spec**

Al final del archivo `backend/src/integrations/infradoc/infrastructure.service.spec.ts`, dentro del `describe('InfrastructureService', ...)` pero después de todos los describes existentes, agregar:

```typescript
describe('linux VM detection', () => {
  it('agrupa Virtual Machine con OS Ubuntu en linuxVMs', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([
      makeAsset({ asset_id: '10', asset_name: 'SRV-UBUNTU', asset_type: 'Virtual Machine', asset_os: 'Ubuntu 22.04', asset_make: null, asset_description: null }),
    ]);
    const result = await service.getClientInfrastructure('uuid-1');
    expect(result.linuxVMs).toHaveLength(1);
    expect(result.linuxVMs[0].name).toBe('SRV-UBUNTU');
    expect(result.windowsVMs).toHaveLength(0);
    expect(result.domainControllers).toHaveLength(0);
  });

  it('no incluye VMs Windows Server en linuxVMs', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([
      makeAsset({ asset_id: '3', asset_name: 'SRV-FILE', asset_type: 'Virtual Machine', asset_os: 'Windows Server 2019', asset_make: null, asset_description: null }),
    ]);
    const result = await service.getClientInfrastructure('uuid-1');
    expect(result.linuxVMs).toHaveLength(0);
    expect(result.windowsVMs).toHaveLength(1);
  });

  it('no incluye VMs con asset_os null en linuxVMs', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([
      makeAsset({ asset_id: '11', asset_name: 'VM-UNKNOWN', asset_type: 'Virtual Machine', asset_os: null, asset_make: null, asset_description: null }),
    ]);
    const result = await service.getClientInfrastructure('uuid-1');
    expect(result.linuxVMs).toHaveLength(0);
  });

  it('linuxVMs es array vacío cuando no hay VMs no-Windows', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([]);
    const result = await service.getClientInfrastructure('uuid-1');
    expect(result.linuxVMs).toEqual([]);
  });

  it('separa correctamente Windows, Linux y DCs cuando los tres están presentes', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([
      makeAsset({ asset_id: '3', asset_name: 'SRV-FILE', asset_type: 'Virtual Machine', asset_os: 'Windows Server 2019', asset_make: null, asset_description: null }),
      makeAsset({ asset_id: '4', asset_name: 'DC01',     asset_type: 'Virtual Machine', asset_os: 'Windows Server 2022', asset_make: null, asset_description: 'Domain Controller' }),
      makeAsset({ asset_id: '10', asset_name: 'SRV-LINUX', asset_type: 'Virtual Machine', asset_os: 'Ubuntu 22.04', asset_make: null, asset_description: null }),
    ]);
    const result = await service.getClientInfrastructure('uuid-1');
    expect(result.windowsVMs).toHaveLength(1);
    expect(result.windowsVMs[0].name).toBe('SRV-FILE');
    expect(result.domainControllers).toHaveLength(1);
    expect(result.domainControllers[0].name).toBe('DC01');
    expect(result.linuxVMs).toHaveLength(1);
    expect(result.linuxVMs[0].name).toBe('SRV-LINUX');
  });
});
```

- [ ] **Step 3: Correr tests — deben FALLAR**

```bash
cd backend && npx jest --testPathPattern="infrastructure.service" --no-coverage
```

Esperado: fallos en los nuevos tests de `linux VM detection`. Tests existentes deben seguir pasando.

- [ ] **Step 4: Implementar detección de Linux VMs en `InfrastructureService`**

En `backend/src/integrations/infradoc/infrastructure.service.ts`:

**Línea ~78 — inicializar `linuxVMs` en el resultado:**

```typescript
const result: ClientInfrastructureDto = {
  esxiHosts:         [],
  windowsVMs:        [],
  domainControllers: [],
  linuxVMs:          [],
  nas:               [],
  routers:           [],
};
```

**Después del bloque `else if (type === 'virtual machine' && os.startsWith('windows server'))` (~línea 99), agregar un else if adicional:**

```typescript
} else if (type === 'virtual machine' && os !== '' && !os.startsWith('windows server')) {
  result.linuxVMs.push(this.mapAsset(asset));
}
```

El bloque completo queda:

```typescript
if (type === 'server') {
  result.esxiHosts.push(this.mapAsset(asset, bmcMap.get(asset.asset_id)));
} else if (type === 'virtual machine' && os.startsWith('windows server')) {
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
```

- [ ] **Step 5: Correr tests — deben PASAR**

```bash
cd backend && npx jest --testPathPattern="infrastructure.service" --no-coverage
```

Esperado: todos los tests del archivo pasan.

- [ ] **Step 6: Commit**

```bash
git add backend/src/integrations/infradoc/dto/client-infrastructure.dto.ts
git add backend/src/integrations/infradoc/infrastructure.service.ts
git add backend/src/integrations/infradoc/infrastructure.service.spec.ts
git commit -m "feat(infradoc): exponer VMs Linux en linuxVMs del DTO de infraestructura"
```

---

## Task 2: Frontend — modelos de datos

**Files:**
- Modify: `frontend/src/app/core/models/infradoc.models.ts`
- Modify: `frontend/src/app/core/models/maintenance-log.models.ts`

**Interfaces:**
- Produce: `ClientInfrastructure.linuxVMs: InfraAsset[]`
- Produce: `VeeamJobEntry { jobName: string; fullsAvailable: number; restorePoints: number }`
- Produce: `VeeamSection { jobs: VeeamJobEntry[]; uncoveredVMs: number[] }`

- [ ] **Step 1: Agregar `linuxVMs` al modelo frontend de InfraDoc**

Reemplazar el contenido completo de `frontend/src/app/core/models/infradoc.models.ts`:

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
  linuxVMs: InfraAsset[];
  nas: InfraAsset[];
  routers: InfraAsset[];
}
```

- [ ] **Step 2: Reemplazar `VeeamSection` en el modelo de payload**

En `frontend/src/app/core/models/maintenance-log.models.ts`, reemplazar las líneas de `VeeamSection` (actualmente `status: 'ok' | 'partial' | 'missing'; missingVMs?: string[]`) por:

```typescript
export interface VeeamJobEntry {
  jobName: string;
  fullsAvailable: number;
  restorePoints: number;
}

export interface VeeamSection {
  jobs: VeeamJobEntry[];
  uncoveredVMs: number[];
}
```

- [ ] **Step 3: Compilar para detectar errores de tipos**

```bash
cd frontend && npx tsc --noEmit
```

Esperado: errores de TypeScript en `maintenance-form.component.ts` y su spec (referencias a `veeamStatus`, `veeamMissing`, `status`, `missingVMs` de `VeeamSection`). Se resolverán en Task 4. **No corregir ahora.**

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/core/models/infradoc.models.ts
git add frontend/src/app/core/models/maintenance-log.models.ts
git commit -m "feat(models): agregar linuxVMs a ClientInfrastructure y rediseñar VeeamSection con jobs dinámicos"
```

---

## Task 3: `VeeamFormComponent` (TDD)

**Files:**
- Create: `frontend/src/app/features/technician/task-drawer/veeam-form/veeam-form.component.spec.ts`
- Create: `frontend/src/app/features/technician/task-drawer/veeam-form/veeam-form.component.ts`
- Create: `frontend/src/app/features/technician/task-drawer/veeam-form/veeam-form.component.html`
- Create: `frontend/src/app/features/technician/task-drawer/veeam-form/veeam-form.component.scss`
- Modify: `frontend/src/app/features/technician/technician.module.ts`

**Interfaces:**
- Consume: `InfraAsset` de `infradoc.models.ts`
- Produce: `VeeamFormComponent` con selector `app-veeam-form`, inputs `formGroup: FormGroup`, `allVMs: InfraAsset[]`, `readOnly: boolean`
- Produce: métodos públicos `addJob()`, `removeJob(i)`, `isUncovered(assetId): boolean`, `toggleVM(assetId)`
- Produce: getter `jobControls: FormArray`

- [ ] **Step 1: Crear el spec**

Crear `frontend/src/app/features/technician/task-drawer/veeam-form/veeam-form.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { VeeamFormComponent } from './veeam-form.component';
import { InfraAsset } from '../../../../../core/models/infradoc.models';

const makeVM = (overrides: Partial<InfraAsset> = {}): InfraAsset => ({
  assetId: 1, name: 'SRV-FILE', ip: '192.168.1.10',
  bmcIp: null, bmcType: null, os: 'Windows Server 2019', model: null,
  ...overrides,
});

describe('VeeamFormComponent', () => {
  let component: VeeamFormComponent;
  let fixture: ComponentFixture<VeeamFormComponent>;
  let fb: FormBuilder;

  function makeFormGroup(): FormGroup {
    return fb.group({
      jobs: fb.array([]),
      uncoveredVMs: [[] as number[]],
    });
  }

  function init(vms: InfraAsset[] = [], readOnly = false): void {
    fixture = TestBed.createComponent(VeeamFormComponent);
    component = fixture.componentInstance;
    component.formGroup = makeFormGroup();
    component.allVMs = vms;
    component.readOnly = readOnly;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VeeamFormComponent],
      imports: [
        ReactiveFormsModule,
        NoopAnimationsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatCheckboxModule,
      ],
    }).compileComponents();
    fb = TestBed.inject(FormBuilder);
  });

  // ── addJob ────────────────────────────────────────────────────────────────────

  it('addJob agrega un FormGroup vacío al FormArray de jobs', () => {
    init();
    expect(component.jobControls.length).toBe(0);
    component.addJob();
    expect(component.jobControls.length).toBe(1);
    expect(component.jobControls.at(0).get('jobName')?.value).toBe('');
    expect(component.jobControls.at(0).get('fullsAvailable')?.value).toBeNull();
    expect(component.jobControls.at(0).get('restorePoints')?.value).toBeNull();
  });

  it('addJob puede agregar múltiples jobs independientes', () => {
    init();
    component.addJob();
    component.addJob();
    expect(component.jobControls.length).toBe(2);
  });

  // ── removeJob ─────────────────────────────────────────────────────────────────

  it('removeJob elimina el job en el índice dado y preserva el resto', () => {
    init();
    component.addJob();
    component.addJob();
    component.jobControls.at(0).patchValue({ jobName: 'Job A' });
    component.jobControls.at(1).patchValue({ jobName: 'Job B' });
    component.removeJob(0);
    expect(component.jobControls.length).toBe(1);
    expect(component.jobControls.at(0).get('jobName')?.value).toBe('Job B');
  });

  // ── isUncovered ───────────────────────────────────────────────────────────────

  it('isUncovered retorna false cuando uncoveredVMs está vacío', () => {
    init([makeVM({ assetId: 3 })]);
    expect(component.isUncovered(3)).toBeFalse();
  });

  it('isUncovered retorna true cuando el assetId está en uncoveredVMs', () => {
    init([makeVM({ assetId: 3 })]);
    component.formGroup.get('uncoveredVMs')!.setValue([3]);
    expect(component.isUncovered(3)).toBeTrue();
  });

  it('isUncovered retorna false cuando el assetId NO está en uncoveredVMs', () => {
    init([makeVM({ assetId: 3 }), makeVM({ assetId: 5 })]);
    component.formGroup.get('uncoveredVMs')!.setValue([5]);
    expect(component.isUncovered(3)).toBeFalse();
  });

  // ── toggleVM ──────────────────────────────────────────────────────────────────

  it('toggleVM agrega el assetId cuando no estaba en la lista', () => {
    init([makeVM({ assetId: 3 })]);
    component.toggleVM(3);
    expect(component.formGroup.get('uncoveredVMs')!.value).toContain(3);
  });

  it('toggleVM quita el assetId cuando ya estaba en la lista', () => {
    init([makeVM({ assetId: 3 })]);
    component.formGroup.get('uncoveredVMs')!.setValue([3]);
    component.toggleVM(3);
    expect(component.formGroup.get('uncoveredVMs')!.value).not.toContain(3);
  });

  it('toggleVM preserva los demás assetIds al quitar uno', () => {
    init([makeVM({ assetId: 3 }), makeVM({ assetId: 5 })]);
    component.formGroup.get('uncoveredVMs')!.setValue([3, 5]);
    component.toggleVM(3);
    expect(component.formGroup.get('uncoveredVMs')!.value).toEqual([5]);
  });

  // ── readOnly ──────────────────────────────────────────────────────────────────

  it('deshabilita el formGroup cuando readOnly es true', () => {
    init([], true);
    expect(component.formGroup.disabled).toBeTrue();
  });

  it('mantiene el formGroup habilitado cuando readOnly es false', () => {
    init([], false);
    expect(component.formGroup.disabled).toBeFalse();
  });
});
```

- [ ] **Step 2: Correr spec — debe FALLAR (componente no existe)**

```bash
cd frontend && npx ng test --include="**/veeam-form.component.spec.ts" --watch=false
```

Esperado: error de compilación porque `VeeamFormComponent` no existe.

- [ ] **Step 3: Crear `veeam-form.component.ts`**

Crear `frontend/src/app/features/technician/task-drawer/veeam-form/veeam-form.component.ts`:

```typescript
import { Component, Input, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup } from '@angular/forms';
import { InfraAsset } from '../../../../core/models/infradoc.models';

@Component({
  selector: 'app-veeam-form',
  templateUrl: './veeam-form.component.html',
  styleUrl: './veeam-form.component.scss',
})
export class VeeamFormComponent implements OnInit {
  @Input() formGroup!: FormGroup;
  @Input() allVMs: InfraAsset[] = [];
  @Input() readOnly = false;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    if (this.readOnly) {
      this.formGroup.disable({ emitEvent: false });
    }
  }

  get jobControls(): FormArray {
    return this.formGroup.get('jobs') as FormArray;
  }

  addJob(): void {
    this.jobControls.push(this.fb.group({
      jobName:        [''],
      fullsAvailable: [null as number | null],
      restorePoints:  [null as number | null],
    }));
  }

  removeJob(i: number): void {
    this.jobControls.removeAt(i);
  }

  isUncovered(assetId: number): boolean {
    const current: number[] = this.formGroup.get('uncoveredVMs')?.value ?? [];
    return current.includes(assetId);
  }

  toggleVM(assetId: number): void {
    const ctrl = this.formGroup.get('uncoveredVMs')!;
    const current: number[] = [...(ctrl.value as number[] ?? [])];
    const idx = current.indexOf(assetId);
    if (idx === -1) {
      current.push(assetId);
    } else {
      current.splice(idx, 1);
    }
    ctrl.setValue(current);
  }
}
```

- [ ] **Step 4: Crear `veeam-form.component.html`**

Crear `frontend/src/app/features/technician/task-drawer/veeam-form/veeam-form.component.html`:

```html
<div [formGroup]="formGroup">

  <!-- ── Jobs de backup ───────────────────────────────── -->
  <div class="vf-section-lbl">Jobs de backup</div>

  <ng-container formArrayName="jobs">

    <div class="vf-jobs-head" *ngIf="jobControls.length > 0">
      <span class="vf-col-hdr">Job</span>
      <span class="vf-col-hdr vf-col-num">Fulls</span>
      <span class="vf-col-hdr vf-col-num">Restore points</span>
      <span></span>
    </div>

    <div class="vf-job-row"
         *ngFor="let _ of jobControls.controls; let i = index"
         [formGroupName]="i">

      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="vf-ff-name">
        <mat-label>Nombre del job</mat-label>
        <input matInput formControlName="jobName" />
      </mat-form-field>

      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="vf-ff-num">
        <mat-label>Fulls</mat-label>
        <input matInput type="number" min="0" formControlName="fullsAvailable" />
      </mat-form-field>

      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="vf-ff-num">
        <mat-label>RPs</mat-label>
        <input matInput type="number" min="0" formControlName="restorePoints" />
      </mat-form-field>

      <button *ngIf="!readOnly" mat-icon-button type="button" class="vf-rm-btn" (click)="removeJob(i)">
        <svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

    </div>

  </ng-container>

  <div class="vf-empty-jobs" *ngIf="jobControls.length === 0">
    <span class="vf-empty-msg">Sin jobs registrados</span>
  </div>

  <button *ngIf="!readOnly" mat-stroked-button type="button" class="vf-add-btn" (click)="addJob()">
    + Agregar job
  </button>

  <!-- ── Cobertura de VMs ──────────────────────────────── -->
  <ng-container *ngIf="allVMs.length > 0">

    <div class="vf-section-lbl vf-section-lbl--cov">Cobertura de VMs</div>
    <div class="vf-cov-hint">Marcá las VMs que NO están cubiertas por ningún job</div>

    <div class="vf-vm-list">
      <div class="vf-vm-row" *ngFor="let vm of allVMs">
        <mat-checkbox
          [checked]="isUncovered(vm.assetId)"
          (change)="toggleVM(vm.assetId)"
          [disabled]="readOnly"
          class="vf-vm-check">
        </mat-checkbox>
        <span class="vf-vm-name">{{ vm.name }}</span>
        <span class="vf-vm-os mono">{{ vm.os ?? '—' }}</span>
        <span class="vf-uncov-badge" *ngIf="isUncovered(vm.assetId)">sin cobertura</span>
      </div>
    </div>

  </ng-container>

</div>
```

- [ ] **Step 5: Crear `veeam-form.component.scss`**

Crear `frontend/src/app/features/technician/task-drawer/veeam-form/veeam-form.component.scss`:

```scss
.vf-section-lbl {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--tx-lo);
  margin-bottom: 6px;

  &--cov {
    margin-top: 16px;
  }
}

.vf-jobs-head {
  display: grid;
  grid-template-columns: 1fr 80px 80px 32px;
  gap: 6px;
  padding: 0 4px 4px;
}

.vf-col-hdr {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--tx-lo);
}

.vf-col-num {
  text-align: center;
}

.vf-job-row {
  display: grid;
  grid-template-columns: 1fr 80px 80px 32px;
  gap: 6px;
  align-items: center;
  margin-bottom: 4px;
}

.vf-ff-name,
.vf-ff-num {
  width: 100%;
}

.vf-rm-btn {
  width: 28px;
  height: 28px;
  color: var(--tx-lo);

  &:hover {
    color: var(--crit);
  }
}

.vf-empty-jobs {
  padding: 8px 4px;
}

.vf-empty-msg {
  font-size: 11px;
  color: var(--tx-lo);
}

.vf-add-btn {
  margin-top: 4px;
  font-size: 11px;
}

.vf-cov-hint {
  font-size: 11px;
  color: var(--tx-lo);
  margin-bottom: 8px;
}

.vf-vm-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.vf-vm-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.vf-vm-check {
  flex-shrink: 0;
}

.vf-vm-name {
  font-size: 12px;
  flex: 1;
}

.vf-vm-os {
  font-size: 10px;
  color: var(--tx-lo);
}

.vf-uncov-badge {
  font-size: 10px;
  font-family: var(--font-mono);
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--crit-bg);
  color: var(--crit);
}
```

- [ ] **Step 6: Correr spec — debe PASAR**

```bash
cd frontend && npx ng test --include="**/veeam-form.component.spec.ts" --watch=false
```

Esperado: todos los tests pasan.

- [ ] **Step 7: Registrar en `TechnicianModule`**

En `frontend/src/app/features/technician/technician.module.ts`:

Agregar el import:
```typescript
import { VeeamFormComponent } from './task-drawer/veeam-form/veeam-form.component';
```

Agregar `VeeamFormComponent` al array `declarations`:
```typescript
declarations: [
  TaskListComponent,
  TaskDrawerComponent,
  MaintenanceFormComponent,
  ConfirmMaintenanceDialogComponent,
  TimeSpentDialogComponent,
  DcHealthCardComponent,
  QnapFormComponent,
  QnapDeviceCardComponent,
  VeeamFormComponent,
],
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/features/technician/task-drawer/veeam-form/
git add frontend/src/app/features/technician/technician.module.ts
git commit -m "feat(veeam-form): crear VeeamFormComponent con lista dinámica de jobs y checklist de VMs"
```

---

## Task 4: `MaintenanceFormComponent` — integración (TDD)

**Files:**
- Modify: `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.spec.ts`
- Modify: `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.ts`
- Modify: `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.html`

**Interfaces:**
- Consume: `VeeamFormComponent` (selector `app-veeam-form`), ya declarado en `TechnicianModule`
- Consume: `VeeamJobEntry`, `VeeamSection` de `maintenance-log.models.ts`
- Produce: getter público `veeamGroup: FormGroup`
- Produce: getter público `allVMs: InfraAsset[]`

- [ ] **Step 1: Actualizar `makeInfra` y agregar helpers en el spec**

En `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.spec.ts`:

**Agregar `FormArray` a los imports de Angular forms** (línea 1):
```typescript
import { FormArray, ReactiveFormsModule } from '@angular/forms';
```

**Agregar `makeVM` helper** justo después de `makeDcSnapshot`:
```typescript
const makeVM = (overrides: Partial<InfraAsset> = {}): InfraAsset => ({
  assetId: 3, name: 'SRV-TEST', ip: null,
  bmcIp: null, bmcType: null, os: null, model: null,
  ...overrides,
});
```

**Actualizar `makeInfra` para incluir `linuxVMs`** (actualmente no tiene ese campo):
```typescript
const makeInfra = (overrides: Partial<ClientInfrastructure> = {}): ClientInfrastructure => ({
  esxiHosts: [{ assetId: 2, name: 'host1.kemini', ip: '192.168.0.104', bmcIp: '192.168.0.200', bmcType: 'iLO', os: 'VMware ESXi 7.0', model: 'HPE DL380' }],
  windowsVMs: [{ assetId: 3, name: '47DC', ip: '192.168.1.18', bmcIp: null, bmcType: null, os: 'Windows Server 2019', model: null }],
  domainControllers: [],
  linuxVMs: [],
  nas: [{ assetId: 10, name: 'QNAP', ip: '192.168.1.21', bmcIp: null, bmcType: null, os: null, model: 'QNAP TS-453D' }],
  routers: [{ assetId: 1, name: 'MikroTik', ip: '192.168.99.1', bmcIp: null, bmcType: null, os: 'RouterOS', model: 'CCR2004' }],
  ...overrides,
});
```

- [ ] **Step 2: Reemplazar los tests de Veeam obsoletos en el spec**

Localizar el bloque `it('should include veeam section only when hasVeeam is true', ...` (dentro de `describe('buildPayload — SERVER_MAINTENANCE', ...)`) y reemplazar los tres tests de Veeam (líneas ~197-217) por:

```typescript
it('should include veeam section with empty jobs and uncoveredVMs when hasVeeam is true', () => {
  init(makeTask('SERVER_MAINTENANCE'), makeInfra({ nas: [], routers: [] }));
  const payload = component.buildPayload() as ServerMaintenancePayload;
  expect(payload.veeam).toBeDefined();
  expect(Array.isArray(payload.veeam!.jobs)).toBeTrue();
  expect(Array.isArray(payload.veeam!.uncoveredVMs)).toBeTrue();
});

it('should include veeam.jobs with correct data when jobs are added to veeamGroup', () => {
  init(makeTask('SERVER_MAINTENANCE'), makeInfra({ nas: [], routers: [] }));
  const jobsArray = component.veeamGroup.get('jobs') as FormArray;
  const jobGroup = (component as any).fb.group({
    jobName: ['Daily Backup'],
    fullsAvailable: [2],
    restorePoints: [14],
  });
  jobsArray.push(jobGroup);
  const payload = component.buildPayload() as ServerMaintenancePayload;
  expect(payload.veeam!.jobs).toHaveLength(1);
  expect(payload.veeam!.jobs[0].jobName).toBe('Daily Backup');
  expect(payload.veeam!.jobs[0].fullsAvailable).toBe(2);
  expect(payload.veeam!.jobs[0].restorePoints).toBe(14);
});

it('should include veeam.uncoveredVMs in payload', () => {
  init(makeTask('SERVER_MAINTENANCE'), makeInfra({ nas: [], routers: [] }));
  component.veeamGroup.get('uncoveredVMs')!.setValue([3, 5]);
  const payload = component.buildPayload() as ServerMaintenancePayload;
  expect(payload.veeam!.uncoveredVMs).toEqual([3, 5]);
});

it('should NOT include veeam section when hasVeeam is false', () => {
  init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }));
  const payload = component.buildPayload() as ServerMaintenancePayload;
  expect(payload.veeam).toBeUndefined();
});
```

- [ ] **Step 3: Reemplazar el test de `parchea veeamStatus` en `patchFormFromPayload`**

Localizar el test `'parchea veeamStatus y veeamMissing'` (dentro de `describe('patchFormFromPayload via savedPayload input', ...)`) y reemplazarlo por:

```typescript
it('parchea veeam: jobs y uncoveredVMs desde payload guardado', () => {
  const saved: ServerMaintenancePayload = {
    type: 'SERVER_MAINTENANCE',
    windows: { servers: [], domainControllers: [] },
    veeam: {
      jobs: [{ jobName: 'Daily Backup', fullsAvailable: 3, restorePoints: 21 }],
      uncoveredVMs: [3],
    },
  };
  initWithSavedPayload(makeTask('SERVER_MAINTENANCE'), makeInfra({ nas: [], routers: [] }), saved);

  const jobsArray = component.veeamGroup.get('jobs') as FormArray;
  expect(jobsArray.length).toBe(1);
  expect(jobsArray.at(0).get('jobName')?.value).toBe('Daily Backup');
  expect(jobsArray.at(0).get('fullsAvailable')?.value).toBe(3);
  expect(jobsArray.at(0).get('restorePoints')?.value).toBe(21);
  expect(component.veeamGroup.get('uncoveredVMs')?.value).toEqual([3]);
});
```

- [ ] **Step 4: Agregar tests de `allVMs` getter**

Después del `describe('conditional getters', ...)` existente, agregar:

```typescript
describe('allVMs getter', () => {
  it('combina windowsVMs + domainControllers + linuxVMs', () => {
    const infra = makeInfra({
      esxiHosts: [], nas: [], routers: [],
      windowsVMs:        [makeVM({ assetId: 3 })],
      domainControllers: [makeVM({ assetId: 4 })],
      linuxVMs:          [makeVM({ assetId: 7 })],
    });
    init(makeTask('SERVER_MAINTENANCE'), infra);
    expect(component.allVMs).toHaveLength(3);
    expect(component.allVMs.map(v => v.assetId)).toEqual([3, 4, 7]);
  });

  it('retorna array vacío cuando no hay VMs en ninguna categoría', () => {
    const infra = makeInfra({
      esxiHosts: [], nas: [], routers: [],
      windowsVMs: [], domainControllers: [], linuxVMs: [],
    });
    init(makeTask('SERVER_MAINTENANCE'), infra);
    expect(component.allVMs).toHaveLength(0);
  });
});
```

- [ ] **Step 5: Correr spec — debe FALLAR**

```bash
cd frontend && npx ng test --include="**/maintenance-form.component.spec.ts" --watch=false
```

Esperado: fallos en los nuevos tests (veeamGroup, allVMs no existen) y en tests que usan `makeInfra` con la vieja interfaz. Los tests de BMC, router, DC deben seguir pasando.

- [ ] **Step 6: Actualizar `maintenance-form.component.ts`**

Reemplazar el contenido completo del archivo:

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
import { ClientInfrastructure, InfraAsset } from '../../../../core/models/infradoc.models';
import {
  BmcEntry,
  DcHealthSnapshot,
  MaintenancePayload,
  RouterEntry,
  ServerMaintenancePayload,
  TerminalPayload,
  VeeamJobEntry,
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

  get hasServers(): boolean { return (this.infrastructure?.windowsVMs?.length ?? 0) > 0; }
  get hasVMware(): boolean  { return (this.infrastructure?.esxiHosts?.length ?? 0) > 0; }
  get hasVeeam(): boolean   { return (this.infrastructure?.esxiHosts?.length ?? 0) > 0; }
  get hasRouter(): boolean  { return (this.infrastructure?.routers?.length ?? 0) > 0; }

  get hasDomainControllers(): boolean {
    return (this.infrastructure?.domainControllers?.length ?? 0) > 0;
  }

  get allVMs(): InfraAsset[] {
    return [
      ...(this.infrastructure?.windowsVMs ?? []),
      ...(this.infrastructure?.domainControllers ?? []),
      ...(this.infrastructure?.linuxVMs ?? []),
    ];
  }

  get serverControls(): FormArray {
    return this.form.get('servers') as FormArray;
  }

  get vmwareHostControls(): FormArray {
    return this.form.get('vmwareHosts') as FormArray;
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

  get veeamGroup(): FormGroup {
    return this.form.get('veeam') as FormGroup;
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
        (this.infrastructure.domainControllers ?? []).map(() =>
          this.fb.group({ rawJson: [''] })
        )
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
      bmcHosts: this.fb.array(
        this.infrastructure.esxiHosts.map(() => this.fb.group({
          firmwareVersion:  [''],
          biosVersion:      [''],
          alertStatus:      ['ok'],
          alertCategories:  [[] as string[]],
          alertLogs:        [''],
        }))
      ),
      veeam: this.fb.group({
        jobs:          this.fb.array([]),
        uncoveredVMs:  [[] as number[]],
      }),
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
    const v = this.form.getRawValue();

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

    const payload: ServerMaintenancePayload = {
      type: 'SERVER_MAINTENANCE',
      windows: {
        servers,
        domainControllers: (this.infrastructure.domainControllers ?? [])
          .map((_, i) => {
            const raw = this.dcControls.at(i).get('rawJson')?.value ?? '';
            try { return JSON.parse(raw) as DcHealthSnapshot; }
            catch { return null; }
          })
          .filter((s): s is DcHealthSnapshot => s !== null),
      },
      notes: v.notes || undefined,
    };

    if (this.hasVMware) {
      payload.vmware = this.infrastructure.esxiHosts.map((host, i) => {
        const ctrl = this.vmwareHostControls.at(i).getRawValue();
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
        const ctrl = this.bmcHostControls.at(i).getRawValue();
        const entry: BmcEntry = {
          hostId:      host.assetId,
          hostName:    host.name,
          alertStatus: ctrl.alertStatus,
        };
        if (ctrl.firmwareVersion) entry.firmwareVersion = ctrl.firmwareVersion;
        if (ctrl.biosVersion)     entry.biosVersion     = ctrl.biosVersion;
        if (ctrl.alertStatus === 'alerta' && ctrl.alertCategories?.length) entry.alertCategories = ctrl.alertCategories;
        if (ctrl.alertLogs)       entry.alertLogs       = ctrl.alertLogs;
        return entry;
      });
    }

    if (this.hasVeeam) {
      const veeamVal = this.veeamGroup.getRawValue();
      payload.veeam = {
        jobs: (veeamVal.jobs as VeeamJobEntry[]).map(j => ({
          jobName:        j.jobName,
          fullsAvailable: Number(j.fullsAvailable),
          restorePoints:  Number(j.restorePoints),
        })),
        uncoveredVMs: (veeamVal.uncoveredVMs as number[]) ?? [],
      };
    }

    if (this.hasRouter) {
      payload.router = this.infrastructure.routers.map((router, i): RouterEntry => {
        const ctrl = this.routerDeviceControls.at(i).getRawValue();
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

      this.form.patchValue({ notes: srv.notes ?? '' });

      if (srv.veeam) {
        const jobsArray = this.veeamGroup.get('jobs') as FormArray;
        while (jobsArray.length > 0) { jobsArray.removeAt(0); }
        (srv.veeam.jobs ?? []).forEach(job => {
          jobsArray.push(this.fb.group({
            jobName:        [job.jobName],
            fullsAvailable: [job.fullsAvailable],
            restorePoints:  [job.restorePoints],
          }));
        });
        this.veeamGroup.get('uncoveredVMs')!.setValue(srv.veeam.uncoveredVMs ?? []);
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

      if (srv.bmc?.length) {
        this.infrastructure.esxiHosts.forEach((host, i) => {
          const saved = srv.bmc!.find(b => b.hostId === host.assetId);
          if (saved) {
            this.bmcHostControls.at(i).patchValue({
              firmwareVersion:  saved.firmwareVersion ?? '',
              biosVersion:      saved.biosVersion ?? '',
              alertStatus:      saved.alertStatus,
              alertCategories:  saved.alertCategories ?? [],
              alertLogs:        saved.alertLogs ?? '',
            });
          }
        });
      }

      if (srv.windows.domainControllers?.length) {
        srv.windows.domainControllers.forEach((snapshot, i) => {
          this.dcControls.at(i)?.patchValue({
            rawJson: JSON.stringify(snapshot, null, 2),
          });
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

- [ ] **Step 7: Reemplazar la sección Veeam en `maintenance-form.component.html`**

Localizar el bloque:
```html
<!-- ── Veeam Backup ──────────────────────────────────── -->
<ng-container *ngIf="hasVeeam">
  ...
</ng-container>
```
(actualmente va de la línea `<!-- ── Veeam Backup` hasta el `</ng-container>` justo antes del `<!-- ── Router / Firewall`).

Reemplazarlo con:

```html
<!-- ── Veeam Backup ──────────────────────────────────── -->
<ng-container *ngIf="hasVeeam">
  <div class="mf-section-lbl">Veeam Backup</div>
  <app-veeam-form
    [formGroup]="veeamGroup"
    [allVMs]="allVMs"
    [readOnly]="readOnly">
  </app-veeam-form>
</ng-container>
```

- [ ] **Step 8: Correr spec — debe PASAR**

```bash
cd frontend && npx ng test --include="**/maintenance-form.component.spec.ts" --watch=false
```

Esperado: todos los tests pasan.

- [ ] **Step 9: Verificar compilación TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Esperado: 0 errores.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.ts
git add frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.html
git add frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.spec.ts
git commit -m "feat(maintenance-form): integrar VeeamFormComponent con jobs dinámicos y cobertura de VMs"
```

---

## Task 5: Storybook — `VeeamFormComponent`

**Files:**
- Create: `frontend/src/app/features/technician/task-drawer/veeam-form/veeam-form.component.stories.ts`

**Interfaces:**
- Consume: `VeeamFormComponent` con `formGroup`, `allVMs`, `readOnly`
- Consume: `FormBuilder` inline (igual que `qnap-device-card.component.stories.ts`)

- [ ] **Step 1: Crear las stories**

Crear `frontend/src/app/features/technician/task-drawer/veeam-form/veeam-form.component.stories.ts`:

```typescript
import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { VeeamFormComponent } from './veeam-form.component';
import { InfraAsset } from '../../../../core/models/infradoc.models';

const fb = new FormBuilder();

function makeFormGroup(jobs: { jobName: string; fullsAvailable: number; restorePoints: number }[] = [], uncoveredVMs: number[] = []) {
  return fb.group({
    jobs: fb.array(
      jobs.map(j => fb.group({
        jobName:        [j.jobName],
        fullsAvailable: [j.fullsAvailable],
        restorePoints:  [j.restorePoints],
      }))
    ),
    uncoveredVMs: [uncoveredVMs],
  });
}

const mockVMs: InfraAsset[] = [
  { assetId: 3, name: 'SRV-FILE',   ip: '192.168.1.10', bmcIp: null, bmcType: null, os: 'Windows Server 2019', model: null },
  { assetId: 4, name: 'DC01',       ip: '192.168.1.18', bmcIp: null, bmcType: null, os: 'Windows Server 2022', model: null },
  { assetId: 7, name: 'SRV-UBUNTU', ip: '192.168.1.25', bmcIp: null, bmcType: null, os: 'Ubuntu 22.04',        model: null },
];

const meta: Meta<VeeamFormComponent> = {
  title: 'Veeam/VeeamForm',
  component: VeeamFormComponent,
  decorators: [
    moduleMetadata({
      declarations: [VeeamFormComponent],
      imports: [
        ReactiveFormsModule,
        CommonModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatCheckboxModule,
      ],
    }),
  ],
  argTypes: {
    readOnly: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<VeeamFormComponent>;

// ── Empty ──────────────────────────────────────────────
// Sin jobs, todas las VMs cubierta por defecto
export const Empty: Story = {
  render: (args) => ({
    props: {
      formGroup: makeFormGroup(),
      allVMs: mockVMs,
      readOnly: args['readOnly'] ?? false,
    },
  }),
};

// ── WithJobs ───────────────────────────────────────────
// 3 jobs completos, sin VMs sin cobertura
export const WithJobs: Story = {
  render: (args) => ({
    props: {
      formGroup: makeFormGroup([
        { jobName: 'Daily Backup - VMs',    fullsAvailable: 4, restorePoints: 28 },
        { jobName: 'Weekly Full - DC01',    fullsAvailable: 2, restorePoints: 8  },
        { jobName: 'Monthly Archive',       fullsAvailable: 1, restorePoints: 3  },
      ]),
      allVMs: mockVMs,
      readOnly: args['readOnly'] ?? false,
    },
  }),
};

// ── UncoveredVMs ───────────────────────────────────────
// 2 jobs, VM Linux sin cobertura marcada
export const UncoveredVMs: Story = {
  render: (args) => ({
    props: {
      formGroup: makeFormGroup(
        [
          { jobName: 'Daily Backup - VMs', fullsAvailable: 3, restorePoints: 21 },
          { jobName: 'Weekly Full - DC01', fullsAvailable: 2, restorePoints: 8  },
        ],
        [7],
      ),
      allVMs: mockVMs,
      readOnly: args['readOnly'] ?? false,
    },
  }),
};

// ── ReadOnly ───────────────────────────────────────────
// Estado guardado, formulario deshabilitado
export const ReadOnly: Story = {
  render: () => {
    const group = makeFormGroup(
      [
        { jobName: 'Daily Backup - VMs', fullsAvailable: 4, restorePoints: 28 },
        { jobName: 'Weekly Full - DC01', fullsAvailable: 2, restorePoints: 8  },
      ],
      [7],
    );
    group.disable();
    return {
      props: { formGroup: group, allVMs: mockVMs, readOnly: true },
    };
  },
};
```

- [ ] **Step 2: Verificar compilación TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Esperado: 0 errores.

- [ ] **Step 3: Correr todos los tests del frontend para validar que nada se rompió**

```bash
cd frontend && npx ng test --watch=false
```

Esperado: todos los tests pasan.

- [ ] **Step 4: Correr todos los tests del backend**

```bash
cd backend && npx jest --no-coverage
```

Esperado: todos los tests pasan.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/features/technician/task-drawer/veeam-form/veeam-form.component.stories.ts
git commit -m "feat(veeam-form): agregar stories de Storybook para los 4 estados del componente"
```

---

## Self-review

**Cobertura del spec:**

| Requisito | Task |
|---|---|
| `linuxVMs` en backend DTO | Task 1 |
| Detección de VMs Linux en `groupAssets` | Task 1 |
| `linuxVMs` en modelo frontend | Task 2 |
| `VeeamJobEntry` + `VeeamSection` rediseñados | Task 2 |
| `VeeamFormComponent` — `addJob` / `removeJob` | Task 3 |
| `VeeamFormComponent` — `isUncovered` / `toggleVM` | Task 3 |
| `VeeamFormComponent` — `readOnly` deshabilita form | Task 3 |
| `MaintenanceFormComponent.allVMs` getter | Task 4 |
| `MaintenanceFormComponent.veeamGroup` getter | Task 4 |
| `buildPayload` mapea jobs y uncoveredVMs | Task 4 |
| `patchFormFromPayload` restaura jobs y uncoveredVMs | Task 4 |
| Template integra `<app-veeam-form>` | Task 4 |
| Stories: Empty, WithJobs, UncoveredVMs, ReadOnly | Task 5 |

**Consistencia de tipos:**

- `VeeamJobEntry` definida en Task 2, usada en `buildPayload` de Task 4 ✓
- `VeeamSection.uncoveredVMs: number[]` (assetIds), coherente en payload y patch ✓
- `VeeamFormComponent.formGroup` recibe el mismo shape que `buildForm()` crea en Task 4 ✓
- `allVMs` combina `windowsVMs + domainControllers + linuxVMs`, coherente con backend Task 1 ✓

**Sin placeholders:** Todo el código está completo en cada step. ✓
