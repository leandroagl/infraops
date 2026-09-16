# Diseño: Configuración de vencimientos por tipo

**Fecha:** 2026-09-15  
**Estado:** Aprobado

---

## Contexto

El módulo de notificaciones de vencimientos tenía una configuración global (un equipo Odoo, un valor de días de anticipación, una lista de tags para todos los tipos de vencimiento). El requerimiento es permitir configurar la automatización de apertura de tickets **por tipo de vencimiento**, con toggle independiente, ticketera, días de anticipación y tags por tipo.

---

## Decisiones de diseño

- **Toggle explícito por tipo:** cada tipo tiene un switch on/off independiente. Permite desactivar sin perder la config del equipo/días/tags.
- **Backend: JSONB en `OdooConfig`** — una columna `expiration_type_configs jsonb` en lugar de tabla separada o columnas flat. Nunca se consulta por campo individual, siempre se lee el blob completo. Consistente con el uso de JSONB en `MaintenanceLog.payload`.
- **UI: pantalla dedicada `/notifications/config`** — el botón "Configuración" (ADMIN-only) en la vista de notificaciones navega a esta ruta en lugar de abrir un dialog. El dialog anterior se elimina. Sin link desde `/admin`.

---

## Backend

### Migración

```sql
ALTER TABLE odoo_config ADD COLUMN expiration_type_configs jsonb;
```

### Entidad `OdooConfig`

Nuevo campo:

```typescript
@Column({ name: 'expiration_type_configs', type: 'jsonb', nullable: true })
expirationsTypeConfigs: Record<string, ExpirationTypeConfigEntry> | null = null;
```

Donde `ExpirationTypeConfigEntry` (interface interna, no entidad):

```typescript
interface ExpirationTypeConfigEntry {
  enabled: boolean;
  helpdeskTeamId: number | null;
  daysAhead: number;
  tagIds: number[];
}
```

Los campos flat existentes (`expirationsHelpdeskTeamId`, `expirationsTicketDaysAhead`, `expirationsTagIds`) se mantienen en la entidad por compatibilidad pero dejan de usarse en la UI nueva.

### DTOs

Nuevo DTO anidado:

```typescript
export class ExpirationTypeConfigEntryDto {
  @IsBoolean() enabled: boolean;
  @IsOptional() @IsInt() @Min(1) helpdeskTeamId: number | null;
  @IsInt() @Min(1) daysAhead: number;
  @IsArray() @IsInt({ each: true }) tagIds: number[];
}
```

`PatchOdooConfigDto` y `OdooConfigResponseDto` reciben el campo:

```typescript
@IsOptional()
@ValidateNested({ each: true })
@Type(() => ExpirationTypeConfigEntryDto)
expirationsTypeConfigs?: Record<string, ExpirationTypeConfigEntryDto>;
```

### Tests backend

- `PatchOdooConfigDto`: valida estructura correcta, rechaza mal tipado en campos anidados
- `IntegrationConfigService`: patch con `expirationsTypeConfigs` persiste y retorna correctamente

---

## Frontend

### Archivos eliminados

- `features/notifications/config-dialog/notifications-config-dialog.component.{ts,html,scss,spec.ts}`

### Archivos nuevos

- `features/notifications/config/notifications-config.component.{ts,html,scss,spec.ts}`

### Layout de la pantalla `/notifications/config`

- Header: título "Configuración de vencimientos" + botón "Volver" (navega a `/notifications`) + botón "Guardar"
- 4 cards en grid 2×2, una por `ExpirationType` (`asset_warranty`, `certificate`, `domain`, `software`)
- Cada card:
  - Header: badge de tipo (color del design system) + nombre + `mat-slide-toggle` (enabled)
  - Body expandido (toggle ON): ticketera (`mat-select`, required), días de anticipación (`input matInput type="number"`), tags (`mat-select` multiple)
  - Body colapsado (toggle OFF): campos deshabilitados, sin validación requerida
- Un único botón "Guardar" hace `PATCH /integration-config/odoo` con `{ expirationsTypeConfigs: { ... } }`
- Carga inicial: `forkJoin` de `getOdoo()` + `getHelpdeskTeams()` + `getHelpdeskTags()`

### Archivos modificados

**`notifications-routing.module.ts`:** ruta hija `/config` con `AdminGuard`:

```typescript
{ path: 'config', component: NotificationsConfigComponent, canActivate: [AdminGuard] }
```

**`notifications.module.ts`:** eliminar imports del dialog component, agregar `NotificationsConfigComponent` y `RouterModule`.

**`notifications.component.ts`:**
- `openConfig()`: de `dialog.open()` a `this.router.navigate(['/notifications/config'])`
- `ticketWindowDays: number` → `typeConfigs: Record<string, ExpirationTypeConfigEntry>` (mapa por tipo)
- `ticketPending(item)`: usa `typeConfigs[item.type]?.daysAhead ?? 30` en lugar del valor global

### Tests frontend

- `NotificationsConfigComponent` spec (ATL): carga config existente y puebla el formulario; toggle ON habilita campos y activa validación; toggle OFF deshabilita campos; save con toggle ON y team null bloquea submit; save emite payload correcto con tipos activos e inactivos
- `NotificationsComponent` spec: `openConfig()` navega en lugar de abrir dialog; `ticketPending()` usa config por tipo

---

## Tipos afectados

`ExpirationType`: `asset_warranty` | `certificate` | `domain` | `software`

Colores del design system por tipo (ya implementados en `notifications.component.ts`):
- `asset_warranty` → `badge--srv`
- `certificate` → `badge--bkp`
- `domain` → `badge--accent`
- `software` → `badge--win`
