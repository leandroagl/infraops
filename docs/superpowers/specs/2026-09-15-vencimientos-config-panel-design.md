# Spec: Panel de configuración del módulo Vencimientos + cron de tickets automáticos

**Fecha:** 2026-09-15  
**Branch:** feature/odoo-helpdesk-teams-select (o nuevo branch a acordar)  
**Alcance:** backend + frontend

---

## Contexto

El módulo de vencimientos (InfraDoc → InfraOps) muestra garantías, dominios, licencias y certificados próximos a vencer. La intención original era que un cron generara automáticamente tickets en Odoo para cada item dentro de un umbral de días. Ese cron **no existe aún**. La constante `TICKET_WINDOW_DAYS = 30` en el frontend es un placeholder hardcodeado.

Esta feature implementa:
1. El cron de creación automática de tickets en Odoo
2. Un panel de configuración dentro del módulo vencimientos (no en Admin) que controla el comportamiento del cron

---

## Almacenamiento (Opción A: extender `odoo_config`)

### Columnas nuevas en `odoo_config`

| Columna | Tipo PG | TypeORM | Default | Descripción |
|---|---|---|---|---|
| `expirations_ticket_days_ahead` | `int` | `int, nullable` | `30` | Días antes del vencimiento en que se crea el ticket |
| `expirations_tag_ids` | `jsonb` | `simple-json, nullable` | `[]` | IDs de tags de Odoo a aplicar al ticket |

### Migración
Nueva migración `AlterOdooConfigAddExpirationsTicketFields` con `ALTER TABLE odoo_config ADD COLUMN`.

### DTOs actualizados
- `OdooConfigDto`: agrega `expirationsTicketDaysAhead: number` y `expirationsTagIds: number[]`
- `PatchOdooConfigDto` (si existe, sino el patch parcial actual): incluye ambos campos como opcionales

---

## Backend

### 1. Endpoint `GET /admin/odoo/helpdesk-tags`

- Mismo controller que `GET /admin/odoo/helpdesk-teams` (ya existe)
- Guard: `AdminGuard`
- Llama a Odoo `helpdesk.tag` via `search_read`, campos `['id', 'name']`
- Respuesta: `HelpdeskTagDto[]` — `{ id: number; name: string }`
- Si Odoo no está configurado: lanza `ServiceUnavailableException` (igual que teams)

### 2. `OdooService.createExpirationTicket`

```typescript
async createExpirationTicket(item: ExpirationItemDto): Promise<number>
```

**Payload Odoo:**
- `team_id`: `expirationsHelpdeskTeamId` de config
- `name`: `"Vencimiento: {typeLabel} – {clientName} – {itemName}"` donde `typeLabel` es el label legible del tipo (Garantía, Dominio, Licencia, Certificado)
- `description`: HTML con fecha de vencimiento y días restantes
- Sin `user_id` (ticket sin asignar)
- `tag_ids`: `[[6, 0, expirationsTagIds]]` si hay tags configurados
- `sale_line_id`: incluir si el cliente tiene mapeo en Odoo, omitir si no (igual que `createTicket`)

**Errores:**
- Si `expirationsHelpdeskTeamId` es null → lanza `BadRequestException`
- Si Odoo devuelve `false` → lanza `ServiceUnavailableException`
- No requiere `partnerId` obligatorio — si el cliente no está mapeado en Odoo, loguea y lanza

### 3. Cron en `ExpirationTicketsService`

```typescript
@Cron('0 8 * * *')
async createPendingExpirationTickets(): Promise<void>
```

**Algoritmo:**
1. Lee config: `expirationsTicketDaysAhead`, `expirationsHelpdeskTeamId`
2. Si `expirationsHelpdeskTeamId` es null → loguea warning y retorna
3. Obtiene todos los vencimientos de InfraDoc via `NotificationsService.getExpirations()`
4. Filtra items con `daysUntil <= daysAhead`
5. Para cada item filtrado:
   a. Verifica si ya existe en `expiration_tickets` via clave `(type, sourceId, expireDate)`
   b. Si ya existe → skip
   c. Si no existe → llama `odooService.createExpirationTicket(item)`
   d. Si Odoo lanza → loguea error y continúa con el siguiente (no aborta el batch)
   e. Si ok → inserta en `expiration_tickets` con `odooTicketId`
6. Loguea resumen al final (N tickets creados, M errores)

**Idempotencia:** garantizada por la constraint `UNIQUE (type, sourceId, expireDate)` ya existente en `expiration_tickets`.

---

## Frontend

### 1. `IntegrationConfigService` (core)

- `OdooConfigDto` agrega `expirationsTicketDaysAhead: number` y `expirationsTagIds: number[]`
- Nuevo método: `getHelpdeskTags(): Observable<HelpdeskTagDto[]>` → `GET /admin/odoo/helpdesk-tags`
- `HelpdeskTagDto`: `{ id: number; name: string }` (mismo shape que `HelpdeskTeamDto`, puede reusar el tipo o crearse uno específico)

### 2. Admin — Integraciones

- Eliminar el `field-row` de "Ticketera Vencimientos" (campo `expirationsHelpdeskTeamId`) de la card de Odoo en `integraciones.component.html`
- Eliminar el control correspondiente del `odooForm` en `integraciones.component.ts`
- El campo sigue existiendo en `OdooConfigDto` y en el backend — solo se gestiona desde el módulo vencimientos

### 3. `NotificationsConfigDialogComponent`

**Ruta:** `frontend/src/app/features/notifications/config-dialog/`  
**Archivos:** `notifications-config-dialog.component.ts`, `.html`, `.scss`, `.spec.ts`

**Form (ReactiveFormsModule):**
| Campo | Control | Tipo | Validación |
|---|---|---|---|
| Ticketera | `mat-select` | `expirationsHelpdeskTeamId` | required |
| Días antes | `mat-input` number | `expirationsTicketDaysAhead` | required, min 1 |
| Tags | `mat-select multiple` | `expirationsTagIds` | opcional |

**Ciclo de vida:**
1. Al abrir: dispara en paralelo `getOdoo()`, `getHelpdeskTeams()`, `getHelpdeskTags()`
2. Mientras carga: spinner, form deshabilitado
3. Error en teams/tags: mensaje de advertencia inline (patrón existente en admin: `field-hint--warn`)
4. Al guardar: `patchOdoo({ expirationsHelpdeskTeamId, expirationsTicketDaysAhead, expirationsTagIds })`, spinner en botón, cierra al ok

**No tiene** botón "Probar conexión" — la conexión ya se valida en admin integraciones.

### 4. `NotificationsComponent`

**Cambios:**
- Inyecta `AuthService` (o equivalente) para exponer `isAdmin: boolean`
- Agrega botón engranaje en nav-bar, visible solo si `isAdmin`
- Método `openConfig()` abre `NotificationsConfigDialogComponent` via `MatDialog`
- `TICKET_WINDOW_DAYS` pasa a cargarse desde la config al inicializar (`expirationsTicketDaysAhead` de `getOdoo()`), con fallback a `30` si no está configurado aún

```html
<button mat-icon-button *ngIf="isAdmin" (click)="openConfig()" matTooltip="Configuración">
  <!-- SVG engranaje 14×14 stroke currentColor -->
</button>
```

### 5. `NotificationsModule`

Agrega a imports: `MatDialogModule`, `MatTooltipModule`, `ReactiveFormsModule` (si no está), `MatInputModule`, `MatSelectModule` (si no están).

---

## Testing

### Backend

**`OdooService.createExpirationTicket`:**
- Construye payload correcto (team, tags, nombre con typeLabel, sin user_id)
- Incluye `sale_line_id` si cliente mapeado, lo omite si no
- Lanza si `expirationsHelpdeskTeamId` es null
- Lanza si Odoo devuelve false

**`ExpirationTicketsService` — cron:**
- No procesa items con `daysUntil > daysAhead`
- Crea ticket y persiste para item dentro del umbral sin ticket existente
- Skippea item que ya tiene registro en `expiration_tickets`
- Error en un item no aborta el batch
- Retorna sin hacer nada si `expirationsHelpdeskTeamId` no está configurado

**`OdooController` helpdesk-tags:**
- Requiere `AdminGuard`
- Devuelve lista de tags

### Frontend

**`NotificationsConfigDialogComponent`:**
- Muestra spinner mientras carga
- Renderiza advertencia si `getHelpdeskTeams()` falla
- Llama `patchOdoo` con los tres campos al guardar
- Deshabilita botón guardar mientras está en progreso

**`NotificationsComponent`:**
- Botón engranaje visible para ADMIN
- Botón engranaje no visible para otros roles

---

## Archivos a crear / modificar

### Backend
| Acción | Archivo |
|---|---|
| Modificar | `integration-config/entities/odoo-config.entity.ts` |
| Modificar | `integration-config/dto/odoo-config.dto.ts` |
| Modificar | `integration-config/integration-config.service.ts` |
| Crear | `migrations/TIMESTAMP-AlterOdooConfigAddExpirationsTicketFields.ts` |
| Modificar | `integrations/odoo/odoo.service.ts` (nuevo método) |
| Modificar | `integrations/odoo/odoo.controller.ts` (nuevo endpoint tags) |
| Modificar | `notifications/expiration-tickets.service.ts` (cron) |
| Modificar | `notifications/notifications.module.ts` (inyectar OdooService) |

### Frontend
| Acción | Archivo |
|---|---|
| Modificar | `core/services/integration-config.service.ts` |
| Modificar | `features/admin/integraciones/integraciones.component.html` |
| Modificar | `features/admin/integraciones/integraciones.component.ts` |
| Crear | `features/notifications/config-dialog/notifications-config-dialog.component.ts` |
| Crear | `features/notifications/config-dialog/notifications-config-dialog.component.html` |
| Crear | `features/notifications/config-dialog/notifications-config-dialog.component.scss` |
| Crear | `features/notifications/config-dialog/notifications-config-dialog.component.spec.ts` |
| Modificar | `features/notifications/notifications.component.ts` |
| Modificar | `features/notifications/notifications.component.html` |
| Modificar | `features/notifications/notifications.module.ts` |
