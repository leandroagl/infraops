# Notifications Module — Design Spec

## Overview

Módulo de notificaciones de vencimientos para InfraOps. Consolida en una sola vista los items con fecha de expiración próxima o vencida, provenientes de InfraDoc (ITFlow): garantías de activos, certificados SSL, dominios y licencias de software.

**Audiencia primaria:** personal de administración (roles `ADMIN`, `COORDINATOR`) que toma acción para notificar a los clientes.

**Visible para:** todos los roles (lectura).

**Futura extensión:** integración SMTP para envío automático de alertas. El diseño no anticipa esta funcionalidad, pero el módulo `notifications/` es el lugar natural para crecer.

---

## Arquitectura

### Principios

- **Sin caché en DB.** Los datos se consultan a InfraDoc en tiempo real al abrir la vista. Sin tablas nuevas, sin cron jobs.
- **Read-only.** No se escribe nada en InfraDoc ni en InfraOps.
- **Módulo dedicado.** `notifications/` separado de `integrations/infradoc/` (ese módulo es per-cliente para infraestructura de tareas).

### Flujo

```
Frontend (NotificationsComponent)
  → GET /notifications/expirations?days=90
  → NotificationsController
  → NotificationsService
  → InfraDoc API (4 requests en paralelo)
      assets/read.php       → asset_warranty_expire
      certificates/read.php → certificate_expire
      domains/read.php      → domain_expire
      software/read.php     → software_expire (campo a confirmar en instancia real)
  ← ExpirationItemDto[]
```

---

## Backend

### Estructura de archivos

```
backend/src/notifications/
├── notifications.module.ts
├── notifications.controller.ts
├── notifications.controller.spec.ts
├── notifications.service.ts
├── notifications.service.spec.ts
└── dto/
    └── expiration-item.dto.ts
```

### DTO

```typescript
export type ExpirationType = 'asset_warranty' | 'certificate' | 'domain' | 'software';

export class ExpirationItemDto {
  type: ExpirationType;
  clientId: number;
  clientName: string;
  itemName: string;
  expireDate: string;   // YYYY-MM-DD
  daysUntil: number;   // negativo = ya expiró
}
```

### Endpoint

```
GET /notifications/expirations
Query params:
  days?: number   — horizonte en días (default: 90, ausente = todos los futuros)
Response: ExpirationItemDto[]
Auth: JWT requerido (todos los roles)
```

### Servicio

`NotificationsService.getExpirations(days?: number): Promise<ExpirationItemDto[]>`

1. Ejecuta `Promise.all` con 4 requests a InfraDoc (scope all-clients, `limit=500`):
   - `GET /api/v1/assets/read.php` → filtra por `asset_warranty_expire != null`
   - `GET /api/v1/certificates/read.php` → filtra por `certificate_expire != null`
   - `GET /api/v1/domains/read.php` → filtra por `domain_expire != null`
   - `GET /api/v1/software/read.php` → filtra por campo de expiración disponible
2. Normaliza cada resultado a `ExpirationItemDto` calculando `daysUntil = differenceInDays(expireDate, today)`.
3. Filtra: incluye items con `expireDate` en el pasado (expirados) + `daysUntil <= days` (si `days` definido).
4. Ordena por `expireDate` ASC (expirados primero, luego más próximos).
5. Items sin fecha de expiración (`null` / campo vacío) se omiten silenciosamente.

**Variables de entorno requeridas:** `INFRADOC_URL`, `INFRADOC_API_KEY` (mismas que usa el módulo existente).

**Prerequisito — API key scope:** Las 4 consultas se hacen sin `client_id`, lo que requiere que `INFRADOC_API_KEY` tenga scope "All Clients" en InfraDoc. Si la key existente es client-scoped, hay que generar una nueva key con scope global antes de implementar.

**Prerequisito — campo de expiración de software:** El módulo `software` de ITFlow expone un campo de fecha de vencimiento cuyo nombre exacto no está documentado en `docs/infradoc/api.md`. Como primer paso de implementación del servicio, hacer `GET /api/v1/software/read.php?limit=1` contra la instancia real e inspeccionar el response para confirmar el nombre del campo (esperado: `software_expire` o similar). Si el campo no existe, omitir el tipo `software` del spec y actualizar `ExpirationType`.

### Importaciones en AppModule

`NotificationsModule` se importa en `AppModule`. Usa `HttpModule` de `@nestjs/axios` directamente (no reutiliza `InfradocIntegrationModule`).

---

## Frontend

### Estructura de archivos

```
frontend/src/app/features/admin/notifications/
├── notifications.component.ts
├── notifications.component.html
├── notifications.component.scss
└── notifications.component.spec.ts

frontend/src/app/core/services/
└── notifications.service.ts
```

### Routing

`admin-routing.module.ts`:
```typescript
{ path: 'notifications', component: NotificationsComponent }
```

Sidebar del admin: nuevo nav-item con ícono de campana apuntando a `/admin/notifications`.

### Estado del componente

```typescript
items: ExpirationItem[] = [];       // respuesta completa del backend
loading = false;
error = '';
filterType: ExpirationType | '' = '';
filterUrgency: 'expired' | 'week' | 'soon' | 'attention' | '' = '';
showAll = false;                    // toggle para ver >90 días
```

### KPIs (getters sobre `items`)

| Getter | Criterio |
|---|---|
| `expiredCount` | `daysUntil < 0` |
| `weekCount` | `0 ≤ daysUntil ≤ 7` |
| `soonCount` | `8 ≤ daysUntil ≤ 20` |
| `totalShown` | longitud de `filteredItems` |

### `filteredItems` (getter)

Aplica en orden: `filterType` → `filterUrgency` → `showAll` (si `true`, no filtra por horizonte; si `false`, solo items del request inicial con `days=90`).

### Urgencia → clases CSS

| Condición | Badge class | Texto |
|---|---|---|
| `daysUntil < 0` | `badge--crit` | `Vencido` |
| `daysUntil ≤ 7` | `badge--crit` | `X días` |
| `daysUntil ≤ 20` | `badge--warn` | `X días` |
| `daysUntil ≤ 45` | `badge--accent` | `X días` |
| `daysUntil > 45` | `badge--neutral` | `X días` |

### Tipo → badge class

| `type` | Badge class | Label |
|---|---|---|
| `asset_warranty` | `badge--srv` | `Garantía` |
| `certificate` | `badge--bkp` | `Certificado` |
| `domain` | `badge--accent` | `Dominio` |
| `software` | `badge--win` | `Licencia` |

Todos aplican `badge--type` para override de fuente (DM Sans, sin uppercase).

### Tabla

`mat-table` con columnas: **Cliente · Item · Tipo · Fecha · Estado**.

- Sin Ag-Grid (tabla informativa, no operacional).
- Filas con `daysUntil < 0` reciben clase `row--expired` para fondo rojo sutil.
- Fecha en columna `Vence`: formato `YYYY-MM-DD`, fuente mono.

### Toggle "Ver todos los futuros"

Checkbox que, al activarse, recarga con `GET /notifications/expirations` (sin `?days`), reemplazando `items` con la respuesta completa. Al desactivarse, recarga con `?days=90`.

---

## Testing

### Backend

**`notifications.service.spec.ts`:**
- Mock de `HttpService.get` con respuestas sintéticas para cada endpoint.
- Verifica normalización de `daysUntil` para cada tipo.
- Verifica que items sin fecha de expiración se omiten.
- Verifica filtrado: `days=90` excluye items a 91+ días pero incluye expirados.
- Verifica orden ASC por `expireDate`.

**`notifications.controller.spec.ts`:**
- Verifica respuesta 200 con el array del servicio.
- Verifica que el endpoint está protegido por JWT guard.

### Frontend

**`notifications.component.spec.ts`:**
- Mock de `NotificationsService.getExpirations()` con dataset fijo.
- Verifica KPI counts correctos.
- Verifica que `filterType` reduce `filteredItems`.
- Verifica que `filterUrgency` reduce `filteredItems`.
- Verifica badge class correcta para cada umbral de `daysUntil`.
- Verifica que filas expiradas tienen clase `row--expired`.

---

## Mockup de referencia

`docs/mockups/notifications-v1.html`

---

## Lo que NO está en este spec

- Envío de emails SMTP (futura extensión).
- Persistencia de "notificación vista/resuelta" (futuro).
- Paginación (500 items por request cubre el parque de ~35 clientes).
- Endpoint de creación/edición de vencimientos (InfraDoc es la fuente de verdad).
