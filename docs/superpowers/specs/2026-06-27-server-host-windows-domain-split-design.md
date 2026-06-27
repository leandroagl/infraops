# Diseño: Split SERVER_MAINTENANCE → SERVER_HOST_MAINTENANCE + WINDOWS_DOMAIN_MAINTENANCE

**Fecha:** 2026-06-27  
**Scope:** Backend (enum + migration + payloads) + Frontend (nuevo form + refactor maintenance-form)

---

## Contexto

El `TaskType` `SERVER_MAINTENANCE` agrupa actualmente tres dominios distintos de hardware:
- **VMware ESXi + BMC** (hosts físicos de virtualización)
- **Windows Servers + Domain Controllers** (VMs Windows y AD)
- **Router/Firewall** (red del cliente)

QNAP y Veeam ya fueron extraídos como dominios independientes. Este spec extrae VMware+BMC y formaliza el dominio Windows+AD, siguiendo el mismo patrón.

Router queda temporalmente en `WINDOWS_DOMAIN_MAINTENANCE` hasta su propio split futuro.

---

## Nuevos TaskTypes

| TaskType | Descripción | Reemplaza |
|---|---|---|
| `SERVER_HOST_MAINTENANCE` | VMware ESXi + BMC | Sub-sección de SERVER_MAINTENANCE |
| `WINDOWS_DOMAIN_MAINTENANCE` | Windows Servers + DCs + Router | SERVER_MAINTENANCE |

`SERVER_MAINTENANCE` queda en el enum de PostgreSQL por compatibilidad (no se puede eliminar valores de un enum sin recrearlo), pero el código lo ignora a partir de esta implementación.

---

## Backend

### TaskType enum (`task-type.enum.ts`)

```typescript
SERVER_HOST_MAINTENANCE    = 'SERVER_HOST_MAINTENANCE',
WINDOWS_DOMAIN_MAINTENANCE = 'WINDOWS_DOMAIN_MAINTENANCE',
// SERVER_MAINTENANCE queda pero no se usa en código nuevo
```

### Migración

Una sola migration con `transaction = false` (requerido por `ALTER TYPE ADD VALUE`):

```sql
-- Paso 1: agregar valores al enum (fuera de transacción)
ALTER TYPE "public"."tasks_type_enum" ADD VALUE IF NOT EXISTS 'SERVER_HOST_MAINTENANCE';
ALTER TYPE "public"."tasks_type_enum" ADD VALUE IF NOT EXISTS 'WINDOWS_DOMAIN_MAINTENANCE';

-- Paso 2: migrar registros existentes (en transacción separada)
UPDATE tasks SET type = 'WINDOWS_DOMAIN_MAINTENANCE' WHERE type = 'SERVER_MAINTENANCE';
```

La migration usa `transaction = false` (patrón ya establecido en `AddVeeamBackupTaskType`). Los dos `ALTER TYPE ADD VALUE` y el `UPDATE` van todos en el mismo método `up()` — TypeORM los ejecuta secuencialmente sin transacción envolvente, lo que es correcto para este caso.

Los payloads jsonb históricos en `maintenance_logs` no se migran — solo el campo `type` de la tabla `tasks`.

### Payload interfaces (`log-item.interface.ts`)

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

`ServerMaintenancePayload` se mantiene sin cambios para los logs históricos.

`MaintenancePayload` union:
```typescript
export type MaintenancePayload =
  | ServerMaintenancePayload
  | ServerHostPayload
  | WindowsDomainPayload
  | TerminalPayload;
```

---

## Frontend

### Modelos (`maintenance-log.models.ts`)

Se agregan `ServerHostPayload` y `WindowsDomainPayload` con las mismas estructuras que el backend. `MaintenancePayload` union se extiende con los dos tipos nuevos. `ServerMaintenancePayload` queda intacto.

### TaskType frontend (`task.models.ts`)

```typescript
SERVER_HOST_MAINTENANCE    = 'SERVER_HOST_MAINTENANCE',
WINDOWS_DOMAIN_MAINTENANCE = 'WINDOWS_DOMAIN_MAINTENANCE',
```

### Labels (`task-labels.ts`)

| TaskType | `typeLabel` | `typeLabelLong` | `typeBadge` |
|---|---|---|---|
| `SERVER_HOST_MAINTENANCE` | `'VMware / BMC'` | `'Mantenimiento de hosts VMware'` | `'badge--srv'` |
| `WINDOWS_DOMAIN_MAINTENANCE` | `'Windows / AD'` | `'Mantenimiento Windows y dominios'` | `'badge--srv'` |

### Nuevo componente: `ServerHostFormComponent`

**Ruta:** `task-drawer/server-host-form/`

**Archivos:**
```
server-host-form.component.ts
server-host-form.component.html
server-host-form.component.scss
server-host-form.component.spec.ts
```

**Inputs/Outputs:**
```typescript
@Input() task: Task
@Input() infrastructure: ClientInfrastructure
@Input() savedPayload: MaintenancePayload | null
@Input() readOnly: boolean
@Output() requestComplete = new EventEmitter<ServerHostPayload>()
@Output() requestNotDone  = new EventEmitter<void>()
```

**Formulario reactivo:** dos `FormArray` paralelos indexados por `esxiHosts`:
- `vmwareHosts`: `cpuUsage`, `memUsage`, `storageUsage`, `highUsageVMs[]`, `snapshotsOk`
- `bmcHosts`: `firmwareVersion`, `biosVersion`, `alertStatus`, `alertCategories[]`, `alertLogs`
- `notes`: campo de texto libre

**Comportamiento:**
- Al inicializar, construye los arrays con un grupo por host en `infrastructure.esxiHosts`
- Si `savedPayload?.type === 'SERVER_HOST_MAINTENANCE'`, hace patch de valores guardados
- `readOnly = true` deshabilita el form completo
- `buildPayload()` construye el `ServerHostPayload` a emitir

**Template:** extrae el HTML de las secciones VMware y BMC de `maintenance-form.component.html` sin modificaciones visuales. Las helpers `metricClass()`, `showHighVMsForHost()`, `getBmcGroup()`, `bmcHasAlert()` se mueven a este componente.

**Estilos:** reutiliza las clases `.mf-vmware-grid`, `.mf-vmware-card`, `.mf-metric-ff` ya definidas en `maintenance-form.component.scss`. Las clases compartidas que sean necesarias se extraen o se duplican si son específicas de este contexto.

### Cambios en `MaintenanceFormComponent`

- Eliminar `FormArray` `vmwareHosts` y `bmcHosts` del form reactivo
- Eliminar getter `hasVMware`, métodos `metricClass()`, `showHighVMsForHost()`, `getBmcGroup()`, `bmcHasAlert()`
- Eliminar secciones VMware y BMC del template
- El payload emitido cambia: `ServerMaintenancePayload` → `WindowsDomainPayload` (type `'WINDOWS_DOMAIN_MAINTENANCE'`)
- El campo `vmware` y `bmc` desaparecen del payload construido; `windows` y `router` se mantienen

### Routing en `task-drawer.component.html`

```html
<!-- SERVER_HOST_MAINTENANCE -->
<app-server-host-form
  *ngIf="infrastructure && task.type === 'SERVER_HOST_MAINTENANCE'"
  [task]="task"
  [infrastructure]="infrastructure"
  [savedPayload]="savedPayload"
  [readOnly]="!isActiveTask"
  (requestComplete)="onRequestComplete($event)"
  (requestNotDone)="onRequestNotDone()">
</app-server-host-form>

<!-- WINDOWS_DOMAIN_MAINTENANCE + TERMINAL_MAINTENANCE + SITE_VISIT + resto -->
<app-maintenance-form
  *ngIf="infrastructure
    && task.type !== 'QNAP_MAINTENANCE'
    && task.type !== 'VEEAM_BACKUP'
    && task.type !== 'SERVER_HOST_MAINTENANCE'"
  ...>
</app-maintenance-form>
```

### Footer en `task-drawer.component.html`

El bloque `SERVER_MAINTENANCE` se reemplaza por `WINDOWS_DOMAIN_MAINTENANCE` con los mismos botones (Completar + Guardar progreso + Cerrar). Se agrega un bloque nuevo para `SERVER_HOST_MAINTENANCE` con los mismos botones.

---

## Tests

### `server-host-form.component.spec.ts` (nuevo)
- Inicialización: form construye N grupos por N `esxiHosts`
- `buildPayload()` retorna `ServerHostPayload` con `type: 'SERVER_HOST_MAINTENANCE'`
- `patchForm()` restaura valores desde `savedPayload`
- `readOnly = true` deshabilita el form
- `requestComplete` emite con payload correcto
- `requestNotDone` emite al invocar el método

### `maintenance-form.component.spec.ts`
- Reemplazar referencias `ServerMaintenancePayload` / `'SERVER_MAINTENANCE'` por `WindowsDomainPayload` / `'WINDOWS_DOMAIN_MAINTENANCE'`
- Eliminar tests de secciones VMware/BMC
- Verificar ausencia de `hasVMware` y arrays relacionados

### `task-drawer.component.spec.ts`
- Actualizar `makeTask()` default a `WINDOWS_DOMAIN_MAINTENANCE`
- Agregar casos para `SERVER_HOST_MAINTENANCE`

### `task-labels.spec.ts`
- Agregar casos para `typeLabel`, `typeLabelLong` y `typeBadge` de ambos tipos nuevos

---

## Fuera de scope

- Split de Router como dominio independiente (trabajo futuro)
- Migración del campo `type` en el payload jsonb de `maintenance_logs`
- Renombrar `MaintenanceFormComponent` a `WindowsDomainFormComponent`
