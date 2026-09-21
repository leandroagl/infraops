# Spec: Configuración por tipo de vencimiento (nombre, tiempo, descripciones)

**Fecha:** 2026-09-21
**Branch:** a acordar
**Alcance:** backend + frontend

---

## Contexto

Al sumar `TaskType.EXPIRATION_CONTROL` (spec `2026-09-21-expiration-tasks-design.md`), esa
tarea quedó configurable desde **Admin → Mantenimientos** (`task-config`) igual que cualquier
otro `TaskType` — un único tiempo predefinido, tags y descripciones para las 4 clases de
vencimiento (Garantía, Certificado, Dominio, Licencia). Eso está mal: cada clase necesita su
propio tiempo, descripción de ticket y descripción de timesheet, y hoy no hay forma de
diferenciarlas. Además, esa pantalla ni siquiera muestra un label legible (aparece
"EXPIRATION_CONTROL" a secas — un bug de la implementación anterior).

El módulo Vencimientos (`Admin → Vencimientos`) ya tiene una config por tipo
(`expirationsTypeConfigs`, jsonb en `odoo_config`: `enabled/helpdeskTeamId/daysAhead/tagIds`).
Es el lugar natural para sumar los 4 campos que hoy solo existen para `TaskType` en
Mantenimientos: **nombre de la tarea, tiempo predefinido, descripción de ticket, descripción
de timesheet**.

## Decisión

1. **`EXPIRATION_CONTROL` sale de Admin → Mantenimientos.** `TaskConfigService.findAll()` deja
   de listarlo — un tiempo/tags/descripción único para las 4 clases no tiene sentido.
2. **Los 4 campos nuevos se agregan a `expirationsTypeConfigs[type]`** (no se crea una tabla
   nueva) — es exactamente lo que ya vive ahí, solo se extiende el objeto por tipo.
3. **La UI de Vencimientos pasa a ser semánticamente igual a Mantenimientos:** tabla de solo
   lectura + un diálogo de edición por fila con **todos** los campos (habilitado, equipo,
   días, tags, nombre, tiempo, descripción de ticket, descripción de timesheet). Se abandona
   el formulario inline + "Guardar" único que existe hoy.
4. **Guardado por tipo**, no por blob completo — nuevo `PATCH /notifications/config/:type`,
   igual en espíritu a `PATCH /task-config/:taskType` que ya existe en Mantenimientos.
5. **`tasks.expiration_type` nuevo** (denormalizado, nullable): para que el backend sepa a qué
   clase de vencimiento pertenece una `Task` sin que `TasksModule`/`OdooService` tengan que
   depender de `NotificationsModule` (la dependencia hoy va en un solo sentido,
   `NotificationsModule → TasksModule` — invertirla crearía un ciclo).
6. **El drawer no necesita un endpoint nuevo**: el que ya existe,
   `GET /notifications/expiration-tickets/by-task/:taskId` (accesible a cualquier rol
   autenticado, no solo ADMIN), suma `defaultTimeMinutes` a su respuesta. Es el único campo de
   los 4 que el frontend necesita — `ticketDescription`/`timesheetDescription`/`taskName` son
   de uso exclusivo del backend al crear/cerrar el ticket de Odoo.

---

## Modelo de datos

### `ExpirationTypeConfigEntry` — 4 campos nuevos

```typescript
{
  enabled: boolean;
  helpdeskTeamId: number | null;
  daysAhead: number;
  tagIds: number[];
  taskName: string | null;              // nuevo — reemplaza EXPIRATION_TYPE_LABELS hardcodeado
  defaultTimeMinutes: number | null;     // nuevo
  ticketDescription: string | null;      // nuevo
  timesheetDescription: string | null;   // nuevo
}
```

Sin migración de columnas — sigue siendo el mismo jsonb, solo se extiende el shape en
TypeScript/DTOs y se valida en `IntegrationConfigService.validateExpirationTypeConfigs`.

### `tasks.expiration_type` — nueva columna

```typescript
@Column({ name: 'expiration_type', type: 'varchar', nullable: true, default: null })
expirationType: string | null; // ExpirationType: 'asset_warranty' | 'certificate' | 'domain' | 'software'
```

Se completa en `ExpirationTicketsService.createPendingExpirationTickets` al llamar a
`createFromExistingTicket`, pasando `item.type`. Nunca se lee cruzando módulos — vive en la
`Task` para que `TasksService`/`OdooService` la consuman directo.

---

## Backend

### 1. `TaskConfigService.findAll()` — excluir `EXPIRATION_CONTROL`

```typescript
const MANTENIMIENTOS_TASK_TYPES = ALL_TASK_TYPES.filter(t => t !== TaskType.EXPIRATION_CONTROL);
```
`findAll()` mapea sobre esta lista en vez de `ALL_TASK_TYPES`. `findOne`/`upsert` no cambian
(siguen siendo genéricos, por si alguna vez hace falta leer/escribir esa fila puntualmente).

### 2. `ExpirationTicketsService` — reemplazar el guardado por blob por guardado por tipo

Se elimina `saveTypeConfigs(configs, updatedBy)` (bulk) y se agrega:

```typescript
async saveTypeConfig(type: string, entry: TypeConfigEntry, updatedBy: string): Promise<OdooConfigResponseDto> {
  const before = await this.integrationConfigService.getOdoo();
  const oldConfigs = (before.expirationsTypeConfigs ?? {}) as TypeConfigs;
  const wasEnabled = oldConfigs[type]?.enabled ?? false;

  const newConfigs: TypeConfigs = { ...oldConfigs, [type]: entry };
  const result = await this.integrationConfigService.patchOdoo({ expirationsTypeConfigs: newConfigs }, updatedBy);

  if (entry.enabled && !wasEnabled) {
    await this.seedBacklogForType(type, entry.daysAhead);
  }
  return result;
}
```

Lee el blob completo, reemplaza solo la entrada del tipo editado, y reescribe — misma
semántica de "leer-modificar-guardar" que ya usa `TaskConfigService.upsert()` para una fila.
`seedBacklogForType` se reusa tal cual, ahora evaluado sobre un solo tipo por invocación (más
simple que el loop actual sobre todos los tipos).

### 3. `createPendingExpirationTickets` — pasar los campos nuevos

```typescript
const odooTicketId = await this.odooService.createExpirationTicket(
  item, client.id, cfg.helpdeskTeamId!, cfg.tagIds, cfg.taskName, cfg.ticketDescription,
);
// ...
const task = await this.tasksService.createFromExistingTicket({
  clientId: client.id,
  type: TaskType.EXPIRATION_CONTROL,
  expirationType: item.type,   // nuevo
  odooTicketId,
  scheduledDate: today(),
});
```

### 4. `getExpirationByTaskId` — sumar `defaultTimeMinutes`

```typescript
const config = await this.integrationConfigService.getOdoo();
const typeConfigs = (config.expirationsTypeConfigs ?? {}) as TypeConfigs;
return {
  ...campos existentes,
  defaultTimeMinutes: typeConfigs[row.type]?.defaultTimeMinutes ?? null,
};
```

### 5. `OdooService.createExpirationTicket` — nombre y descripción configurables

```typescript
async createExpirationTicket(
  item: ExpirationItemDto,
  infraopsClientId: string,
  helpdeskTeamId: number,
  tagIds: number[],
  taskName?: string | null,
  ticketDescription?: string | null,
): Promise<number> {
  const typeLabel = taskName?.trim() || DEFAULT_EXPIRATION_TYPE_LABELS[item.type];
  const name = `Vencimiento: ${typeLabel} – ${item.clientName} – ${item.itemName}`;
  const customIntro = ticketDescription?.trim() ? plainTextToHtml(ticketDescription) : '';
  const description = `${customIntro}<p>Fecha de vencimiento: <strong>${item.expireDate}</strong></p><p>Días restantes: ${item.daysUntil}</p>`;
  // resto igual — la fecha/días restantes siempre se agregan, no son editables (son
  // datos de la instancia del ticket, no texto estático)
}
```

`EXPIRATION_TYPE_LABELS` se renombra `DEFAULT_EXPIRATION_TYPE_LABELS` — sigue siendo el
fallback cuando el admin no configuró `taskName` (mismo patrón que
`TICKET_DESCRIPTION_DEFAULTS`/`TIMESHEET_DESCRIPTION_DEFAULT` en Mantenimientos: "vacío = usar
default").

### 6. `OdooService.closeTicket` — resolver `timesheetDescription` por tipo de vencimiento

```typescript
async closeTicket(
  odooTicketId: number,
  employeeId: number,
  unitAmount: number,
  taskType: TaskType,
  expirationType?: string | null,
): Promise<void> {
  const stageId = await this.resolveDoneStageId();
  const timesheetDescription = await this.resolveTimesheetDescription(taskType, expirationType);
  await this.logTimesheet(odooTicketId, employeeId, unitAmount, timesheetDescription);
  // ...
}

private async resolveTimesheetDescription(taskType: TaskType, expirationType?: string | null): Promise<string> {
  if (taskType === TaskType.EXPIRATION_CONTROL && expirationType) {
    const config = await this.integrationConfigService.getOdoo();
    const typeConfigs = (config.expirationsTypeConfigs ?? {}) as TypeConfigs;
    return typeConfigs[expirationType]?.timesheetDescription?.trim() || TIMESHEET_DESCRIPTION_DEFAULT;
  }
  const config = await this.taskConfigService.findOne(taskType);
  return config?.timesheetDescription ?? TIMESHEET_DESCRIPTION_DEFAULT;
}
```

### 7. `TasksService` — pasar `expirationType` de punta a punta

- `createFromExistingTicket(params)` acepta `expirationType?: string | null` y lo persiste en
  `Task.expirationType`.
- `updateStatus` pasa `task.expirationType` a `odooService.closeTicket(...)` (quinto
  argumento).

### 8. Endpoint por tipo

```typescript
@Patch(':type')
patch(
  @Param('type') type: string,
  @Body() dto: ExpirationTypeConfigEntryDto,
  @CurrentUser() user: JwtPayload,
): Promise<OdooConfigResponseDto> {
  return this.expirationTicketsService.saveTypeConfig(type, dto, user.email);
}
```
Reemplaza el `@Patch()` actual (blob completo). `PatchExpirationTypeConfigsDto` se elimina —
el body ahora es directamente `ExpirationTypeConfigEntryDto` (con los 4 campos nuevos
opcionales agregados).

---

## Frontend

### 1. `notifications-config.component` — tabla de solo lectura + diálogo por fila

Mismo patrón que `task-config.component`/`task-edit-dialog`:
- Tabla (`mat-table`): Tipo | Habilitado | Equipo | Días | Tiempo predefinido | Tags | Acciones
- Botón "Editar" por fila abre `NotificationsTypeEditDialogComponent` (nuevo, mirror de
  `TaskEditDialogComponent`) con: habilitado (slide toggle), equipo Odoo (select), días
  (number), **nombre de la tarea (input)**, **tiempo predefinido HH:MM (input)**, tags
  (multi-select), **descripción del ticket (textarea)**, **descripción del timesheet
  (textarea)**.
- Guarda con `NotificationsService.patchTypeConfig(type, entry)` → `PATCH /notifications/config/:type`.
- Se elimina el formulario reactivo único + botón "Guardar" general actual.

### 2. `shared/utils/time-format.ts` — nuevo, extraído de `task-edit-dialog`

`TIME_PATTERN`, `minutesToTime`, `timeToMinutes` se movían de
`task-edit-dialog.component.ts` (única copia hoy) a este util — la nueva pantalla necesita
exactamente la misma lógica, así que se extrae en vez de duplicar (regla de `shared/` de
`CLAUDE.md`). `task-edit-dialog.component.ts` pasa a importarla en vez de tener su propia copia.

### 3. Task drawer — `taskConfig` de `EXPIRATION_CONTROL` sale de `expirationDetail`

`ngOnChanges` deja de pedir `taskConfigService.getAll()` para este tipo (ya no aparece ahí) y
en cambio, dentro de `loadExpirationDetail()`, sintetiza un `TaskTypeConfigDto` a partir de
`detail.defaultTimeMinutes`:

```typescript
this.taskConfig = detail ? {
  taskType: 'EXPIRATION_CONTROL', defaultTimeMinutes: detail.defaultTimeMinutes,
  odooTagIds: [], odooTagNames: [], ticketDescription: null, timesheetDescription: null,
  ondraOwnedHosts: [], updatedAt: '',
} : null;
```
El guard `isConfigMissing` (que ya ignora `odooTagIds` para este tipo, sumado en la feature
anterior) sigue funcionando sin cambios — ahora simplemente recibe el dato desde otra fuente.

---

## Testing

### Backend
- `TaskConfigService.findAll()` no incluye `EXPIRATION_CONTROL`.
- `ExpirationTicketsService.saveTypeConfig`: mergea solo el tipo editado sin pisar los otros
  3; siembra backlog solo cuando ese tipo pasa de deshabilitado a habilitado.
- `OdooService.createExpirationTicket`: usa `taskName`/`ticketDescription` cuando vienen
  configurados; cae al default cuando vienen vacíos/undefined.
- `OdooService.closeTicket`: para `EXPIRATION_CONTROL` con `expirationType`, resuelve
  `timesheetDescription` desde `expirationsTypeConfigs`, no desde `TaskConfigService`.
- `TasksService.createFromExistingTicket`: persiste `expirationType` cuando se provee.
- `NotificationsConfigController` PATCH por tipo: requiere ADMIN, delega en `saveTypeConfig`.
- `ExpirationTicketsService.getExpirationByTaskId`: incluye `defaultTimeMinutes` resuelto por
  tipo.

### Frontend
- `notifications-config.component`: tabla read-only, abre el diálogo con los datos del tipo
  correcto, refleja el resultado tras guardar sin recargar todo.
- `NotificationsTypeEditDialogComponent`: parsea/valida HH:MM igual que `TaskEditDialogComponent`;
  guarda con `patchTypeConfig`.
- `task-drawer`: `isConfigMissing`/`canComplete` para `EXPIRATION_CONTROL` se resuelven desde
  `expirationDetail.defaultTimeMinutes`, no desde `taskConfigService`.

---

## Archivos a crear / modificar

### Backend
| Acción | Archivo |
|---|---|
| Modificar | `integration-config/dto/odoo-config.dto.ts` |
| Modificar | `integration-config/integration-config.service.ts` |
| Modificar | `notifications/dto/expiration-item.dto.ts` |
| Modificar | `notifications/expiration-tickets.service.ts` |
| Eliminar | `notifications/dto/patch-expiration-type-configs.dto.ts` |
| Modificar | `notifications/notifications-config.controller.ts` |
| Modificar | `notifications/notifications.controller.ts` (sin cambios de firma, ya delega) |
| Modificar | `integrations/odoo/odoo.service.ts` |
| Modificar | `tasks/task.entity.ts` |
| Modificar | `tasks/tasks.service.ts` |
| Modificar | `task-config/task-config.service.ts` |
| Crear | `migrations/TIMESTAMP-AddExpirationTypeToTasks.ts` |

### Frontend
| Acción | Archivo |
|---|---|
| Modificar | `core/models/notification.models.ts` |
| Modificar | `core/services/notifications.service.ts` |
| Crear | `shared/utils/time-format.ts` |
| Modificar | `features/admin/task-config/task-edit-dialog/task-edit-dialog.component.ts` |
| Modificar | `features/admin/notifications-config/notifications-config.component.ts/.html/.scss` |
| Crear | `features/admin/notifications-config/type-edit-dialog/notifications-type-edit-dialog.component.ts/.html/.scss` |
| Modificar | `features/technician/task-drawer/task-drawer.component.ts` |

---

## Fuera de alcance

- Migrar filas viejas de `task_config` con `taskType = EXPIRATION_CONTROL` que hayan quedado
  de la implementación anterior — quedan inertes (nadie las lee ni las lista), no justifica
  una migración de datos en esta etapa del proyecto.
- Traducir `ticketDescription` a HTML con el mismo editor rico que Mantenimientos (si algún
  día lo tiene) — por ahora sigue siendo texto plano → HTML con `plainTextToHtml`, igual que
  Mantenimientos hoy.
