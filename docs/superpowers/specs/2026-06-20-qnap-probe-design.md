# Spec: QNAP Auto-Probe en formulario de mantenimiento de servidores

**Fecha:** 2026-06-20  
**Scope:** Formulario de mantenimiento → sección QNAP/NAS  
**Estado:** Aprobado

---

## Resumen

Mejorar la sección QNAP/NAS del formulario de mantenimiento de servidores para que el técnico pueda obtener datos del dispositivo con un botón, en lugar de ingresarlos manualmente. Los datos se obtienen consultando la API QTS de QNAP directamente desde el backend de InfraOps, se muestran como read-only en el formulario, y se persisten en el payload del `MaintenanceLog` para uso en el historial del cliente.

---

## Contexto

### Estado actual del formulario QNAP

Por cada dispositivo NAS, el técnico carga manualmente:
- `spaceUsed` (% texto libre)
- `raidStatus` (select: ok / degraded / failed)
- `firmwareUpdated` (checkbox)

### Limitaciones que resuelve esta feature

- El % sin contexto de tamaño total es poco informativo
- El técnico tiene que navegar al QTS para buscar los datos y transcribirlos
- No se registra cantidad de discos ni estado individual

---

## Datos a recolectar

### Auto-obtenidos vía API QNAP (read-only en el formulario)

| Campo | Tipo | Descripción |
|---|---|---|
| `spaceUsedPercent` | `number` | % de espacio utilizado |
| `totalSpaceGb` | `number` | Espacio total en GB |
| `raidStatus` | `'ok' \| 'degraded' \| 'failed'` | Estado del RAID |
| `diskCount` | `number` | Cantidad de discos instalados |
| `diskErrors` | `number` | Cantidad de discos con error o warning |
| `currentFirmware` | `string` | Versión de firmware actual |
| `probeAt` | `string` | ISO timestamp de la consulta |

### Manuales (editables por el técnico)

| Campo | Tipo | Descripción |
|---|---|---|
| `firmwareUpdated` | `boolean` | Si se actualizó el firmware en esta visita |
| `firmwareVersion` | `string?` | Versión aplicada (visible solo si `firmwareUpdated = true`) |

---

## Modelo de datos

### `QNAPSection` (actualizado en `maintenance-log.models.ts`)

```typescript
export interface QNAPSection {
  deviceId:          number;
  deviceName:        string;
  // Auto-obtenidos — null si el probe no se ejecutó
  spaceUsedPercent:  number | null;
  totalSpaceGb:      number | null;
  raidStatus:        'ok' | 'degraded' | 'failed' | null;
  diskCount:         number | null;
  diskErrors:        number | null;
  currentFirmware:   string | null;
  probeAt:           string | null;
  // Manuales
  firmwareUpdated:   boolean;
  firmwareVersion?:  string;
}
```

Los campos auto-obtenidos son `null` cuando el técnico no ejecutó el probe, lo que permite guardar el formulario sin requerir la consulta.

### `QnapSnapshot` (DTO interno frontend, no persiste directamente)

```typescript
interface QnapSnapshot {
  spaceUsedPercent: number;
  totalSpaceGb:     number;
  raidStatus:       'ok' | 'degraded' | 'failed';
  diskCount:        number;
  diskErrors:       number;
  currentFirmware:  string;
  collectedAt:      string;
}
```

---

## Arquitectura

### Flujo de datos

```
Frontend                     Backend                        QNAP QTS API
   │                            │                              │
   │  GET /qnap-probe/:assetId  │                              │
   │──────────────────────────► │                              │
   │                            │  getAssetById(assetId)       │
   │                            │──── InfraDoc API ───────────►│
   │                            │◄── asset_uri ────────────────│
   │                            │                              │
   │                            │  POST authLogin.cgi          │
   │                            │─────────────────────────────►│
   │                            │◄── SID ──────────────────────│
   │                            │                              │
   │                            │  sysinfo + volumes + disks   │
   │                            │─────────────────────────────►│
   │                            │◄── datos ────────────────────│
   │                            │  DELETE authLogout.cgi       │
   │◄── QnapSnapshot ───────────│                              │
   │                            │
component state ← snapshot
buildPayload() mergea snapshot + campos manuales
```

### Backend — archivos nuevos/modificados

**`backend/src/integrations/infradoc/infradoc-assets.service.ts`**
- `RawInfradocAsset` → agregar `asset_uri: string | null`
- Nuevo método `getAssetById(assetId: number): Promise<RawInfradocAsset | null>`

**`backend/src/integrations/qnap/` (nuevo módulo)**
```
qnap-probe.module.ts
qnap-api.service.ts       — cliente HTTP para QTS API (auth, sysinfo, volumes, disks, logout)
qnap-probe.service.ts     — orquesta: get asset_uri → call QNAP → return QnapSnapshot
dto/qnap-snapshot.dto.ts  — DTO de respuesta
```

**`backend/src/integrations/infradoc/infrastructure.controller.ts`**
- Nuevo endpoint `GET /infrastructure/qnap-probe/:assetId`
- Guard: JWT, rol TECHNICIAN+

### `QnapApiService` — consideraciones de implementación

- `asset_uri` almacena la URL de gestión del QNAP (ej. `http://192.168.1.10:8080`)
- Credenciales vía env vars: `QNAP_READER_USER` / `QNAP_READER_PASS`
- Sin validación de certificado SSL: `httpsAgent: new https.Agent({ rejectUnauthorized: false })`
- Soporte multi-versión QTS: el servicio debe probar endpoints de QTS 5.x primero y hacer fallback a CGI API (QTS 4.x) si falla — revisar endpoints disponibles contra dispositivos reales antes de implementar
- La sesión (SID) debe cerrarse siempre con logout, incluso si falla una consulta intermedia
- No es NAS Lenovo: la abstracción debe permitir sumar otros fabricantes en el futuro sin modificar `QnapProbeService`

### Frontend — archivos nuevos/modificados

**`frontend/src/app/core/models/maintenance-log.models.ts`**
- Actualizar `QNAPSection` según modelo de datos definido arriba

**`frontend/src/app/core/models/infradoc.models.ts`**
- No requiere cambios (`asset_uri` se resuelve en el backend)

**`frontend/src/app/core/services/qnap-probe.service.ts` (nuevo)**
- `probe(assetId: number): Observable<QnapSnapshot>`
- Llama `GET /infrastructure/qnap-probe/:assetId`

**`frontend/src/app/features/technician/task-drawer/maintenance-form/qnap-health-card/` (nuevo componente)**
```
qnap-health-card.component.ts
qnap-health-card.component.html
qnap-health-card.component.scss
qnap-health-card.component.spec.ts
```

Interfaz del componente:
```typescript
@Input()  nas: InfraAsset
@Input()  formGroup: FormGroup    // { firmwareUpdated, firmwareVersion }
@Input()  savedSnapshot: QnapSnapshot | null  // null cuando no hay log previo
@Input()  readOnly: boolean
@Output() snapshotLoaded = new EventEmitter<QnapSnapshot>()
```

Estado interno:
```typescript
probeStatus: 'idle' | 'loading' | 'error' | 'loaded'
snapshot: QnapSnapshot | null   // se inicializa con savedSnapshot si existe
errorMessage: string | null
```

En `ngOnChanges`, si `savedSnapshot` cambia y `probeStatus` es `idle`, se asigna `snapshot = savedSnapshot` y `probeStatus = 'loaded'`. Esto permite que el modo `readOnly` muestre los datos históricos del payload sin necesidad de que el técnico haya presionado el botón en la sesión actual.

**`frontend/src/app/features/technician/task-drawer/maintenance-form/maintenance-form.component.ts`**
- `qnapFetchedData: (QnapSnapshot | null)[]` — array paralelo a `infrastructure.nas`, inicializado con `null`s
- `onQnapSnapshotLoaded(i: number, snap: QnapSnapshot)` — guarda en `qnapFetchedData[i]`
- `patchFormFromPayload()` — además de los campos manuales, reconstruye `qnapFetchedData[i]` desde `srv.qnap[i]` para que el card muestre datos históricos en modo `readOnly`
- FormArray de QNAP simplificado: solo `{ firmwareUpdated: false, firmwareVersion: '' }` por device
- `buildPayload()` mergea `qnapFetchedData[i]` + campos manuales del FormGroup

---

## UI del componente `QnapHealthCardComponent`

### Estado idle
```
┌──────────────────────────────────────────────┐
│ NAS-CLIENTE-01          192.168.1.10         │
│  [ Obtener datos ]                           │
└──────────────────────────────────────────────┘
```

### Estado loading
```
┌──────────────────────────────────────────────┐
│ NAS-CLIENTE-01          192.168.1.10         │
│  ⟳ Consultando...                            │
└──────────────────────────────────────────────┘
```

### Estado error
```
┌──────────────────────────────────────────────┐
│ NAS-CLIENTE-01          192.168.1.10         │
│  ✕ No se pudo conectar al dispositivo        │
│  [ Reintentar ]                              │
└──────────────────────────────────────────────┘
```

### Estado loaded
```
┌──────────────────────────────────────────────┐
│ NAS-CLIENTE-01   192.168.1.10   14:32        │
│                                              │
│  ALMACENAMIENTO                              │
│  Total: 8 TB   Usado: 2.4 TB   30% [verde]  │
│                                              │
│  RAID                    DISCOS              │
│  [ OK ]                  4 · [ 0 errores ]  │
│                                              │
│  FIRMWARE                                    │
│  5.1.5.2647                                  │
│  ──────────────────────────────────────────  │
│  □  Firmware actualizado                     │
│     Versión aplicada: [_______________]      │  ← solo visible si checked
└──────────────────────────────────────────────┘
```

### Coloring semántico (consistente con el resto del formulario)

| Métrica | OK | Warn | Crit |
|---|---|---|---|
| `spaceUsedPercent` | < 70% | 70–84% | ≥ 85% |
| `raidStatus` | `ok` | `degraded` | `failed` |
| `diskErrors` | `0` | — | `> 0` |

---

## Comportamiento del formulario

- El formulario **guarda sin errores** aunque el probe no se haya ejecutado (todos los campos auto-obtenidos quedan `null`)
- El botón "Obtener datos" está disponible en modo edición; oculto en modo `readOnly`
- En modo `readOnly` con datos: `patchFormFromPayload` reconstruye `qnapFetchedData[i]` desde el payload y lo pasa como `savedSnapshot` al card, que lo muestra directamente
- En modo `readOnly` sin datos: muestra "Sin datos automáticos" en lugar del botón

---

## Histórico en perfil de cliente

Los campos auto-obtenidos se persisten completos en `MaintenanceLog.payload.qnap[]`. La vista `ClientMantenimientosComponent` no se modifica en esta feature — cuando se construya el historial detallado, los datos ya estarán disponibles en el payload jsonb.

---

## Lo que está fuera de scope

- Soporte para NAS Lenovo (future)
- Creación automática de ticket Odoo ante alertas detectadas (future — la estructura del snapshot ya lo habilita)
- Módulo vault de credenciales (future — hoy se usa `QNAP_READER_USER` / `QNAP_READER_PASS` en `.env`)
- Vista de historial detallado de QNAP en el perfil del cliente (future)
