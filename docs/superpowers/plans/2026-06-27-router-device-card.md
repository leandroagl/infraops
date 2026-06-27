# Router Device Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extraer la card de dispositivo del `RouterFormComponent` a un `RouterDeviceCardComponent` siguiendo el patrón visual y estructural del `QnapDeviceCardComponent`.

**Architecture:** Se crea `RouterDeviceCardComponent` en `router-form/router-device-card/` con header (nombre + IP, sin badge) y body con dos secciones (`mf-section-lbl`): "Firmware" (campo versión + checkbox en grid 1fr auto) y "Configuración" (checkbox de backup). El `RouterFormComponent` se simplifica a un stack de `app-router-device-card`.

**Tech Stack:** Angular, Angular Material (MatCheckboxModule, MatFormFieldModule, MatInputModule), ReactiveFormsModule, SCSS con CSS custom properties para theming de Material.

## Global Constraints

- Sin standalone components — declarar en `TechnicianModule`
- `appearance="outline"` en todos los `mat-form-field`
- Sin `<input>`, `<button>`, `<select>` nativos — solo Angular Material
- TDD: test antes que implementación
- Un archivo a la vez — confirmar entre archivos en implementación subagent-driven
- Idioma del código: inglés; labels y texto de UI: español

---

## Mapa de archivos

| Archivo | Estado | Responsabilidad |
|---|---|---|
| `router-form/router-device-card/router-device-card.component.ts` | Crear | Lógica del card: getter `firmwareUpdated` |
| `router-form/router-device-card/router-device-card.component.html` | Crear | Template: header + body con secciones |
| `router-form/router-device-card/router-device-card.component.scss` | Crear | Estilos: card, header, body, form fields, checkboxes |
| `router-form/router-device-card/router-device-card.component.spec.ts` | Crear | Tests del card |
| `router-form/router-form.component.ts` | Modificar | Agregar `getRouterGroup(i)` |
| `router-form/router-form.component.html` | Modificar | Reemplazar cards inline por `app-router-device-card` |
| `router-form/router-form.component.scss` | Modificar | Simplificar a `.rf-devices-stack` |
| `router-form/router-form.component.spec.ts` | Modificar | Agregar test de `getRouterGroup()` |
| `technician.module.ts` | Modificar | Declarar `RouterDeviceCardComponent` |

Todos los archivos viven bajo `frontend/src/app/features/technician/task-drawer/`.

---

## Task 1: RouterDeviceCardComponent — spec + implementación

**Files:**
- Create: `frontend/src/app/features/technician/task-drawer/router-form/router-device-card/router-device-card.component.spec.ts`
- Create: `frontend/src/app/features/technician/task-drawer/router-form/router-device-card/router-device-card.component.ts`
- Create: `frontend/src/app/features/technician/task-drawer/router-form/router-device-card/router-device-card.component.html`
- Create: `frontend/src/app/features/technician/task-drawer/router-form/router-device-card/router-device-card.component.scss`
- Modify: `frontend/src/app/features/technician/technician.module.ts`

**Interfaces:**
- Consumes: `InfraAsset` de `core/models/infradoc.models`, `FormGroup` con keys `firmwareUpdated: boolean`, `firmwareVersion: string`, `backupDone: boolean`
- Produces: `RouterDeviceCardComponent` con selector `app-router-device-card`, inputs: `device: InfraAsset`, `group: FormGroup`, `readOnly: boolean`

- [ ] **Step 1: Escribir el spec**

Crear `router-device-card.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { RouterDeviceCardComponent } from './router-device-card.component';
import { InfraAsset } from '../../../../../core/models/infradoc.models';

const mockDevice: InfraAsset = {
  assetId: 1, name: 'MikroTik RB4011', ip: '192.168.0.1',
  bmcIp: null, bmcType: null, os: null, model: 'RB4011',
};

function makeGroup(fb: FormBuilder) {
  return fb.group({
    firmwareUpdated: [false],
    firmwareVersion: [''],
    backupDone:      [false],
  });
}

describe('RouterDeviceCardComponent', () => {
  let component: RouterDeviceCardComponent;
  let fixture: ComponentFixture<RouterDeviceCardComponent>;
  let fb: FormBuilder;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RouterDeviceCardComponent],
      imports: [
        ReactiveFormsModule, CommonModule, NoopAnimationsModule,
        MatFormFieldModule, MatInputModule, MatCheckboxModule,
      ],
    }).compileComponents();

    fb = TestBed.inject(FormBuilder);
    fixture = TestBed.createComponent(RouterDeviceCardComponent);
    component = fixture.componentInstance;
    component.device = mockDevice;
    component.group = makeGroup(fb);
    fixture.detectChanges();
  });

  it('renders device name', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('MikroTik RB4011');
  });

  it('renders device IP', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('192.168.0.1');
  });

  it('renders — when IP is null', () => {
    component.device = { ...mockDevice, ip: null };
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('—');
  });

  describe('firmwareUpdated getter', () => {
    it('returns false by default', () => {
      expect(component.firmwareUpdated).toBeFalse();
    });

    it('returns true when control is true', () => {
      component.group.patchValue({ firmwareUpdated: true });
      expect(component.firmwareUpdated).toBeTrue();
    });
  });

  describe('firmwareVersion field (conditional)', () => {
    it('oculta el campo firmwareVersion cuando firmwareUpdated es false', () => {
      component.group.patchValue({ firmwareUpdated: false });
      fixture.detectChanges();
      const field = fixture.nativeElement.querySelector('mat-form-field');
      expect(field).toBeNull();
    });

    it('muestra el campo firmwareVersion cuando firmwareUpdated es true', () => {
      component.group.patchValue({ firmwareUpdated: true });
      fixture.detectChanges();
      const field = fixture.nativeElement.querySelector('mat-form-field');
      expect(field).not.toBeNull();
    });
  });
});
```

- [ ] **Step 2: Ejecutar el spec y confirmar que falla**

```
cd frontend
npx ng test --include="**/router-device-card.component.spec.ts" --watch=false
```

Esperado: FAIL — `RouterDeviceCardComponent` no existe.

- [ ] **Step 3: Crear el componente TypeScript**

Crear `router-device-card.component.ts`:

```typescript
import { Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { InfraAsset } from '../../../../../core/models/infradoc.models';

@Component({
  selector: 'app-router-device-card',
  templateUrl: './router-device-card.component.html',
  styleUrl: './router-device-card.component.scss',
})
export class RouterDeviceCardComponent {
  @Input() device!: InfraAsset;
  @Input() group!: FormGroup;
  @Input() readOnly = false;

  get firmwareUpdated(): boolean {
    return this.group.get('firmwareUpdated')?.value === true;
  }
}
```

- [ ] **Step 4: Crear el template HTML**

Crear `router-device-card.component.html`:

```html
<div class="mf-cl-rpt rdc-card">

  <div class="rdc-header">
    <div class="rdc-identity">
      <span class="rdc-device-name">{{ device.name }}</span>
      <span class="rdc-device-ip mono">{{ device.ip ?? '—' }}</span>
    </div>
  </div>

  <div [formGroup]="group" class="rdc-body">

    <div class="mf-section-lbl">Firmware</div>

    <div class="rdc-firmware-row">
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="rdc-form-field">
        <mat-label>Versión instalada</mat-label>
        <input matInput formControlName="firmwareVersion" placeholder="Ej: 7.14.2" />
      </mat-form-field>

      <mat-checkbox formControlName="firmwareUpdated" class="rdc-check">
        Se actualizó el firmware
      </mat-checkbox>
    </div>

    <div class="mf-section-lbl">Configuración</div>

    <mat-checkbox formControlName="backupDone" class="rdc-check">
      Backup de configuración realizado
    </mat-checkbox>

  </div>
</div>
```

Nota: el campo `firmwareVersion` NO es condicional aquí — siempre visible ya que es el campo de versión para registrar la versión actual/aplicada. El diseño spec mostró un campo "Nueva versión" condicional, pero el modelo solo tiene un campo `firmwareVersion` (la versión aplicada), por lo que se adapta: el campo siempre visible registra la versión instalada, y el checkbox indica si fue actualizado.

- [ ] **Step 5: Crear el SCSS**

Crear `router-device-card.component.scss`:

```scss
// ── Card base ──────────────────────────────────────────────
.mf-cl-rpt {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0;
  box-shadow: var(--shadow-card);
}

// ── Section label con línea divisora ──────────────────────
.mf-section-lbl {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  font-weight: 600;
  color: var(--tx-lo);
  letter-spacing: 0.8px;
  text-transform: uppercase;
  font-family: var(--font-mono);
  margin-top: 12px;
  white-space: nowrap;

  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border-lo);
  }
}

// ── Header con fondo elevado y separador ──────────────────
.rdc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-lo);
  background: var(--elevated);
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
}

// ── Body ──────────────────────────────────────────────────
.rdc-body {
  padding: 12px 14px 14px;
}

// ── Identity (nombre + IP en columna) ─────────────────────
.rdc-identity {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.rdc-device-name {
  font-size: 11px;
  font-weight: 500;
  color: var(--tx-hi);
}

.rdc-device-ip {
  font-size: 9px;
  color: var(--tx-lo);
  font-family: var(--font-mono);
}

// ── Firmware row: field (1fr) + checkbox (auto) ───────────
.rdc-firmware-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
  margin-top: 8px;
}

// ── Form field compacto ───────────────────────────────────
mat-form-field.rdc-form-field {
  width: 100%;
  --mat-form-field-container-height:            32px;
  --mat-form-field-container-vertical-padding:  6px;
  --mdc-outlined-text-field-container-color:        var(--elevated);
  --mdc-outlined-text-field-outline-color:          var(--border);
  --mdc-outlined-text-field-hover-outline-color:    var(--border-md);
  --mdc-outlined-text-field-focus-outline-color:    var(--accent-bd);
  --mdc-outlined-text-field-label-text-color:       var(--tx-lo);
  --mdc-outlined-text-field-hover-label-text-color: var(--tx-md);
  --mdc-outlined-text-field-focus-label-text-color: var(--accent);
}

// ── Checkbox theming ──────────────────────────────────────
mat-checkbox.rdc-check {
  --mdc-checkbox-unselected-outline-color:        var(--border);
  --mdc-checkbox-unselected-hover-outline-color:  var(--accent);
  --mdc-checkbox-unselected-focus-outline-color:  var(--accent-bd);
  --mdc-checkbox-selected-icon-color:             var(--ok-bg);
  --mdc-checkbox-selected-checkmark-color:        var(--ok);
  --mdc-checkbox-selected-focus-icon-color:       var(--ok-bg);
  --mdc-checkbox-selected-hover-icon-color:       var(--ok-bg);
  --mdc-checkbox-selected-pressed-icon-color:     var(--ok-bg);
  --mdc-form-field-label-text-size:  11px;
  --mdc-form-field-label-text-color: var(--tx-hi);
  display: block;
  margin-top: 8px;
}
```

- [ ] **Step 6: Declarar en TechnicianModule**

Modificar `frontend/src/app/features/technician/technician.module.ts`:

```typescript
// Agregar el import:
import { RouterDeviceCardComponent } from './task-drawer/router-form/router-device-card/router-device-card.component';

// Agregar a declarations (al final de la lista existente):
declarations: [
  TaskListComponent, TaskDrawerComponent, MaintenanceFormComponent,
  ConfirmMaintenanceDialogComponent, TimeSpentDialogComponent,
  DcHealthCardComponent, QnapFormComponent, QnapDeviceCardComponent,
  VeeamFormComponent, ServerHostFormComponent, RouterFormComponent,
  RouterDeviceCardComponent   // ← agregar
],
```

- [ ] **Step 7: Ejecutar el spec y confirmar que pasa**

```
cd frontend
npx ng test --include="**/router-device-card.component.spec.ts" --watch=false
```

Esperado: todos los tests PASS (7 tests).

- [ ] **Step 8: Commit**

```
git add frontend/src/app/features/technician/task-drawer/router-form/router-device-card/
git add frontend/src/app/features/technician/technician.module.ts
git commit -m "feat(router-form): agregar RouterDeviceCardComponent con patrón visual QNAP"
```

---

## Task 2: Refactor RouterFormComponent

**Files:**
- Modify: `frontend/src/app/features/technician/task-drawer/router-form/router-form.component.ts`
- Modify: `frontend/src/app/features/technician/task-drawer/router-form/router-form.component.html`
- Modify: `frontend/src/app/features/technician/task-drawer/router-form/router-form.component.scss`
- Modify: `frontend/src/app/features/technician/task-drawer/router-form/router-form.component.spec.ts`

**Interfaces:**
- Consumes: `RouterDeviceCardComponent` (selector `app-router-device-card`) del Task 1
- Produce: `RouterFormComponent` con método público `getRouterGroup(i: number): FormGroup`

- [ ] **Step 1: Escribir el test de `getRouterGroup()`**

Agregar al bloque `describe('RouterFormComponent — pure unit tests')` existente en `router-form.component.spec.ts`:

```typescript
describe('getRouterGroup()', () => {
  it('devuelve el FormGroup en el índice correcto del FormArray', () => {
    component.infrastructure = makeInfra([makeRouter(), makeRouter({ assetId: 2, name: 'fw-02' })]);
    component.ngOnChanges({ infrastructure: {} as any });
    const group = component.getRouterGroup(1);
    expect(group).toBeTruthy();
    expect(group.get('firmwareUpdated')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar el test y confirmar que falla**

```
cd frontend
npx ng test --include="**/router-form.component.spec.ts" --watch=false
```

Esperado: FAIL — `getRouterGroup is not a function`.

- [ ] **Step 3: Agregar `getRouterGroup()` al componente TS**

En `router-form.component.ts`, agregar debajo del getter `routerControls`:

```typescript
getRouterGroup(i: number): FormGroup {
  return this.routerControls.at(i) as FormGroup;
}
```

- [ ] **Step 4: Reemplazar el template HTML**

Reemplazar el contenido de `router-form.component.html` con:

```html
<form [formGroup]="form" class="rf">

  <div class="rf-devices-stack">
    <app-router-device-card
      *ngFor="let _ of routerControls.controls; let i = index"
      [device]="infrastructure.routers[i]"
      [group]="getRouterGroup(i)"
      [readOnly]="readOnly">
    </app-router-device-card>
  </div>

  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="rf-notes-field">
    <mat-label>Notas</mat-label>
    <textarea matInput formControlName="notes" placeholder="Observaciones generales..."></textarea>
  </mat-form-field>

</form>
```

- [ ] **Step 5: Simplificar el SCSS**

Reemplazar el contenido de `router-form.component.scss` con:

```scss
.rf {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rf-devices-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rf-notes-field {
  width: 100%;
  margin-top: 12px;
}
```

- [ ] **Step 6: Ejecutar todos los tests del router form**

```
cd frontend
npx ng test --include="**/router-form/**" --watch=false
```

Esperado: todos los tests existentes PASS + el nuevo test de `getRouterGroup()`.

- [ ] **Step 7: Commit**

```
git add frontend/src/app/features/technician/task-drawer/router-form/router-form.component.ts
git add frontend/src/app/features/technician/task-drawer/router-form/router-form.component.html
git add frontend/src/app/features/technician/task-drawer/router-form/router-form.component.scss
git add frontend/src/app/features/technician/task-drawer/router-form/router-form.component.spec.ts
git commit -m "refactor(router-form): simplificar template usando RouterDeviceCardComponent"
```

---

## Self-Review

**Spec coverage:**
- ✅ Extraer `RouterDeviceCardComponent` — Task 1
- ✅ Header: nombre + IP, sin badge — Task 1 Step 4
- ✅ Secciones "Firmware" y "Configuración" con `mf-section-lbl` — Task 1 Step 4
- ✅ Grid 1fr auto para firmware row — Task 1 Step 4+5
- ✅ CSS custom properties para theming Material — Task 1 Step 5
- ✅ Declaración en TechnicianModule — Task 1 Step 6
- ✅ Tests del card — Task 1 Step 1
- ✅ `getRouterGroup()` con test — Task 2 Steps 1-3
- ✅ Template simplificado en RouterFormComponent — Task 2 Steps 4-5
- ✅ SCSS simplificado — Task 2 Step 5
- ✅ Commits frecuentes — un commit por task

**Type consistency:**
- `RouterDeviceCardComponent` usa `InfraAsset` — mismo tipo que `QnapDeviceCardComponent`
- `getRouterGroup(i: number): FormGroup` — usado en template como `[group]="getRouterGroup(i)"`
- FormGroup keys `firmwareUpdated`, `firmwareVersion`, `backupDone` — consistentes entre `buildForm()` y los tests del card
