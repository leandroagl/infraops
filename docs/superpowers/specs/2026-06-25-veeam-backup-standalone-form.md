# Spec: Formulario Veeam Backup standalone + TaskType VEEAM_BACKUP

**Fecha:** 2026-06-25
**Rama:** feat/veeam-backup-section

---

## Contexto

El formulario de Veeam (jobs + VMs sin cobertura) existe actualmente como sub-componente de `MaintenanceFormComponent`, embebido dentro del flujo `SERVER_MAINTENANCE`. Se lo extrae como formulario independiente y se crea el tipo de tarea `VEEAM_BACKUP` con su propio ticket Odoo.

---

## Decisiones tomadas

- **SERVER_MAINTENANCE pierde la sección Veeam** — Veeam pasa a ser exclusivamente una tarea dedicada `VEEAM_BACKUP`.
- **Tag Odoo:** `'Backups (Veeam)'` — debe existir en Odoo antes de crear la primera tarea.
- **Patrón de referencia:** `QnapFormComponent` / `QNAP_MAINTENANCE` — todos los cambios lo siguen exactamente.
- **Componente:** se refactoriza `VeeamFormComponent` in-place (no se crea carpeta nueva).

---

## Modelo de datos

### Backend — `task-type.enum.ts`
```typescript
VEEAM_BACKUP = 'VEEAM_BACKUP'
```

### Frontend — `task.models.ts`
```typescript
export type TaskType =
  | 'SERVER_MAINTENANCE'
  | 'QNAP_MAINTENANCE'
  | 'VEEAM_BACKUP'        // nuevo
  | 'TERMINAL_MAINTENANCE'
  | 'SITE_VISIT'
  | 'AV_CONTROL'
  | 'UPS_CONTROL'
  | 'ENDPOINT_INVENTORY';
```

### Frontend — `maintenance-log.models.ts`
```typescript
export interface VeeamBackupPayload {
  type: 'VEEAM_BACKUP';
  jobs: VeeamJobEntry[];       // reutiliza interfaz existente
  uncoveredVMs: number[];
  notes?: string;
}

export type MaintenancePayload =
  | ServerMaintenancePayload
  | TerminalPayload
  | QnapPayload
  | VeeamBackupPayload;        // nuevo
```

---

## Backend — Odoo (`odoo.service.ts`)

**`TICKET_META`:**
```typescript
[TaskType.VEEAM_BACKUP]: {
  name: 'Mantenimiento de backups Veeam',
  description: 'Control de jobs de backup, puntos de restauración y cobertura de VMs.',
},
```

**Nuevo método privado:**
```typescript
private async resolveVeeamTagId(): Promise<number>
// Busca tag 'Backups (Veeam)' en Odoo. Cachea en this.veeamTagId.
// Lanza ServiceUnavailableException si no existe.
```

**`createTicket()` — condición adicional:**
```typescript
if (taskType === TaskType.VEEAM_BACKUP) {
  const tagId = await this.resolveVeeamTagId();
  payload['tag_ids'] = [[6, 0, [tagId]]];
}
```

---

## Frontend — `VeeamFormComponent` refactorizado

**Ubicación:** `frontend/src/app/features/technician/task-drawer/veeam-form/`  
(misma carpeta, componente promovido a standalone)

### Inputs
| Input | Tipo | Descripción |
|---|---|---|
| `task` | `Task` | Tarea activa |
| `infrastructure` | `ClientInfrastructure` | Infraestructura del cliente desde InfraDoc |
| `savedPayload` | `MaintenancePayload \| null` | Payload guardado (para patch) |
| `readOnly` | `boolean` | Deshabilita el formulario |

### Outputs
| Output | Tipo | Descripción |
|---|---|---|
| `requestComplete` | `EventEmitter<VeeamBackupPayload>` | Solicita completar la tarea |
| `requestNotDone` | `EventEmitter<void>` | Solicita marcar como no realizada |

### FormGroup propio
```typescript
form = fb.group({
  jobs:         fb.array([]),   // FormGroups con jobName, fullsAvailable, restorePoints
  uncoveredVMs: [[] as number[]],
  notes:        [''],
})
```

### `allVMs` — calculado internamente
```typescript
get allVMs(): InfraAsset[] {
  return [
    ...(this.infrastructure?.windowsVMs ?? []),
    ...(this.infrastructure?.domainControllers ?? []),
    ...(this.infrastructure?.linuxVMs ?? []),
  ];
}
```

### Ciclo de vida (`OnChanges`)
- `infrastructure` cambia → `buildForm()` → patch si hay `savedPayload` → `applyReadOnlyState()`
- `savedPayload` cambia → `patchFormFromPayload()` (solo si `payload.type === 'VEEAM_BACKUP'`)
- `readOnly` cambia → `applyReadOnlyState()`

### `buildPayload()` emite:
```typescript
{ type: 'VEEAM_BACKUP', jobs: [...], uncoveredVMs: [...], notes: '...' }
```

### Métodos conservados
`addJob()`, `removeJob(i)`, `toggleVM(assetId)`, `isUncovered(assetId)`, `submit()`, `submitNotDone()`

---

## Frontend — `MaintenanceFormComponent` (limpieza)

Se elimina todo lo relacionado con Veeam:
- Campo `veeam` del `FormGroup` en `buildForm()`
- Getter `veeamGroup`
- Getter `hasVeeam`
- Bloque `payload.veeam = ...` en `buildPayload()`
- Bloque `if (srv.veeam)` en `patchFormFromPayload()`
- Sección Veeam del template HTML
- Import y uso de `VeeamFormComponent` como sub-componente

---

## Frontend — `TaskDrawerComponent`

### Imports y ViewChild
```typescript
import { VeeamFormComponent } from './veeam-form/veeam-form.component';

@ViewChild(VeeamFormComponent) veeamForm?: VeeamFormComponent;
```

### `triggerFormComplete()`
```typescript
triggerFormComplete(): void {
  this.maintenanceForm?.submit();
  this.qnapForm?.submit();
  this.veeamForm?.submit();   // nuevo
}
```

### Template — formulario
```html
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

### Template — footer
```html
<ng-container *ngIf="task.type === 'VEEAM_BACKUP'">
  <button mat-flat-button color="primary" (click)="triggerFormComplete()">Completar mantenimiento</button>
  <button mat-stroked-button color="warn" (click)="onRequestNotDone()">No concretada</button>
  <button mat-stroked-button (click)="drawerClosed.emit()">Cerrar</button>
</ng-container>
```

### `drawerIconStyle()`
`VEEAM_BACKUP` usa color `--srv` (infraestructura).

---

## Frontend — Utilidades y diálogo

### `task-labels.ts`
```typescript
VEEAM_BACKUP: 'Veeam'           // typeLabel
VEEAM_BACKUP: 'Mantenimiento de backups Veeam'  // typeLabelLong
VEEAM_BACKUP: 'badge--srv'      // typeBadge
```

### `task-create-dialog.component.ts`
```typescript
{ value: 'VEEAM_BACKUP', label: 'Mantenimiento Veeam Backup' }
```

---

## Tests

- `odoo.service.spec.ts`: caso `VEEAM_BACKUP` en `createTicket()` agrega tag correcto
- `veeam-form.component.spec.ts`: reescribir para el componente standalone (patrón de `qnap-form.component.spec.ts`)
- `maintenance-form.component.spec.ts`: verificar que ya no existe sección Veeam
- `task-labels.spec.ts`: cubrir nuevo tipo

---

## Prerequisito de deploy

Crear el tag `'Backups (Veeam)'` en Odoo (Helpdesk → Configuración → Tags) antes de activar en producción.
