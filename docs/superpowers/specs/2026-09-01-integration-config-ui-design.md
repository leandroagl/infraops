# Spec: Gestión interactiva de configuración de integraciones externas

**Fecha:** 2026-09-01
**Branch:** feature/integration-config-ui
**Alcance:** Odoo, InfraDoc, VMware ESXi

---

## Problema

Los parámetros de conexión a Odoo, InfraDoc y VMware (URLs, usuarios, API keys,
contraseñas) viven en el `.env` del servidor. Cambiar una credencial (ej. rotación
de API key de Odoo) requiere acceso SSH al servidor y reinicio del proceso. El
objetivo es poder editarlos desde la UI de InfraOps sin tocar el servidor.

---

## Solución

Una nueva tab "Integraciones" en el módulo Admin. Tres cards — uno por sistema —
con formulario editable, campos sensibles enmascarados y botón "Probar conexión"
por integración. Los valores se persisten en la DB, encriptados en columna para
los campos sensibles. Los servicios existentes leen de DB con fallback al `.env`
(migración suave sin pérdida de configuración previa).

---

## Backend

### Módulo nuevo: `integration-config`

Ubicación: `backend/src/integration-config/`

```
integration-config/
├── entities/
│   ├── odoo-config.entity.ts
│   ├── infradoc-config.entity.ts
│   └── vmware-config.entity.ts
├── dto/
│   ├── odoo-config.dto.ts
│   ├── infradoc-config.dto.ts
│   └── vmware-config.dto.ts
├── integration-config.service.ts
├── integration-config.service.spec.ts
├── integration-config.controller.ts
├── integration-config.controller.spec.ts
└── integration-config.module.ts
```

### Entidades (TypeORM, fila única por tabla)

**`OdooConfig`** — tabla `odoo_config`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | int (PK, default 1) | Fila única |
| `url` | varchar | URL base de la instancia Odoo |
| `db` | varchar | Nombre de la base de datos |
| `username` | varchar | Email del usuario bot |
| `apiKey` | varchar | API key encriptada con AES-256-GCM |
| `helpdeskTeamId` | int | ID del equipo Helpdesk en Odoo |
| `updatedAt` | timestamp | Última modificación |
| `updatedBy` | varchar | Email del admin que guardó (viene del JWT via `@CurrentUser()`) |

**`InfraDocConfig`** — tabla `infradoc_config`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | int (PK, default 1) | Fila única |
| `url` | varchar | Endpoint de la API de InfraDoc |
| `apiKey` | varchar | API key encriptada |
| `updatedAt` | timestamp | |
| `updatedBy` | varchar | Email del admin (via `@CurrentUser()`) |

**`VmwareConfig`** — tabla `vmware_config`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | int (PK, default 1) | Fila única |
| `username` | varchar | Usuario de solo lectura en hosts ESXi |
| `password` | varchar | Contraseña encriptada |
| `updatedAt` | timestamp | |
| `updatedBy` | varchar | Email del admin (via `@CurrentUser()`) |

### Encriptación

- Algoritmo: `aes-256-gcm`
- Clave: `INTEGRATIONS_ENCRYPT_KEY` en `.env` (renombrar el existente `ODOO_ENCRYPT_KEY`, que actualmente no se usa en el código)
- IV aleatorio por encriptación, almacenado junto al ciphertext (`iv:authTag:ciphertext` en base64)
- La clave nunca se persiste en DB

### API REST (guard: `RolesGuard` → `ADMIN`)

```
GET  /integration-config/odoo          → OdooConfigResponseDto
PATCH /integration-config/odoo         → OdooConfigResponseDto
POST /integration-config/odoo/test     → { ok: boolean, message: string }

GET  /integration-config/infradoc      → InfraDocConfigResponseDto
PATCH /integration-config/infradoc     → InfraDocConfigResponseDto
POST /integration-config/infradoc/test → { ok: boolean, message: string }

GET  /integration-config/vmware        → VmwareConfigResponseDto
PATCH /integration-config/vmware       → VmwareConfigResponseDto
POST /integration-config/vmware/test   → { ok: boolean, message: string }
```

**Campos sensibles en respuestas GET/PATCH:** siempre devuelven `"••••••••"`.
El frontend nunca recibe el valor real.

**Patch con campo sensible masked:** si el valor del campo sensible entrante es
`"••••••••"` o está ausente, el servicio no modifica ese campo en DB.
Si viene un valor nuevo, encripta y guarda.

**Fallback al `.env`:** si la fila no existe en DB (primera vez, sin configuración
migrada), `GET` devuelve los valores del `.env` (campos sensibles siempre masked).

### Cambios en servicios existentes

**`OdooSystemRpcService`:**
- Recibe `IntegrationConfigService` por inyección
- En `authenticate()` y `callKw()` llama a `configService.getOdooConfig()` (que
  lee DB o fallback env) en lugar de `this.configService.getOrThrow('ODOO_*')`
- El `uid` cacheado en memoria se invalida (`this.uid = null`) cuando se persiste
  una nueva config de Odoo (el service lo notifica o el controller lo llama directo)
- `buildOdooClient()` ya recibe valores sueltos en lugar de `ConfigService` → no cambia firma externa

**`VmwareService`:**
- Reemplaza `process.env.VMWARE_USER` / `VMWARE_PASS` por valores de `VmwareConfig`
  (o fallback al `.env` si la fila no existe)
- El servicio pasa a ser `async` en la lectura de credenciales

**`OdooService`:**
- El `ODOO_HELPDESK_TEAM_ID` que hoy lee de `configService` pasa a venir de
  `OdooConfig.helpdeskTeamId`

### Test de conexión

Todos los tests usan la configuración actualmente guardada (DB o fallback `.env`).
Para probar credenciales nuevas: guardar primero, luego probar.

- **Odoo:** llama a `OdooSystemRpcService.authenticate()` con la config actual,
  devuelve `{ ok: true }` si recibe uid, error con mensaje si falla
- **InfraDoc:** hace GET a la URL configurada con la API key. Si no hay endpoint
  `/health` documentado, hace GET a la URL base y considera éxito cualquier respuesta HTTP (ver scope)
- **VMware:** no hay endpoint genérico de test; devuelve siempre
  `{ ok: true, message: "Credenciales guardadas. Se verificarán en el próximo health check." }`

---

## Frontend

### Archivos nuevos

```
frontend/src/app/features/admin/integraciones/
├── integraciones.component.ts
├── integraciones.component.html
├── integraciones.component.scss
└── integraciones.component.spec.ts

frontend/src/app/core/services/
└── integration-config.service.ts   (+ .spec.ts)
```

### Routing

`admin-routing.module.ts`:
```typescript
{ path: 'integraciones', component: IntegracionesComponent }
```

`admin-layout.component.ts` — agregar tab:
```typescript
{ path: 'integraciones', label: 'Integraciones' }
```

### `IntegrationConfigService` (core)

Métodos:
```typescript
getOdoo(): Observable<OdooConfigDto>
patchOdoo(dto: Partial<OdooConfigDto>): Observable<OdooConfigDto>
testOdoo(): Observable<{ ok: boolean; message: string }>

getInfraDoc(): Observable<InfraDocConfigDto>
patchInfraDoc(dto: Partial<InfraDocConfigDto>): Observable<InfraDocConfigDto>
testInfraDoc(): Observable<{ ok: boolean; message: string }>

getVmware(): Observable<VmwareConfigDto>
patchVmware(dto: Partial<VmwareConfigDto>): Observable<VmwareConfigDto>
testVmware(): Observable<{ ok: boolean; message: string }>
```

### `IntegracionesComponent`

Tres secciones (cards) en el template, una por integración. Estado por card:
```typescript
interface CardState {
  loading: boolean;      // cargando config inicial
  saving: boolean;       // guardando
  testing: boolean;      // probando conexión
  connectionStatus: 'ok' | 'error' | 'unknown';
  connectionMessage: string;
}
```

**Campos sensibles:**
- Valor inicial: `"••••••••"` (devuelto por API)
- `showSecret: boolean` por campo → toggle con ícono ojo (SVG inline, stroke, 14×14)
- Al guardar: si el valor del campo es `"••••••••"`, se omite del PATCH DTO

**"Probar conexión":**
1. `testing = true` → spinner en el botón, ambos botones disabled
2. Llama al endpoint `/test`
3. OK → `connectionStatus = 'ok'`, badge verde
4. Error → `connectionStatus = 'error'`, badge rojo, snackbar con `message`
5. `testing = false`

**"Guardar":**
1. `saving = true`
2. Construye DTO omitiendo campos sensibles masked
3. PATCH → actualiza form con respuesta
4. Snackbar de éxito / error
5. `saving = false`

### Módulos Angular Material requeridos (en `admin.module.ts`)

Ya presentes en el módulo admin. No se agregan nuevos.

---

## Seguridad

- Endpoints de `integration-config` protegidos con `@Roles(UserRole.ADMIN)` + `RolesGuard`
- Respuestas nunca exponen valores de campos sensibles (siempre masked)
- `INTEGRATIONS_ENCRYPT_KEY` solo en `.env`, nunca en DB ni en respuestas API
- El test de conexión de Odoo acepta credenciales del request para no requerir guardar primero → se valida que el llamante sea ADMIN antes de ejecutar

---

## Migración

- Las tres tablas se crean con una nueva migración TypeORM
- El `.env` existente no se toca durante el deploy (fallback garantizado)
- Después del deploy, un ADMIN puede ir a Integraciones y hacer "Probar conexión"
  para verificar que el fallback funciona, luego guardar para persistir en DB
- `ODOO_ENCRYPT_KEY` → renombrar a `INTEGRATIONS_ENCRYPT_KEY` en `.env` y documentar

---

## Lo que queda fuera de scope

- InfraDoc no tiene endpoint `/health` documentado → el test de InfraDoc se define
  cuando se conozca el endpoint disponible (por ahora puede hacer GET a la URL base)
- No se migran automáticamente los valores del `.env` a la DB (el admin lo hace manualmente desde la UI)
- No se notifica a otros procesos/pods sobre el cambio de config (InfraOps corre en un solo contenedor)
