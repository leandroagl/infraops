# Spec: VMware ESXi Health Check

**Fecha:** 2026-06-28  
**Branch:** feature/vmware-health-check  
**Scope:** Control de salud de hosts ESXi standalone (sin vCenter) ejecutado desde el drawer de mantenimiento de servidores.

---

## Contexto

En el drawer de mantenimiento de servidores (`SERVER_HOST_MAINTENANCE`), cada host ESXi se mostrará como una card individual. El técnico puede ejecutar un script Python con pyVmomi contra el host correspondiente y ver los resultados inline en esa card. Los resultados se persisten en el payload `jsonb` del `MaintenanceLog` al completar la tarea, para uso futuro en el dashboard de cliente.

El contenido ESXi existente en `ServerHostFormComponent` está obsoleto y se reemplaza completamente por esta feature.

---

## Arquitectura general

```
InfraDoc API
  └─ uri1, uri2 (campos nuevos) ──► InfradocAssetsService (extender RawInfradocAsset)
                                    └─ InfraAssetDto (agregar uri1/uri2)
                                       └─ Frontend: InfraAsset model

Frontend (EsxiHostCardComponent)
  └─ botón "Ejecutar control" ──► POST /integrations/vmware/health-check
                                   └─ VmwareController
                                      └─ VmwareService
                                         └─ child_process.spawn(python3 collectors/vmware/vmware_health.py)
                                            └─ JSON stdout ──► response al frontend
                                               └─ EsxiHostCardComponent muestra resultados inline

Al completar tarea:
  ServerHostFormComponent.buildPayload()
    └─ { esxiHosts: [{ assetId, vmwareCheck: VmwareHealthResult, notes? }] }
       └─ MaintenanceLog.payload (jsonb)
```

---

## Backend

### 1. Extensión InfraDoc

**Archivos a modificar:**
- `backend/src/integrations/infradoc/infradoc-assets.service.ts`
- `backend/src/integrations/infradoc/dto/client-infrastructure.dto.ts`

`RawInfradocAsset` agrega:
```typescript
uri1: string | null
uri2: string | null
```

El mapper propaga ambos campos a `InfraAssetDto`. Sin transformación — se pasan tal cual desde la API de InfraDoc.

### 2. Módulo `integrations/vmware/`

```
backend/src/integrations/vmware/
├── vmware-integration.module.ts
├── vmware.controller.ts
├── vmware.service.ts
└── dto/
    ├── health-check-request.dto.ts
    └── vmware-health-result.dto.ts
```

Registrado en `AppModule`.

**Controller:** `POST /integrations/vmware/health-check`
- Guard: `JwtAuthGuard`
- Body: `HealthCheckRequestDto { hostUri: string }`
- Response: `VmwareHealthResult`
- Sin lógica de negocio — delega completamente al service

**Service `VmwareService.runHealthCheck(hostUri: string)`:**
1. Parsea host y puerto de `hostUri` (formato `host:puerto`).
2. Lanza `python3 collectors/vmware/vmware_health.py --host <host> --port <puerto> --user $VMWARE_USER --pass $VMWARE_PASS` via `child_process.spawn`.
3. Acumula stdout en buffer.
4. Si el proceso no termina en 30s → `kill()` → lanza `GatewayTimeoutException`.
5. Si exit code ≠ 0 → lanza `BadGatewayException` con stderr como mensaje.
6. Parsea JSON de stdout → retorna objeto tipado.

Las credenciales `VMWARE_USER` y `VMWARE_PASS` se leen desde `process.env`. Nunca viajan al frontend.

### 3. Contrato de datos `VmwareHealthResult`

```typescript
interface VmwareHealthResult {
  host: {
    name: string;
    esxiVersion: string;        // "VMware ESXi 7.0.3 build-21930508"
    uptimeHours: number;
    cpuUsagePct: number;
    memUsagePct: number;
    memOvercommitRatio: number; // memoria configurada VMs / memoria física
    overallStatus: 'green' | 'yellow' | 'red';
    hardwareAlerts: string[];   // vacío si todo ok
  };
  datastores: Array<{
    name: string;
    type: 'VMFS' | 'NFS' | string;
    capacityGb: number;
    freeGb: number;
    usedPct: number;
    accessible: boolean;
  }>;
  vms: {
    poweredOn: number;
    poweredOff: number;
    suspended: number;
    snapshots: Array<{
      vmName: string;
      count: number;
      oldestDays: number;
    }>;
    toolsNotOk: number;
  };
  network: {
    vswitchErrors: string[];  // vacío si todo ok
    nicsFailed: string[];     // vacío si todas up
  };
  collectedAt: string;        // ISO 8601
}
```

---

## Script Python

```
collectors/
└── vmware/
    ├── vmware_health.py
    └── requirements.txt      # pyVmomi==8.x
```

**Invocación:**
```
python3 collectors/vmware/vmware_health.py \
  --host <ip_o_dns> --port <puerto> \
  --user <user> --pass <pass>
```

**Flujo:**
1. `SmartConnect` con `disableSslCertValidation=True` (hosts internos sin cert válido).
2. Recolección con un único `RetrieveContentsEx` con múltiples propiedades para minimizar round-trips al host.
3. Cálculo de métricas derivadas (uptime, overcommit ratio, antigüedad de snapshots, etc.).
4. Print JSON a stdout → exit 0.
5. Cualquier excepción → print a stderr → exit 1.

**Datos recolectados:**
- Host: nombre, versión ESXi + build, uptime en horas, CPU % uso, mem % uso, memory overcommit ratio, overall_status, sensores (PSU/fans/temperatura) — estado agregado + lista de alertas
- Datastores: nombre, tipo, capacidad GB, libre GB, % usado, accesible
- VMs: conteo por power state, snapshots (solo VMs con al menos uno: nombre, cantidad, días del más viejo), VMware Tools no ok
- Red: vSwitches/portgroups en error, NICs físicas caídas

**Dependencias:** solo `pyVmomi`. Sin requests, pandas ni ninguna otra librería.

---

## Docker

### `backend/Dockerfile`

```dockerfile
FROM node:20-alpine
RUN apk add --no-cache python3 py3-pip && \
    pip3 install --no-cache-dir pyVmomi --break-system-packages
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
COPY collectors/ ./collectors/
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
```

### `docker-compose.yml` (raíz del repo)

```yaml
services:
  backend:
    build: ./backend
    env_file: ./backend/.env
    ports:
      - "3000:3000"
    depends_on:
      - db
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: infraops
      POSTGRES_USER: infraops
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

El frontend se agrega al compose cuando se defina su build.

---

## Frontend

### 1. Modelo `InfraAsset`

Agrega `uri1: string | null` y `uri2: string | null`.

### 2. Función utilitaria `resolveVmwareUri`

```typescript
// shared/ o technician/utils/
function resolveVmwareUri(asset: InfraAsset): string | null
```

Retorna la primera de `uri1`/`uri2` cuyo puerto (formato `host:puerto`) esté en el rango 344–348. Retorna `null` si ninguna aplica. Pure function, fácil de testear.

### 3. `EsxiHostCardComponent`

Declarado en `TechnicianModule`. Sigue el patrón de `QnapDeviceCardComponent`.

```typescript
@Input()  host: InfraAsset
@Input()  result: VmwareHealthResult | null
@Input()  loading: boolean
@Input()  readOnly: boolean
@Output() runCheck = new EventEmitter<string>()  // emite la URI VMware
```

**Estados visuales:**

| Estado | UI |
|---|---|
| URI VMware no detectada | Botón deshabilitado, badge "Sin VMware" |
| Listo para ejecutar | Botón "Ejecutar control VMware" habilitado |
| Cargando | Spinner inline, botón deshabilitado |
| Resultado disponible | Secciones Host / Datastores / VMs / Red, botón "Re-ejecutar" |
| Error | Mensaje de error inline, botón "Reintentar" |

**Coloring semántico (design system):**
- `overallStatus: 'red'` → `--crit`, `'yellow'` → `--warn`, `'green'` → `--ok`
- Datastores: `usedPct > 85%` → `--crit`, `> 70%` → `--warn`
- Snapshots: `oldestDays > 90` → `--crit`, `> 30` → `--warn`
- NICs caídas o vswitchErrors no vacío → `--crit`

### 4. `ServerHostFormComponent` — refactor

- Elimina todo el contenido ESXi obsoleto.
- Declara `vmwareResults = new Map<number, VmwareHealthResult>()` y `loadingHosts = new Set<number>()` y `hostErrors = new Map<number, string>()`.
- Renderiza `<app-esxi-host-card>` por cada elemento en `infrastructure.esxiHosts`.
- `onRunCheck(uri: string, assetId: number)`: llama a `VmwareApiService.healthCheck(uri)`, actualiza Map/Set.
- `buildPayload()` retorna `{ esxiHosts: [{ assetId, vmwareCheck: VmwareHealthResult | null, notes? }] }`.
- El botón "Completar" **no se bloquea** si el check no fue ejecutado — el técnico puede completar con `vmwareCheck: null` (host inaccesible, etc.).

### 5. `VmwareApiService`

```typescript
// technician/ o shared/services/
healthCheck(hostUri: string): Observable<VmwareHealthResult>
// POST /integrations/vmware/health-check  { hostUri }
```

---

## Error handling

| Escenario | Comportamiento |
|---|---|
| Host inaccesible / credenciales incorrectas | stderr del script → `BadGatewayException` → mensaje en card |
| Timeout 30s | NestJS mata proceso → `GatewayTimeoutException` → "Timeout: el host no respondió en 30s" |
| Error en host A | No afecta card de host B — estado independiente por card |
| Sin reintento automático | El reintento lo inicia el técnico desde el botón de la card |

---

## Testing

### Backend (Jest)

- **`VmwareService`:** mockear `child_process.spawn`
  - Caso feliz: stdout JSON válido → retorna objeto parseado
  - Exit code 1 con stderr → lanza `BadGatewayException`
  - Timeout → lanza `GatewayTimeoutException`
- **`VmwareController`:** test de integración con `VmwareService` mockeado
- **`InfradocAssetsService`:** extender tests existentes para `uri1`/`uri2` propagados correctamente

### Frontend (Angular Testing Library)

- **`EsxiHostCardComponent`:**
  - Sin URI VMware → botón deshabilitado
  - `loading: true` → spinner visible, botón deshabilitado
  - `result` con datos → renderiza secciones con coloring correcto
  - `overallStatus: 'red'` → clase CSS `--crit` aplicada
- **`ServerHostFormComponent`:**
  - `buildPayload()` incluye `vmwareCheck` cuando result existe
  - `buildPayload()` incluye `vmwareCheck: null` cuando no se ejecutó el check
  - Completar sin haber ejecutado el check es válido

---

## Piezas del scope

| Pieza | Tipo | Archivo |
|---|---|---|
| `vmware_health.py` | Nuevo | `collectors/vmware/vmware_health.py` |
| `requirements.txt` | Nuevo | `collectors/vmware/requirements.txt` |
| Módulo VMware NestJS | Nuevo | `backend/src/integrations/vmware/` |
| `Dockerfile` backend | Nuevo | `backend/Dockerfile` |
| `docker-compose.yml` | Nuevo | `docker-compose.yml` |
| uri1/uri2 en InfraDoc | Extensión | `infradoc-assets.service.ts`, `client-infrastructure.dto.ts` |
| `resolveVmwareUri` | Nuevo | `shared/` o `technician/utils/` |
| `EsxiHostCardComponent` | Nuevo | `technician/task-drawer/esxi-host-card/` |
| `VmwareApiService` | Nuevo | `technician/` o `shared/services/` |
| `ServerHostFormComponent` | Refactor | `technician/task-drawer/server-host-form/` |
| `TechnicianModule` | Extensión | agregar declaraciones nuevas |
| `InfraAsset` model frontend | Extensión | agregar `uri1`/`uri2` |
