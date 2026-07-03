# Windows Server Row Redesign + Script Reinicio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el diseño de tabla grilla de servidores Windows en `maintenance-form` por tarjetas estilo Veeam, y agregar la columna "Script reinicio" con estados ok/error/no_task.

**Architecture:** El componente `MaintenanceFormComponent` tiene la sección de servidores actualmente como grilla CSS con header fijo. Se reemplaza por una lista de tarjetas con stripe lateral coloreado (idéntico al patrón de `VeeamFormComponent`). Se agrega un campo `restartScript` al modelo `WindowsServerEntry` y al formulario reactivo. El estado visual del row combina el peor valor entre `updates` y `restartScript`.

**Tech Stack:** Angular 19, Angular Material, Reactive Forms, SCSS con CSS custom properties, Jest/Karma.

## Global Constraints

- Sin standalone components — módulo Angular tradicional
- Angular Material obligatorio para todos los elementos interactivos
- `appearance="outline"` en todos los `mat-form-field`
- Sin `::ng-deep` — coloring via CSS custom properties
- TDD: test antes que implementación
- Un commit por task
- Tests en `maintenance-form.component.spec.ts` — NO crear nuevo archivo de spec
- El campo `notes` de `WindowsServerEntry` se mantiene en el modelo (compatibilidad) pero no aparece en el form
- El branch de trabajo es `feature/windows-server-row-redesign` (crear antes de empezar)

---

## Archivos

| Archivo | Acción |
|---|---|
| `frontend/src/app/core/models/maintenance-log.models.ts` | Modificar — agregar `restartScript` a `WindowsServerEntry` |
| `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.ts` | Modificar — form, helpers, summary getters, payload |
| `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.html` | Modificar — reemplazar sección servidores |
| `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.scss` | Modificar — reemplazar estilos de tabla por estilos de tarjeta |
| `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.spec.ts` | Modificar — actualizar tests |

---

### Task 1: Crear branch y agregar `restartScript` al modelo

**Files:**
- Modify: `frontend/src/app/core/models/maintenance-log.models.ts`

**Interfaces:**
- Produces: `WindowsServerEntry` con campo `restartScript: 'ok' | 'error' | 'no_task'`

- [ ] **Step 1: Crear el branch**

```bash
git checkout -b feature/windows-server-row-redesign
```

- [ ] **Step 2: Modificar `WindowsServerEntry` en `maintenance-log.models.ts`**

Localizar la interfaz (línea ~24) y reemplazarla:

```typescript
export interface WindowsServerEntry {
  serverId:      number;
  serverName:    string;
  updates:       'ok' | 'pending' | 'failed';
  restartScript: 'ok' | 'error' | 'no_task';
  notes?:        string;
}
```

- [ ] **Step 3: Verificar que compila sin errores**

```bash
cd frontend && npx tsc --noEmit
```

Expected: sin errores de tipo. Si hay errores de "Property 'restartScript' is missing", se corrigen en Task 2.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/core/models/maintenance-log.models.ts
git commit -m "feat(models): agregar restartScript a WindowsServerEntry"
```

---

### Task 2: Actualizar componente TS — form, helpers, summary y payload

**Files:**
- Modify: `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.ts`
- Test: `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.spec.ts`

**Interfaces:**
- Consumes: `WindowsServerEntry.restartScript: 'ok' | 'error' | 'no_task'` (Task 1)
- Produces:
  - `serverRowState(i: number): 'ok' | 'warn' | 'crit'` — usado en template con `'st-' + serverRowState(i)`
  - `summaryOk: number`, `summaryWarn: number`, `summaryCrit: number` — para las pills
  - `serverControls` FormArray con grupos `{ updates, restartScript }` (sin `notes`, sin `expanded`)
  - `buildPayload()` incluye `restartScript` en cada `WindowsServerEntry`
  - `selectClass(value)` mapea `'no_task'` a `'mf-sel--warn'`

- [ ] **Step 1: Escribir los tests que fallarán**

En `maintenance-form.component.spec.ts`, agregar los siguientes bloques después del bloque `serverRowClass` existente (línea ~429). Los bloques existentes de `serverRowClass` deben actualizarse también.

**Reemplazar el bloque `serverRowClass` existente (líneas ~411-429) por:**

```typescript
describe('serverRowState', () => {
  it('retorna ok cuando updates y restartScript son ok', () => {
    init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }));
    component.serverControls.at(0).patchValue({ updates: 'ok', restartScript: 'ok' });
    expect(component.serverRowState(0)).toBe('ok');
  });

  it('retorna warn cuando updates es pending y restartScript es ok', () => {
    init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }));
    component.serverControls.at(0).patchValue({ updates: 'pending', restartScript: 'ok' });
    expect(component.serverRowState(0)).toBe('warn');
  });

  it('retorna warn cuando updates es ok y restartScript es no_task', () => {
    init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }));
    component.serverControls.at(0).patchValue({ updates: 'ok', restartScript: 'no_task' });
    expect(component.serverRowState(0)).toBe('warn');
  });

  it('retorna crit cuando updates es failed', () => {
    init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }));
    component.serverControls.at(0).patchValue({ updates: 'failed', restartScript: 'ok' });
    expect(component.serverRowState(0)).toBe('crit');
  });

  it('retorna crit cuando restartScript es error', () => {
    init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }));
    component.serverControls.at(0).patchValue({ updates: 'ok', restartScript: 'error' });
    expect(component.serverRowState(0)).toBe('crit');
  });

  it('retorna crit cuando ambos son crit', () => {
    init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }));
    component.serverControls.at(0).patchValue({ updates: 'failed', restartScript: 'error' });
    expect(component.serverRowState(0)).toBe('crit');
  });
});
```

**Agregar bloque de summary getters después:**

```typescript
describe('summary getters', () => {
  function makeMultiVMInfra(): ClientInfrastructure {
    return makeInfra({
      esxiHosts: [], nas: [], routers: [],
      windowsVMs: [
        { assetId: 1, name: 'SRV-A', ip: null, bmcIp: null, bmcType: null, os: null, model: null, uri1: null, uri2: null },
        { assetId: 2, name: 'SRV-B', ip: null, bmcIp: null, bmcType: null, os: null, model: null, uri1: null, uri2: null },
        { assetId: 3, name: 'SRV-C', ip: null, bmcIp: null, bmcType: null, os: null, model: null, uri1: null, uri2: null },
      ],
    });
  }

  it('summaryOk cuenta servidores con ambos campos en ok', () => {
    init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), makeMultiVMInfra());
    component.serverControls.at(0).patchValue({ updates: 'ok',     restartScript: 'ok'   });
    component.serverControls.at(1).patchValue({ updates: 'ok',     restartScript: 'ok'   });
    component.serverControls.at(2).patchValue({ updates: 'pending', restartScript: 'ok'  });
    expect(component.summaryOk).toBe(2);
  });

  it('summaryWarn cuenta servidores con estado warn', () => {
    init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), makeMultiVMInfra());
    component.serverControls.at(0).patchValue({ updates: 'ok',      restartScript: 'ok'      });
    component.serverControls.at(1).patchValue({ updates: 'pending', restartScript: 'ok'      });
    component.serverControls.at(2).patchValue({ updates: 'ok',      restartScript: 'no_task' });
    expect(component.summaryWarn).toBe(2);
  });

  it('summaryCrit cuenta servidores con estado crit', () => {
    init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), makeMultiVMInfra());
    component.serverControls.at(0).patchValue({ updates: 'failed', restartScript: 'ok'   });
    component.serverControls.at(1).patchValue({ updates: 'ok',     restartScript: 'error' });
    component.serverControls.at(2).patchValue({ updates: 'ok',     restartScript: 'ok'   });
    expect(component.summaryCrit).toBe(2);
  });
});
```

**Actualizar el test de payload (en bloque `buildPayload — WINDOWS_DOMAIN_MAINTENANCE`) para verificar `restartScript`:**

Reemplazar el test "should include windows.servers with updates per VM" (línea ~160) por:

```typescript
it('should include windows.servers with updates and restartScript per VM', () => {
  const infra = makeInfra({ esxiHosts: [], nas: [], routers: [] });
  init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), infra);
  component.serverControls.at(0).patchValue({ updates: 'ok', restartScript: 'error' });
  const payload = component.buildPayload() as WindowsDomainPayload;
  expect(payload.windows.servers.length).toBe(1);
  expect(payload.windows.servers[0].serverName).toBe('47DC');
  expect(payload.windows.servers[0].updates).toBe('ok');
  expect(payload.windows.servers[0].restartScript).toBe('error');
});
```

**Agregar test de patch `restartScript` desde payload guardado** (dentro de `patchFormFromPayload via savedPayload input`):

```typescript
it('parchea restartScript del servidor desde payload guardado', () => {
  const saved: WindowsDomainPayload = {
    type: 'WINDOWS_DOMAIN_MAINTENANCE',
    windows: {
      servers: [{ serverId: 3, serverName: '47DC', updates: 'ok', restartScript: 'no_task' }],
      domainControllers: [],
    },
  };
  initWithSavedPayload(
    makeTask('WINDOWS_DOMAIN_MAINTENANCE'),
    makeInfra({ esxiHosts: [], nas: [], routers: [] }),
    saved,
  );
  expect(component.serverControls.at(0).get('restartScript')?.value).toBe('no_task');
});

it('usa ok como default de restartScript cuando no está en el payload guardado', () => {
  const saved: WindowsDomainPayload = {
    type: 'WINDOWS_DOMAIN_MAINTENANCE',
    windows: {
      servers: [{ serverId: 3, serverName: '47DC', updates: 'pending', restartScript: undefined as any }],
      domainControllers: [],
    },
  };
  initWithSavedPayload(
    makeTask('WINDOWS_DOMAIN_MAINTENANCE'),
    makeInfra({ esxiHosts: [], nas: [], routers: [] }),
    saved,
  );
  expect(component.serverControls.at(0).get('restartScript')?.value).toBe('ok');
});
```

**Agregar test para `selectClass` con `no_task`** (dentro del bloque `selectClass`):

```typescript
it('should return mf-sel--warn for "no_task"', () => {
  init(makeTask(), makeInfra());
  expect(component.selectClass('no_task')).toBe('mf-sel--warn');
});
```

- [ ] **Step 2: Verificar que los nuevos tests fallan**

```bash
cd frontend && npx ng test --include="**/maintenance-form.component.spec.ts" --watch=false --browsers=ChromeHeadless 2>&1 | tail -40
```

Expected: múltiples FAILED — `serverRowState is not a function`, `summaryOk is not a property`, etc.

- [ ] **Step 3: Implementar los cambios en el componente TS**

Reemplazar el contenido completo de `maintenance-form.component.ts` con:

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
  DcHealthSnapshot,
  MaintenancePayload,
  TerminalPayload,
  WindowsDomainPayload,
} from '../../../../core/models/maintenance-log.models';

type ServerRowState = 'ok' | 'warn' | 'crit';

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

  @Output() requestComplete = new EventEmitter<WindowsDomainPayload | TerminalPayload>();
  @Output() requestSave     = new EventEmitter<WindowsDomainPayload | TerminalPayload>();
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
      this.applyReadOnlyState();
    } else if (changes['readOnly'] && this.form) {
      this.applyReadOnlyState();
    }
  }

  // ── Getters condicionales ────────────────────────────────────────────────────

  get hasServers(): boolean { return this.infrastructure?.windowsVMs?.length > 0; }

  get allVMs() {
    return [
      ...(this.infrastructure?.windowsVMs ?? []),
      ...(this.infrastructure?.domainControllers ?? []),
      ...(this.infrastructure?.linuxVMs ?? []),
    ];
  }

  get serverControls(): FormArray {
    return this.form.get('servers') as FormArray;
  }

  get dcControls(): FormArray {
    return this.form.get('domainControllers') as FormArray;
  }

  get hasDomainControllers(): boolean {
    return (this.infrastructure?.domainControllers?.length ?? 0) > 0;
  }

  get isTerminalType(): boolean {
    return this.task?.type === 'TERMINAL_MAINTENANCE' || this.task?.type === 'SITE_VISIT';
  }

  get isServerType(): boolean {
    return this.task?.type === 'WINDOWS_DOMAIN_MAINTENANCE';
  }

  get isUnsupported(): boolean {
    return this.task?.type === 'AV_CONTROL'
      || this.task?.type === 'UPS_CONTROL'
      || this.task?.type === 'ENDPOINT_INVENTORY';
  }

  // ── Summary getters ──────────────────────────────────────────────────────────

  get summaryOk(): number {
    return this.infrastructure?.windowsVMs?.reduce((n, _, i) =>
      n + (this.serverRowState(i) === 'ok' ? 1 : 0), 0) ?? 0;
  }

  get summaryWarn(): number {
    return this.infrastructure?.windowsVMs?.reduce((n, _, i) =>
      n + (this.serverRowState(i) === 'warn' ? 1 : 0), 0) ?? 0;
  }

  get summaryCrit(): number {
    return this.infrastructure?.windowsVMs?.reduce((n, _, i) =>
      n + (this.serverRowState(i) === 'crit' ? 1 : 0), 0) ?? 0;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  selectClass(value: string): string {
    if (!value) return 'mf-sel--na';
    if (value === 'ok' || value === 'OK') return 'mf-sel--ok';
    if (value === 'pending' || value === 'degraded' || value === 'falta_configurar'
        || value === 'ERROR Systemlog' || value === 'no_task') return 'mf-sel--warn';
    if (value === 'error' || value === 'failed' || value === 'ERROR' || value === 'alerta') return 'mf-sel--crit';
    return 'mf-sel--na';
  }

  serverRowState(i: number): ServerRowState {
    const group = this.getServerGroup(i);
    const updates      = group.get('updates')?.value      ?? 'ok';
    const restartScript = group.get('restartScript')?.value ?? 'ok';
    const isCrit = updates === 'failed' || restartScript === 'error';
    const isWarn = updates === 'pending' || restartScript === 'no_task';
    if (isCrit) return 'crit';
    if (isWarn) return 'warn';
    return 'ok';
  }

  getServerGroup(index: number): FormGroup {
    return this.serverControls.at(index) as FormGroup;
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
          updates:       ['ok'],
          restartScript: ['ok'],
        }))
      ),
      domainControllers: this.fb.array(
        (this.infrastructure.domainControllers ?? []).map(() =>
          this.fb.group({ rawJson: [''] })
        )
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

  // ── Payload construction ────────────────────────────────────────────────────

  buildPayload(): WindowsDomainPayload | TerminalPayload {
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
      serverId:      vm.assetId,
      serverName:    vm.name,
      updates:       v.servers[i]?.updates       ?? 'ok',
      restartScript: v.servers[i]?.restartScript ?? 'ok',
    }));

    const payload: WindowsDomainPayload = {
      type: 'WINDOWS_DOMAIN_MAINTENANCE',
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

    return payload;
  }

  private patchFormFromPayload(payload: MaintenancePayload): void {
    if (payload.type === 'WINDOWS_DOMAIN_MAINTENANCE') {
      const srv = payload as WindowsDomainPayload;

      this.form.patchValue({ notes: srv.notes ?? '' });

      if (srv.windows.servers?.length) {
        this.infrastructure.windowsVMs.forEach((vm, i) => {
          const saved = srv.windows.servers.find(s => s.serverId === vm.assetId);
          if (saved) {
            this.serverControls.at(i).patchValue({
              updates:       saved.updates,
              restartScript: saved.restartScript ?? 'ok',
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

- [ ] **Step 4: Correr los tests y verificar que pasan**

```bash
cd frontend && npx ng test --include="**/maintenance-form.component.spec.ts" --watch=false --browsers=ChromeHeadless 2>&1 | tail -40
```

Expected: todos los tests PASSED. Si alguno falla por `serverRowClass` (método renombrado), verificar que el spec lo referencia como `serverRowState`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.ts \
        frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.spec.ts
git commit -m "feat(maintenance-form): agregar restartScript, serverRowState y summary getters"
```

---

### Task 3: Actualizar template HTML — tarjetas estilo Veeam

**Files:**
- Modify: `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.html`

**Interfaces:**
- Consumes: `serverRowState(i): 'ok'|'warn'|'crit'`, `summaryOk`, `summaryWarn`, `summaryCrit`, `selectClass(v)` (Task 2)
- Consumes: `serverControls` FormArray con grupos `{ updates, restartScript }` (Task 2)

- [ ] **Step 1: Reemplazar la sección de servidores Windows en el template**

En `maintenance-form.component.html`, reemplazar solo el bloque entre `<!-- ── Servidores Windows` y su `</ng-container>` de cierre (líneas 3-68 aprox., antes de `<!-- ── Controladores de dominio`). El `<form>` externo y el resto del template no se tocan.

Reemplazar por:

```html
  <!-- ── Servidores Windows ─────────────────────────────── -->
  <ng-container *ngIf="hasServers">

    <div class="mf-section-lbl">Servidores</div>

    <div class="mf-srv-summary">
      <span class="mf-srv-pill" [class.p-ok]="summaryOk > 0">{{ summaryOk }} OK</span>
      <span class="mf-srv-pill" [class.p-warn]="summaryWarn > 0">{{ summaryWarn }} Advertencia</span>
      <span class="mf-srv-pill" [class.p-crit]="summaryCrit > 0">{{ summaryCrit }} Error</span>
    </div>

    <div class="mf-srv-list" formArrayName="servers">
      <div
        *ngFor="let _ of serverControls.controls; let i = index"
        class="mf-srv-row"
        [ngClass]="'st-' + serverRowState(i)"
        [formGroupName]="i">

        <div class="mf-srv-stripe"></div>

        <div class="mf-srv-inner">
          <div class="mf-srv-name-cell">
            <span class="mf-srv-name">{{ infrastructure.windowsVMs[i].name }}</span>
            <span class="mf-srv-ip">{{ infrastructure.windowsVMs[i].ip ?? '—' }}</span>
          </div>

          <mat-form-field appearance="outline" subscriptSizing="dynamic"
                          class="mf-srv-ff" [ngClass]="selectClass(getServerGroup(i).get('updates')?.value)">
            <mat-select formControlName="updates">
              <mat-option value="ok">Al día</mat-option>
              <mat-option value="pending">Pendientes</mat-option>
              <mat-option value="failed">Error</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" subscriptSizing="dynamic"
                          class="mf-srv-rs-ff" [ngClass]="selectClass(getServerGroup(i).get('restartScript')?.value)">
            <mat-select formControlName="restartScript">
              <mat-option value="ok">Ejecutándose ✓</mat-option>
              <mat-option value="no_task">Sin tarea</mat-option>
              <mat-option value="error">Error de ejecución</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

      </div>
    </div>

  </ng-container>
```

- [ ] **Step 2: Verificar que el template compila sin errores**

```bash
cd frontend && npx ng build --configuration development 2>&1 | tail -20
```

Expected: `Build at: ... - Hash: ...` sin errores de template.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.html
git commit -m "feat(maintenance-form): reemplazar tabla de servidores por tarjetas estilo Veeam"
```

---

### Task 4: Actualizar SCSS — estilos de tarjeta estilo Veeam

**Files:**
- Modify: `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.scss`

**Interfaces:**
- Consumes: clases generadas en template: `.mf-srv-list`, `.mf-srv-row.st-ok/warn/crit`, `.mf-srv-stripe`, `.mf-srv-inner`, `.mf-srv-name-cell`, `.mf-srv-name`, `.mf-srv-ip`, `.mf-srv-ff`, `.mf-srv-rs-ff`, `.mf-srv-summary`, `.mf-srv-pill`

- [ ] **Step 1: Reemplazar el bloque `// ── Server table` en el SCSS**

En `maintenance-form.component.scss`, localizar el bloque `// ── Server table ───...` (línea ~149) y reemplazar **desde ese comentario hasta el final del bloque de estilos de server** (incluye `.mf-srv-table`, `.mf-srv-head`, `.mf-srv-th`, `.mf-srv-row`, `.mf-srv-icon`, `.mf-srv-name-cell`, `.mf-srv-name`, `.mf-srv-access`, `button.mf-expand-btn`, `.mf-expand-panel`, `.mf-expand-detail`, `.mf-expand-os`) por:

```scss
// ── Server summary pills ────────────────────────────────────────────────────
.mf-srv-summary {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
  margin-top: -4px;
}

.mf-srv-pill {
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

// ── Server list (Veeam-style cards) ────────────────────────────────────────
.mf-srv-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: -4px;
}

.mf-srv-row {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  overflow: hidden;

  &.st-ok   { border-color: var(--ok-bd); }
  &.st-warn { border-color: var(--warn-bd); background: color-mix(in srgb, var(--warn) 5%, transparent); }
  &.st-crit { border-color: var(--crit-bd); background: color-mix(in srgb, var(--crit) 5%, transparent); }
}

.mf-srv-stripe {
  width: 3px;
  align-self: stretch;
  flex-shrink: 0;
  background: var(--border-md);

  .st-ok   & { background: var(--ok);   }
  .st-warn & { background: var(--warn); }
  .st-crit & { background: var(--crit); }
}

.mf-srv-inner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  flex: 1;
  min-width: 0;
}

.mf-srv-name-cell {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.mf-srv-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--tx-hi);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mf-srv-ip {
  font-size: 9px;
  color: var(--tx-lo);
  font-family: var(--font-mono);
}

mat-form-field.mf-srv-ff {
  width: 110px;
  flex-shrink: 0;

  --mat-form-field-container-height:           28px;
  --mat-form-field-container-vertical-padding: 4px;
  --mdc-outlined-text-field-outline-color:          var(--border);
  --mdc-outlined-text-field-hover-outline-color:    var(--border-md);
  --mdc-outlined-text-field-focus-outline-color:    var(--accent-bd);
  --mat-select-trigger-text-color:                  var(--tx-hi);
  --mat-select-trigger-text-size:                   10px;
}

mat-form-field.mf-srv-rs-ff {
  width: 140px;
  flex-shrink: 0;

  --mat-form-field-container-height:           28px;
  --mat-form-field-container-vertical-padding: 4px;
  --mdc-outlined-text-field-outline-color:          var(--border);
  --mdc-outlined-text-field-hover-outline-color:    var(--border-md);
  --mdc-outlined-text-field-focus-outline-color:    var(--accent-bd);
  --mat-select-trigger-text-color:                  var(--tx-hi);
  --mat-select-trigger-text-size:                   10px;
}
```

- [ ] **Step 2: Build final y verificar sin errores**

```bash
cd frontend && npx ng build --configuration development 2>&1 | tail -20
```

Expected: build exitoso sin errores.

- [ ] **Step 3: Correr todos los tests del módulo**

```bash
cd frontend && npx ng test --include="**/maintenance-form.component.spec.ts" --watch=false --browsers=ChromeHeadless 2>&1 | tail -20
```

Expected: todos PASSED.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.scss
git commit -m "feat(maintenance-form): aplicar estilos Veeam a lista de servidores Windows"
```
