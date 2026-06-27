# VeeamFormComponent v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar VeeamFormComponent para control por VM (cobertura + fulls) reemplazando el modelo de jobs + uncoveredVMs.

**Architecture:** Tres tareas secuenciales: primero el modelo (foundation), luego el componente completo con TDD, finalmente actualizar TaskDrawerComponent para integrar el nuevo API.

**Tech Stack:** Angular 19, Angular Material, Reactive Forms, Jest (Karma/Jasmine)

## Global Constraints

- Angular NgModules — sin standalone components
- Todo elemento interactivo usa Angular Material exclusivamente (prohibido `<input>`, `<select>`, `<button>` nativos)
- `mat-form-field` siempre `appearance="outline"` y `subscriptSizing="dynamic"`
- Coloring via CSS custom properties, nunca `::ng-deep`
- Tipografía mono: `var(--font-mono)` (IBM Plex Mono). Tipografía UI: `var(--font-ui)`, 13px
- TDD: el spec se escribe antes que la implementación
- Idioma de código: inglés. Idioma de commits: español
- Umbrales confirmados: `fullsInMonth >= 2` = verde, `= 1` = naranja, `= 0` = rojo

---

## File Map

| Archivo | Acción |
|---|---|
| `frontend/src/app/core/models/maintenance-log.models.ts` | Modificar: agregar `VeeamVmEntry`, reemplazar `VeeamBackupPayload` |
| `frontend/src/app/features/technician/task-drawer/veeam-form/veeam-form.component.ts` | Reemplazar completo |
| `frontend/src/app/features/technician/task-drawer/veeam-form/veeam-form.component.html` | Reemplazar completo |
| `frontend/src/app/features/technician/task-drawer/veeam-form/veeam-form.component.scss` | Reemplazar completo |
| `frontend/src/app/features/technician/task-drawer/veeam-form/veeam-form.component.spec.ts` | Reemplazar completo |
| `frontend/src/app/features/technician/task-drawer/task-drawer.component.ts` | Modificar: agregar 2 getters, actualizar imports |
| `frontend/src/app/features/technician/task-drawer/task-drawer.component.html` | Modificar: binding veeam-form + footer VEEAM_BACKUP |

---

## Task 1: Actualizar modelo VeeamBackupPayload

**Files:**
- Modify: `frontend/src/app/core/models/maintenance-log.models.ts`

**Interfaces:**
- Produces: `VeeamVmEntry`, `VeeamBackupPayload` (nueva estructura) usados en Tasks 2 y 3

- [ ] **Step 1: Abrir maintenance-log.models.ts y localizar VeeamBackupPayload**

El archivo está en `frontend/src/app/core/models/maintenance-log.models.ts`. La sección actual a reemplazar es:

```typescript
export interface VeeamBackupPayload {
  type: 'VEEAM_BACKUP';
  jobs: VeeamJobEntry[];
  uncoveredVMs: number[];
  notes?: string;
}
```

- [ ] **Step 2: Agregar VeeamVmEntry y reemplazar VeeamBackupPayload**

Dejar `VeeamJobEntry` y `VeeamSection` intactos (los usa `ServerMaintenancePayload.veeam`). Solo reemplazar `VeeamBackupPayload` y agregar `VeeamVmEntry` antes de ella:

```typescript
export interface VeeamVmEntry {
  vmName: string;
  coverage: 'job' | 'agent' | 'excluded' | 'no_backup';
  fullsInMonth: number | null;
}

export interface VeeamBackupPayload {
  type: 'VEEAM_BACKUP';
  vms: VeeamVmEntry[];
  notes: string | null;
}
```

- [ ] **Step 3: Verificar que el tipo union MaintenancePayload sigue siendo válido**

La línea final del archivo debe seguir siendo:
```typescript
export type MaintenancePayload = ServerMaintenancePayload | TerminalPayload | QnapPayload | VeeamBackupPayload;
```

No cambiar nada más. `VeeamJobEntry` y `VeeamSection` permanecen inalterados.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/core/models/maintenance-log.models.ts
git commit -m "refactor(models): reemplazar VeeamBackupPayload por estructura por VM (VeeamVmEntry)"
```

---

## Task 2: Reescribir VeeamFormComponent (TDD)

**Files:**
- Modify: `frontend/src/app/features/technician/task-drawer/veeam-form/veeam-form.component.spec.ts`
- Modify: `frontend/src/app/features/technician/task-drawer/veeam-form/veeam-form.component.ts`
- Modify: `frontend/src/app/features/technician/task-drawer/veeam-form/veeam-form.component.html`
- Modify: `frontend/src/app/features/technician/task-drawer/veeam-form/veeam-form.component.scss`

**Interfaces:**
- Consumes: `VeeamVmEntry`, `VeeamBackupPayload` de Task 1
- Produces: componente `app-veeam-form` con API `[vms] [existingPayload] [readOnly] (saved) (cancelled)` usado en Task 3

- [ ] **Step 1: Reemplazar veeam-form.component.spec.ts con los tests**

Reemplazar el archivo completo con:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, SimpleChange } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { VeeamFormComponent } from './veeam-form.component';
import { VeeamBackupPayload } from '../../../../core/models/maintenance-log.models';

const VMS = [
  { name: 'SRV-FILE', os: 'Windows Server 2019' },
  { name: 'DC01',     os: 'Windows Server 2022' },
  { name: 'APP-01',   os: 'Debian 12' },
];

function init(
  component: VeeamFormComponent,
  fixture: ComponentFixture<VeeamFormComponent>,
  vms = VMS,
  existingPayload?: VeeamBackupPayload,
): void {
  component.vms = vms;
  component.existingPayload = existingPayload;
  component.ngOnChanges({ vms: new SimpleChange(undefined, vms, true) });
  fixture.detectChanges();
}

describe('VeeamFormComponent', () => {
  let component: VeeamFormComponent;
  let fixture: ComponentFixture<VeeamFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VeeamFormComponent],
      imports: [
        ReactiveFormsModule,
        NoopAnimationsModule,
        MatFormFieldModule,
        MatSelectModule,
        MatInputModule,
        MatButtonModule,
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture   = TestBed.createComponent(VeeamFormComponent);
    component = fixture.componentInstance;
  });

  describe('inicialización', () => {
    it('crea un FormArray con un grupo por VM', () => {
      init(component, fixture);
      expect(component.vmRows.length).toBe(3);
    });

    it('defaults: coverage=job, fullsInMonth=null', () => {
      init(component, fixture);
      const first = component.vmRows.at(0);
      expect(first.get('coverage')?.value).toBe('job');
      expect(first.get('fullsInMonth')?.value).toBeNull();
    });

    it('notas vacías por defecto', () => {
      init(component, fixture);
      expect(component.form.get('notes')?.value).toBe('');
    });
  });

  describe('onCoverageChange', () => {
    it('excluded → fullsInMonth = null', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'excluded', fullsInMonth: 3 });
      component.onCoverageChange(0);
      expect(component.vmRows.at(0).get('fullsInMonth')?.value).toBeNull();
    });

    it('no_backup → fullsInMonth = null', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'no_backup', fullsInMonth: 3 });
      component.onCoverageChange(0);
      expect(component.vmRows.at(0).get('fullsInMonth')?.value).toBeNull();
    });

    it('job no modifica fullsInMonth', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'job', fullsInMonth: 3 });
      component.onCoverageChange(0);
      expect(component.vmRows.at(0).get('fullsInMonth')?.value).toBe(3);
    });

    it('agent no modifica fullsInMonth', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'agent', fullsInMonth: 2 });
      component.onCoverageChange(0);
      expect(component.vmRows.at(0).get('fullsInMonth')?.value).toBe(2);
    });
  });

  describe('vmRowState', () => {
    it('excluded → excl', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'excluded', fullsInMonth: null });
      expect(component.vmRowState(0)).toBe('excl');
    });

    it('no_backup → no', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'no_backup', fullsInMonth: null });
      expect(component.vmRowState(0)).toBe('no');
    });

    it('job + fullsInMonth null → no', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'job', fullsInMonth: null });
      expect(component.vmRowState(0)).toBe('no');
    });

    it('job + fullsInMonth 0 → no', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'job', fullsInMonth: 0 });
      expect(component.vmRowState(0)).toBe('no');
    });

    it('job + fullsInMonth 1 → warn', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'job', fullsInMonth: 1 });
      expect(component.vmRowState(0)).toBe('warn');
    });

    it('job + fullsInMonth 2 → ok', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'job', fullsInMonth: 2 });
      expect(component.vmRowState(0)).toBe('ok');
    });

    it('agent + fullsInMonth 3 → ok', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'agent', fullsInMonth: 3 });
      expect(component.vmRowState(0)).toBe('ok');
    });
  });

  describe('vmHint', () => {
    it('excluded → Excluida ✓ / h-ok', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'excluded', fullsInMonth: null });
      expect(component.vmHint(0)).toEqual({ text: 'Excluida ✓', cls: 'h-ok' });
    });

    it('no_backup → Sin cobertura / h-no', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'no_backup', fullsInMonth: null });
      expect(component.vmHint(0)).toEqual({ text: 'Sin cobertura', cls: 'h-no' });
    });

    it('job + 0 fulls → Sin fulls registrados / h-no', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'job', fullsInMonth: 0 });
      expect(component.vmHint(0)).toEqual({ text: 'Sin fulls registrados', cls: 'h-no' });
    });

    it('job + null fulls → Sin fulls registrados / h-no', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'job', fullsInMonth: null });
      expect(component.vmHint(0)).toEqual({ text: 'Sin fulls registrados', cls: 'h-no' });
    });

    it('job + 1 full → Verificar cadena de incrementales / h-warn', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'job', fullsInMonth: 1 });
      expect(component.vmHint(0)).toEqual({ text: 'Verificar cadena de incrementales', cls: 'h-warn' });
    });

    it('job + 2 fulls → 2 fulls ✓ / h-ok', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'job', fullsInMonth: 2 });
      expect(component.vmHint(0)).toEqual({ text: '2 fulls ✓', cls: 'h-ok' });
    });

    it('agent + 5 fulls → 5 fulls ✓ / h-ok', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'agent', fullsInMonth: 5 });
      expect(component.vmHint(0)).toEqual({ text: '5 fulls ✓', cls: 'h-ok' });
    });
  });

  describe('pills summaryOk / summaryWarn / summaryNo', () => {
    it('excl cuenta como ok en summaryOk', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'excluded' });
      component.vmRows.at(1).patchValue({ coverage: 'job', fullsInMonth: 2 });
      component.vmRows.at(2).patchValue({ coverage: 'no_backup' });
      expect(component.summaryOk).toBe(2);
      expect(component.summaryNo).toBe(1);
    });

    it('summaryWarn cuenta job+1 correctamente', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'job', fullsInMonth: 1 });
      component.vmRows.at(1).patchValue({ coverage: 'job', fullsInMonth: 1 });
      component.vmRows.at(2).patchValue({ coverage: 'job', fullsInMonth: 2 });
      expect(component.summaryWarn).toBe(2);
      expect(component.summaryOk).toBe(1);
    });

    it('suma de los tres pills es igual al total de VMs', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'job', fullsInMonth: 2 });
      component.vmRows.at(1).patchValue({ coverage: 'job', fullsInMonth: 1 });
      component.vmRows.at(2).patchValue({ coverage: 'no_backup' });
      expect(component.summaryOk + component.summaryWarn + component.summaryNo).toBe(3);
    });
  });

  describe('showFulls', () => {
    it('true para job', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'job' });
      expect(component.showFulls(0)).toBeTrue();
    });

    it('true para agent', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'agent' });
      expect(component.showFulls(0)).toBeTrue();
    });

    it('false para excluded', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'excluded' });
      expect(component.showFulls(0)).toBeFalse();
    });

    it('false para no_backup', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'no_backup' });
      expect(component.showFulls(0)).toBeFalse();
    });
  });

  describe('existingPayload patch', () => {
    it('parchea valores por nombre de VM al inicializar', () => {
      const payload: VeeamBackupPayload = {
        type: 'VEEAM_BACKUP',
        vms: [
          { vmName: 'DC01',     coverage: 'agent',    fullsInMonth: 4 },
          { vmName: 'SRV-FILE', coverage: 'excluded', fullsInMonth: null },
        ],
        notes: 'todo ok',
      };
      init(component, fixture, VMS, payload);
      expect(component.vmRows.at(0).get('coverage')?.value).toBe('excluded');
      expect(component.vmRows.at(0).get('fullsInMonth')?.value).toBeNull();
      expect(component.vmRows.at(1).get('coverage')?.value).toBe('agent');
      expect(component.vmRows.at(1).get('fullsInMonth')?.value).toBe(4);
      expect(component.form.get('notes')?.value).toBe('todo ok');
    });

    it('ignora VMs del payload que no están en vms[]', () => {
      const payload: VeeamBackupPayload = {
        type: 'VEEAM_BACKUP',
        vms: [{ vmName: 'VM-INEXISTENTE', coverage: 'job', fullsInMonth: 4 }],
        notes: null,
      };
      init(component, fixture, VMS, payload);
      expect(component.vmRows.length).toBe(3);
      expect(component.vmRows.at(0).get('coverage')?.value).toBe('job');
    });
  });

  describe('readOnly', () => {
    it('deshabilita el formulario cuando readOnly es true', () => {
      component.vms = VMS;
      component.readOnly = true;
      component.ngOnChanges({ vms: new SimpleChange(undefined, VMS, true) });
      fixture.detectChanges();
      expect(component.form.disabled).toBeTrue();
    });

    it('form habilitado cuando readOnly es false', () => {
      init(component, fixture);
      expect(component.form.disabled).toBeFalse();
    });
  });

  describe('saved / cancelled', () => {
    it('submit emite saved con type VEEAM_BACKUP', () => {
      init(component, fixture);
      const emitted: VeeamBackupPayload[] = [];
      component.saved.subscribe((p: VeeamBackupPayload) => emitted.push(p));
      component.submit();
      expect(emitted.length).toBe(1);
      expect(emitted[0].type).toBe('VEEAM_BACKUP');
    });

    it('cancelled emite correctamente', () => {
      init(component, fixture);
      let emitted = false;
      component.cancelled.subscribe(() => { emitted = true; });
      component.cancelled.emit();
      expect(emitted).toBeTrue();
    });
  });

  describe('buildPayload', () => {
    it('retorna una entrada por VM con nombre correcto', () => {
      init(component, fixture);
      const payload = component.buildPayload();
      expect(payload.vms.length).toBe(3);
      expect(payload.vms[0].vmName).toBe('SRV-FILE');
      expect(payload.vms[1].vmName).toBe('DC01');
      expect(payload.vms[2].vmName).toBe('APP-01');
    });

    it('excluded → fullsInMonth null en payload', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'excluded', fullsInMonth: 3 });
      expect(component.buildPayload().vms[0].fullsInMonth).toBeNull();
    });

    it('no_backup → fullsInMonth null en payload', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'no_backup', fullsInMonth: 3 });
      expect(component.buildPayload().vms[0].fullsInMonth).toBeNull();
    });

    it('notes null cuando está vacío', () => {
      init(component, fixture);
      component.form.patchValue({ notes: '' });
      expect(component.buildPayload().notes).toBeNull();
    });

    it('notes con valor cuando no está vacío', () => {
      init(component, fixture);
      component.form.patchValue({ notes: 'revisar DC01' });
      expect(component.buildPayload().notes).toBe('revisar DC01');
    });

    it('buildPayload funciona aunque el form esté deshabilitado (readOnly)', () => {
      component.vms = VMS;
      component.readOnly = true;
      component.ngOnChanges({ vms: new SimpleChange(undefined, VMS, true) });
      fixture.detectChanges();
      const payload = component.buildPayload();
      expect(payload.type).toBe('VEEAM_BACKUP');
      expect(payload.vms.length).toBe(3);
    });
  });
});
```

- [ ] **Step 2: Ejecutar los tests — verificar que fallan**

```bash
cd frontend && npx ng test --include="**/veeam-form.component.spec.ts" --watch=false
```

Esperado: múltiples fallos porque la implementación no coincide con el nuevo spec.

- [ ] **Step 3: Reemplazar veeam-form.component.ts**

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
import {
  VeeamBackupPayload,
  VeeamVmEntry,
} from '../../../../core/models/maintenance-log.models';

type VmCoverage = 'job' | 'agent' | 'excluded' | 'no_backup';
type VmRowState = 'ok' | 'warn' | 'no' | 'excl';

@Component({
  selector: 'app-veeam-form',
  templateUrl: './veeam-form.component.html',
  styleUrl: './veeam-form.component.scss',
})
export class VeeamFormComponent implements OnChanges {
  @Input() vms: { name: string; os: string }[] = [];
  @Input() existingPayload?: VeeamBackupPayload;
  @Input() readOnly = false;

  @Output() saved    = new EventEmitter<VeeamBackupPayload>();
  @Output() cancelled = new EventEmitter<void>();

  form!: FormGroup;

  constructor(private fb: FormBuilder) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['vms'] && this.vms.length) {
      this.buildForm();
      if (this.existingPayload) {
        this.patchFromPayload(this.existingPayload);
      }
      this.applyReadOnly();
    } else if (changes['existingPayload'] && this.existingPayload && this.form) {
      this.patchFromPayload(this.existingPayload);
    } else if (changes['readOnly'] && this.form) {
      this.applyReadOnly();
    }
  }

  get vmRows(): FormArray {
    return this.form.get('vmRows') as FormArray;
  }

  vmRowState(i: number): VmRowState {
    const row = this.vmRows.at(i).getRawValue() as { coverage: VmCoverage; fullsInMonth: number | null };
    if (row.coverage === 'excluded') return 'excl';
    if (row.coverage === 'no_backup') return 'no';
    const fulls = row.fullsInMonth ?? 0;
    if (fulls >= 2) return 'ok';
    if (fulls === 1) return 'warn';
    return 'no';
  }

  vmHint(i: number): { text: string; cls: string } {
    const row = this.vmRows.at(i).getRawValue() as { coverage: VmCoverage; fullsInMonth: number | null };
    if (row.coverage === 'excluded') return { text: 'Excluida ✓', cls: 'h-ok' };
    if (row.coverage === 'no_backup') return { text: 'Sin cobertura', cls: 'h-no' };
    const fulls = row.fullsInMonth ?? 0;
    if (fulls === 0) return { text: 'Sin fulls registrados', cls: 'h-no' };
    if (fulls === 1) return { text: 'Verificar cadena de incrementales', cls: 'h-warn' };
    return { text: `${fulls} fulls ✓`, cls: 'h-ok' };
  }

  showFulls(i: number): boolean {
    const cov: VmCoverage = this.vmRows.at(i).get('coverage')?.value;
    return cov === 'job' || cov === 'agent';
  }

  covClass(i: number): string {
    const s = this.vmRowState(i);
    return s === 'no' ? 'cov--no' : s === 'warn' ? 'cov--warn' : 'cov--ok';
  }

  fullsClass(i: number): string {
    const s = this.vmRowState(i);
    return s === 'ok' ? 'fulls--ok' : s === 'warn' ? 'fulls--warn' : 'fulls--no';
  }

  get summaryOk(): number {
    return this.vms.reduce((n, _, i) => {
      const s = this.vmRowState(i);
      return n + (s === 'ok' || s === 'excl' ? 1 : 0);
    }, 0);
  }

  get summaryWarn(): number {
    return this.vms.reduce((n, _, i) => n + (this.vmRowState(i) === 'warn' ? 1 : 0), 0);
  }

  get summaryNo(): number {
    return this.vms.reduce((n, _, i) => n + (this.vmRowState(i) === 'no' ? 1 : 0), 0);
  }

  onCoverageChange(i: number): void {
    const cov: VmCoverage = this.vmRows.at(i).get('coverage')?.value;
    if (cov === 'excluded' || cov === 'no_backup') {
      this.vmRows.at(i).get('fullsInMonth')?.setValue(null, { emitEvent: false });
    }
  }

  buildPayload(): VeeamBackupPayload {
    const raw = this.form.getRawValue() as { vmRows: { coverage: VmCoverage; fullsInMonth: number | null }[]; notes: string };
    const vms: VeeamVmEntry[] = this.vms.map((vm, i) => {
      const { coverage, fullsInMonth } = raw.vmRows[i];
      return {
        vmName: vm.name,
        coverage,
        fullsInMonth: (coverage === 'excluded' || coverage === 'no_backup') ? null : (fullsInMonth ?? null),
      };
    });
    return {
      type: 'VEEAM_BACKUP',
      vms,
      notes: raw.notes?.trim() || null,
    };
  }

  submit(): void {
    this.saved.emit(this.buildPayload());
  }

  private buildForm(): void {
    this.form = this.fb.group({
      vmRows: this.fb.array(
        this.vms.map(() =>
          this.fb.group({
            coverage:      ['job' as VmCoverage],
            fullsInMonth:  [null as number | null],
          })
        )
      ),
      notes: [''],
    });
  }

  private patchFromPayload(payload: VeeamBackupPayload): void {
    payload.vms.forEach(entry => {
      const idx = this.vms.findIndex(v => v.name === entry.vmName);
      if (idx === -1) return;
      this.vmRows.at(idx).patchValue({
        coverage:     entry.coverage,
        fullsInMonth: entry.fullsInMonth,
      }, { emitEvent: false });
    });
    this.form.patchValue({ notes: payload.notes ?? '' }, { emitEvent: false });
  }

  private applyReadOnly(): void {
    if (!this.form) return;
    if (this.readOnly) {
      this.form.disable({ emitEvent: false });
    } else {
      this.form.enable({ emitEvent: false });
    }
  }
}
```

- [ ] **Step 4: Ejecutar los tests — verificar que pasan**

```bash
cd frontend && npx ng test --include="**/veeam-form.component.spec.ts" --watch=false
```

Esperado: todos los tests pasan.

- [ ] **Step 5: Reemplazar veeam-form.component.html**

Reemplazar el archivo completo con:

```html
<form [formGroup]="form" class="vf">

  <!-- ── VMs del entorno ───────────────────────────── -->
  <div class="vf-section-lbl">VMs del entorno</div>

  <div class="vf-summary">
    <span class="vf-pill" [class.p-ok]="summaryOk > 0">{{ summaryOk }} OK</span>
    <span class="vf-pill" [class.p-warn]="summaryWarn > 0">{{ summaryWarn }} Advertencia</span>
    <span class="vf-pill" [class.p-crit]="summaryNo > 0">{{ summaryNo }} Sin cobertura</span>
  </div>

  <div class="vf-vm-list" formArrayName="vmRows">
    <div
      *ngFor="let _ of vmRows.controls; let i = index"
      class="vf-vm-row"
      [ngClass]="'st-' + vmRowState(i)"
      [formGroupName]="i">

      <div class="vf-stripe"></div>

      <div class="vf-inner">
        <span class="vf-vm-name">{{ vms[i].name }}</span>
        <span class="vf-vm-os">{{ vms[i].os }}</span>

        <mat-form-field appearance="outline" subscriptSizing="dynamic"
                        class="vf-cov-ff" [ngClass]="covClass(i)">
          <mat-select formControlName="coverage" (selectionChange)="onCoverageChange(i)">
            <mat-option value="job">Job</mat-option>
            <mat-option value="agent">Agent</mat-option>
            <mat-option value="excluded">Excluida</mat-option>
            <mat-option value="no_backup">Sin backup</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field *ngIf="showFulls(i)" appearance="outline" subscriptSizing="dynamic"
                        class="vf-fulls-ff" [ngClass]="fullsClass(i)">
          <input matInput type="number" min="0" formControlName="fullsInMonth" />
        </mat-form-field>

        <span class="vf-hint" [ngClass]="vmHint(i).cls">{{ vmHint(i).text }}</span>
      </div>

    </div>
  </div>

  <!-- ── Observaciones ─────────────────────────────── -->
  <div class="vf-section-lbl">Observaciones</div>

  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="vf-notes-ff">
    <textarea matInput formControlName="notes" rows="3"
              placeholder="Notas del control, problemas detectados, acciones pendientes..."></textarea>
  </mat-form-field>

  <!-- ── Footer ────────────────────────────────────── -->
  <div class="vf-footer">
    <button mat-stroked-button type="button" (click)="cancelled.emit()">Cancelar</button>
    <button mat-flat-button color="primary" type="button" (click)="submit()">Guardar control</button>
  </div>

</form>
```

- [ ] **Step 6: Reemplazar veeam-form.component.scss**

Reemplazar el archivo completo con:

```scss
.vf {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.vf-section-lbl {
  font-size: 9px;
  font-weight: 600;
  color: var(--tx-lo);
  letter-spacing: 0.6px;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 8px;

  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border-lo);
  }
}

.vf-summary {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
  margin-top: -8px;
}

.vf-pill {
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 9px;
  font-family: var(--font-mono);
  font-weight: 500;
  border: 1px solid var(--border);
  color: var(--tx-lo);
  background: var(--card);

  &.p-ok   { background: var(--ok-bg);   border-color: var(--ok-bd);   color: var(--ok);   }
  &.p-warn { background: var(--warn-bg); border-color: var(--warn-bd); color: var(--warn); }
  &.p-crit { background: var(--crit-bg); border-color: var(--crit-bd); color: var(--crit); }
}

.vf-vm-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: -8px;
}

.vf-vm-row {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  overflow: hidden;

  &.st-ok   { border-color: var(--ok-bd);   }
  &.st-warn { border-color: var(--warn-bd); }
  &.st-no   { border-color: var(--crit-bd); }
}

.vf-stripe {
  width: 3px;
  align-self: stretch;
  flex-shrink: 0;
  background: var(--border-md);

  .st-ok   & { background: var(--ok);   }
  .st-warn & { background: var(--warn); }
  .st-no   & { background: var(--crit); }
}

.vf-inner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 11px;
  flex: 1;
  min-width: 0;
}

.vf-vm-name {
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font-mono);
  color: var(--tx-hi);
  min-width: 90px;
  flex-shrink: 0;
}

.vf-vm-os {
  font-size: 9px;
  color: var(--tx-lo);
  font-family: var(--font-mono);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vf-cov-ff {
  width: 110px;
  flex-shrink: 0;
}

.vf-fulls-ff {
  width: 64px;
  flex-shrink: 0;

  input { text-align: center; }
}

.vf-hint {
  font-size: 9px;
  font-family: var(--font-mono);
  color: var(--tx-lo);
  white-space: nowrap;
  flex-shrink: 0;

  &.h-ok   { color: var(--ok);   }
  &.h-warn { color: var(--warn); }
  &.h-no   { color: var(--crit); }
}

.vf-notes-ff { width: 100%; }

.vf-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
}

// Coverage select coloring via CSS custom properties (sin ::ng-deep)
mat-form-field.cov--ok {
  --mdc-outlined-text-field-outline-color: var(--ok-bd);
  --mat-select-trigger-text-color: var(--ok);
}
mat-form-field.cov--warn {
  --mdc-outlined-text-field-outline-color: var(--warn-bd);
  --mat-select-trigger-text-color: var(--warn);
}
mat-form-field.cov--no {
  --mdc-outlined-text-field-outline-color: var(--crit-bd);
  --mat-select-trigger-text-color: var(--crit);
}

// Fulls input coloring
mat-form-field.fulls--ok {
  --mdc-outlined-text-field-outline-color: var(--ok-bd);
  --mdc-outlined-text-field-input-text-color: var(--ok);
}
mat-form-field.fulls--warn {
  --mdc-outlined-text-field-outline-color: var(--warn-bd);
  --mdc-outlined-text-field-input-text-color: var(--warn);
}
mat-form-field.fulls--no {
  --mdc-outlined-text-field-outline-color: var(--crit-bd);
  --mdc-outlined-text-field-input-text-color: var(--crit);
}
```

- [ ] **Step 7: Ejecutar los tests — verificar que siguen pasando**

```bash
cd frontend && npx ng test --include="**/veeam-form.component.spec.ts" --watch=false
```

Esperado: todos los tests pasan.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/features/technician/task-drawer/veeam-form/
git commit -m "feat(veeam-form): rediseño v2 — control por VM con cobertura, fulls y hints de estado"
```

---

## Task 3: Actualizar integración en TaskDrawerComponent

**Files:**
- Modify: `frontend/src/app/features/technician/task-drawer/task-drawer.component.ts`
- Modify: `frontend/src/app/features/technician/task-drawer/task-drawer.component.html`

**Interfaces:**
- Consumes: `VeeamBackupPayload` de Task 1, API `app-veeam-form` de Task 2
- Produces: drawer funcional end-to-end para tareas `VEEAM_BACKUP`

- [ ] **Step 1: Agregar getters y actualizar imports en task-drawer.component.ts**

En el bloque de imports existente, agregar `VeeamBackupPayload` si no está:

```typescript
import {
  MaintenancePayload,
  ServerMaintenancePayload,
  VeeamBackupPayload,
} from '../../../core/models/maintenance-log.models';
```

Luego, dentro de la clase `TaskDrawerComponent`, agregar los dos getters después del getter `odooLink`:

```typescript
get veeamVms(): { name: string; os: string }[] {
  if (!this.infrastructure) return [];
  return [
    ...this.infrastructure.windowsVMs,
    ...this.infrastructure.domainControllers,
    ...this.infrastructure.linuxVMs,
  ].map(v => ({ name: v.name, os: v.os ?? '—' }));
}

get veeamPayload(): VeeamBackupPayload | undefined {
  return this.savedPayload?.type === 'VEEAM_BACKUP'
    ? (this.savedPayload as VeeamBackupPayload)
    : undefined;
}
```

- [ ] **Step 2: Actualizar el binding de app-veeam-form en task-drawer.component.html**

Reemplazar el bloque actual:

```html
<!-- Formulario VEEAM BACKUP -->
<app-veeam-form
  *ngIf="infrastructure && task.type === 'VEEAM_BACKUP'"
  [task]="task"
  [infrastructure]="infrastructure"
  [savedPayload]="savedPayload"
  [readOnly]="!isActiveTask"
  (requestComplete)="onRequestComplete($event)"
  (requestNotDone)="onRequestNotDone()">
</app-veeam-form>
```

Con:

```html
<!-- Formulario VEEAM BACKUP -->
<app-veeam-form
  *ngIf="infrastructure && task.type === 'VEEAM_BACKUP'"
  [vms]="veeamVms"
  [existingPayload]="veeamPayload"
  [readOnly]="!isActiveTask"
  (saved)="onRequestComplete($event)"
  (cancelled)="drawerClosed.emit()">
</app-veeam-form>
```

- [ ] **Step 3: Actualizar el footer VEEAM_BACKUP en task-drawer.component.html**

Reemplazar el bloque actual:

```html
<!-- VEEAM_BACKUP -->
<ng-container *ngIf="task.type === 'VEEAM_BACKUP'">
  <button mat-flat-button color="primary" (click)="triggerFormComplete()">Completar mantenimiento</button>
  <button mat-stroked-button color="warn" (click)="onRequestNotDone()">No concretada</button>
  <button mat-stroked-button (click)="drawerClosed.emit()">Cerrar</button>
</ng-container>
```

Con:

```html
<!-- VEEAM_BACKUP — botones Guardar/Cancelar los maneja el form internamente -->
<ng-container *ngIf="task.type === 'VEEAM_BACKUP'">
  <button mat-stroked-button color="warn" (click)="onRequestNotDone()">No concretada</button>
</ng-container>
```

- [ ] **Step 4: Verificar compilación TypeScript**

```bash
cd frontend && npx ng build --configuration=development 2>&1 | head -40
```

Esperado: sin errores de tipo. Si hay errores por el cambio de `VeeamBackupPayload`, son por referencias al modelo viejo — buscarlas con:

```bash
grep -rn "uncoveredVMs\|VeeamJobEntry" frontend/src/app --include="*.ts" | grep -v "node_modules"
```

Cualquier referencia a `uncoveredVMs` o `VeeamJobEntry` en el contexto de `VEEAM_BACKUP` (no de `ServerMaintenancePayload`) debe actualizarse.

- [ ] **Step 5: Ejecutar el suite completo de tests**

```bash
cd frontend && npx ng test --watch=false
```

Esperado: todos los tests existentes pasan. Si algún test del drawer o del maintenance-log.models.spec.ts falla por el cambio de modelo, ajustarlo para usar la nueva estructura.

- [ ] **Step 6: Commit final**

```bash
git add frontend/src/app/features/technician/task-drawer/task-drawer.component.ts
git add frontend/src/app/features/technician/task-drawer/task-drawer.component.html
git commit -m "feat(task-drawer): integrar VeeamFormComponent v2 — binding por VM, footer simplificado"
```
