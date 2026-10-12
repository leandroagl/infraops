# Sistema de notificaciones in-app — InfraOps

**Fecha:** 2026-10-12  
**Estado:** Aprobado, pendiente de implementación

---

## Objetivo

Proveer un mecanismo de notificación visual persistente que avise a cada miembro del equipo cuando el cron diario de vencimientos crea tickets automáticos en Odoo. Las notificaciones son por usuario (cada uno gestiona las suyas), no expiran automáticamente, y se pueden descartar individualmente o en bloque.

## Alcance

- Sólo notifica `EXPIRATION_TICKET_CREATED` (generado por el cron de vencimientos).
- La arquitectura es extensible: el tipo es un string libre, pueden agregarse otros tipos en el futuro sin cambiar el esquema.
- No incluye WebSockets ni SSE — el cron dispara una vez al día a las 8am, por lo que polling de 60s es suficiente.

---

## Modelo de datos

### Tabla `app_notifications`

| columna    | tipo         | notas                                         |
|------------|--------------|-----------------------------------------------|
| id         | uuid PK      | generado                                      |
| type       | varchar      | `EXPIRATION_TICKET_CREATED`                   |
| payload    | jsonb        | ver estructura abajo                          |
| createdAt  | timestamptz  | default `now()`                               |

**Estructura del payload para `EXPIRATION_TICKET_CREATED`:**
```json
{
  "clientName": "ACME S.A.",
  "expirationType": "domain",
  "itemName": "ejemplo.com",
  "daysUntil": 5,
  "odooTicketId": 1234
}
```

### Tabla `user_notification_reads`

| columna        | tipo        | notas                                     |
|----------------|-------------|-------------------------------------------|
| id             | uuid PK     | generado                                  |
| userId         | uuid FK     | → `users.id` ON DELETE CASCADE            |
| notificationId | uuid FK     | → `app_notifications.id` ON DELETE CASCADE|
| readAt         | timestamptz | default `now()`                           |

Constraint: `UNIQUE (userId, notificationId)`.

Una notificación es "no leída" para un usuario si no existe fila en `user_notification_reads` con ese par.

---

## Backend

### Módulo `AppNotificationsModule`

Ubicación: `backend/src/app-notifications/`

#### Entidades
- `AppNotification` — mapea `app_notifications`
- `UserNotificationRead` — mapea `user_notification_reads`

#### `AppNotificationsService`

```typescript
create(type: string, payload: Record<string, unknown>): Promise<AppNotification>
getUnreadForUser(userId: string): Promise<AppNotification[]>
markAsRead(userId: string, notificationId: string): Promise<void>
markAllAsRead(userId: string): Promise<void>
```

`getUnreadForUser` usa LEFT JOIN + WHERE `unr.id IS NULL`:
```sql
SELECT n.*
FROM app_notifications n
LEFT JOIN user_notification_reads unr
  ON unr.notification_id = n.id AND unr.user_id = :userId
WHERE unr.id IS NULL
ORDER BY n.created_at DESC
```

`markAllAsRead` hace un INSERT bulk de todas las unread del usuario (ON CONFLICT DO NOTHING).

#### `AppNotificationsController`

Base path: `/app-notifications`. Todos los endpoints requieren JWT.

| método | ruta       | descripción                          |
|--------|------------|--------------------------------------|
| GET    | `/`        | Unread del usuario autenticado       |
| PATCH  | `/:id/read`| Marca una notificación como leída    |
| PATCH  | `/read-all`| Marca todas como leídas              |

El controller extrae `userId` del JWT via `@CurrentUser()`.

#### Integración con `ExpirationTicketsService`

En `createTicketWithTask()`, después de crear el ticket en Odoo exitosamente, se llama:

```typescript
await this.appNotificationsService.create('EXPIRATION_TICKET_CREATED', {
  clientName: item.clientName,
  expirationType: item.type,
  itemName: item.itemName,
  daysUntil: item.daysUntil,
  odooTicketId,
});
```

Esta llamada es fire-and-forget a nivel de error: si falla la notificación, el ticket ya se creó y no se revierta. El error se loggea pero no se relanza.

#### Migración

Timestamp: `1790800000000-CreateAppNotifications.ts`

Crea ambas tablas y el unique constraint.

#### Registro en `AppModule`

`AppNotificationsModule` se agrega al array `imports` de `AppModule`.

---

## Frontend

### Modelo `AppNotification`

Ubicación: `frontend/src/app/core/models/app-notification.models.ts`

```typescript
export interface AppNotificationPayload {
  clientName?: string;
  expirationType?: string;
  itemName?: string;
  daysUntil?: number;
  odooTicketId?: number;
}

export interface AppNotification {
  id: string;
  type: string;
  payload: AppNotificationPayload;
  createdAt: string;
}
```

### `AppNotificationsService`

Ubicación: `frontend/src/app/core/services/app-notifications.service.ts`

- `providedIn: 'root'`
- Arranca el polling cuando `ShellComponent` llama a `startPolling()`, se detiene con `stopPolling()`
- Internamente: `interval(60_000).pipe(startWith(0), switchMap(() => http.get(...)))`
- `notifications$: BehaviorSubject<AppNotification[]>` — lista actual de unread
- `unreadCount$: Observable<number>` — derivado de `notifications$.pipe(map(n => n.length))`
- `markAsRead(id: string)`: PATCH + filtra el item del subject local (sin esperar re-poll)
- `markAllAsRead()`: PATCH + vacía el subject local

### `NotificationBellComponent`

Ubicación: `frontend/src/app/core/shell/notification-bell/`

**Template:**
- `mat-icon-button` con SVG de campana (15×15px, stroke, currentColor)
- `[matBadge]="unreadCount$ | async"` con `matBadgeHidden` cuando count = 0
- `[matMenuTriggerFor]="bellMenu"`
- `mat-menu #bellMenu`:
  - Header: `"Notificaciones"` (label de sección 9px uppercase)
  - Lista de items (max-height con scroll si hay muchos):
    - Por item: chip de urgencia (color por `daysUntil`) + texto + botón X de dismiss
    - Texto: `"[tipoLabel]: [itemName] · [clientName] · en N días"` o `"vencido hace N días"`
    - Click en el item navega a `/notifications`
  - Empty state: `"Sin notificaciones nuevas"` cuando la lista está vacía
  - Footer: botón `mat-stroked-button` `"Limpiar todo"` visible sólo cuando hay items

**Colores de urgencia del chip** (por `daysUntil`):
- `< 0` → `--crit`
- `0–7` → `--crit`
- `8–20` → `--warn`
- `> 20` → `--accent`

**Labels de tipo de expiración:**
```
domain        → Dominio
software      → Licencia
asset_warranty → Garantía
certificate   → Certificado
```

### Integración en `ShellComponent`

1. `ShellComponent` inyecta `AppNotificationsService`
2. En `ngOnInit()` llama `appNotificationsService.startPolling()`
3. En `ngOnDestroy()` (implementa `OnDestroy`) llama `appNotificationsService.stopPolling()`
4. `NotificationBellComponent` se agrega al toolbar HTML entre `toolbar__spacer` y el botón de usuario

### `ShellModule`

Agrega `NotificationBellComponent` a `declarations` y los módulos Material necesarios:
- `MatBadgeModule`
- `MatMenuModule`
- `MatButtonModule` (ya importado probablemente)
- `MatTooltipModule` (opcional, para tooltip en el botón)

---

## Archivos a crear / modificar

### Backend — nuevos
```
backend/src/app-notifications/app-notification.entity.ts
backend/src/app-notifications/user-notification-read.entity.ts
backend/src/app-notifications/app-notifications.service.ts
backend/src/app-notifications/app-notifications.service.spec.ts
backend/src/app-notifications/app-notifications.controller.ts
backend/src/app-notifications/app-notifications.controller.spec.ts
backend/src/app-notifications/dto/app-notification.dto.ts
backend/src/app-notifications/app-notifications.module.ts
backend/src/migrations/1790800000000-CreateAppNotifications.ts
```

### Backend — modificados
```
backend/src/app.module.ts                              (+AppNotificationsModule)
backend/src/notifications/expiration-tickets.service.ts (+llamada a create())
backend/src/notifications/expiration-tickets.service.spec.ts (actualizar tests)
```

### Frontend — nuevos
```
frontend/src/app/core/models/app-notification.models.ts
frontend/src/app/core/services/app-notifications.service.ts
frontend/src/app/core/services/app-notifications.service.spec.ts
frontend/src/app/core/shell/notification-bell/notification-bell.component.ts
frontend/src/app/core/shell/notification-bell/notification-bell.component.html
frontend/src/app/core/shell/notification-bell/notification-bell.component.scss
frontend/src/app/core/shell/notification-bell/notification-bell.component.spec.ts
```

### Frontend — modificados
```
frontend/src/app/core/shell/shell.module.ts        (+NotificationBellComponent + módulos Material)
frontend/src/app/core/shell/shell.component.html   (+<app-notification-bell> en toolbar)
frontend/src/app/core/shell/shell.component.ts     (+inject + startPolling/stopPolling)
```

---

## Testing

### Backend
- `AppNotificationsService`: tests unitarios para `create`, `getUnreadForUser`, `markAsRead`, `markAllAsRead` (mock del repositorio)
- `AppNotificationsController`: tests de integración para los 3 endpoints, verificando que el userId viene del JWT y no del body

### Frontend
- `AppNotificationsService`: tests unitarios para polling (mock HttpClient + fakeAsync), `markAsRead` (actualiza subject local), `markAllAsRead`
- `NotificationBellComponent`: tests de renderizado (badge count, lista, empty state, botón limpiar todo visible/oculto), tests de interacción (dismiss individual, limpiar todo)

---

## Notas de implementación

- `markAllAsRead` en backend: busca todas las unread del usuario y hace INSERT bulk. Si la lista es vacía, no inserta nada.
- El endpoint `PATCH /read-all` no necesita body.
- El endpoint `PATCH /:id/read` verifica que la notificación exista (404 si no), pero no verifica que pertenezca al usuario — cualquier usuario puede marcar cualquier ID como leído (la lectura es sólo un registro de "este usuario la vio").
- La notificación persiste en `app_notifications` indefinidamente. No hay limpieza automática en esta versión — si se necesita, se puede agregar un cron de limpieza de registros >90 días en una iteración futura.
