# DC Health Snapshot — Diseño

**Fecha:** 2026-06-17  
**Contexto:** Formulario de mantenimiento de servidores (`SERVER_MAINTENANCE`)

---

## Problema

El formulario actual de Windows Server tiene dos controles que generan fricción:

1. **Script de reinicio por servidor** — un select manual (`ok / falta_configurar / error`) que el técnico llena después de correr un script de reinicio programado. Frágil, sin datos reales del servidor.
2. **DCDIAG** — un select con tres opciones (`OK / ERROR / ERROR Systemlog`) más un campo de detalle. Reemplazable por datos objetivos del script PowerShell `Get-DCHealthSnapshot.ps1`.

El objetivo es reemplazar ambos controles por un snapshot JSON estructurado generado por el script, con visualización detallada agrupada por área (Replicación, DNS, SYSVOL).

---

## Alcance

### Se elimina
- Columna "Script reinicio" (`rebootScript`) de la tabla de servidores Windows.
- Sección DCDIAG (select + campo de detalle).

### Se agrega
- Sección "Controladores de dominio" en el formulario de `SERVER_MAINTENANCE`.
- Una card por DC detectado desde InfraDoc.
- Cada card acepta el JSON del script y lo renderiza visualmente.

### Sin cambios
- Tabla de servidores Windows (no-DCs) — mantiene solo la columna de Updates.
- Secciones VMware, BMC, QNAP, Veeam, Router — sin cambios.
- Flujo de guardado parcial y completado — mismo mecanismo.

---

## Sección 1 — Backend: detección de DCs

### `RawInfradocAsset` (backend)

Agrega campo:
```typescript
asset_description: string | null;
```

### `infrastructure.service.ts` — `groupAssets()`

Un asset `virtual machine + windows server` es DC si:
```typescript
(asset.asset_description ?? '').toLowerCase().includes('domain controller')
```

Los DCs van a `domainControllers`; el resto sigue a `windowsVMs`.

### `ClientInfrastructureDto` (backend)

```typescript
export class ClientInfrastructureDto {
  esxiHosts: InfraAssetDto[];
  windowsVMs: InfraAssetDto[];
  domainControllers: InfraAssetDto[];
  nas: InfraAssetDto[];
  routers: InfraAssetDto[];
}
```

### `ClientInfrastructure` (frontend — `infradoc.models.ts`)

```typescript
export interface ClientInfrastructure {
  esxiHosts: InfraAsset[];
  windowsVMs: InfraAsset[];
  domainControllers: InfraAsset[];
  nas: InfraAsset[];
  routers: InfraAsset[];
}
```

---

## Sección 2 — Modelos de payload (`maintenance-log.models.ts`)

### `DcHealthSnapshot` — nuevo

Espeja el output del script `Get-DCHealthSnapshot.ps1`:

```typescript
export interface DcHealthSnapshot {
  is_dc: boolean;
  dc_name: string;
  domain: string | null;
  collected_at: string;
  repl_healthy: boolean | null;
  repl_failures: number | null;
  repl_partners: number | null;
  repl_max_age_hours: number | null;
  dns_test_pass: boolean | null;
  dns_service_ok: boolean | null;
  dns_srv_ok: boolean | null;
  dns_zone_count: number | null;
  sysvol_state_ok: boolean | null;
  sysvol_backlog: number | null;
  sysvol_replication: string | null;
  warnings: string[];
}
```

### `WindowsServerEntry` — actualizado

```typescript
export interface WindowsServerEntry {
  serverId: number;
  serverName: string;
  updates: 'ok' | 'pending' | 'failed';
  notes?: string;
}
```

Eliminado: `rebootScript`.

### `WindowsSection` — actualizado

```typescript
export interface WindowsSection {
  servers: WindowsServerEntry[];
  domainControllers: DcHealthSnapshot[];
}
```

Eliminados: `dcdiag`, `dcdiagDetail`.

---

## Sección 3 — `DcHealthCardComponent`

**Ubicación:** `features/technician/task-drawer/maintenance-form/dc-health-card/`

### Interface

```typescript
@Input() dc: InfraAsset;
@Input() formGroup: FormGroup;  // { rawJson: string }
@Input() readOnly = false;
```

Sin `@Output` — el estado vive en el `FormGroup` del padre.

### Estados

| Estado | Condición | Vista |
|--------|-----------|-------|
| Vacío | `rawJson` vacío | Textarea + placeholder |
| Error de parseo | JSON malformado | Textarea + mensaje de error |
| Error semántico | `is_dc === false` | Textarea + advertencia |
| Parseado | JSON válido con `is_dc: true` | Display detallado + botón Editar |
| Read-only | `readOnly = true` | Solo display (sin textarea) |

### Lógica de parseo

Al cambiar `rawJson` (via `valueChanges`):
1. Si vacío → limpiar `parsed` y `parseError`.
2. `JSON.parse(rawJson)` — si falla → `parseError = 'JSON inválido'`.
3. Si `parsed.is_dc === false` → `parseError = 'Este equipo no es un controlador de dominio'`.
4. Si válido → `parsed = snapshot`, `parseError = null`.

Botón "Editar" (visible cuando `parsed !== null` y no `readOnly`): limpia `parsed` sin tocar el control del form. El textarea vuelve a mostrarse con el JSON previo.

### Layout del display

**Header de la card:**
- Nombre del DC (`dc.name`) · IP (`dc.ip ?? '—'`) · Dominio (`parsed.domain ?? '—'`)
- Timestamp: `parsed.collected_at` formateado con `LocalDatePipe`

**Sección Replicación AD:**
- Badge `repl_healthy`: verde (true) / rojo (false) / gris (null)
- `repl_failures`: número de fallos
- `repl_partners`: cantidad de partners
- `repl_max_age_hours`: horas desde última replicación, o "N/A" si null (DC único)

**Sección DNS:**
- Badge `dns_test_pass`: verde / rojo / gris
- Badge `dns_service_ok`: verde / rojo / gris
- Badge `dns_srv_ok`: verde / rojo / gris
- `dns_zone_count`: número de zonas

**Sección SYSVOL / DFSR:**
- Badge `sysvol_state_ok`: verde / rojo / gris
- `sysvol_replication`: texto (DFSR / FRS-o-desconocido)
- `sysvol_backlog`: número o "N/A" si null (PDC sin partners)

**Warnings** (si `warnings.length > 0`):
- Lista usando el estilo `mf-alert` existente, una entrada por warning.

---

## Sección 4 — Cambios en `MaintenanceFormComponent`

### `buildForm()`

**Agrega:**
```typescript
domainControllers: this.fb.array(
  this.infrastructure.domainControllers.map(() =>
    this.fb.group({ rawJson: [''] })
  )
)
```

**Elimina:** controles `dcdiag`, `dcdiagDetail`.

**Modifica** FormArray `servers`: grupo pasa de `{ rebootScript, updates, notes, expanded }` a `{ updates, notes, expanded }`.

### Getters

```typescript
get dcControls(): FormArray {
  return this.form.get('domainControllers') as FormArray;
}

get hasDomainControllers(): boolean {
  return this.infrastructure?.domainControllers?.length > 0;
}
```

Helpers eliminados: `dcdiagHasError()`. `serverRowClass()` simplificado o eliminado (solo queda `updates`).

### `buildPayload()`

`WindowsServerEntry` ya no incluye `rebootScript`.

`WindowsSection.domainControllers` se construye así:
```typescript
domainControllers: this.infrastructure.domainControllers
  .map((_, i) => {
    const raw = this.dcControls.at(i).get('rawJson')?.value ?? '';
    try { return JSON.parse(raw) as DcHealthSnapshot; }
    catch { return null; }
  })
  .filter((s): s is DcHealthSnapshot => s !== null),
```

Al **guardar borrador**: DCs con JSON inválido/vacío se omiten, no se bloquea el guardado.  
Al **completar**: validar que todos los DCs tengan snapshot válido antes de emitir (puede ser una advertencia, no un bloqueo duro — a definir en implementación).

### `patchFormFromPayload()`

Para `SERVER_MAINTENANCE`:
- Ya no parchea `dcdiag`/`dcdiagDetail`.
- Rellena `domainControllers` FormArray:
```typescript
srv.windows.domainControllers?.forEach((snapshot, i) => {
  this.dcControls.at(i)?.patchValue({
    rawJson: JSON.stringify(snapshot, null, 2),
  });
});
```

### Template

- Eliminar la sección DCDIAG completa.
- Eliminar columna `Script reinicio` del header y filas de `mf-srv-table`.
- Agregar sección nueva antes o después de la tabla de servidores:

```html
<ng-container *ngIf="hasDomainControllers">
  <div class="mf-section-lbl">Controladores de dominio</div>
  <ng-container formArrayName="domainControllers">
    <app-dc-health-card
      *ngFor="let _ of dcControls.controls; let i = index"
      [dc]="infrastructure.domainControllers[i]"
      [formGroup]="dcControls.at(i)"
      [readOnly]="readOnly">
    </app-dc-health-card>
  </ng-container>
</ng-container>
```

---

## Sección 5 — Tests

### Backend (`infrastructure.service.spec.ts`)

- Asset `virtual machine + windows server + description "Domain Controller"` → `domainControllers`, no `windowsVMs`.
- Asset `virtual machine + windows server` sin description → `windowsVMs`.
- Ambos tipos presentes → agrupación correcta en ambas listas.

### Frontend — `dc-health-card.component.spec.ts`

- `rawJson` vacío → textarea visible, sin display.
- JSON válido con `is_dc: true` → display visible con las 3 secciones.
- JSON válido con `is_dc: false` → error semántico visible.
- JSON malformado → `parseError` visible.
- `readOnly = true` → no hay textarea.
- Botón Editar → vuelve al textarea con el JSON anterior.

### Frontend — `maintenance-form.component.spec.ts`

- `buildPayload()` con 1 DC con JSON válido → `windows.domainControllers` contiene el snapshot.
- `buildPayload()` con DC con `rawJson` vacío → `windows.domainControllers` es array vacío.
- `buildPayload()` con DC con JSON malformado → DC omitido del array.
- `patchFormFromPayload()` con `domainControllers` en el payload → `rawJson` del control se rellena con `JSON.stringify(snapshot, null, 2)`.
- `windows.servers` ya no incluye `rebootScript` en ningún entry.

---

## Archivos a crear / modificar

| Archivo | Acción |
|---------|--------|
| `backend/src/integrations/infradoc/infradoc-assets.service.ts` | Agregar `asset_description` a `RawInfradocAsset` |
| `backend/src/integrations/infradoc/infrastructure.service.ts` | Detectar DCs por description, poblar `domainControllers` |
| `backend/src/integrations/infradoc/dto/client-infrastructure.dto.ts` | Agregar `domainControllers` |
| `backend/src/integrations/infradoc/infrastructure.service.spec.ts` | Nuevos casos de test |
| `backend/src/integrations/infradoc/infradoc-assets.service.spec.ts` | Sin cambios necesarios |
| `frontend/src/app/core/models/infradoc.models.ts` | Agregar `domainControllers` |
| `frontend/src/app/core/models/maintenance-log.models.ts` | Nuevos interfaces, actualizar existentes |
| `frontend/src/app/features/technician/task-drawer/maintenance-form/dc-health-card/dc-health-card.component.ts` | **Crear** |
| `frontend/src/app/features/technician/task-drawer/maintenance-form/dc-health-card/dc-health-card.component.html` | **Crear** |
| `frontend/src/app/features/technician/task-drawer/maintenance-form/dc-health-card/dc-health-card.component.scss` | **Crear** |
| `frontend/src/app/features/technician/task-drawer/maintenance-form/dc-health-card/dc-health-card.component.spec.ts` | **Crear** |
| `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.ts` | Modificar form, payload, patch |
| `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.html` | Modificar template |
| `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.spec.ts` | Actualizar tests |
| `frontend/src/app/features/technician/technician.module.ts` | Declarar `DcHealthCardComponent` |
