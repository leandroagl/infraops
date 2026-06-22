# Spec: QNAP como dominio de tarea independiente

**Fecha:** 2026-06-21
**Branch:** feature/domain-task-split

## Contexto

`SERVER_MAINTENANCE` es una tarea monolítica que cubre Windows, VMware, QNAP, Veeam y Router en un único formulario. Este spec extrae QNAP como su propio `TaskType`, con formulario propio, ticket Odoo con título/descripción específicos, y mejoras de UX en las cards de dispositivo.

`SERVER_MAINTENANCE` sigue existiendo para los demás dominios hasta que se extraigan en futuros specs. Tras este cambio, el formulario `SERVER_MAINTENANCE` pierde la sección QNAP.

---

## Cambios requeridos

### 1. Backend — TaskType + Odoo ticket

**`backend/src/tasks/task-type.enum.ts`**
```typescript
export enum TaskType {
  SERVER_MAINTENANCE    = 'SERVER_MAINTENANCE',
  QNAP_MAINTENANCE     = 'QNAP_MAINTENANCE',   // nuevo
  TERMINAL_MAINTENANCE = 'TERMINAL_MAINTENANCE',
  SITE_VISIT           = 'SITE_VISIT',
  AV_CONTROL           = 'AV_CONTROL',
  UPS_CONTROL          = 'UPS_CONTROL',
  ENDPOINT_INVENTORY   = 'ENDPOINT_INVENTORY',
}
```

**Migración PostgreSQL** — el tipo `task_type_enum` de PostgreSQL requiere `ALTER TYPE` para agregar el nuevo valor:
```sql
ALTER TYPE task_type_enum ADD VALUE IF NOT EXISTS 'QNAP_MAINTENANCE';
```

**`backend/src/integrations/odoo/odoo.service.ts` — `createTicket`**

La firma pasa a aceptar `taskType` para definir título y descripción del ticket:

```typescript
async createTicket(
  clientId: string,
  technicianId: string,
  taskType: TaskType,
): Promise<number>
```

Mapa de título/descripción por tipo:
```typescript
const TICKET_META: Record<TaskType, { name: string; description: string }> = {
  [TaskType.SERVER_MAINTENANCE]:    { name: 'Mantenimiento de infraestructura',       description: 'Mantenimiento mensual de infraestructura.' },
  [TaskType.QNAP_MAINTENANCE]:      { name: 'Mantenimiento QNAP/NAS',                 description: 'Control mensual de dispositivos NAS: espacio en disco, estado RAID, discos con error y firmware.' },
  [TaskType.TERMINAL_MAINTENANCE]:  { name: 'Mantenimiento de terminales',             description: 'Mantenimiento mensual de terminales.' },
  [TaskType.SITE_VISIT]:            { name: 'Visita técnica presencial',               description: 'Visita técnica al cliente.' },
  [TaskType.AV_CONTROL]:            { name: 'Control de antivirus',                    description: 'Control mensual de antivirus.' },
  [TaskType.UPS_CONTROL]:           { name: 'Control de UPS',                          description: 'Control mensual de equipos UPS.' },
  [TaskType.ENDPOINT_INVENTORY]:    { name: 'Inventario de endpoints',                 description: 'Relevamiento de endpoints.' },
};
```

**`backend/src/tasks/tasks.service.ts`** — pasar `dto.type` al llamar `createTicket`:
```typescript
const odooTicketId = await this.odooService.createTicket(
  dto.clientId,
  dto.technicianId,
  dto.type,
);
```

---

### 2. Frontend — modelo

**`frontend/src/app/core/models/maintenance-log.models.ts`**

Agregar interfaz de payload para el nuevo tipo:
```typescript
export interface QnapPayload {
  type: 'QNAP_MAINTENANCE';
  qnap: QNAPSection[];
  notes?: string;
}

export type MaintenancePayload = ServerMaintenancePayload | TerminalPayload | QnapPayload;
```

**`frontend/src/app/core/models/task.models.ts`**

Agregar `QNAP_MAINTENANCE` al enum `TaskType` del frontend (espejo del backend).

---

### 3. Frontend — QnapFormComponent

**Ubicación:** `frontend/src/app/features/technician/task-drawer/qnap-form/`

**Archivos:**
```
qnap-form.component.ts
qnap-form.component.html
qnap-form.component.scss
qnap-form.component.spec.ts
```

**Inputs/Outputs** (misma interfaz que `MaintenanceFormComponent`):
```typescript
@Input() task!: Task;
@Input() infrastructure!: ClientInfrastructure;
@Input() savedPayload: MaintenancePayload | null = null;
@Input() readOnly = false;
@Output() requestComplete = new EventEmitter<QnapPayload>();
@Output() requestNotDone  = new EventEmitter<void>();
```

**Lógica extraída de `MaintenanceFormComponent`:**
- `FormArray` `qnapDevices` con todos sus controles (incluyendo `totalSpaceUnit`/`usedSpaceUnit` de la feature anterior)
- Helpers: `getQnapGroup(i)`, `diskSlotOptions(i)`, `qnapFirmwareUpdated(i)`, `spaceRatio(i)`
- `buildPayload()` → retorna `QnapPayload`
- `patchFormFromPayload()` para `savedPayload` de tipo `QnapPayload`

**Helper nuevo — `qnapCardHealth(i)`:**
```typescript
qnapCardHealth(i: number): 'ok' | 'warn' | 'crit' {
  const g = this.getQnapGroup(i).value;
  const ratio = this.spaceRatio(i);
  if (g.disksWithError?.length || g.raidStatus === 'failed' || ratio > 85) return 'crit';
  if (g.raidStatus === 'degraded' || ratio > 70) return 'warn';
  return 'ok';
}
```

**UI improvements en cada card:**

1. **Health dot** — `.mf-cl-rpt-dot` recibe clase dinámica `[ngClass]`:
```html
<div class="mf-cl-rpt-dot"
     [ngClass]="'mf-cl-rpt-dot--' + qnapCardHealth(i)"></div>
```
CSS en el componente:
```scss
.mf-cl-rpt-dot--ok   { background: var(--ok); }
.mf-cl-rpt-dot--warn { background: var(--warn); }
.mf-cl-rpt-dot--crit { background: var(--crit); }
```

2. **Badge de porcentaje de espacio** — junto al campo "Espacio utilizado":
```html
<span class="qnap-space-pct" [ngClass]="metricClass(spaceRatio(i), 70, 85)">
  {{ spaceRatio(i) | number:'1.0-0' }}%
</span>
```

3. **Chips de discos con error** — debajo del multi-select cuando hay errores:
```html
<div *ngIf="getQnapGroup(i).get('disksWithError')?.value?.length"
     class="qnap-disk-error-chips">
  <span *ngFor="let disk of getQnapGroup(i).get('disksWithError')?.value"
        class="qnap-disk-chip">{{ disk }}</span>
</div>
```

---

### 4. Frontend — limpiar MaintenanceFormComponent

Eliminar de `MaintenanceFormComponent`:
- FormArray `qnapDevices` y su inicialización
- Helpers: `getQnapGroup`, `diskSlotOptions`, `qnapFirmwareUpdated`, `spaceRatio`
- Sección QNAP del template (el bloque `<ng-container *ngIf="hasQNAP">`)
- Sección QNAP de `buildPayload` (eliminar `if (this.hasQNAP) { ... }`)
- Sección QNAP de `patchFormFromPayload`
- Getter `hasQNAP`
- Tests relacionados con QNAP en `maintenance-form.component.spec.ts`

---

### 5. Frontend — routing en TaskDrawerComponent

**`task-drawer.component.html`** — el drawer elige el form según `task.type`:
```html
<app-qnap-form
  *ngIf="task.type === 'QNAP_MAINTENANCE'"
  [task]="task"
  [infrastructure]="infrastructure"
  [savedPayload]="savedPayload"
  [readOnly]="readOnly"
  (requestComplete)="onRequestComplete($event)"
  (requestNotDone)="onRequestNotDone()">
</app-qnap-form>

<app-maintenance-form
  *ngIf="task.type !== 'QNAP_MAINTENANCE'"
  [task]="task"
  ...>
</app-maintenance-form>
```

---

## Out of scope

- Migración de tareas `SERVER_MAINTENANCE` existentes
- Scheduler automático de tareas de dominio
- Cadencia configurable por dominio (bimestral, etc.)
- Otros dominios (VMware, Veeam, Router, Windows)
