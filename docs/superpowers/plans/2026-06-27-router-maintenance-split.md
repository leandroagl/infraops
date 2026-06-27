# Router Maintenance Split — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extraer la sección Router/Firewall de `WINDOWS_DOMAIN_MAINTENANCE` como tipo de tarea independiente `ROUTER_MAINTENANCE`, con su propio componente `RouterFormComponent` y payload `RouterMaintenancePayload`.

**Architecture:** Nuevo `RouterFormComponent` replica el patrón de `ServerHostFormComponent` — inputs `task/infrastructure/savedPayload/readOnly`, outputs `requestComplete/requestSave/requestNotDone`, emite `RouterMaintenancePayload`. `MaintenanceFormComponent` pierde la sección router. `TaskDrawerComponent` enruta el nuevo tipo. Backend agrega enum value + migración.

**Tech Stack:** NestJS + TypeORM (PostgreSQL), Angular 19 + Angular Material + Reactive Forms (sin standalone components), Jest (backend), Angular TestBed unit tests (frontend).

## Global Constraints

- Sin standalone Angular components — todos declarados en `TechnicianModule`
- Angular Material exclusivamente — sin `<input>`, `<select>`, `<button>` nativos en templates
- `appearance="outline"` en todos los `mat-form-field`
- TDD — test fallando primero, luego implementación
- Un archivo a la vez — commit después de cada tarea
- `transaction = false` en migraciones que usen `ALTER TYPE ADD VALUE`
- Backend tests: `cd E:/develop/infraops/backend && npm test`
- Frontend tests: `cd E:/develop/infraops/frontend && npx ng test --watch=false --browsers=ChromeHeadless`

---

## File Map

| Archivo | Acción |
|---|---|
| `backend/src/tasks/task-type.enum.ts` | Modify — agrega `ROUTER_MAINTENANCE` |
| `backend/src/migrations/1782604800000-AddRouterMaintenanceTaskType.ts` | Create — migración |
| `backend/src/maintenance-logs/log-item.interface.ts` | Modify — agrega `RouterEntry` + `RouterMaintenancePayload`, actualiza `MaintenancePayload` union, elimina `router?` de `WindowsDomainPayload` |
| `frontend/src/app/core/models/task.models.ts` | Modify — agrega `'ROUTER_MAINTENANCE'` al union |
| `frontend/src/app/core/models/maintenance-log.models.ts` | Modify — agrega `RouterMaintenancePayload`, actualiza `MaintenancePayload` union, elimina `router?` de `WindowsDomainPayload` |
| `frontend/src/app/shared/utils/task-labels.ts` | Modify — labels para `ROUTER_MAINTENANCE` |
| `frontend/src/app/shared/utils/task-labels.spec.ts` | Modify — casos de test |
| `frontend/.../router-form/router-form.component.ts` | Create |
| `frontend/.../router-form/router-form.component.html` | Create |
| `frontend/.../router-form/router-form.component.scss` | Create |
| `frontend/.../router-form/router-form.component.spec.ts` | Create |
| `frontend/.../technician.module.ts` | Modify — declara `RouterFormComponent` |
| `frontend/.../maintenance-form/maintenance-form.component.ts` | Modify — elimina router |
| `frontend/.../maintenance-form/maintenance-form.component.html` | Modify — elimina sección router |
| `frontend/.../maintenance-form/maintenance-form.component.spec.ts` | Modify — actualiza referencias |
| `frontend/.../task-drawer/task-drawer.component.ts` | Modify — ViewChild + detectIssues |
| `frontend/.../task-drawer/task-drawer.component.html` | Modify — routing + footer |
| `frontend/.../task-drawer/task-drawer.component.spec.ts` | Modify — actualiza mocks |

---

## Task 1: Backend — Enum, migración, payload

**Files:**
- Modify: `backend/src/tasks/task-type.enum.ts`
- Create: `backend/src/migrations/1782604800000-AddRouterMaintenanceTaskType.ts`
- Modify: `backend/src/maintenance-logs/log-item.interface.ts`

**Interfaces:**
- Produce: `RouterEntry { routerId, routerName, firmwareUpdated, firmwareVersion?, backupDone }` y `RouterMaintenancePayload { type: 'ROUTER_MAINTENANCE', router: RouterEntry[], notes? }` en `log-item.interface.ts`

- [ ] **Step 1: Agregar `ROUTER_MAINTENANCE` al enum del backend**

Archivo: `backend/src/tasks/task-type.enum.ts`

```typescript
export enum TaskType {
  SERVER_MAINTENANCE         = 'SERVER_MAINTENANCE',
  SERVER_HOST_MAINTENANCE    = 'SERVER_HOST_MAINTENANCE',
  WINDOWS_DOMAIN_MAINTENANCE = 'WINDOWS_DOMAIN_MAINTENANCE',
  QNAP_MAINTENANCE           = 'QNAP_MAINTENANCE',
  VEEAM_BACKUP               = 'VEEAM_BACKUP',
  ROUTER_MAINTENANCE         = 'ROUTER_MAINTENANCE',
  TERMINAL_MAINTENANCE       = 'TERMINAL_MAINTENANCE',
  SITE_VISIT                 = 'SITE_VISIT',
  AV_CONTROL                 = 'AV_CONTROL',
  UPS_CONTROL                = 'UPS_CONTROL',
  ENDPOINT_INVENTORY         = 'ENDPOINT_INVENTORY',
}
```

- [ ] **Step 2: Crear la migración**

Archivo: `backend/src/migrations/1782604800000-AddRouterMaintenanceTaskType.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRouterMaintenanceTaskType1782604800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE task_type_enum ADD VALUE IF NOT EXISTS 'ROUTER_MAINTENANCE'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL no permite eliminar valores de un enum
  }
}
```

> **Importante:** esta migración debe tener `transaction = false` en el datasource, o ejecutarse fuera de transacción. En este proyecto, la convención es que migraciones con `ALTER TYPE ADD VALUE` se registran en `data-source.ts` con `migrationsTransactionMode: 'each'` (ya configurado).

- [ ] **Step 3: Actualizar `log-item.interface.ts`**

Agregar `RouterEntry` (con ID por device, coherente con frontend), agregar `RouterMaintenancePayload`, eliminiar `router?` de `WindowsDomainPayload`, y agregar al union `MaintenancePayload`.

Archivo: `backend/src/maintenance-logs/log-item.interface.ts` — reemplazar completamente:

```typescript
export interface WindowsServerEntry {
  serverId: number;
  serverName: string;
  rebootScript: 'ok' | 'error' | 'falta_configurar';
  updates: 'ok' | 'pending' | 'failed';
  notes?: string;
}

export interface WindowsSection {
  servers: WindowsServerEntry[];
  dcdiag: string;
  dcdiagDetail?: string;
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

export interface RouterSection {
  firmwareUpdated: boolean;
  firmwareVersion?: string;
  backupDone: boolean;
}

export interface RouterEntry {
  routerId: number;
  routerName: string;
  firmwareUpdated: boolean;
  firmwareVersion?: string;
  backupDone: boolean;
}

export type BmcAlertCategory = 'fan' | 'psu' | 'temperatura' | 'cpu' | 'memoria' | 'storage' | 'nic' | 'sistema';

export interface BmcEntry {
  hostId: number;
  hostName: string;
  firmwareVersion?: string;
  biosVersion?: string;
  alertStatus: 'ok' | 'alerta';
  alertCategories?: BmcAlertCategory[];
  alertLogs?: string;
}

export interface ServerMaintenancePayload {
  type: 'SERVER_MAINTENANCE';
  windows: WindowsSection;
  vmware?: VMwareHostEntry[];
  qnap?: QNAPSection[];
  veeam?: VeeamSection;
  router?: RouterSection;
  bmc?: BmcEntry[];
  notes?: string;
}

export interface ServerHostPayload {
  type: 'SERVER_HOST_MAINTENANCE';
  vmware: VMwareHostEntry[];
  bmc: BmcEntry[];
  notes?: string;
}

export interface WindowsDomainPayload {
  type: 'WINDOWS_DOMAIN_MAINTENANCE';
  windows: WindowsSection;
  notes?: string;
}

export interface RouterMaintenancePayload {
  type: 'ROUTER_MAINTENANCE';
  router: RouterEntry[];
  notes?: string;
}

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

export type MaintenancePayload =
  | ServerMaintenancePayload
  | ServerHostPayload
  | WindowsDomainPayload
  | RouterMaintenancePayload
  | TerminalPayload;
```

- [ ] **Step 4: Verificar tests del backend**

```
cd E:/develop/infraops/backend && npm test
```

Esperado: todos pasan (no hay tests que referencien router en WindowsDomainPayload).

- [ ] **Step 5: Commit**

```
git add backend/src/tasks/task-type.enum.ts backend/src/migrations/1782604800000-AddRouterMaintenanceTaskType.ts backend/src/maintenance-logs/log-item.interface.ts
git commit -m "feat(backend): agregar ROUTER_MAINTENANCE — enum + migración + payload interface"
```

---

## Task 2: Frontend — Modelos y labels

**Files:**
- Modify: `frontend/src/app/core/models/task.models.ts`
- Modify: `frontend/src/app/core/models/maintenance-log.models.ts`
- Modify: `frontend/src/app/shared/utils/task-labels.ts`
- Modify: `frontend/src/app/shared/utils/task-labels.spec.ts`

**Interfaces:**
- Consumes: `RouterEntry` ya existe en `maintenance-log.models.ts`
- Produce: `RouterMaintenancePayload { type: 'ROUTER_MAINTENANCE', router: RouterEntry[], notes?: string }` exportado desde `maintenance-log.models.ts`; `'ROUTER_MAINTENANCE'` en union `TaskType`

- [ ] **Step 1: Escribir tests fallidos para labels**

Archivo: `frontend/src/app/shared/utils/task-labels.spec.ts`

Agregar en `describe('typeLabel()')` y `describe('typeLabelLong()')` los nuevos casos. Buscar el bloque `const cases: [TaskType, string][]` de cada describe y agregar:

En `typeLabel()`:
```typescript
['ROUTER_MAINTENANCE', 'Router / FW'],
```

En `typeLabelLong()`:
```typescript
['ROUTER_MAINTENANCE', 'Mantenimiento de router y firewall'],
```

En `typeBadge()`:
```typescript
['ROUTER_MAINTENANCE', 'badge--srv'],
```

- [ ] **Step 2: Verificar que los tests fallan**

```
cd E:/develop/infraops/frontend && npx ng test --watch=false --browsers=ChromeHeadless --include="**/task-labels.spec.ts"
```

Esperado: FAIL — `'ROUTER_MAINTENANCE'` no está en el tipo `TaskType`.

- [ ] **Step 3: Actualizar `task.models.ts`**

Archivo: `frontend/src/app/core/models/task.models.ts`

```typescript
export type TaskType =
  | 'SERVER_MAINTENANCE'
  | 'SERVER_HOST_MAINTENANCE'
  | 'WINDOWS_DOMAIN_MAINTENANCE'
  | 'QNAP_MAINTENANCE'
  | 'VEEAM_BACKUP'
  | 'ROUTER_MAINTENANCE'
  | 'TERMINAL_MAINTENANCE'
  | 'SITE_VISIT'
  | 'AV_CONTROL'
  | 'UPS_CONTROL'
  | 'ENDPOINT_INVENTORY';
```

El resto del archivo (`TaskStatus`, `Task`, `UpdateTaskStatusPayload`) queda igual.

- [ ] **Step 4: Actualizar `maintenance-log.models.ts`**

Agregar `RouterMaintenancePayload`, eliminar `router?` de `WindowsDomainPayload`, agregar al union:

```typescript
export interface WindowsDomainPayload {
  type: 'WINDOWS_DOMAIN_MAINTENANCE';
  windows: WindowsSection;
  notes?: string;
}

export interface RouterMaintenancePayload {
  type: 'ROUTER_MAINTENANCE';
  router: RouterEntry[];
  notes?: string;
}
```

Y en el union al final:
```typescript
export type MaintenancePayload =
  | ServerMaintenancePayload
  | ServerHostPayload
  | WindowsDomainPayload
  | RouterMaintenancePayload
  | TerminalPayload
  | QnapPayload
  | VeeamBackupPayload;
```

> Nota: `RouterEntry` ya existe en este archivo — no redefinir.

- [ ] **Step 5: Actualizar `task-labels.ts`**

Agregar `ROUTER_MAINTENANCE` en los tres `Record<TaskType, string>`:

```typescript
export function typeLabel(type: TaskType): string {
  const labels: Record<TaskType, string> = {
    SERVER_MAINTENANCE:         'Servidores',
    SERVER_HOST_MAINTENANCE:    'VMware / BMC',
    WINDOWS_DOMAIN_MAINTENANCE: 'Windows / AD',
    QNAP_MAINTENANCE:           'QNAP/NAS',
    VEEAM_BACKUP:               'Veeam',
    ROUTER_MAINTENANCE:         'Router / FW',
    TERMINAL_MAINTENANCE:       'Terminales',
    SITE_VISIT:                 'Visita',
    AV_CONTROL:                 'Antivirus',
    UPS_CONTROL:                'UPS',
    ENDPOINT_INVENTORY:         'Inventario',
  };
  return labels[type];
}

export function typeLabelLong(type: TaskType): string {
  const labels: Record<TaskType, string> = {
    SERVER_MAINTENANCE:         'Mantenimiento de servidores',
    SERVER_HOST_MAINTENANCE:    'Mantenimiento de hosts VMware',
    WINDOWS_DOMAIN_MAINTENANCE: 'Mantenimiento Windows y dominios',
    QNAP_MAINTENANCE:           'Mantenimiento QNAP/NAS',
    VEEAM_BACKUP:               'Mantenimiento de backups Veeam',
    ROUTER_MAINTENANCE:         'Mantenimiento de router y firewall',
    TERMINAL_MAINTENANCE:       'Visita de terminales',
    SITE_VISIT:                 'Visita presencial',
    AV_CONTROL:                 'Control antivirus',
    UPS_CONTROL:                'Control UPS',
    ENDPOINT_INVENTORY:         'Inventario',
  };
  return labels[type];
}
```

La función `typeBadge()` no necesita cambio — `ROUTER_MAINTENANCE` no es tipo visita, cae en el `else` que retorna `'badge--srv'`.

- [ ] **Step 6: Verificar tests**

```
cd E:/develop/infraops/frontend && npx ng test --watch=false --browsers=ChromeHeadless --include="**/task-labels.spec.ts"
```

Esperado: todos pasan.

- [ ] **Step 7: Commit**

```
git add frontend/src/app/core/models/task.models.ts frontend/src/app/core/models/maintenance-log.models.ts frontend/src/app/shared/utils/task-labels.ts frontend/src/app/shared/utils/task-labels.spec.ts
git commit -m "feat(frontend): agregar tipo ROUTER_MAINTENANCE — models + labels"
```

---

## Task 3: RouterFormComponent

**Files:**
- Create: `frontend/src/app/features/technician/task-drawer/router-form/router-form.component.ts`
- Create: `frontend/src/app/features/technician/task-drawer/router-form/router-form.component.html`
- Create: `frontend/src/app/features/technician/task-drawer/router-form/router-form.component.scss`
- Create: `frontend/src/app/features/technician/task-drawer/router-form/router-form.component.spec.ts`
- Modify: `frontend/src/app/features/technician/technician.module.ts`

**Interfaces:**
- Consumes: `RouterEntry`, `RouterMaintenancePayload`, `MaintenancePayload` de `maintenance-log.models.ts`; `Task` de `task.models.ts`; `ClientInfrastructure` de `infradoc.models.ts`
- Produce: componente `app-router-form` declarado en `TechnicianModule`

- [ ] **Step 1: Escribir el spec (test primero)**

Archivo: `frontend/src/app/features/technician/task-drawer/router-form/router-form.component.spec.ts`

```typescript
import { FormBuilder } from '@angular/forms';
import { RouterFormComponent } from './router-form.component';
import { ClientInfrastructure, InfraAsset } from '../../../../core/models/infradoc.models';
import { RouterMaintenancePayload } from '../../../../core/models/maintenance-log.models';
import { Task } from '../../../../core/models/task.models';

const makeTask = (): Task => ({
  id: '1', clientId: '10', technicianId: '2',
  type: 'ROUTER_MAINTENANCE', status: 'PENDING',
  scheduledDate: '2026-06-27T00:00:00.000Z',
  completedDate: null, odooTicketId: null,
  createdAt: '2026-06-01T00:00:00.000Z',
});

const makeRouter = (overrides: Partial<InfraAsset> = {}): InfraAsset => ({
  assetId: 1, name: 'router-mikrotik', ip: '192.168.0.1',
  os: null, model: 'MikroTik RB4011', bmcIp: null, bmcType: null,
  ...overrides,
});

const makeInfra = (routers: InfraAsset[] = [makeRouter()]): ClientInfrastructure => ({
  esxiHosts: [], windowsVMs: [], domainControllers: [], linuxVMs: [], nas: [],
  routers,
});

describe('RouterFormComponent — pure unit tests', () => {
  let component: RouterFormComponent;

  beforeEach(() => {
    component = new RouterFormComponent(new FormBuilder());
    component.task = makeTask();
  });

  describe('buildForm()', () => {
    it('crea un control por cada router en infrastructure', () => {
      component.infrastructure = makeInfra([makeRouter(), makeRouter({ assetId: 2, name: 'fw-02' })]);
      component.ngOnChanges({ infrastructure: {} as any });
      expect(component.routerControls.length).toBe(2);
    });

    it('inicializa firmwareUpdated en false', () => {
      component.infrastructure = makeInfra();
      component.ngOnChanges({ infrastructure: {} as any });
      expect(component.routerControls.at(0).get('firmwareUpdated')?.value).toBe(false);
    });

    it('inicializa backupDone en false', () => {
      component.infrastructure = makeInfra();
      component.ngOnChanges({ infrastructure: {} as any });
      expect(component.routerControls.at(0).get('backupDone')?.value).toBe(false);
    });
  });

  describe('buildPayload()', () => {
    beforeEach(() => {
      component.infrastructure = makeInfra();
      component.ngOnChanges({ infrastructure: {} as any });
    });

    it('retorna payload con type ROUTER_MAINTENANCE', () => {
      const payload = component.buildPayload();
      expect(payload.type).toBe('ROUTER_MAINTENANCE');
    });

    it('mapea router con routerId y routerName del infrastructure', () => {
      const payload = component.buildPayload();
      expect(payload.router[0].routerId).toBe(1);
      expect(payload.router[0].routerName).toBe('router-mikrotik');
    });

    it('mapea firmwareUpdated y backupDone del form', () => {
      component.routerControls.at(0).patchValue({ firmwareUpdated: true, backupDone: true });
      const payload = component.buildPayload();
      expect(payload.router[0].firmwareUpdated).toBe(true);
      expect(payload.router[0].backupDone).toBe(true);
    });

    it('incluye firmwareVersion si no está vacío', () => {
      component.routerControls.at(0).patchValue({ firmwareVersion: '7.14.2' });
      const payload = component.buildPayload();
      expect(payload.router[0].firmwareVersion).toBe('7.14.2');
    });

    it('omite firmwareVersion si está vacío', () => {
      component.routerControls.at(0).patchValue({ firmwareVersion: '' });
      const payload = component.buildPayload();
      expect(payload.router[0].firmwareVersion).toBeUndefined();
    });

    it('incluye notes si no está vacío', () => {
      component.form.patchValue({ notes: 'revisar config' });
      expect(component.buildPayload().notes).toBe('revisar config');
    });

    it('omite notes si está vacío', () => {
      component.form.patchValue({ notes: '' });
      expect(component.buildPayload().notes).toBeUndefined();
    });
  });

  describe('patchFormFromPayload()', () => {
    beforeEach(() => {
      component.infrastructure = makeInfra();
      component.ngOnChanges({ infrastructure: {} as any });
    });

    it('restaura firmwareUpdated y backupDone del payload guardado', () => {
      const payload: RouterMaintenancePayload = {
        type: 'ROUTER_MAINTENANCE',
        router: [{ routerId: 1, routerName: 'router-mikrotik', firmwareUpdated: true, firmwareVersion: '7.14.2', backupDone: true }],
      };
      component.savedPayload = payload;
      component.ngOnChanges({ infrastructure: {} as any });
      expect(component.routerControls.at(0).get('firmwareUpdated')?.value).toBe(true);
      expect(component.routerControls.at(0).get('firmwareVersion')?.value).toBe('7.14.2');
      expect(component.routerControls.at(0).get('backupDone')?.value).toBe(true);
    });

    it('ignora payload de otro tipo', () => {
      component.savedPayload = { type: 'QNAP_MAINTENANCE', qnap: [] };
      component.ngOnChanges({ infrastructure: {} as any });
      expect(component.routerControls.at(0).get('firmwareUpdated')?.value).toBe(false);
    });
  });

  describe('readOnly', () => {
    it('deshabilita el form cuando readOnly = true', () => {
      component.infrastructure = makeInfra();
      component.readOnly = true;
      component.ngOnChanges({ infrastructure: {} as any });
      expect(component.form.disabled).toBe(true);
    });

    it('habilita el form cuando readOnly cambia a false', () => {
      component.infrastructure = makeInfra();
      component.readOnly = true;
      component.ngOnChanges({ infrastructure: {} as any });
      component.readOnly = false;
      component.ngOnChanges({ readOnly: {} as any });
      expect(component.form.disabled).toBe(false);
    });
  });

  describe('outputs', () => {
    beforeEach(() => {
      component.infrastructure = makeInfra();
      component.ngOnChanges({ infrastructure: {} as any });
    });

    it('submit() emite requestComplete con payload ROUTER_MAINTENANCE', () => {
      let emitted: RouterMaintenancePayload | undefined;
      component.requestComplete.subscribe(p => emitted = p);
      component.submit();
      expect(emitted?.type).toBe('ROUTER_MAINTENANCE');
    });

    it('save() emite requestSave con payload ROUTER_MAINTENANCE', () => {
      let emitted: RouterMaintenancePayload | undefined;
      component.requestSave.subscribe(p => emitted = p);
      component.save();
      expect(emitted?.type).toBe('ROUTER_MAINTENANCE');
    });

    it('submitNotDone() emite requestNotDone', () => {
      let emitted = false;
      component.requestNotDone.subscribe(() => emitted = true);
      component.submitNotDone();
      expect(emitted).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Verificar que los tests fallan**

```
cd E:/develop/infraops/frontend && npx ng test --watch=false --browsers=ChromeHeadless --include="**/router-form.component.spec.ts"
```

Esperado: FAIL — `RouterFormComponent` no existe.

- [ ] **Step 3: Implementar `router-form.component.ts`**

Archivo: `frontend/src/app/features/technician/task-drawer/router-form/router-form.component.ts`

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
  RouterEntry,
  RouterMaintenancePayload,
} from '../../../../core/models/maintenance-log.models';

@Component({
  selector: 'app-router-form',
  templateUrl: './router-form.component.html',
  styleUrl: './router-form.component.scss',
})
export class RouterFormComponent implements OnChanges {
  @Input() task!: Task;
  @Input() infrastructure!: ClientInfrastructure;
  @Input() savedPayload: MaintenancePayload | null = null;
  @Input() readOnly = false;

  @Output() requestComplete = new EventEmitter<RouterMaintenancePayload>();
  @Output() requestSave     = new EventEmitter<RouterMaintenancePayload>();
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

  get routerControls(): FormArray {
    return this.form.get('routers') as FormArray;
  }

  buildPayload(): RouterMaintenancePayload {
    const router: RouterEntry[] = this.infrastructure.routers.map((r, i) => {
      const ctrl = this.routerControls.at(i).value;
      const entry: RouterEntry = {
        routerId:        r.assetId,
        routerName:      r.name,
        firmwareUpdated: ctrl.firmwareUpdated,
        backupDone:      ctrl.backupDone,
      };
      if (ctrl.firmwareVersion) entry.firmwareVersion = ctrl.firmwareVersion;
      return entry;
    });

    return {
      type: 'ROUTER_MAINTENANCE',
      router,
      notes: this.form.value.notes || undefined,
    };
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

  private buildForm(): void {
    this.form = this.fb.group({
      routers: this.fb.array(
        this.infrastructure.routers.map(() => this.fb.group({
          firmwareUpdated: [false],
          firmwareVersion: [''],
          backupDone:      [false],
        }))
      ),
      notes: [''],
    });
  }

  private applyReadOnlyState(): void {
    if (!this.form) return;
    if (this.readOnly) {
      this.form.disable({ emitEvent: false });
    } else {
      this.form.enable({ emitEvent: false });
    }
  }

  private patchFormFromPayload(payload: MaintenancePayload): void {
    if (payload.type !== 'ROUTER_MAINTENANCE') return;
    const saved = payload as RouterMaintenancePayload;

    this.form.patchValue({ notes: saved.notes ?? '' });

    if (saved.router?.length) {
      this.infrastructure.routers.forEach((router, i) => {
        const entry = saved.router.find(r => r.routerId === router.assetId);
        if (entry) {
          this.routerControls.at(i).patchValue({
            firmwareUpdated: entry.firmwareUpdated,
            firmwareVersion: entry.firmwareVersion ?? '',
            backupDone:      entry.backupDone,
          });
        }
      });
    }
  }
}
```

- [ ] **Step 4: Crear `router-form.component.html`**

Archivo: `frontend/src/app/features/technician/task-drawer/router-form/router-form.component.html`

```html
<form [formGroup]="form" class="rf">

  <div class="rf-section-lbl">Router / Firewall</div>

  <div class="rf-grid" formArrayName="routers">
    <div *ngFor="let _ of routerControls.controls; let i = index"
         [formGroupName]="i"
         class="rf-card">

      <div class="rf-card-hdr">
        <div class="rf-card-dot"></div>
        <div class="rf-name-block">
          <span class="rf-card-label">{{ infrastructure.routers[i].name }}</span>
          <span class="mono rf-ip">{{ infrastructure.routers[i].ip ?? '—' }}</span>
        </div>
      </div>

      <mat-checkbox formControlName="firmwareUpdated" class="rf-check">
        Actualizar firmware a última versión estable
      </mat-checkbox>

      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="rf-field">
        <mat-label>Versión firmware aplicada</mat-label>
        <input matInput formControlName="firmwareVersion" placeholder="Ej: 7.14.2" />
      </mat-form-field>

      <mat-checkbox formControlName="backupDone" class="rf-check">
        Realizar backup de configuración
      </mat-checkbox>

    </div>
  </div>

  <div class="rf-section-lbl">Notas adicionales</div>
  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="rf-field">
    <textarea matInput formControlName="notes" rows="3"
              placeholder="Observaciones adicionales..."></textarea>
  </mat-form-field>

</form>
```

- [ ] **Step 5: Crear `router-form.component.scss`**

Archivo: `frontend/src/app/features/technician/task-drawer/router-form/router-form.component.scss`

```scss
.rf {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rf-section-lbl {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--tx-lo);
  margin-top: 8px;
  margin-bottom: 2px;
}

.rf-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rf-card {
  background: var(--surface-2);
  border: 1px solid var(--bd);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rf-card-hdr {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.rf-card-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--srv);
  flex-shrink: 0;
}

.rf-name-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rf-card-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--tx-hi);
}

.rf-ip {
  font-size: 11px;
  color: var(--tx-lo);
}

.rf-check {
  font-size: 12px;
}

.rf-field {
  width: 100%;
}
```

- [ ] **Step 6: Declarar `RouterFormComponent` en `TechnicianModule`**

Archivo: `frontend/src/app/features/technician/technician.module.ts`

Agregar el import y la declaración:

```typescript
import { RouterFormComponent } from './task-drawer/router-form/router-form.component';
```

En `declarations: [...]` agregar `RouterFormComponent` junto a los otros form components.

- [ ] **Step 7: Verificar que los tests pasan**

```
cd E:/develop/infraops/frontend && npx ng test --watch=false --browsers=ChromeHeadless --include="**/router-form.component.spec.ts"
```

Esperado: todos pasan.

- [ ] **Step 8: Commit**

```
git add frontend/src/app/features/technician/task-drawer/router-form/ frontend/src/app/features/technician/technician.module.ts
git commit -m "feat(frontend): RouterFormComponent — formulario standalone ROUTER_MAINTENANCE"
```

---

## Task 4: Limpiar `MaintenanceFormComponent`

**Files:**
- Modify: `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.ts`
- Modify: `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.html`
- Modify: `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.spec.ts`

**Interfaces:**
- Consumes: `WindowsDomainPayload` ya no tiene `router?` (Task 2)
- Produce: `MaintenanceFormComponent` sin ninguna referencia a router

- [ ] **Step 1: Actualizar el spec de `MaintenanceFormComponent`**

Buscar y eliminar cualquier referencia a `router`, `routerDevices`, `hasRouter` en el spec. Si hay tests que verifican la sección router, eliminarlos. Agregar/verificar que existe el test:

```typescript
it('buildPayload() de WINDOWS_DOMAIN_MAINTENANCE no incluye router', () => {
  component.task = { ...makeTask(), type: 'WINDOWS_DOMAIN_MAINTENANCE' };
  component.infrastructure = makeInfra({ windowsVMs: [makeVM()] });
  component.ngOnChanges({ infrastructure: {} as any });
  const payload = component.buildPayload() as WindowsDomainPayload;
  expect((payload as any).router).toBeUndefined();
});
```

> Nota: si el spec no tiene `makeTask()` o `makeInfra()` helpers, agrégalos al estilo de `server-host-form.component.spec.ts`.

- [ ] **Step 2: Verificar que el test falla (o pasa si ya es correcto)**

```
cd E:/develop/infraops/frontend && npx ng test --watch=false --browsers=ChromeHeadless --include="**/maintenance-form.component.spec.ts"
```

- [ ] **Step 3: Actualizar `maintenance-form.component.ts`**

Cambios a realizar:

1. Eliminar del import `RouterEntry` si está importado
2. En `buildForm()`: eliminar el FormArray `routerDevices`
3. Eliminar getter `routerDeviceControls`
4. Eliminar getter `hasRouter`
5. En `buildPayload()`: en el bloque `WindowsDomainPayload`, eliminar la asignación de `payload.router`
6. En `patchFormFromPayload()`: eliminar el bloque `if (srv.router?.length)` en el branch `WINDOWS_DOMAIN_MAINTENANCE`
7. Actualizar tipo del output si referenciaba `RouterEntry`: `@Output() requestComplete = new EventEmitter<WindowsDomainPayload | TerminalPayload>()`

El resultado debe quedar en `buildPayload()` para `WINDOWS_DOMAIN_MAINTENANCE`:

```typescript
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
```

Y en `buildForm()`, eliminar:
```typescript
routerDevices: this.fb.array(
  this.infrastructure.routers.map(() => this.fb.group({
    firmwareUpdated: [false],
    firmwareVersion: [''],
    backupDone:      [false],
  }))
),
```

- [ ] **Step 4: Actualizar `maintenance-form.component.html`**

Eliminar la sección completa:

```html
<!-- ── Router / Firewall ─────────────────────────────── -->
<ng-container *ngIf="hasRouter">
  ...
</ng-container>
```

(desde `<ng-container *ngIf="hasRouter">` hasta su `</ng-container>` de cierre, inclusive).

- [ ] **Step 5: Verificar tests**

```
cd E:/develop/infraops/frontend && npx ng test --watch=false --browsers=ChromeHeadless --include="**/maintenance-form.component.spec.ts"
```

Esperado: todos pasan, sin referencias a router.

- [ ] **Step 6: Commit**

```
git add frontend/src/app/features/technician/task-drawer/maintenance-form/
git commit -m "refactor(maintenance-form): eliminar sección router — ahora en RouterFormComponent"
```

---

## Task 5: Conectar `TaskDrawerComponent`

**Files:**
- Modify: `frontend/src/app/features/technician/task-drawer/task-drawer.component.ts`
- Modify: `frontend/src/app/features/technician/task-drawer/task-drawer.component.html`
- Modify: `frontend/src/app/features/technician/task-drawer/task-drawer.component.spec.ts`

**Interfaces:**
- Consumes: `app-router-form` con selector de `RouterFormComponent` (Task 3); `RouterMaintenancePayload` de `maintenance-log.models.ts`
- Produce: drawer completo enrutando `ROUTER_MAINTENANCE` al nuevo form

- [ ] **Step 1: Actualizar el spec del drawer**

En `task-drawer.component.spec.ts`, buscar los mocks de `task.type` y agregar el caso `ROUTER_MAINTENANCE`. Si el spec tiene un test que verifica que `app-maintenance-form` se muestra para ciertos tipos, actualizar la condición para excluir `ROUTER_MAINTENANCE`.

Agregar test:
```typescript
it('no muestra app-maintenance-form para ROUTER_MAINTENANCE', () => {
  // similar a los tests existentes de routing por tipo
});
```

> Nota: revisar el spec actual — si ya usa `MockComponent` o `NO_ERRORS_SCHEMA`, adaptar al patrón existente.

- [ ] **Step 2: Actualizar `task-drawer.component.ts`**

Cambios:

1. Agregar imports:
```typescript
import { RouterFormComponent } from './router-form/router-form.component';
import { RouterMaintenancePayload } from '../../../core/models/maintenance-log.models';
```

2. Agregar `@ViewChild`:
```typescript
@ViewChild(RouterFormComponent) routerForm?: RouterFormComponent;
```

3. Agregar helper de save:
```typescript
triggerRouterFormSave(): void {
  this.routerForm?.save();
}
```

4. Actualizar `triggerFormComplete()`:
```typescript
triggerFormComplete(): void {
  this.maintenanceForm?.submit();
  this.qnapForm?.submit();
  this.veeamForm?.submit();
  this.serverHostForm?.submit();
  this.routerForm?.submit();
}
```

5. `detectIssues()` no necesita cambios — el default `return { dcdiagErrors: [], veeamMissing: false, emptyFields: [] }` ya cubre `ROUTER_MAINTENANCE`.

- [ ] **Step 3: Actualizar `task-drawer.component.html`**

**Agregar el bloque del formulario** antes del bloque catch-all de `app-maintenance-form`:

```html
<!-- Formulario ROUTER_MAINTENANCE -->
<app-router-form
  *ngIf="infrastructure && task.type === 'ROUTER_MAINTENANCE'"
  [task]="task"
  [infrastructure]="infrastructure"
  [savedPayload]="savedPayload"
  [readOnly]="!isActiveTask"
  (requestComplete)="onRequestComplete($event)"
  (requestSave)="onRequestSave($event)"
  (requestNotDone)="onRequestNotDone()">
</app-router-form>
```

**Actualizar la condición del catch-all** de `app-maintenance-form` para excluir `ROUTER_MAINTENANCE`:

```html
<app-maintenance-form
  *ngIf="infrastructure && task.type !== 'QNAP_MAINTENANCE' && task.type !== 'VEEAM_BACKUP' && task.type !== 'SERVER_HOST_MAINTENANCE' && task.type !== 'ROUTER_MAINTENANCE'"
  ...>
</app-maintenance-form>
```

**Agregar el bloque de footer** para `ROUTER_MAINTENANCE` dentro de `<div class="d-footer" *ngIf="isActiveTask">`:

```html
<!-- ROUTER_MAINTENANCE -->
<ng-container *ngIf="task.type === 'ROUTER_MAINTENANCE'">
  <button mat-flat-button color="primary" (click)="triggerFormComplete()" [disabled]="completing">
    <mat-spinner *ngIf="completing" [diameter]="16"></mat-spinner>
    <span *ngIf="!completing">Completar mantenimiento</span>
  </button>
  <button mat-stroked-button (click)="triggerRouterFormSave()" [disabled]="completing">Guardar progreso</button>
  <button mat-stroked-button (click)="drawerClosed.emit()" [disabled]="completing">Cerrar</button>
</ng-container>
```

- [ ] **Step 4: Verificar todos los tests**

```
cd E:/develop/infraops/frontend && npx ng test --watch=false --browsers=ChromeHeadless --include="**/task-drawer.component.spec.ts"
```

Esperado: todos pasan.

- [ ] **Step 5: Verificar suite completa**

```
cd E:/develop/infraops/frontend && npx ng test --watch=false --browsers=ChromeHeadless
```

Esperado: toda la suite pasa sin errores de compilación TypeScript.

- [ ] **Step 6: Commit**

```
git add frontend/src/app/features/technician/task-drawer/task-drawer.component.ts frontend/src/app/features/technician/task-drawer/task-drawer.component.html frontend/src/app/features/technician/task-drawer/task-drawer.component.spec.ts
git commit -m "feat(task-drawer): conectar ROUTER_MAINTENANCE — routing + footer + ViewChild"
```
