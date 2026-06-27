# Server Host + Windows Domain Split — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `SERVER_MAINTENANCE` into `SERVER_HOST_MAINTENANCE` (VMware ESXi + BMC) and `WINDOWS_DOMAIN_MAINTENANCE` (Windows Servers + DCs + Router) as independent task types with separate forms.

**Architecture:** New `ServerHostFormComponent` extracts VMware+BMC sections from `MaintenanceFormComponent`. `MaintenanceFormComponent` is updated to emit `WindowsDomainPayload` for `WINDOWS_DOMAIN_MAINTENANCE`. `TaskDrawerComponent` routes the new type to the new form. A DB migration adds both enum values and migrates existing rows.

**Tech Stack:** NestJS backend (TypeORM migrations), Angular 19 + Angular Material + Reactive Forms (no standalone components).

## Global Constraints

- No standalone Angular components — all components declared in `TechnicianModule`
- Angular Material exclusively — no native `<input>`, `<select>`, `<button>` in templates
- `appearance="outline"` on all `mat-form-field`
- TDD — write failing test first, then implement
- One file at a time — commit after each task
- Run `cd E:/develop/infraops/frontend && npx ng test --watch=false --browsers=ChromeHeadless` to verify tests pass
- Run `cd E:/develop/infraops/backend && npm test` for backend tests
- `transaction = false` on any migration that uses `ALTER TYPE ADD VALUE`

---

## File Map

| File | Action |
|---|---|
| `backend/src/tasks/task-type.enum.ts` | Modify — add 2 new values |
| `backend/src/migrations/<ts>-AddServerHostAndWindowsDomainTaskTypes.ts` | Create — migration |
| `backend/src/maintenance-logs/log-item.interface.ts` | Modify — add 2 new payload interfaces |
| `frontend/src/app/core/models/task.models.ts` | Modify — add 2 new TaskType values |
| `frontend/src/app/core/models/maintenance-log.models.ts` | Modify — add 2 new payload interfaces |
| `frontend/src/app/shared/utils/task-labels.ts` | Modify — add labels for 2 new types |
| `frontend/src/app/shared/utils/task-labels.spec.ts` | Modify — add test cases |
| `frontend/.../server-host-form/server-host-form.component.ts` | Create |
| `frontend/.../server-host-form/server-host-form.component.html` | Create |
| `frontend/.../server-host-form/server-host-form.component.scss` | Create |
| `frontend/.../server-host-form/server-host-form.component.spec.ts` | Create |
| `frontend/.../technician.module.ts` | Modify — declare ServerHostFormComponent |
| `frontend/.../maintenance-form/maintenance-form.component.ts` | Modify — remove VMware+BMC, update types |
| `frontend/.../maintenance-form/maintenance-form.component.html` | Modify — remove VMware+BMC sections |
| `frontend/.../maintenance-form/maintenance-form.component.spec.ts` | Modify — update type refs, remove VMware tests |
| `frontend/.../task-drawer/task-drawer.component.ts` | Modify — add ViewChild, update detectIssues |
| `frontend/.../task-drawer/task-drawer.component.html` | Modify — add routing + footer block |
| `frontend/.../task-drawer/task-drawer.component.spec.ts` | Modify — update type refs |

---

## Task 1: Backend — Enum, Migration, Payload Interfaces

**Files:**
- Modify: `backend/src/tasks/task-type.enum.ts`
- Create: `backend/src/migrations/1782432000000-AddServerHostAndWindowsDomainTaskTypes.ts`
- Modify: `backend/src/maintenance-logs/log-item.interface.ts`

**Interfaces:**
- Produces: `ServerHostPayload { type, vmware, bmc, notes? }`, `WindowsDomainPayload { type, windows, router?, notes? }` in `log-item.interface.ts`

- [ ] **Step 1: Add new values to backend TaskType enum**

Replace the entire content of `backend/src/tasks/task-type.enum.ts`:

```typescript
export enum TaskType {
  SERVER_MAINTENANCE         = 'SERVER_MAINTENANCE',
  SERVER_HOST_MAINTENANCE    = 'SERVER_HOST_MAINTENANCE',
  WINDOWS_DOMAIN_MAINTENANCE = 'WINDOWS_DOMAIN_MAINTENANCE',
  QNAP_MAINTENANCE           = 'QNAP_MAINTENANCE',
  VEEAM_BACKUP               = 'VEEAM_BACKUP',
  TERMINAL_MAINTENANCE       = 'TERMINAL_MAINTENANCE',
  SITE_VISIT                 = 'SITE_VISIT',
  AV_CONTROL                 = 'AV_CONTROL',
  UPS_CONTROL                = 'UPS_CONTROL',
  ENDPOINT_INVENTORY         = 'ENDPOINT_INVENTORY',
}
```

- [ ] **Step 2: Create the migration**

Create `backend/src/migrations/1782432000000-AddServerHostAndWindowsDomainTaskTypes.ts`:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddServerHostAndWindowsDomainTaskTypes1782432000000 implements MigrationInterface {
  name = 'AddServerHostAndWindowsDomainTaskTypes1782432000000';
  transaction = false as const;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."tasks_type_enum" ADD VALUE IF NOT EXISTS 'SERVER_HOST_MAINTENANCE'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."tasks_type_enum" ADD VALUE IF NOT EXISTS 'WINDOWS_DOMAIN_MAINTENANCE'`,
    );
    await queryRunner.query(
      `UPDATE tasks SET type = 'WINDOWS_DOMAIN_MAINTENANCE' WHERE type = 'SERVER_MAINTENANCE'`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL no soporta eliminar valores de un enum sin recrearlo.
  }
}
```

- [ ] **Step 3: Run the migration**

```bash
cd E:/develop/infraops/backend && npm run migration:run
```

Expected: migration executes without error. Verify with:

```bash
docker exec infraops-db psql -U postgres -d infraops -c "SELECT COUNT(*) FROM tasks WHERE type = 'WINDOWS_DOMAIN_MAINTENANCE';"
```

Expected: returns 13 (the previously SERVER_MAINTENANCE tasks).

- [ ] **Step 4: Add payload interfaces to backend**

In `backend/src/maintenance-logs/log-item.interface.ts`, add after the `ServerMaintenancePayload` interface (before the `TerminalChecks` interface):

```typescript
export interface ServerHostPayload {
  type: 'SERVER_HOST_MAINTENANCE';
  vmware: VMwareHostEntry[];
  bmc: BmcEntry[];
  notes?: string;
}

export interface WindowsDomainPayload {
  type: 'WINDOWS_DOMAIN_MAINTENANCE';
  windows: WindowsSection;
  router?: RouterSection;
  notes?: string;
}
```

Replace the `MaintenancePayload` union at the bottom of the file:

```typescript
export type MaintenancePayload =
  | ServerMaintenancePayload
  | ServerHostPayload
  | WindowsDomainPayload
  | TerminalPayload;
```

- [ ] **Step 5: Run backend tests**

```bash
cd E:/develop/infraops/backend && npm test 2>&1 | tail -20
```

Expected: all tests pass (interface-only changes, no logic changed).

- [ ] **Step 6: Commit**

```bash
git -C E:/develop/infraops add backend/src/tasks/task-type.enum.ts backend/src/migrations/1782432000000-AddServerHostAndWindowsDomainTaskTypes.ts backend/src/maintenance-logs/log-item.interface.ts
git -C E:/develop/infraops commit -m "feat(backend): agregar SERVER_HOST_MAINTENANCE y WINDOWS_DOMAIN_MAINTENANCE — enum + migration + interfaces"
```

---

## Task 2: Frontend Models and Labels

**Files:**
- Modify: `frontend/src/app/core/models/task.models.ts`
- Modify: `frontend/src/app/core/models/maintenance-log.models.ts`
- Modify: `frontend/src/app/shared/utils/task-labels.ts`
- Modify: `frontend/src/app/shared/utils/task-labels.spec.ts`

**Interfaces:**
- Produces: `ServerHostPayload`, `WindowsDomainPayload` in `maintenance-log.models.ts`; updated `TaskType` union; labels for both new types

- [ ] **Step 1: Write failing label tests first**

In `frontend/src/app/shared/utils/task-labels.spec.ts`, add these test cases at the end of the `describe` block (before the closing `}`):

```typescript
it('typeLabel retorna "VMware / BMC" para SERVER_HOST_MAINTENANCE', () => {
  expect(typeLabel('SERVER_HOST_MAINTENANCE')).toBe('VMware / BMC');
});

it('typeLabel retorna "Windows / AD" para WINDOWS_DOMAIN_MAINTENANCE', () => {
  expect(typeLabel('WINDOWS_DOMAIN_MAINTENANCE')).toBe('Windows / AD');
});

it('typeLabelLong retorna "Mantenimiento de hosts VMware" para SERVER_HOST_MAINTENANCE', () => {
  expect(typeLabelLong('SERVER_HOST_MAINTENANCE')).toBe('Mantenimiento de hosts VMware');
});

it('typeLabelLong retorna "Mantenimiento Windows y dominios" para WINDOWS_DOMAIN_MAINTENANCE', () => {
  expect(typeLabelLong('WINDOWS_DOMAIN_MAINTENANCE')).toBe('Mantenimiento Windows y dominios');
});

it('typeBadge retorna "badge--srv" para SERVER_HOST_MAINTENANCE', () => {
  expect(typeBadge('SERVER_HOST_MAINTENANCE')).toBe('badge--srv');
});

it('typeBadge retorna "badge--srv" para WINDOWS_DOMAIN_MAINTENANCE', () => {
  expect(typeBadge('WINDOWS_DOMAIN_MAINTENANCE')).toBe('badge--srv');
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd E:/develop/infraops/frontend && npx ng test --watch=false --browsers=ChromeHeadless --include="**/task-labels.spec.ts" 2>&1 | tail -5
```

Expected: FAILED (TypeScript compile error — unknown TaskType values).

- [ ] **Step 3: Add new TaskType values to frontend model**

Replace the entire content of `frontend/src/app/core/models/task.models.ts`:

```typescript
export type TaskType =
  | 'SERVER_MAINTENANCE'
  | 'SERVER_HOST_MAINTENANCE'
  | 'WINDOWS_DOMAIN_MAINTENANCE'
  | 'QNAP_MAINTENANCE'
  | 'VEEAM_BACKUP'
  | 'TERMINAL_MAINTENANCE'
  | 'SITE_VISIT'
  | 'AV_CONTROL'
  | 'UPS_CONTROL'
  | 'ENDPOINT_INVENTORY';

export type TaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'ESCALATED'
  | 'NOT_DONE';

export interface Task {
  id: string;
  clientId: string;
  technicianId: string;
  type: TaskType;
  status: TaskStatus;
  scheduledDate: string;
  completedDate: string | null;
  odooTicketId: number | null;
  createdAt: string;
  client?: { id: string; name: string };
  technician?: { id: string; user: { id: string; name: string; email: string } };
}

export interface UpdateTaskStatusPayload {
  status: TaskStatus;
  timeSpentMinutes?: number;
}
```

- [ ] **Step 4: Add payload interfaces to frontend models**

In `frontend/src/app/core/models/maintenance-log.models.ts`, add after the `ServerMaintenancePayload` interface (before the `// --- Terminal Maintenance ---` comment):

```typescript
export interface ServerHostPayload {
  type: 'SERVER_HOST_MAINTENANCE';
  vmware: VMwareHostEntry[];
  bmc: BmcEntry[];
  notes?: string;
}

export interface WindowsDomainPayload {
  type: 'WINDOWS_DOMAIN_MAINTENANCE';
  windows: WindowsSection;
  router?: RouterEntry[];
  notes?: string;
}
```

Replace the `MaintenancePayload` union at the bottom of the file:

```typescript
export type MaintenancePayload =
  | ServerMaintenancePayload
  | ServerHostPayload
  | WindowsDomainPayload
  | TerminalPayload
  | QnapPayload
  | VeeamBackupPayload;
```

- [ ] **Step 5: Update task-labels.ts**

Replace the entire content of `frontend/src/app/shared/utils/task-labels.ts`:

```typescript
import { TaskStatus, TaskType } from '../../core/models/task.models';

/** Texto legible en español para un TaskStatus. */
export function statusLabel(status: TaskStatus): string {
  const labels: Record<TaskStatus, string> = {
    PENDING:     'Pendiente',
    IN_PROGRESS: 'En curso',
    DONE:        'Listo',
    ESCALATED:   'Escalado',
    NOT_DONE:    'No hecho',
  };
  return labels[status] ?? status;
}

/** Clase CSS badge para un TaskStatus. */
export function statusBadge(status: TaskStatus): string {
  const map: Record<TaskStatus, string> = {
    PENDING:     'badge--neutral',
    IN_PROGRESS: 'badge--accent',
    DONE:        'badge--ok',
    ESCALATED:   'badge--warn',
    NOT_DONE:    'badge--crit',
  };
  return map[status] ?? 'badge--neutral';
}

/** Label corta en español para un TaskType (uso en tablas). */
export function typeLabel(type: TaskType): string {
  const labels: Record<TaskType, string> = {
    SERVER_MAINTENANCE:         'Servidores',
    SERVER_HOST_MAINTENANCE:    'VMware / BMC',
    WINDOWS_DOMAIN_MAINTENANCE: 'Windows / AD',
    QNAP_MAINTENANCE:           'QNAP/NAS',
    VEEAM_BACKUP:               'Veeam',
    TERMINAL_MAINTENANCE:       'Terminales',
    SITE_VISIT:                 'Visita',
    AV_CONTROL:                 'Antivirus',
    UPS_CONTROL:                'UPS',
    ENDPOINT_INVENTORY:         'Inventario',
  };
  return labels[type];
}

/** Label larga en español para un TaskType (uso en drawers y listas). */
export function typeLabelLong(type: TaskType): string {
  const labels: Record<TaskType, string> = {
    SERVER_MAINTENANCE:         'Mantenimiento de servidores',
    SERVER_HOST_MAINTENANCE:    'Mantenimiento de hosts VMware',
    WINDOWS_DOMAIN_MAINTENANCE: 'Mantenimiento Windows y dominios',
    QNAP_MAINTENANCE:           'Mantenimiento QNAP/NAS',
    VEEAM_BACKUP:               'Mantenimiento de backups Veeam',
    TERMINAL_MAINTENANCE:       'Visita de terminales',
    SITE_VISIT:                 'Visita presencial',
    AV_CONTROL:                 'Control antivirus',
    UPS_CONTROL:                'Control UPS',
    ENDPOINT_INVENTORY:         'Inventario',
  };
  return labels[type];
}

/** Clase CSS badge para un TaskType según si es visita o servicio. */
export function typeBadge(type: TaskType): string {
  return type === 'TERMINAL_MAINTENANCE' || type === 'SITE_VISIT'
    ? 'badge--purple'
    : 'badge--srv';
}
```

- [ ] **Step 6: Run label tests**

```bash
cd E:/develop/infraops/frontend && npx ng test --watch=false --browsers=ChromeHeadless --include="**/task-labels.spec.ts" 2>&1 | tail -5
```

Expected: `TOTAL: N SUCCESS`

- [ ] **Step 7: Commit**

```bash
git -C E:/develop/infraops add frontend/src/app/core/models/task.models.ts frontend/src/app/core/models/maintenance-log.models.ts frontend/src/app/shared/utils/task-labels.ts frontend/src/app/shared/utils/task-labels.spec.ts
git -C E:/develop/infraops commit -m "feat(frontend): agregar tipos SERVER_HOST_MAINTENANCE y WINDOWS_DOMAIN_MAINTENANCE — models + labels"
```

---

## Task 3: ServerHostFormComponent

**Files:**
- Create: `frontend/src/app/features/technician/task-drawer/server-host-form/server-host-form.component.ts`
- Create: `frontend/src/app/features/technician/task-drawer/server-host-form/server-host-form.component.html`
- Create: `frontend/src/app/features/technician/task-drawer/server-host-form/server-host-form.component.scss`
- Create: `frontend/src/app/features/technician/task-drawer/server-host-form/server-host-form.component.spec.ts`
- Modify: `frontend/src/app/features/technician/technician.module.ts`

**Interfaces:**
- Consumes: `ServerHostPayload`, `VMwareHostEntry`, `BmcEntry` from `maintenance-log.models.ts`; `ClientInfrastructure` from `infradoc.models.ts`
- Produces: `ServerHostFormComponent` with `submit()`, `save()`, `submitNotDone()` public methods; `requestComplete: EventEmitter<ServerHostPayload>`, `requestSave: EventEmitter<ServerHostPayload>`, `requestNotDone: EventEmitter<void>`

- [ ] **Step 1: Write the failing spec**

Create `frontend/src/app/features/technician/task-drawer/server-host-form/server-host-form.component.spec.ts`:

```typescript
import { FormBuilder } from '@angular/forms';
import { ServerHostFormComponent } from './server-host-form.component';
import { ClientInfrastructure, InfraAsset } from '../../../../core/models/infradoc.models';
import { ServerHostPayload } from '../../../../core/models/maintenance-log.models';
import { Task } from '../../../../core/models/task.models';

const makeTask = (): Task => ({
  id: '1', clientId: '10', technicianId: '2',
  type: 'SERVER_HOST_MAINTENANCE', status: 'PENDING',
  scheduledDate: '2026-06-01T00:00:00.000Z',
  completedDate: null, odooTicketId: null,
  createdAt: '2026-05-01T00:00:00.000Z',
});

const makeHost = (overrides: Partial<InfraAsset> = {}): InfraAsset => ({
  assetId: 1, name: 'host1.ondra', ip: '192.168.0.104',
  bmcIp: '192.168.0.200', bmcType: 'iLO',
  os: 'VMware ESXi 7.0', model: 'HPE DL380',
  ...overrides,
});

const makeInfra = (hosts: InfraAsset[] = [makeHost()]): ClientInfrastructure => ({
  esxiHosts: hosts,
  windowsVMs: [], domainControllers: [], linuxVMs: [], nas: [], routers: [],
});

describe('ServerHostFormComponent — pure unit tests', () => {
  let component: ServerHostFormComponent;

  beforeEach(() => {
    component = new ServerHostFormComponent(new FormBuilder());
    component.task = makeTask();
  });

  describe('buildForm()', () => {
    it('crea un grupo vmwareHosts y bmcHosts por cada esxiHost', () => {
      component.infrastructure = makeInfra([makeHost(), makeHost({ assetId: 2, name: 'host2' })]);
      component.ngOnChanges({ infrastructure: {} as any });
      expect(component.vmwareHostControls.length).toBe(2);
      expect(component.bmcHostControls.length).toBe(2);
    });

    it('inicializa alertStatus en "ok" para cada host', () => {
      component.infrastructure = makeInfra();
      component.ngOnChanges({ infrastructure: {} as any });
      expect(component.bmcHostControls.at(0).get('alertStatus')?.value).toBe('ok');
    });
  });

  describe('buildPayload()', () => {
    beforeEach(() => {
      component.infrastructure = makeInfra();
      component.ngOnChanges({ infrastructure: {} as any });
    });

    it('retorna payload con type SERVER_HOST_MAINTENANCE', () => {
      const payload = component.buildPayload();
      expect(payload.type).toBe('SERVER_HOST_MAINTENANCE');
    });

    it('mapea vmware con hostId, hostName y métricas del form', () => {
      component.vmwareHostControls.at(0).patchValue({ cpuUsage: 45, memUsage: 60, storageUsage: 70, snapshotsOk: true });
      const payload = component.buildPayload();
      expect(payload.vmware[0].hostId).toBe(1);
      expect(payload.vmware[0].hostName).toBe('host1.ondra');
      expect(payload.vmware[0].cpuUsage).toBe(45);
      expect(payload.vmware[0].snapshotsOk).toBe(true);
    });

    it('mapea bmc con alertStatus y omite alertCategories si no hay alerta', () => {
      component.bmcHostControls.at(0).patchValue({ alertStatus: 'ok', firmwareVersion: '2.82' });
      const payload = component.buildPayload();
      expect(payload.bmc[0].alertStatus).toBe('ok');
      expect(payload.bmc[0].firmwareVersion).toBe('2.82');
      expect(payload.bmc[0].alertCategories).toBeUndefined();
    });

    it('incluye alertCategories en bmc cuando alertStatus es "alerta"', () => {
      component.bmcHostControls.at(0).patchValue({ alertStatus: 'alerta', alertCategories: ['fan', 'psu'] });
      const payload = component.buildPayload();
      expect(payload.bmc[0].alertCategories).toEqual(['fan', 'psu']);
    });

    it('incluye notes si no está vacío', () => {
      component.form.patchValue({ notes: 'revisar próxima semana' });
      expect(component.buildPayload().notes).toBe('revisar próxima semana');
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

    it('restaura valores de vmware del payload guardado', () => {
      const payload: ServerHostPayload = {
        type: 'SERVER_HOST_MAINTENANCE',
        vmware: [{ hostId: 1, hostName: 'host1.ondra', cpuUsage: 55, memUsage: 72, storageUsage: 80, snapshotsOk: false }],
        bmc: [{ hostId: 1, hostName: 'host1.ondra', alertStatus: 'ok' }],
      };
      component.savedPayload = payload;
      component.ngOnChanges({ infrastructure: {} as any });
      expect(component.vmwareHostControls.at(0).get('cpuUsage')?.value).toBe(55);
      expect(component.vmwareHostControls.at(0).get('memUsage')?.value).toBe(72);
    });

    it('restaura alertStatus de bmc del payload guardado', () => {
      const payload: ServerHostPayload = {
        type: 'SERVER_HOST_MAINTENANCE',
        vmware: [{ hostId: 1, hostName: 'host1.ondra', cpuUsage: 0, memUsage: 0, storageUsage: 0, snapshotsOk: false }],
        bmc: [{ hostId: 1, hostName: 'host1.ondra', alertStatus: 'alerta', alertCategories: ['fan'] }],
      };
      component.savedPayload = payload;
      component.ngOnChanges({ infrastructure: {} as any });
      expect(component.bmcHostControls.at(0).get('alertStatus')?.value).toBe('alerta');
      expect(component.bmcHostControls.at(0).get('alertCategories')?.value).toEqual(['fan']);
    });

    it('ignora payload de otro tipo', () => {
      component.savedPayload = { type: 'QNAP_MAINTENANCE', qnap: [] };
      component.ngOnChanges({ infrastructure: {} as any });
      expect(component.vmwareHostControls.at(0).get('cpuUsage')?.value).toBeNull();
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

  describe('helpers', () => {
    beforeEach(() => {
      component.infrastructure = makeInfra();
      component.ngOnChanges({ infrastructure: {} as any });
    });

    it('metricClass retorna "mf-inp--crit" cuando value >= critThreshold', () => {
      expect(component.metricClass(85, 60, 80)).toBe('mf-inp--crit');
    });

    it('metricClass retorna "mf-inp--warn" cuando value >= warnThreshold', () => {
      expect(component.metricClass(65, 60, 80)).toBe('mf-inp--warn');
    });

    it('metricClass retorna "mf-inp--ok" cuando value < warnThreshold', () => {
      expect(component.metricClass(40, 60, 80)).toBe('mf-inp--ok');
    });

    it('metricClass retorna "" para null', () => {
      expect(component.metricClass(null, 60, 80)).toBe('');
    });

    it('showHighVMsForHost retorna true cuando cpu >= 60', () => {
      component.vmwareHostControls.at(0).patchValue({ cpuUsage: 60, memUsage: 0, storageUsage: 0 });
      expect(component.showHighVMsForHost(0)).toBe(true);
    });

    it('bmcHasAlert retorna true cuando alertStatus es "alerta"', () => {
      component.bmcHostControls.at(0).patchValue({ alertStatus: 'alerta' });
      expect(component.bmcHasAlert(0)).toBe(true);
    });
  });

  describe('outputs', () => {
    beforeEach(() => {
      component.infrastructure = makeInfra();
      component.ngOnChanges({ infrastructure: {} as any });
    });

    it('submit() emite requestComplete con el payload', () => {
      let emitted: ServerHostPayload | undefined;
      component.requestComplete.subscribe(p => emitted = p);
      component.submit();
      expect(emitted?.type).toBe('SERVER_HOST_MAINTENANCE');
    });

    it('save() emite requestSave con el payload', () => {
      let emitted: ServerHostPayload | undefined;
      component.requestSave.subscribe(p => emitted = p);
      component.save();
      expect(emitted?.type).toBe('SERVER_HOST_MAINTENANCE');
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

- [ ] **Step 2: Run spec to confirm it fails**

```bash
cd E:/develop/infraops/frontend && npx ng test --watch=false --browsers=ChromeHeadless --include="**/server-host-form.component.spec.ts" 2>&1 | tail -5
```

Expected: compile error — `ServerHostFormComponent` not found.

- [ ] **Step 3: Create the component TS**

Create `frontend/src/app/features/technician/task-drawer/server-host-form/server-host-form.component.ts`:

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
  MaintenancePayload,
  ServerHostPayload,
  VMwareHostEntry,
} from '../../../../core/models/maintenance-log.models';

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

  get vmwareHostControls(): FormArray {
    return this.form.get('vmwareHosts') as FormArray;
  }

  get bmcHostControls(): FormArray {
    return this.form.get('bmcHosts') as FormArray;
  }

  getBmcGroup(index: number): FormGroup {
    return this.bmcHostControls.at(index) as FormGroup;
  }

  bmcHasAlert(index: number): boolean {
    return this.getBmcGroup(index).get('alertStatus')?.value === 'alerta';
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
    const vmware: VMwareHostEntry[] = this.infrastructure.esxiHosts.map((host, i) => {
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

    const bmc: BmcEntry[] = this.infrastructure.esxiHosts.map((host, i) => {
      const ctrl = this.bmcHostControls.at(i).value;
      const entry: BmcEntry = {
        hostId:      host.assetId,
        hostName:    host.name,
        alertStatus: ctrl.alertStatus,
      };
      if (ctrl.firmwareVersion) entry.firmwareVersion = ctrl.firmwareVersion;
      if (ctrl.biosVersion)     entry.biosVersion     = ctrl.biosVersion;
      if (ctrl.alertStatus === 'alerta' && ctrl.alertCategories?.length) {
        entry.alertCategories = ctrl.alertCategories;
      }
      if (ctrl.alertLogs) entry.alertLogs = ctrl.alertLogs;
      return entry;
    });

    return {
      type: 'SERVER_HOST_MAINTENANCE',
      vmware,
      bmc,
      notes: this.form.value.notes || undefined,
    };
  }

  private buildForm(): void {
    this.form = this.fb.group({
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
    if (payload.type !== 'SERVER_HOST_MAINTENANCE') return;
    const srv = payload as ServerHostPayload;

    this.form.patchValue({ notes: srv.notes ?? '' });

    if (srv.vmware?.length) {
      this.infrastructure.esxiHosts.forEach((host, i) => {
        const saved = srv.vmware.find(h => h.hostId === host.assetId);
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
        const saved = srv.bmc.find(b => b.hostId === host.assetId);
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
  }
}
```

- [ ] **Step 4: Create the template**

Create `frontend/src/app/features/technician/task-drawer/server-host-form/server-host-form.component.html`:

```html
<form [formGroup]="form" class="shf">

  <!-- ── VMware ESXi ──────────────────────────────────── -->
  <div class="shf-section-lbl">VMware ESXi</div>

  <div class="shf-vmware-grid" formArrayName="vmwareHosts">
    <div *ngFor="let _ of vmwareHostControls.controls; let i = index"
         [formGroupName]="i"
         class="shf-cl-rpt shf-vmware-card">

      <div class="shf-cl-rpt-hdr">
        <div class="shf-cl-rpt-dot" style="background:var(--srv)"></div>
        <div class="shf-vmware-name-block">
          <span class="shf-cl-rpt-label">{{ infrastructure.esxiHosts[i].name }}</span>
          <span class="mono shf-host-ip">{{ infrastructure.esxiHosts[i].ip ?? '—' }}</span>
        </div>
      </div>

      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="shf-metric-ff"
                      [ngClass]="metricClass(vmwareHostControls.at(i).get('cpuUsage')?.value, 60, 80)">
        <mat-label>CPU</mat-label>
        <input matInput formControlName="cpuUsage" type="number" min="0" max="100" placeholder="0" />
        <span matTextSuffix>%</span>
      </mat-form-field>

      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="shf-metric-ff"
                      [ngClass]="metricClass(vmwareHostControls.at(i).get('memUsage')?.value, 70, 85)">
        <mat-label>Memoria</mat-label>
        <input matInput formControlName="memUsage" type="number" min="0" max="100" placeholder="0" />
        <span matTextSuffix>%</span>
      </mat-form-field>

      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="shf-metric-ff"
                      [ngClass]="metricClass(vmwareHostControls.at(i).get('storageUsage')?.value, 70, 85)">
        <mat-label>Storage</mat-label>
        <input matInput formControlName="storageUsage" type="number" min="0" max="100" placeholder="0" />
        <span matTextSuffix>%</span>
      </mat-form-field>

      <mat-form-field *ngIf="showHighVMsForHost(i)"
                      appearance="outline" subscriptSizing="dynamic" class="shf-form-field">
        <mat-label>VMs afectadas</mat-label>
        <mat-select formControlName="highUsageVMs" multiple>
          <mat-option *ngFor="let vm of infrastructure.windowsVMs" [value]="vm.name">
            {{ vm.name }}
          </mat-option>
        </mat-select>
      </mat-form-field>

      <mat-checkbox formControlName="snapshotsOk" class="shf-cl-mat shf-snapshot-check">
        Snapshots revisados y limpiados
      </mat-checkbox>

    </div>
  </div>

  <!-- ── BMC / Gestión remota ──────────────────────────────────────────────── -->
  <div class="shf-section-lbl">BMC / Gestión remota</div>

  <div class="shf-vmware-grid" formArrayName="bmcHosts">
    <div *ngFor="let _ of bmcHostControls.controls; let i = index"
         [formGroupName]="i"
         class="shf-cl-rpt shf-vmware-card">

      <div class="shf-cl-rpt-hdr">
        <div class="shf-cl-rpt-dot" style="background:var(--srv)"></div>
        <span class="shf-cl-rpt-label">{{ infrastructure.esxiHosts[i].name }}</span>
        <span *ngIf="infrastructure.esxiHosts[i].bmcType"
              class="badge badge--srv">{{ infrastructure.esxiHosts[i].bmcType }}</span>
        <span class="mono shf-host-ip">{{ infrastructure.esxiHosts[i].bmcIp ?? '—' }}</span>
      </div>

      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="shf-form-field">
        <mat-label>Versión firmware</mat-label>
        <input matInput formControlName="firmwareVersion" placeholder="Ej: 2.82" />
      </mat-form-field>

      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="shf-form-field">
        <mat-label>Versión BIOS</mat-label>
        <input matInput formControlName="biosVersion" placeholder="Ej: U30 v2.86" />
      </mat-form-field>

      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="shf-form-field"
                      [ngClass]="selectClass(getBmcGroup(i).get('alertStatus')?.value)">
        <mat-label>Alertas detectadas</mat-label>
        <mat-select formControlName="alertStatus">
          <mat-option value="ok">OK</mat-option>
          <mat-option value="alerta">ALERTA</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field *ngIf="bmcHasAlert(i)"
                      appearance="outline" subscriptSizing="dynamic"
                      class="shf-form-field">
        <mat-label>Categorías de alerta</mat-label>
        <mat-select formControlName="alertCategories" multiple>
          <mat-option value="fan">Fan</mat-option>
          <mat-option value="psu">PSU</mat-option>
          <mat-option value="temperatura">Temperatura</mat-option>
          <mat-option value="cpu">CPU</mat-option>
          <mat-option value="memoria">Memoria</mat-option>
          <mat-option value="storage">Storage</mat-option>
          <mat-option value="nic">NIC</mat-option>
          <mat-option value="sistema">Sistema</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" subscriptSizing="dynamic"
                      class="shf-form-field shf-alertlogs-ff">
        <mat-label>Logs en alerta</mat-label>
        <textarea matInput formControlName="alertLogs"
                  cdkTextareaAutosize
                  placeholder="Pegá aquí entradas del event log del BMC..."></textarea>
      </mat-form-field>

    </div>
  </div>

  <!-- ── Notas ─────────────────────────────────────────────────────────────── -->
  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="shf-form-field">
    <mat-label>Notas</mat-label>
    <textarea matInput formControlName="notes" cdkTextareaAutosize placeholder="Observaciones generales..."></textarea>
  </mat-form-field>

</form>
```

Note: the template uses `selectClass()` for BMC alert coloring. Add this helper to the component TS (after `bmcHasAlert()`):

```typescript
selectClass(value: string): string {
  if (!value) return 'shf-sel--na';
  if (value === 'ok') return 'shf-sel--ok';
  if (value === 'alerta') return 'shf-sel--crit';
  return 'shf-sel--na';
}
```

- [ ] **Step 5: Create the SCSS**

Create `frontend/src/app/features/technician/task-drawer/server-host-form/server-host-form.component.scss`:

```scss
.shf {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.shf-section-lbl {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  font-weight: 600;
  color: var(--tx-lo);
  letter-spacing: 0.8px;
  text-transform: uppercase;
  font-family: var(--font-mono);
  margin-top: 4px;
  white-space: nowrap;

  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border-lo);
  }
}

mat-form-field.shf-form-field {
  width: 100%;
  --mat-form-field-container-height:           32px;
  --mat-form-field-container-vertical-padding: 6px;
  --mdc-outlined-text-field-container-color:        var(--elevated);
  --mdc-outlined-text-field-outline-color:          var(--border);
  --mdc-outlined-text-field-hover-outline-color:    var(--border-md);
  --mdc-outlined-text-field-focus-outline-color:    var(--accent-bd);
  --mdc-outlined-text-field-label-text-color:       var(--tx-lo);
  --mdc-outlined-text-field-hover-label-text-color: var(--tx-md);
  --mdc-outlined-text-field-focus-label-text-color: var(--accent);
  --mat-select-trigger-text-color:                  var(--tx-hi);
  --mat-select-placeholder-text-color:              var(--tx-lo);
  --mat-select-arrow-foreground-color:              var(--tx-lo);
  --mat-select-trigger-text-size:                   11px;
}

mat-form-field.shf-metric-ff {
  width: 100%;
  --mat-form-field-container-height:           32px;
  --mat-form-field-container-vertical-padding: 6px;
  --mdc-outlined-text-field-container-color:        var(--elevated);
  --mdc-outlined-text-field-outline-color:          var(--border);
  --mdc-outlined-text-field-hover-outline-color:    var(--border-md);
  --mdc-outlined-text-field-focus-outline-color:    var(--accent-bd);
  --mdc-outlined-text-field-label-text-color:       var(--tx-lo);
  --mdc-outlined-text-field-focus-label-text-color: var(--accent);
  --mat-select-trigger-text-size:                   11px;
}

mat-form-field.shf-alertlogs-ff {
  --mdc-outlined-text-field-container-color:        var(--crit-bg);
  --mdc-outlined-text-field-outline-color:          var(--crit-bd);
  --mdc-outlined-text-field-hover-outline-color:    var(--crit-bd);
  --mdc-outlined-text-field-focus-outline-color:    var(--crit);
  --mdc-outlined-text-field-label-text-color:       var(--crit);
  --mdc-outlined-text-field-focus-label-text-color: var(--crit);
  --mdc-outlined-text-field-input-text-color:       var(--crit);
}

mat-form-field {
  &.shf-sel--ok {
    --mdc-outlined-text-field-container-color: var(--ok-bg);
    --mdc-outlined-text-field-outline-color:   var(--ok-bd);
    --mat-select-trigger-text-color:           var(--ok);
  }
  &.shf-sel--crit {
    --mdc-outlined-text-field-container-color: var(--crit-bg);
    --mdc-outlined-text-field-outline-color:   var(--crit-bd);
    --mat-select-trigger-text-color:           var(--crit);
  }
  &.shf-inp--ok {
    --mdc-outlined-text-field-container-color: var(--ok-bg);
    --mdc-outlined-text-field-outline-color:   var(--ok-bd);
  }
  &.shf-inp--warn {
    --mdc-outlined-text-field-container-color: var(--warn-bg);
    --mdc-outlined-text-field-outline-color:   var(--warn-bd);
  }
  &.shf-inp--crit {
    --mdc-outlined-text-field-container-color: var(--crit-bg);
    --mdc-outlined-text-field-outline-color:   var(--crit-bd);
  }
}

.shf-vmware-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 8px;
  align-items: start;
}

.shf-vmware-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.shf-cl-rpt {
  background: var(--card);
  border: 1px solid var(--border-lo);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  box-shadow: var(--shadow-card);
}

.shf-cl-rpt-hdr {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.shf-cl-rpt-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--tx-lo);
  flex-shrink: 0;
}

.shf-cl-rpt-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--tx-hi);
  flex: 1;
}

.shf-vmware-name-block {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}

.shf-host-ip {
  font-size: 9px;
  color: var(--tx-lo);
  font-family: var(--font-mono);
}

mat-checkbox.shf-cl-mat {
  --mdc-checkbox-unselected-outline-color:        var(--border);
  --mdc-checkbox-unselected-hover-outline-color:  var(--accent);
  --mdc-checkbox-selected-icon-color:             var(--ok-bg);
  --mdc-checkbox-selected-checkmark-color:        var(--ok);
  --mdc-checkbox-selected-focus-icon-color:       var(--ok-bg);
  --mdc-checkbox-selected-hover-icon-color:       var(--ok-bg);
  --mdc-checkbox-selected-pressed-icon-color:     var(--ok-bg);
  --mdc-form-field-label-text-size:  11px;
  --mdc-form-field-label-text-color: var(--tx-hi);

  background: var(--card);
  border: 1px solid var(--border-lo);
  border-radius: var(--radius-sm);
  padding: 6px 12px;
  display: block;
  width: 100%;
  box-sizing: border-box;
}

mat-checkbox.shf-snapshot-check {
  background: transparent !important;
  border-color: transparent !important;
}
```

- [ ] **Step 6: Register in TechnicianModule**

In `frontend/src/app/features/technician/technician.module.ts`, add import and declaration:

```typescript
import { ServerHostFormComponent } from './task-drawer/server-host-form/server-host-form.component';
```

Add `ServerHostFormComponent` to the `declarations` array (after `VeeamFormComponent`):

```typescript
declarations: [
  TaskListComponent, TaskDrawerComponent, MaintenanceFormComponent,
  ConfirmMaintenanceDialogComponent, TimeSpentDialogComponent,
  DcHealthCardComponent, QnapFormComponent, QnapDeviceCardComponent,
  VeeamFormComponent, ServerHostFormComponent
],
```

- [ ] **Step 7: Run the spec**

```bash
cd E:/develop/infraops/frontend && npx ng test --watch=false --browsers=ChromeHeadless --include="**/server-host-form.component.spec.ts" 2>&1 | tail -5
```

Expected: `TOTAL: N SUCCESS`

- [ ] **Step 8: Commit**

```bash
git -C E:/develop/infraops add "frontend/src/app/features/technician/task-drawer/server-host-form/" frontend/src/app/features/technician/technician.module.ts
git -C E:/develop/infraops commit -m "feat(frontend): ServerHostFormComponent — VMware+BMC standalone form"
```

---

## Task 4: MaintenanceFormComponent Refactor

**Files:**
- Modify: `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.ts`
- Modify: `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.html`
- Modify: `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.spec.ts`

**Interfaces:**
- Consumes: `WindowsDomainPayload` (new), `TerminalPayload` from `maintenance-log.models.ts`
- Produces: updated `MaintenanceFormComponent` emitting `WindowsDomainPayload | TerminalPayload`; no VMware/BMC public API

- [ ] **Step 1: Update the spec first**

In `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.spec.ts`:

1. Replace the import of `ServerMaintenancePayload` with `WindowsDomainPayload`:

```typescript
import {
  DcHealthSnapshot,
  WindowsDomainPayload,
  TerminalPayload,
} from '../../../../core/models/maintenance-log.models';
```

2. Change `makeTask(type = 'SERVER_MAINTENANCE')` → `makeTask(type = 'WINDOWS_DOMAIN_MAINTENANCE')` and update all literal `'SERVER_MAINTENANCE'` references inside test cases.

3. Remove any test that specifically exercises `vmwareHostControls`, `bmcHostControls`, `hasVMware`, `metricClass`, `showHighVMsForHost`, `getBmcGroup`, `bmcHasAlert`.

4. Update references to `ServerMaintenancePayload` type in tests → `WindowsDomainPayload`.

5. In any `buildPayload()` test that checks `payload.type`, update expected value to `'WINDOWS_DOMAIN_MAINTENANCE'`.

- [ ] **Step 2: Run spec to confirm new failures**

```bash
cd E:/develop/infraops/frontend && npx ng test --watch=false --browsers=ChromeHeadless --include="**/maintenance-form.component.spec.ts" 2>&1 | tail -5
```

Expected: failures due to type mismatches (not yet updated in component).

- [ ] **Step 3: Update maintenance-form.component.ts**

Replace the entire file with the following (VMware+BMC removed, types updated):

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
  RouterEntry,
  TerminalPayload,
  WindowsDomainPayload,
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
  get hasRouter(): boolean  { return this.infrastructure?.routers?.length > 0; }

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

  get routerDeviceControls(): FormArray {
    return this.form.get('routerDevices') as FormArray;
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

  toggleExpand(index: number): void {
    const ctrl = this.serverControls.at(index).get('expanded');
    ctrl?.setValue(!ctrl.value);
  }

  getServerGroup(index: number): FormGroup {
    return this.serverControls.at(index) as FormGroup;
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
      serverId:   vm.assetId,
      serverName: vm.name,
      updates:    v.servers[i]?.updates ?? 'ok',
      notes:      v.servers[i]?.notes || undefined,
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
    if (payload.type === 'WINDOWS_DOMAIN_MAINTENANCE') {
      const srv = payload as WindowsDomainPayload;

      this.form.patchValue({ notes: srv.notes ?? '' });

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

- [ ] **Step 4: Remove VMware+BMC sections from the HTML**

In `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.html`, delete the two `<ng-container *ngIf="hasVMware">` blocks:
- The VMware ESXi block (from `<!-- ── VMware ESXi` to its closing `</ng-container>`)
- The BMC block (from `<!-- ── BMC / Gestión remota` to its closing `</ng-container>`)

Both blocks are between the Windows Servers section and the Router/Firewall section.

- [ ] **Step 5: Run maintenance-form spec**

```bash
cd E:/develop/infraops/frontend && npx ng test --watch=false --browsers=ChromeHeadless --include="**/maintenance-form.component.spec.ts" 2>&1 | tail -5
```

Expected: `TOTAL: N SUCCESS`

- [ ] **Step 6: Commit**

```bash
git -C E:/develop/infraops add "frontend/src/app/features/technician/task-drawer/maintenance-form/"
git -C E:/develop/infraops commit -m "refactor(maintenance-form): extraer VMware+BMC, emitir WindowsDomainPayload"
```

---

## Task 5: TaskDrawerComponent Wiring

**Files:**
- Modify: `frontend/src/app/features/technician/task-drawer/task-drawer.component.ts`
- Modify: `frontend/src/app/features/technician/task-drawer/task-drawer.component.html`
- Modify: `frontend/src/app/features/technician/task-drawer/task-drawer.component.spec.ts`

**Interfaces:**
- Consumes: `ServerHostFormComponent.submit()`, `ServerHostFormComponent.save()`, `ServerHostFormComponent.submitNotDone()`

- [ ] **Step 1: Update task-drawer.component.ts**

Make these changes:

**Add imports** (after existing import of `VeeamFormComponent`):
```typescript
import { ServerHostFormComponent } from './server-host-form/server-host-form.component';
```

Add to the model imports:
```typescript
import {
  MaintenancePayload,
  ServerHostPayload,
  ServerMaintenancePayload,
  VeeamBackupPayload,
  WindowsDomainPayload,
} from '../../../core/models/maintenance-log.models';
```

**Add ViewChild** (after `veeamForm`):
```typescript
@ViewChild(ServerHostFormComponent) serverHostForm?: ServerHostFormComponent;
```

**Update `triggerFormComplete()`**:
```typescript
triggerFormComplete(): void {
  this.maintenanceForm?.submit();
  this.qnapForm?.submit();
  this.veeamForm?.submit();
  this.serverHostForm?.submit();
}
```

**Add `triggerServerHostSave()`** (after `triggerFormSave()`):
```typescript
triggerServerHostSave(): void {
  this.serverHostForm?.save();
}
```

**Update `detectIssues()`** — replace the entire method:
```typescript
detectIssues(payload: MaintenancePayload): {
  dcdiagErrors: string[];
  veeamMissing: boolean;
  emptyFields: string[];
} {
  if (payload.type === 'WINDOWS_DOMAIN_MAINTENANCE') {
    const srv = payload as WindowsDomainPayload;
    const dcdiagErrors: string[] = (srv.windows.domainControllers ?? [])
      .flatMap(dc => dc.warnings ?? [])
      .filter(w => w.toUpperCase().startsWith('ERROR'));
    return { dcdiagErrors, veeamMissing: false, emptyFields: [] };
  }

  if (payload.type === 'SERVER_HOST_MAINTENANCE') {
    const srv = payload as ServerHostPayload;
    const emptyFields: string[] = [];
    srv.vmware.forEach((host) => {
      const label = srv.vmware.length > 1 ? ` (${host.hostName})` : '';
      if (isNaN(host.cpuUsage))     emptyFields.push(`CPU%${label}`);
      if (isNaN(host.memUsage))     emptyFields.push(`Memoria%${label}`);
      if (isNaN(host.storageUsage)) emptyFields.push(`Storage%${label}`);
    });
    return { dcdiagErrors: [], veeamMissing: false, emptyFields };
  }

  return { dcdiagErrors: [], veeamMissing: false, emptyFields: [] };
}
```

- [ ] **Step 2: Update task-drawer.component.html — body routing**

Replace the `<app-maintenance-form>` condition line:

```html
<!-- Formulario SERVER_HOST_MAINTENANCE -->
<app-server-host-form
  *ngIf="infrastructure && task.type === 'SERVER_HOST_MAINTENANCE'"
  [task]="task"
  [infrastructure]="infrastructure"
  [savedPayload]="savedPayload"
  [readOnly]="!isActiveTask"
  (requestComplete)="onRequestComplete($event)"
  (requestSave)="onRequestSave($event)"
  (requestNotDone)="onRequestNotDone()">
</app-server-host-form>

<!-- Formulario WINDOWS_DOMAIN_MAINTENANCE + TERMINAL_MAINTENANCE + SITE_VISIT + otros -->
<app-maintenance-form
  *ngIf="infrastructure && task.type !== 'QNAP_MAINTENANCE' && task.type !== 'VEEAM_BACKUP' && task.type !== 'SERVER_HOST_MAINTENANCE'"
  [task]="task"
  [infrastructure]="infrastructure"
  [savedPayload]="savedPayload"
  [readOnly]="!isActiveTask"
  (requestComplete)="onRequestComplete($event)"
  (requestSave)="onRequestSave($event)"
  (requestNotDone)="onRequestNotDone()">
</app-maintenance-form>
```

- [ ] **Step 3: Update task-drawer.component.html — footer**

Replace the `<!-- SERVER_MAINTENANCE -->` footer block:

```html
<!-- WINDOWS_DOMAIN_MAINTENANCE -->
<ng-container *ngIf="task.type === 'WINDOWS_DOMAIN_MAINTENANCE'">
  <button mat-flat-button color="primary" (click)="triggerFormComplete()" [disabled]="completing">
    <mat-spinner *ngIf="completing" [diameter]="16"></mat-spinner>
    <span *ngIf="!completing">Completar mantenimiento</span>
  </button>
  <button mat-stroked-button (click)="triggerFormSave()" [disabled]="completing">Guardar progreso</button>
  <button mat-stroked-button (click)="drawerClosed.emit()" [disabled]="completing">Cerrar</button>
</ng-container>

<!-- SERVER_HOST_MAINTENANCE -->
<ng-container *ngIf="task.type === 'SERVER_HOST_MAINTENANCE'">
  <button mat-flat-button color="primary" (click)="triggerFormComplete()" [disabled]="completing">
    <mat-spinner *ngIf="completing" [diameter]="16"></mat-spinner>
    <span *ngIf="!completing">Completar mantenimiento</span>
  </button>
  <button mat-stroked-button (click)="triggerServerHostSave()" [disabled]="completing">Guardar progreso</button>
  <button mat-stroked-button (click)="drawerClosed.emit()" [disabled]="completing">Cerrar</button>
</ng-container>
```

Also add `'SERVER_HOST_MAINTENANCE'` to the unsupported types guard — actually it should NOT be in the unsupported block. Verify the unsupported footer guard still reads:

```html
<ng-container *ngIf="task.type === 'AV_CONTROL' || task.type === 'UPS_CONTROL' || task.type === 'ENDPOINT_INVENTORY'">
```

And delete or keep `'SERVER_MAINTENANCE'` from any footer guards (it's now dead code — the DB has no SERVER_MAINTENANCE tasks, but defensively you can leave the old block or remove it).

- [ ] **Step 4: Update task-drawer.component.spec.ts**

In the spec, find the `mockInfra` constant and the `makeTask()` helper:

1. Update `makeTask()` default type from `'SERVER_MAINTENANCE'` to `'WINDOWS_DOMAIN_MAINTENANCE'`.
2. Update any literal `'SERVER_MAINTENANCE'` in test expectations or switch cases to `'WINDOWS_DOMAIN_MAINTENANCE'`.
3. Add test case for `SERVER_HOST_MAINTENANCE`:

```typescript
it('detectIssues retorna emptyFields para SERVER_HOST_MAINTENANCE con métricas NaN', () => {
  const payload: ServerHostPayload = {
    type: 'SERVER_HOST_MAINTENANCE',
    vmware: [{ hostId: 1, hostName: 'host1', cpuUsage: NaN, memUsage: 50, storageUsage: 30, snapshotsOk: true }],
    bmc: [],
  };
  const issues = component.detectIssues(payload);
  expect(issues.emptyFields).toContain('CPU%');
});
```

- [ ] **Step 5: Run the full test suite**

```bash
cd E:/develop/infraops/frontend && npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | grep -E "TOTAL:|FAILED" | tail -3
```

Expected: `TOTAL: N SUCCESS`

- [ ] **Step 6: Commit**

```bash
git -C E:/develop/infraops add "frontend/src/app/features/technician/task-drawer/task-drawer.component.ts" "frontend/src/app/features/technician/task-drawer/task-drawer.component.html" "frontend/src/app/features/technician/task-drawer/task-drawer.component.spec.ts"
git -C E:/develop/infraops commit -m "feat(task-drawer): conectar SERVER_HOST_MAINTENANCE y WINDOWS_DOMAIN_MAINTENANCE — routing + footer + detectIssues"
```

---

## Self-review notes

- Migration runs with `transaction = false` — consistent with existing Veeam/QNAP migrations ✓
- `ServerHostFormComponent` has `selectClass()` method added in Step 4 but the spec doesn't test it — it's a pure visual helper, acceptable ✓
- `MaintenanceFormComponent` keeps `SERVER_MAINTENANCE` out of `patchFormFromPayload` — legacy logs with that type won't patch (intentional: those rows no longer exist in tasks table after migration) ✓
- `detectIssues()` in task-drawer returns empty results for `SERVER_MAINTENANCE` (legacy) — safe fallback ✓
- Router stays in `WindowsDomainPayload` for now — explicitly out of scope per spec ✓
