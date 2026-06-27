# Spec: VeeamFormComponent v2

## Contexto

Rediseño completo del control mensual de Veeam Backup. Reemplaza el modelo anterior (jobs + uncoveredVMs) por un control por VM: cada VM recibe un tipo de cobertura y un conteo de fulls en el mes.

Referencia visual: `docs/mockups/veeam-control-v2.html`.

---

## Archivos afectados

| Archivo | Acción |
|---|---|
| `frontend/src/app/core/models/maintenance-log.models.ts` | Agregar `VeeamVmEntry`, reemplazar `VeeamBackupPayload` |
| `task-drawer/veeam-form/veeam-form.component.ts` | Rediseño completo |
| `task-drawer/veeam-form/veeam-form.component.html` | Rediseño completo |
| `task-drawer/veeam-form/veeam-form.component.scss` | Rediseño completo |
| `task-drawer/veeam-form/veeam-form.component.spec.ts` | Reescritura completa |
| `task-drawer/task-drawer.component.ts` | Agregar getters `veeamVms` y `veeamPayload` |
| `task-drawer/task-drawer.component.html` | Actualizar binding `<app-veeam-form>` y footer VEEAM_BACKUP |
| `technician.module.ts` | Sin cambios |

---

## Modelo

```typescript
export interface VeeamVmEntry {
  vmName: string;
  coverage: 'job' | 'agent' | 'excluded' | 'no_backup';
  fullsInMonth: number | null;  // null si excluded | no_backup
}

export interface VeeamBackupPayload {
  type: 'VEEAM_BACKUP';
  vms: VeeamVmEntry[];
  notes: string | null;
}
```

`VeeamJobEntry` y `VeeamSection` se mantienen intactos — los usa `ServerMaintenancePayload.veeam`, que es independiente.

---

## API del componente

```typescript
@Input() vms: { name: string; os: string }[] = [];       // de InfraDoc vía TaskDrawer
@Input() existingPayload?: VeeamBackupPayload;            // payload guardado, si existe
@Input() readOnly = false;                                // form deshabilitado si tarea DONE/ESCALATED
@Output() saved     = new EventEmitter<VeeamBackupPayload>();
@Output() cancelled = new EventEmitter<void>();
```

### Formulario interno

```typescript
form = fb.group({
  vmRows: fb.array([]),   // un FormGroup por VM: { coverage, fullsInMonth }
  notes: [''],
})
```

Inicialización: un grupo por elemento de `vms[]` con defaults `{ coverage: 'job', fullsInMonth: null }`. Si hay `existingPayload`, se parchea por nombre de VM.

---

## Lógica de estado por VM

Umbrales confirmados: **≥2 fulls = verde**.

| coverage | fulls | `vmRowState` | clase fila | `vmHint` | clase hint |
|---|---|---|---|---|---|
| `excluded` | — | `'excl'` | `.st-excl` (gris) | `'Excluida ✓'` | `h-ok` (verde) |
| `no_backup` | — | `'no'` | `.st-no` (rojo) | `'Sin cobertura'` | `h-no` (rojo) |
| job/agent | null o 0 | `'no'` | `.st-no` | `'Sin fulls registrados'` | `h-no` |
| job/agent | 1 | `'warn'` | `.st-warn` | `'Verificar cadena de incrementales'` | `h-warn` |
| job/agent | ≥2 | `'ok'` | `.st-ok` | `'{n} fulls ✓'` | `h-ok` |

### Pills de resumen

`excluded` → cuenta como OK en pills.

| Pill | Color si N>0 | Qué cuenta |
|---|---|---|
| "N OK" | verde | `excl` + job/agent + ≥2 |
| "N Advertencia" | naranja | job/agent + 1 |
| "N Sin cobertura" | rojo | `no_backup` + job/agent + 0 |

---

## Coloring de controles (sin `::ng-deep`)

Via CSS custom properties en el SCSS del componente, usando `[ngClass]` en `mat-form-field`:

```scss
mat-form-field.cov--ok   { --mdc-outlined-text-field-outline-color: var(--ok-bd);   --mat-select-trigger-text-color: var(--ok);   }
mat-form-field.cov--warn { --mdc-outlined-text-field-outline-color: var(--warn-bd); --mat-select-trigger-text-color: var(--warn); }
mat-form-field.cov--no   { --mdc-outlined-text-field-outline-color: var(--crit-bd); --mat-select-trigger-text-color: var(--crit); }

mat-form-field.fulls--ok   { --mdc-outlined-text-field-outline-color: var(--ok-bd);   --mdc-outlined-text-field-input-text-color: var(--ok);   }
mat-form-field.fulls--warn { --mdc-outlined-text-field-outline-color: var(--warn-bd); --mdc-outlined-text-field-input-text-color: var(--warn); }
mat-form-field.fulls--no   { --mdc-outlined-text-field-outline-color: var(--crit-bd); --mdc-outlined-text-field-input-text-color: var(--crit); }
```

---

## Integración en TaskDrawerComponent

### Nuevos getters

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

### Binding actualizado en el template

```html
<app-veeam-form
  *ngIf="infrastructure && task.type === 'VEEAM_BACKUP'"
  [vms]="veeamVms"
  [existingPayload]="veeamPayload"
  [readOnly]="!isActiveTask"
  (saved)="onRequestComplete($event)"
  (cancelled)="drawerClosed.emit()">
</app-veeam-form>
```

### Footer VEEAM_BACKUP

Se eliminan los botones "Completar mantenimiento" y "Cerrar" del bloque VEEAM_BACKUP en el footer del drawer (el form los maneja internamente). Se conserva "No concretada" en el drawer.

```html
<ng-container *ngIf="task.type === 'VEEAM_BACKUP'">
  <button mat-stroked-button color="warn" (click)="onRequestNotDone()">No concretada</button>
</ng-container>
```

---

## Tests (veeam-form.component.spec.ts)

| Grupo | Casos |
|---|---|
| Inicialización | FormArray con un grupo por VM, coverage='job', fullsInMonth=null |
| `onCoverageChange` | excluded → fullsInMonth=null; no_backup → fullsInMonth=null; job/agent no toca fulls |
| `vmRowState` | excl→'excl', no_backup→'no', fulls null→'no', fulls 1→'warn', fulls 2→'ok' |
| `vmHint` | excl→'Excluida ✓'/h-ok, no→'Sin cobertura'/h-no, 0→h-no, 1→h-warn, ≥2→h-ok |
| Pills `summaryOk/Warn/No` | counts correctos; excl cuenta como ok |
| `existingPayload` patch | valores parcheados por nombre de VM |
| `readOnly` | `form.disabled === true` |
| `saved` | emite payload con type, vms y notes |
| `cancelled` | emite evento |
| `buildPayload` | nullifica fullsInMonth para excl/no_backup; notes null si vacío |
