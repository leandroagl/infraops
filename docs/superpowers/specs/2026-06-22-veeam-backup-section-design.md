# Veeam Backup Section — Diseño

**Fecha:** 2026-06-22  
**Branch:** `feat/veeam-backup-section`

## Objetivo

Reemplazar la `VeeamSection` actual (`status: ok|partial|missing` + `missingVMs: string[]`) por una sección estructurada que capture:

1. **Lista dinámica de jobs de backup** — el técnico agrega una fila por job con nombre, fulls disponibles y restore points.
2. **Checklist de cobertura de VMs** — InfraDoc provee la lista completa de VMs; el técnico marca cuáles no están cubiertas por ningún job.

Las réplicas Veeam quedan fuera de scope (futuro).

---

## Cambios de backend — InfraDoc

### Problema
`groupAssets` en `InfrastructureService` solo captura VMs con OS `windows server`. Las VMs Linux (y otros OS) caen en el `else` y no se exponen.

### Solución
Agregar `linuxVMs: InfraAssetDto[]` al DTO. Toda VM con `asset_type === 'virtual machine'` cuyo OS **no** empiece con `windows server` va a `linuxVMs`.

**Archivos afectados:**
- `backend/src/integrations/infradoc/dto/client-infrastructure.dto.ts` — agregar `linuxVMs`
- `backend/src/integrations/infradoc/infrastructure.service.ts` — capturar VMs no-Windows
- `backend/src/integrations/infradoc/infrastructure.service.spec.ts` — tests de detección Linux
- `frontend/src/app/core/models/infradoc.models.ts` — agregar `linuxVMs: InfraAsset[]`

---

## Modelo de datos

### `VeeamJobEntry`
```typescript
export interface VeeamJobEntry {
  jobName: string;
  fullsAvailable: number;
  restorePoints: number;
}
```

### `VeeamSection` (reemplaza la actual)
```typescript
export interface VeeamSection {
  jobs: VeeamJobEntry[];
  uncoveredVMs: number[];  // assetIds de VMs sin cobertura
}
```

El campo `uncoveredVMs` usa `assetId` (número) para que si una VM cambia de nombre en InfraDoc, la referencia no se rompa.

---

## Componente: `VeeamFormComponent`

Componente presentacional extraído del formulario de mantenimiento, similar al patrón `QnapDeviceCardComponent`.

### Inputs
```typescript
@Input() formGroup!: FormGroup;       // { jobs: FormArray, uncoveredVMs: number[] }
@Input() allVMs!: InfraAsset[];       // windowsVMs + domainControllers + linuxVMs
@Input() readOnly = false;
```

### Estructura del FormGroup
```typescript
fb.group({
  jobs: fb.array([]),            // FormArray de { jobName, fullsAvailable, restorePoints }
  uncoveredVMs: [[] as number[]] // IDs de VMs no cubiertas
})
```

### Métodos
- `addJob()` — agrega una fila vacía al FormArray
- `removeJob(i: number)` — quita la fila i
- `toggleVM(assetId: number)` — agrega o quita del array `uncoveredVMs`
- `isUncovered(assetId: number): boolean` — helper para el checklist

### Comportamiento
- El botón "Agregar job" no aparece en `readOnly`
- El botón de eliminar job no aparece en `readOnly`
- Cuando `readOnly = true` → `formGroup.disable()`
- Si no hay VMs en `allVMs` (cliente sin VMs en InfraDoc), la sección de cobertura no se renderiza

---

## Integración en `MaintenanceFormComponent`

### `allVMs` getter
```typescript
get allVMs(): InfraAsset[] {
  return [
    ...(this.infrastructure.windowsVMs ?? []),
    ...(this.infrastructure.domainControllers ?? []),
    ...(this.infrastructure.linuxVMs ?? []),
  ];
}
```

### `buildForm` — grupo Veeam
```typescript
veeam: this.fb.group({
  jobs: this.fb.array([]),
  uncoveredVMs: [[] as number[]],
})
```

### `buildPayload` — mapeo a `VeeamSection`
```typescript
if (this.hasVeeam) {
  const veeamVal = this.form.get('veeam')!.value;
  payload.veeam = {
    jobs: veeamVal.jobs.map((j: any) => ({
      jobName:        j.jobName,
      fullsAvailable: Number(j.fullsAvailable),
      restorePoints:  Number(j.restorePoints),
    })),
    uncoveredVMs: veeamVal.uncoveredVMs ?? [],
  };
}
```

### `patchFormFromPayload` — restauración
Al recibir un payload guardado:
1. Por cada job en `payload.veeam.jobs`, agregar un grupo al FormArray con sus valores.
2. Patchear `uncoveredVMs` con el array de IDs.

---

## Storybook

**Precondición:** Storybook debe estar instalado (plan `2026-06-22-storybook-qnap-device-card`).

Stories para `VeeamFormComponent`:

| Story | Descripción |
|---|---|
| `Empty` | Sin jobs, sin VMs marcadas como no cubiertas |
| `WithJobs` | 3 jobs completos, todas las VMs cubiertas |
| `UncoveredVMs` | 2 jobs, 2 VMs marcadas sin cobertura |
| `ReadOnly` | Estado guardado, form deshabilitado |

Cada story construye el `FormGroup` inline y pasa `allVMs` con datos de ejemplo (2 Windows VMs + 1 Linux VM).

---

## Archivos a crear / modificar

| Acción | Archivo |
|---|---|
| Modificar | `backend/src/integrations/infradoc/dto/client-infrastructure.dto.ts` |
| Modificar | `backend/src/integrations/infradoc/infrastructure.service.ts` |
| Modificar | `backend/src/integrations/infradoc/infrastructure.service.spec.ts` |
| Modificar | `frontend/src/app/core/models/infradoc.models.ts` |
| Modificar | `frontend/src/app/core/models/maintenance-log.models.ts` |
| Crear | `frontend/src/app/features/technician/task-drawer/veeam-form/veeam-form.component.ts` |
| Crear | `frontend/src/app/features/technician/task-drawer/veeam-form/veeam-form.component.html` |
| Crear | `frontend/src/app/features/technician/task-drawer/veeam-form/veeam-form.component.scss` |
| Crear | `frontend/src/app/features/technician/task-drawer/veeam-form/veeam-form.component.spec.ts` |
| Crear | `frontend/src/app/features/technician/task-drawer/veeam-form/veeam-form.component.stories.ts` |
| Modificar | `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.ts` |
| Modificar | `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.html` |
| Modificar | `frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.spec.ts` |
| Modificar | `frontend/src/app/features/technician/technician.module.ts` |

---

## Lo que queda fuera de scope

- Réplicas Veeam
- Integración con API de Veeam (todo es manual)
- Alertas automáticas por fulls bajos o restore points escasos
