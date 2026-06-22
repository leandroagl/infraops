# Storybook Setup + QnapDeviceCardComponent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Instalar Storybook 8 en el frontend Angular 17, extraer `QnapDeviceCardComponent` del formulario QNAP existente y documentar sus 5 estados con stories.

**Architecture:** `QnapDeviceCardComponent` es un componente presentacional que recibe un `FormGroup` y un `InfraAsset` como inputs. Muta directamente el FormGroup (sin outputs). `QnapFormComponent` queda como orquestador que crea el FormArray y pasa cada grupo al card. Storybook consume el card de forma aislada, con FormGroups construidos inline por cada story.

**Tech Stack:** Angular 17 · Angular Material 17 · ReactiveFormsModule · Storybook 8 (`@storybook/angular`) · Jasmine/Karma

## Global Constraints

- No standalone components — usar NgModule con `declarations` en `TechnicianModule`
- Angular Material `appearance="outline"` — único estilo permitido en `mat-form-field`
- No `::ng-deep` — coloring semántico via CSS custom properties con `[ngClass]`
- No `any` en TypeScript
- TDD: spec antes de implementación
- Commits frecuentes — uno por task

---

## File Map

| Acción | Archivo |
|---|---|
| Crear | `frontend/.storybook/main.ts` |
| Crear | `frontend/.storybook/preview.ts` |
| Modificar | `frontend/package.json` |
| Crear | `frontend/src/app/features/technician/task-drawer/qnap-form/qnap-device-card/qnap-device-card.component.ts` |
| Crear | `frontend/src/app/features/technician/task-drawer/qnap-form/qnap-device-card/qnap-device-card.component.html` |
| Crear | `frontend/src/app/features/technician/task-drawer/qnap-form/qnap-device-card/qnap-device-card.component.scss` |
| Crear | `frontend/src/app/features/technician/task-drawer/qnap-form/qnap-device-card/qnap-device-card.component.spec.ts` |
| Crear | `frontend/src/app/features/technician/task-drawer/qnap-form/qnap-device-card/qnap-device-card.component.stories.ts` |
| Modificar | `frontend/src/app/features/technician/task-drawer/qnap-form/qnap-form.component.ts` |
| Modificar | `frontend/src/app/features/technician/task-drawer/qnap-form/qnap-form.component.html` |
| Modificar | `frontend/src/app/features/technician/technician.module.ts` |

---

## Task 1: Instalar y configurar Storybook

**Files:**
- Crear: `frontend/.storybook/main.ts`
- Crear: `frontend/.storybook/preview.ts`
- Modificar: `frontend/package.json`

**Interfaces:**
- Produce: comando `npm run storybook` funcional en `frontend/`

- [ ] **Step 1: Ejecutar el init de Storybook dentro de `frontend/`**

```bash
cd frontend
npx storybook@latest init
```

Cuando pregunte el tipo de proyecto, seleccionar `angular`. El init detecta la versión automáticamente. Instala `@storybook/angular`, `@storybook/addon-essentials` y `storybook` como devDependencies. También agrega el script `"storybook"` al `package.json`.

> Si el init pregunta por un builder (webpack vs vite), elegir **webpack** — es el default estable con Angular 17.

- [ ] **Step 2: Eliminar los stories de ejemplo generados**

El init crea una carpeta `src/stories/` con ejemplos. Eliminarla completa:

```bash
rm -rf src/stories
```

- [ ] **Step 3: Sobrescribir `.storybook/main.ts` con la configuración mínima**

Contenido final de `frontend/.storybook/main.ts`:

```typescript
import type { StorybookConfig } from '@storybook/angular';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.ts'],
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/angular',
    options: {},
  },
};

export default config;
```

- [ ] **Step 4: Sobrescribir `.storybook/preview.ts` con imports globales y animaciones**

Contenido final de `frontend/.storybook/preview.ts`:

```typescript
import { applicationConfig } from '@storybook/angular';
import { provideAnimations } from '@angular/platform-browser/animations';
import '../src/styles.scss';

export const decorators = [
  applicationConfig({
    providers: [provideAnimations()],
  }),
];
```

`styles.scss` importa en cascada `tokens.scss → reset.scss → typography.scss → components.scss → ag-grid.scss`. Todos los tokens y clases del design system estarán disponibles en Storybook sin configuración adicional.

- [ ] **Step 5: Verificar que Storybook inicia sin errores**

```bash
npm run storybook
```

Resultado esperado: Storybook abre en `http://localhost:6006`. La sidebar izquierda debe estar **vacía** (sin stories). No debe haber errores en consola relacionados a Angular o estilos. Ctrl+C para detener.

- [ ] **Step 6: Commit**

```bash
cd ..
git add frontend/.storybook frontend/package.json frontend/package-lock.json
git commit -m "chore(storybook): instalar y configurar Storybook 8 para Angular 17"
```

---

## Task 2: Extraer QnapDeviceCardComponent (TDD)

**Files:**
- Crear: `frontend/src/app/features/technician/task-drawer/qnap-form/qnap-device-card/qnap-device-card.component.spec.ts`
- Crear: `frontend/src/app/features/technician/task-drawer/qnap-form/qnap-device-card/qnap-device-card.component.ts`
- Crear: `frontend/src/app/features/technician/task-drawer/qnap-form/qnap-device-card/qnap-device-card.component.html`
- Crear: `frontend/src/app/features/technician/task-drawer/qnap-form/qnap-device-card/qnap-device-card.component.scss`
- Modificar: `frontend/src/app/features/technician/task-drawer/qnap-form/qnap-form.component.ts`
- Modificar: `frontend/src/app/features/technician/task-drawer/qnap-form/qnap-form.component.html`
- Modificar: `frontend/src/app/features/technician/technician.module.ts`

**Interfaces:**
- Consume: `InfraAsset` de `core/models/infradoc.models.ts` · `FormGroup` de `@angular/forms`
- Produce: `QnapDeviceCardComponent` con inputs `device: InfraAsset`, `group: FormGroup`, `readOnly: boolean`
- Produce: getters públicos `spaceRatio: number`, `cardHealth: 'ok'|'warn'|'crit'`, `diskSlotOptions: string[]`, `firmwareUpdated: boolean`

- [ ] **Step 1: Crear el archivo de spec con los tests (en rojo)**

Crear `frontend/src/app/features/technician/task-drawer/qnap-form/qnap-device-card/qnap-device-card.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { QnapDeviceCardComponent } from './qnap-device-card.component';
import { InfraAsset } from '../../../../../core/models/infradoc.models';

const mockDevice: InfraAsset = {
  assetId: 1, name: 'QNAP TS-219P+', ip: '192.168.0.1',
  bmcIp: null, bmcType: null, os: null, model: 'TS-219P+',
};

function makeGroup(fb: FormBuilder) {
  return fb.group({
    diskCount:          [4],
    totalSpaceGB:       [4],
    totalSpaceUnit:     ['TB'],
    usedSpaceGB:        [1.8],
    usedSpaceUnit:      ['TB'],
    disksWithError:     [[]],
    raidStatus:         ['ok'],
    firmwareVersion:    ['5.1.0.2566'],
    firmwareUpdated:    [false],
    firmwareNewVersion: [''],
  });
}

describe('QnapDeviceCardComponent', () => {
  let component: QnapDeviceCardComponent;
  let fixture: ComponentFixture<QnapDeviceCardComponent>;
  let fb: FormBuilder;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [QnapDeviceCardComponent],
      imports: [
        ReactiveFormsModule, CommonModule, NoopAnimationsModule,
        MatFormFieldModule, MatInputModule, MatSelectModule, MatCheckboxModule,
      ],
    }).compileComponents();

    fb = TestBed.inject(FormBuilder);
    fixture = TestBed.createComponent(QnapDeviceCardComponent);
    component = fixture.componentInstance;
    component.device = mockDevice;
    component.group = makeGroup(fb);
    fixture.detectChanges();
  });

  describe('spaceRatio', () => {
    it('computes ratio as percentage of used/total in same unit', () => {
      component.group.patchValue({ totalSpaceGB: 4, totalSpaceUnit: 'TB', usedSpaceGB: 2, usedSpaceUnit: 'TB' });
      expect(component.spaceRatio).toBe(50);
    });

    it('converts TB to GB for cross-unit comparison', () => {
      component.group.patchValue({ totalSpaceGB: 1, totalSpaceUnit: 'TB', usedSpaceGB: 512, usedSpaceUnit: 'GB' });
      expect(component.spaceRatio).toBe(50);
    });

    it('returns 0 when total is 0', () => {
      component.group.patchValue({ totalSpaceGB: 0, usedSpaceGB: 100 });
      expect(component.spaceRatio).toBe(0);
    });
  });

  describe('cardHealth', () => {
    it('returns ok when RAID ok and space under 70%', () => {
      component.group.patchValue({ raidStatus: 'ok', totalSpaceGB: 4, totalSpaceUnit: 'TB', usedSpaceGB: 1, usedSpaceUnit: 'TB', disksWithError: [] });
      expect(component.cardHealth).toBe('ok');
    });

    it('returns warn when RAID degraded', () => {
      component.group.patchValue({ raidStatus: 'degraded', disksWithError: [] });
      expect(component.cardHealth).toBe('warn');
    });

    it('returns warn when space ratio exceeds 70%', () => {
      component.group.patchValue({ raidStatus: 'ok', totalSpaceGB: 4, totalSpaceUnit: 'TB', usedSpaceGB: 3, usedSpaceUnit: 'TB', disksWithError: [] });
      expect(component.cardHealth).toBe('warn');
    });

    it('returns crit when RAID failed', () => {
      component.group.patchValue({ raidStatus: 'failed', disksWithError: [] });
      expect(component.cardHealth).toBe('crit');
    });

    it('returns crit when there are disks with error', () => {
      component.group.patchValue({ raidStatus: 'ok', totalSpaceGB: 4, totalSpaceUnit: 'TB', usedSpaceGB: 1, usedSpaceUnit: 'TB', disksWithError: ['Disk 1'] });
      expect(component.cardHealth).toBe('crit');
    });

    it('returns crit when space ratio exceeds 85%', () => {
      component.group.patchValue({ raidStatus: 'ok', totalSpaceGB: 4, totalSpaceUnit: 'TB', usedSpaceGB: 3.8, usedSpaceUnit: 'TB', disksWithError: [] });
      expect(component.cardHealth).toBe('crit');
    });
  });

  describe('diskSlotOptions', () => {
    it('generates disk slot labels from diskCount', () => {
      component.group.patchValue({ diskCount: 3 });
      expect(component.diskSlotOptions).toEqual(['Disk 1', 'Disk 2', 'Disk 3']);
    });

    it('returns empty array when diskCount is 0', () => {
      component.group.patchValue({ diskCount: 0 });
      expect(component.diskSlotOptions).toEqual([]);
    });

    it('returns empty array when diskCount is null', () => {
      component.group.patchValue({ diskCount: null });
      expect(component.diskSlotOptions).toEqual([]);
    });
  });

  describe('firmwareUpdated', () => {
    it('returns false by default', () => {
      expect(component.firmwareUpdated).toBeFalse();
    });

    it('returns true when checkbox is checked', () => {
      component.group.patchValue({ firmwareUpdated: true });
      expect(component.firmwareUpdated).toBeTrue();
    });
  });
});
```

- [ ] **Step 2: Verificar que los tests fallan (componente no existe)**

```bash
cd frontend
npx ng test --include="**/qnap-device-card.component.spec.ts" --watch=false
```

Resultado esperado: error de compilación — `QnapDeviceCardComponent` no encontrado.

- [ ] **Step 3: Crear `qnap-device-card.component.ts`**

```typescript
import { Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { InfraAsset } from '../../../../../core/models/infradoc.models';

@Component({
  selector: 'app-qnap-device-card',
  templateUrl: './qnap-device-card.component.html',
  styleUrl: './qnap-device-card.component.scss',
})
export class QnapDeviceCardComponent {
  @Input() device!: InfraAsset;
  @Input() group!: FormGroup;
  @Input() readOnly = false;

  get spaceRatio(): number {
    const v = this.group.value;
    const total = Number(v.totalSpaceGB) * (v.totalSpaceUnit === 'TB' ? 1024 : 1);
    const used  = Number(v.usedSpaceGB)  * (v.usedSpaceUnit  === 'TB' ? 1024 : 1);
    return total ? (used / total) * 100 : 0;
  }

  get cardHealth(): 'ok' | 'warn' | 'crit' {
    const v = this.group.value;
    const ratio = this.spaceRatio;
    if (v.disksWithError?.length || v.raidStatus === 'failed' || ratio > 85) return 'crit';
    if (v.raidStatus === 'degraded' || ratio > 70) return 'warn';
    return 'ok';
  }

  get diskSlotOptions(): string[] {
    const count = Number(this.group.get('diskCount')?.value);
    if (!count || isNaN(count) || count <= 0) return [];
    return Array.from({ length: count }, (_, k) => `Disk ${k + 1}`);
  }

  get firmwareUpdated(): boolean {
    return this.group.get('firmwareUpdated')?.value === true;
  }

  raidBadgeClass(): string {
    const v = this.group.get('raidStatus')?.value;
    if (!v || v === 'ok')       return 'badge--ok';
    if (v === 'degraded')       return 'badge--warn';
    if (v === 'failed')         return 'badge--crit';
    return 'badge--neutral';
  }

  raidBadgeLabel(): string {
    const v = this.group.get('raidStatus')?.value;
    if (!v || v === 'ok')       return 'RAID: OK';
    if (v === 'degraded')       return 'RAID: Degradado';
    if (v === 'failed')         return 'RAID: Error';
    return 'RAID: —';
  }

  spaceBadgeClass(): string {
    const ratio = this.spaceRatio;
    if (ratio >= 85) return 'badge--crit';
    if (ratio >= 70) return 'badge--warn';
    if (ratio > 0)   return 'badge--ok';
    return 'badge--neutral';
  }

  selectClass(value: string): string {
    if (!value || value === 'ok') return 'mf-sel--ok';
    if (value === 'degraded')     return 'mf-sel--warn';
    if (value === 'failed')       return 'mf-sel--crit';
    return '';
  }

  metricClass(value: number, warnThreshold: number, critThreshold: number): string {
    if (!value || isNaN(value))         return '';
    if (value >= critThreshold)         return 'mf-inp--crit';
    if (value >= warnThreshold)         return 'mf-inp--warn';
    return 'mf-inp--ok';
  }
}
```

- [ ] **Step 4: Verificar que los tests de getters pasan**

```bash
npx ng test --include="**/qnap-device-card.component.spec.ts" --watch=false
```

Resultado esperado: todos los tests en verde. Si alguno falla, revisar el getter correspondiente antes de continuar.

- [ ] **Step 5: Crear `qnap-device-card.component.html`**

```html
<div class="mf-cl-rpt qnap-card"
     [class.mf-cl-rpt--warn]="cardHealth === 'warn'"
     [class.qnap-card--crit]="cardHealth === 'crit'">

  <!-- Header -->
  <div class="qnap-card-header">
    <div class="qnap-card-identity">
      <span class="mf-cl-rpt-label">{{ device.name }}</span>
      <span class="mono mf-host-ip">{{ device.ip ?? '—' }}</span>
    </div>
    <div class="qnap-card-badges">
      <span class="badge" [ngClass]="raidBadgeClass()">
        <span class="dot"></span>{{ raidBadgeLabel() }}
      </span>
      <span *ngIf="spaceRatio > 0" class="badge" [ngClass]="spaceBadgeClass()">
        <span class="dot"></span>{{ spaceRatio | number:'1.0-0' }}%
      </span>
    </div>
  </div>

  <div [formGroup]="group">

    <!-- Sección almacenamiento -->
    <div class="mf-section-lbl">Almacenamiento</div>

    <div class="qnap-storage-row">
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="mf-metric-ff">
        <mat-label>Cantidad de discos</mat-label>
        <input matInput formControlName="diskCount" type="number" min="1" placeholder="0" />
      </mat-form-field>

      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="mf-metric-ff">
        <mat-label>Espacio total</mat-label>
        <input matInput formControlName="totalSpaceGB" type="number" min="0" placeholder="0" />
        <mat-select matSuffix formControlName="totalSpaceUnit" style="width:55px">
          <mat-option value="GB">GB</mat-option>
          <mat-option value="TB">TB</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="mf-metric-ff"
                      [ngClass]="metricClass(spaceRatio, 70, 85)">
        <mat-label>Espacio utilizado</mat-label>
        <input matInput formControlName="usedSpaceGB" type="number" min="0" placeholder="0" />
        <mat-select matSuffix formControlName="usedSpaceUnit" style="width:55px">
          <mat-option value="GB">GB</mat-option>
          <mat-option value="TB">TB</mat-option>
        </mat-select>
      </mat-form-field>
    </div>

    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="mf-form-field"
                    [ngClass]="group.get('disksWithError')?.value?.length ? 'mf-sel--crit' : ''">
      <mat-label>Discos con error</mat-label>
      <mat-select formControlName="disksWithError" multiple>
        <mat-option *ngFor="let slot of diskSlotOptions" [value]="slot">{{ slot }}</mat-option>
      </mat-select>
    </mat-form-field>

    <div *ngIf="group.get('disksWithError')?.value?.length" class="qnap-disk-error-chips">
      <span *ngFor="let disk of group.get('disksWithError')?.value" class="qnap-disk-chip">{{ disk }}</span>
    </div>

    <!-- Barra de progreso -->
    <div *ngIf="spaceRatio > 0" class="qnap-progress-bar">
      <div class="qnap-progress-fill"
           [ngClass]="metricClass(spaceRatio, 70, 85)"
           [style.width.%]="spaceRatio"></div>
    </div>

    <!-- Estado RAID (select oculto visualmente — el badge del header lo representa) -->
    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="mf-form-field"
                    [ngClass]="selectClass(group.get('raidStatus')?.value)">
      <mat-label>Estado RAID</mat-label>
      <mat-select formControlName="raidStatus">
        <mat-option value="ok">OK — saludable</mat-option>
        <mat-option value="degraded">Degradado</mat-option>
        <mat-option value="failed">Error</mat-option>
      </mat-select>
    </mat-form-field>

    <!-- Sección firmware -->
    <div class="mf-section-lbl">Firmware</div>

    <div class="qnap-firmware-row">
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="mf-form-field">
        <mat-label>Versión instalada</mat-label>
        <input matInput formControlName="firmwareVersion" placeholder="Ej: 5.1.0.2566" />
      </mat-form-field>
      <mat-checkbox formControlName="firmwareUpdated" class="mf-cl-mat mf-qnap-fw-check">
        Se actualizó el firmware
      </mat-checkbox>
    </div>

    <mat-form-field *ngIf="firmwareUpdated"
                    appearance="outline" subscriptSizing="dynamic" class="mf-form-field">
      <mat-label>Nueva versión aplicada</mat-label>
      <input matInput formControlName="firmwareNewVersion" placeholder="Ej: 5.2.0.2800" />
    </mat-form-field>

  </div>
</div>
```

- [ ] **Step 6: Crear `qnap-device-card.component.scss`**

```scss
.qnap-card--crit {
  border-color: var(--crit-bd);
  background: color-mix(in srgb, var(--crit) 3%, transparent);
}

// Header
.qnap-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.qnap-card-identity {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.qnap-card-badges {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

// Filas de campos
.qnap-storage-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  align-items: start;
}

.qnap-firmware-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
}

// Barra de progreso
.qnap-progress-bar {
  height: 5px;
  background: var(--elevated);
  border-radius: 3px;
  overflow: hidden;
  margin: 2px 0 6px;
}

.qnap-progress-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 300ms ease;

  &.mf-inp--ok   { background: var(--ok); }
  &.mf-inp--warn { background: var(--warn); }
  &.mf-inp--crit { background: var(--crit); }
}

// Chips de discos con error
.qnap-disk-error-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 2px;
}

.qnap-disk-chip {
  font-size: 11px;
  font-family: var(--font-mono);
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--crit-bg);
  color: var(--crit);
}
```

- [ ] **Step 7: Declarar `QnapDeviceCardComponent` en `TechnicianModule`**

Modificar `frontend/src/app/features/technician/technician.module.ts`.

Agregar el import al inicio:
```typescript
import { QnapDeviceCardComponent } from './task-drawer/qnap-form/qnap-device-card/qnap-device-card.component';
```

Agregar al array `declarations`:
```typescript
declarations: [
  TaskListComponent, TaskDrawerComponent, MaintenanceFormComponent,
  ConfirmMaintenanceDialogComponent, TimeSpentDialogComponent,
  DcHealthCardComponent, QnapFormComponent,
  QnapDeviceCardComponent,   // ← agregar
],
```

- [ ] **Step 8: Refactorizar `qnap-form.component.ts`**

Reemplazar el contenido completo del archivo. Se eliminan los métodos que migran al card (`spaceRatio`, `qnapCardHealth`, `selectClass`, `metricClass`, `diskSlotOptions`, `qnapFirmwareUpdated`):

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
  MaintenancePayload,
  QNAPSection,
  QnapPayload,
} from '../../../../core/models/maintenance-log.models';

@Component({
  selector: 'app-qnap-form',
  templateUrl: './qnap-form.component.html',
  styleUrl: './qnap-form.component.scss',
})
export class QnapFormComponent implements OnChanges {
  @Input() task!: Task;
  @Input() infrastructure!: ClientInfrastructure;
  @Input() savedPayload: MaintenancePayload | null = null;
  @Input() readOnly = false;

  @Output() requestComplete = new EventEmitter<QnapPayload>();
  @Output() requestNotDone  = new EventEmitter<void>();

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
    } else if (changes['readOnly'] && this.form) {
      this.applyReadOnlyState();
    }
  }

  get qnapDeviceControls(): FormArray {
    return this.form.get('qnapDevices') as FormArray;
  }

  getQnapGroup(index: number): FormGroup {
    return this.qnapDeviceControls.at(index) as FormGroup;
  }

  submit(): void {
    this.requestComplete.emit(this.buildPayload());
  }

  submitNotDone(): void {
    this.requestNotDone.emit();
  }

  private applyReadOnlyState(): void {
    if (!this.form) return;
    if (this.readOnly) {
      this.form.disable({ emitEvent: false });
    } else {
      this.form.enable({ emitEvent: false });
    }
  }

  private buildForm(): void {
    this.form = this.fb.group({
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
      notes: [''],
    });
  }

  private buildPayload(): QnapPayload {
    const v = this.form.value;
    return {
      type: 'QNAP_MAINTENANCE',
      qnap: this.infrastructure.nas.map((nas, i) => {
        const ctrl = this.qnapDeviceControls.at(i).value;
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
        if (ctrl.firmwareUpdated && ctrl.firmwareNewVersion) {
          result.firmwareNewVersion = ctrl.firmwareNewVersion;
        }
        return result;
      }),
      notes: v.notes || undefined,
    };
  }

  private patchFormFromPayload(payload: MaintenancePayload): void {
    if (payload.type !== 'QNAP_MAINTENANCE') return;
    const qnap = payload as QnapPayload;
    this.form.patchValue({ notes: qnap.notes ?? '' });
    if (qnap.qnap?.length) {
      this.infrastructure.nas.forEach((nas, i) => {
        const saved = qnap.qnap.find(d => d.deviceId === nas.assetId);
        if (saved) {
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
            firmwareNewVersion: saved.firmwareNewVersion ?? '',
          });
        }
      });
    }
  }
}
```

- [ ] **Step 9: Reemplazar `qnap-form.component.html`**

```html
<form [formGroup]="form">

  <div class="mf-vmware-grid">
    <app-qnap-device-card
      *ngFor="let _ of qnapDeviceControls.controls; let i = index"
      [device]="infrastructure.nas[i]"
      [group]="getQnapGroup(i)"
      [readOnly]="readOnly">
    </app-qnap-device-card>
  </div>

  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="mf-form-field" style="margin-top:12px">
    <mat-label>Notas</mat-label>
    <textarea matInput formControlName="notes" placeholder="Observaciones generales..."></textarea>
  </mat-form-field>

</form>
```

> `formArrayName="qnapDevices"` se eliminó — ya no hay `formGroupName` directos en esta plantilla. El card gestiona su propio `[formGroup]="group"` internamente.

- [ ] **Step 10: Correr todos los tests y verificar que no hay regresiones**

```bash
npx ng test --watch=false
```

Resultado esperado: todos los tests en verde, incluyendo los specs preexistentes de `QnapFormComponent` y el nuevo spec de `QnapDeviceCardComponent`.

> Si el spec de `QnapFormComponent` falla porque probaba métodos que ya no existen (`spaceRatio`, `qnapCardHealth`, etc.), eliminar esas pruebas del spec — pertenecen al nuevo componente y ya están cubiertas ahí.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/app/features/technician/
git commit -m "refactor(qnap): extraer QnapDeviceCardComponent del formulario QNAP"
```

---

## Task 3: Escribir Storybook Stories

**Files:**
- Crear: `frontend/src/app/features/technician/task-drawer/qnap-form/qnap-device-card/qnap-device-card.component.stories.ts`

**Interfaces:**
- Consume: `QnapDeviceCardComponent` con getters de Task 2
- Consume: `InfraAsset` de `core/models/infradoc.models.ts`

- [ ] **Step 1: Crear el archivo de stories**

Crear `frontend/src/app/features/technician/task-drawer/qnap-form/qnap-device-card/qnap-device-card.component.stories.ts`:

```typescript
import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { QnapDeviceCardComponent } from './qnap-device-card.component';
import { InfraAsset } from '../../../../../core/models/infradoc.models';

const fb = new FormBuilder();

function makeGroup(overrides: {
  diskCount?: number | null;
  totalSpaceGB?: number | null;
  totalSpaceUnit?: 'GB' | 'TB';
  usedSpaceGB?: number | null;
  usedSpaceUnit?: 'GB' | 'TB';
  disksWithError?: string[];
  raidStatus?: string;
  firmwareVersion?: string;
  firmwareUpdated?: boolean;
  firmwareNewVersion?: string;
} = {}) {
  return fb.group({
    diskCount:          [overrides.diskCount          ?? null],
    totalSpaceGB:       [overrides.totalSpaceGB       ?? null],
    totalSpaceUnit:     [overrides.totalSpaceUnit      ?? 'TB'],
    usedSpaceGB:        [overrides.usedSpaceGB        ?? null],
    usedSpaceUnit:      [overrides.usedSpaceUnit       ?? 'TB'],
    disksWithError:     [overrides.disksWithError      ?? []],
    raidStatus:         [overrides.raidStatus          ?? 'ok'],
    firmwareVersion:    [overrides.firmwareVersion     ?? ''],
    firmwareUpdated:    [overrides.firmwareUpdated     ?? false],
    firmwareNewVersion: [overrides.firmwareNewVersion  ?? ''],
  });
}

const mockDevice: InfraAsset = {
  assetId: 1, name: 'QNAP – TS-219P+', ip: '192.168.0.132',
  bmcIp: null, bmcType: null, os: null, model: 'TS-219P+',
};

const meta: Meta<QnapDeviceCardComponent> = {
  title: 'QNAP/QnapDeviceCard',
  component: QnapDeviceCardComponent,
  decorators: [
    moduleMetadata({
      declarations: [QnapDeviceCardComponent],
      imports: [
        ReactiveFormsModule, CommonModule,
        MatFormFieldModule, MatInputModule,
        MatSelectModule, MatCheckboxModule,
      ],
    }),
  ],
  argTypes: {
    readOnly: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<QnapDeviceCardComponent>;

// ── Healthy ────────────────────────────────────────────────────
// RAID ok, 45% espacio usado — todo verde
export const Healthy: Story = {
  render: (args) => ({
    props: {
      device: mockDevice,
      group: makeGroup({
        diskCount: 4, totalSpaceGB: 4, totalSpaceUnit: 'TB',
        usedSpaceGB: 1.8, usedSpaceUnit: 'TB',
        raidStatus: 'ok', firmwareVersion: '5.1.0.2566',
      }),
      readOnly: args['readOnly'] ?? false,
    },
  }),
};

// ── StorageWarning ─────────────────────────────────────────────
// RAID ok, 75% espacio — badge de espacio en warn, barra amarilla
export const StorageWarning: Story = {
  render: (args) => ({
    props: {
      device: mockDevice,
      group: makeGroup({
        diskCount: 4, totalSpaceGB: 4, totalSpaceUnit: 'TB',
        usedSpaceGB: 3, usedSpaceUnit: 'TB',
        raidStatus: 'ok', firmwareVersion: '5.1.0.2566',
      }),
      readOnly: args['readOnly'] ?? false,
    },
  }),
};

// ── DiskError ──────────────────────────────────────────────────
// RAID degraded, Disk 2 con error — badge RAID en warn, chip visible
export const DiskError: Story = {
  render: (args) => ({
    props: {
      device: { ...mockDevice, name: 'QNAP – VS-8148UPro+', ip: '192.168.0.199' },
      group: makeGroup({
        diskCount: 8, totalSpaceGB: 48, totalSpaceUnit: 'TB',
        usedSpaceGB: 20, usedSpaceUnit: 'TB',
        raidStatus: 'degraded', disksWithError: ['Disk 2'],
        firmwareVersion: '5.0.0.1932',
      }),
      readOnly: args['readOnly'] ?? false,
    },
  }),
};

// ── Critical ───────────────────────────────────────────────────
// RAID failed, 90% espacio, Disk 1 + Disk 3 con error — todo rojo
export const Critical: Story = {
  render: (args) => ({
    props: {
      device: { ...mockDevice, name: 'NAS – QNAP Cramer', ip: '192.168.10.15' },
      group: makeGroup({
        diskCount: 4, totalSpaceGB: 8, totalSpaceUnit: 'TB',
        usedSpaceGB: 7.5, usedSpaceUnit: 'TB',
        raidStatus: 'failed', disksWithError: ['Disk 1', 'Disk 3'],
        firmwareVersion: '5.0.0.1932',
      }),
      readOnly: args['readOnly'] ?? false,
    },
  }),
};

// ── ReadOnly ───────────────────────────────────────────────────
// Form deshabilitado con firmware actualizado — estado post-mantenimiento
export const ReadOnly: Story = {
  render: () => {
    const group = makeGroup({
      diskCount: 4, totalSpaceGB: 4, totalSpaceUnit: 'TB',
      usedSpaceGB: 1.8, usedSpaceUnit: 'TB',
      raidStatus: 'ok', firmwareVersion: '5.1.0.2566',
      firmwareUpdated: true, firmwareNewVersion: '5.2.0.2800',
    });
    group.disable();
    return {
      props: { device: mockDevice, group, readOnly: true },
    };
  },
};
```

- [ ] **Step 2: Verificar que Storybook compila sin errores**

```bash
npm run storybook
```

Resultado esperado: Storybook abre en `http://localhost:6006`. En la sidebar debe aparecer `QNAP > QnapDeviceCard` con las 5 stories: `Healthy`, `StorageWarning`, `DiskError`, `Critical`, `ReadOnly`.

- [ ] **Step 3: Verificar visualmente cada story**

Abrir cada story y confirmar:

| Story | Verificar |
|---|---|
| `Healthy` | Badge RAID verde "RAID: OK", badge espacio verde ~45%, barra verde baja |
| `StorageWarning` | Badge espacio amarillo ~75%, barra amarilla, RAID verde |
| `DiskError` | Badge RAID amarillo "RAID: Degradado", chip "Disk 2" visible en rojo |
| `Critical` | Card con borde rojo, badge RAID rojo "RAID: Error", chips "Disk 1" y "Disk 3", barra roja |
| `ReadOnly` | Todos los campos deshabilitados, campo "Nueva versión aplicada" visible con valor |

En el panel de controles (tab "Controls"), el toggle `readOnly` debe poder activarse y desactivarse en tiempo real.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/features/technician/task-drawer/qnap-form/qnap-device-card/qnap-device-card.component.stories.ts
git commit -m "feat(storybook): agregar stories de QnapDeviceCard con 5 estados"
```
