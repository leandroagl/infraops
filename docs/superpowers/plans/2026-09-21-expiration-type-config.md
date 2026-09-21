# Configuración por tipo de vencimiento — Implementation Plan

**Goal:** Que Garantía/Certificado/Dominio/Licencia tengan cada uno su propio nombre de tarea,
tiempo predefinido, descripción de ticket y descripción de timesheet — configurables desde
Admin → Vencimientos con una UI semánticamente igual a Admin → Mantenimientos (tabla de solo
lectura + diálogo de edición por fila) — y que `EXPIRATION_CONTROL` deje de aparecer en
Admin → Mantenimientos, donde un único valor no tiene sentido para los 4 tipos.

**Architecture:** Los 4 campos nuevos se agregan a `expirationsTypeConfigs[type]` (mismo jsonb
que ya existe, no hay tabla nueva). Nuevo `tasks.expiration_type` denormalizado para que
`TasksService`/`OdooService` sepan a qué tipo de vencimiento pertenece una tarea sin acoplar
`TasksModule` a `NotificationsModule` en sentido inverso. Guardado por tipo (no por blob
completo): nuevo `PATCH /notifications/config/:type`, reemplaza el `PATCH /notifications/config`
actual. El drawer sigue sin necesitar un endpoint nuevo — `defaultTimeMinutes` se suma a la
respuesta que ya existe de `GET /notifications/expiration-tickets/by-task/:taskId`.

**Tech Stack:** NestJS (TypeORM), Angular 19, Angular Material, Jest (backend), Jasmine/TestBed (frontend).

**Spec:** `docs/superpowers/specs/2026-09-21-expiration-type-config-design.md`

## Global Constraints

- TDD obligatorio: test antes que implementación en cada task.
- Idioma del código: inglés; commits y documentación: español.
- `appearance="outline"` en todo `mat-form-field` nuevo; sin standalone components.
- Reactividad de estado: el diálogo nuevo actualiza la fila editada en el array local del
  padre al cerrar, sin recargar toda la tabla.
- No crear una tabla nueva — los 4 campos van a `expirationsTypeConfigs`, ya jsonb.
- `ticketDescription`/`timesheetDescription`/`taskName` son de uso exclusivo del backend (al
  crear/cerrar el ticket de Odoo) — el frontend solo necesita `defaultTimeMinutes`.

---

## File Map

| Acción | Archivo |
|---|---|
| Crear | `backend/src/migrations/1789900000000-AddExpirationTypeToTasks.ts` |
| Modificar | `backend/src/tasks/task.entity.ts` |
| Modificar | `backend/src/tasks/tasks.service.ts` |
| Modificar | `backend/src/tasks/tasks.service.spec.ts` |
| Modificar | `backend/src/task-config/task-config.service.ts` |
| Modificar | `backend/src/task-config/task-config.service.spec.ts` |
| Modificar | `backend/src/integration-config/dto/odoo-config.dto.ts` |
| Modificar | `backend/src/integration-config/entities/odoo-config.entity.ts` |
| Modificar | `backend/src/integration-config/integration-config.service.ts` |
| Modificar | `backend/src/integration-config/integration-config.service.spec.ts` |
| Modificar | `backend/src/integrations/odoo/odoo.service.ts` |
| Modificar | `backend/src/integrations/odoo/odoo.service.spec.ts` |
| Modificar | `backend/src/notifications/dto/expiration-item.dto.ts` |
| Eliminar | `backend/src/notifications/dto/patch-expiration-type-configs.dto.ts` |
| Modificar | `backend/src/notifications/expiration-tickets.service.ts` |
| Modificar | `backend/src/notifications/expiration-tickets.service.spec.ts` |
| Modificar | `backend/src/notifications/notifications-config.controller.ts` |
| Modificar | `backend/src/notifications/notifications-config.controller.spec.ts` |
| Crear | `frontend/src/app/shared/utils/time-format.ts` |
| Crear | `frontend/src/app/shared/utils/time-format.spec.ts` |
| Modificar | `frontend/src/app/features/admin/task-config/task-edit-dialog/task-edit-dialog.component.ts` |
| Modificar | `frontend/src/app/core/models/notification.models.ts` |
| Modificar | `frontend/src/app/core/services/notifications.service.ts` |
| Modificar | `frontend/src/app/core/services/notifications.service.spec.ts` |
| Crear | `frontend/src/app/features/admin/notifications-config/type-edit-dialog/notifications-type-edit-dialog.component.ts` |
| Crear | `frontend/src/app/features/admin/notifications-config/type-edit-dialog/notifications-type-edit-dialog.component.html` |
| Crear | `frontend/src/app/features/admin/notifications-config/type-edit-dialog/notifications-type-edit-dialog.component.scss` |
| Crear | `frontend/src/app/features/admin/notifications-config/type-edit-dialog/notifications-type-edit-dialog.component.spec.ts` |
| Modificar | `frontend/src/app/features/admin/notifications-config/notifications-config.component.ts` |
| Modificar | `frontend/src/app/features/admin/notifications-config/notifications-config.component.html` |
| Modificar | `frontend/src/app/features/admin/notifications-config/notifications-config.component.spec.ts` |
| Modificar | `frontend/src/app/features/technician/task-drawer/task-drawer.component.ts` |
| Modificar | `frontend/src/app/features/technician/task-drawer/task-drawer.component.spec.ts` |
| Modificar | `frontend/src/app/features/admin/admin.module.ts` (declarar el diálogo nuevo) |

---

### Task 1: `tasks.expiration_type` — migración + entity

**Files:** migración nueva, `task.entity.ts`

- [ ] Migración simple (jsonb no, columna real):
```typescript
export class AddExpirationTypeToTasks1789900000000 implements MigrationInterface {
  name = 'AddExpirationTypeToTasks1789900000000';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "expiration_type" varchar`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "tasks" DROP COLUMN "expiration_type"`);
  }
}
```
- [ ] `task.entity.ts`: `@Column({ name: 'expiration_type', type: 'varchar', nullable: true, default: null }) expirationType: string | null;`
- [ ] `cd backend && npx tsc --noEmit` sin errores nuevos.
- [ ] Commit: `feat(tasks): agregar expiration_type para saber a qué tipo de vencimiento pertenece una tarea`

---

### Task 2: DTOs — 4 campos nuevos en `ExpirationTypeConfigEntry`

**Files:** `odoo-config.dto.ts`, `odoo-config.entity.ts`

- [ ] En `odoo-config.dto.ts`, agregar a `ExpirationTypeConfigEntryDto`:
```typescript
@IsOptional() @IsString() taskName?: string | null;

@IsOptional() @IsInt() @Min(1) defaultTimeMinutes?: number | null;

@IsOptional() @IsString() ticketDescription?: string | null;

@IsOptional() @IsString() timesheetDescription?: string | null;
```
(mismo estilo que `UpdateTaskConfigDto` en `task-config/dto/update-task-config.dto.ts` — `@IsOptional`
antes de cada validador para permitir `null`/ausente).
- [ ] En `odoo-config.entity.ts`, extender el tipo inline de `expirationsTypeConfigs` con los
  mismos 4 campos (`taskName: string | null; defaultTimeMinutes: number | null;
  ticketDescription: string | null; timesheetDescription: string | null;`).
- [ ] `cd backend && npx tsc --noEmit` — van a aparecer errores en `integration-config.service.ts`
  (los 4 tipos inline que replican esta forma) y en `expiration-tickets.service.ts` — se
  resuelven en las tasks siguientes.
- [ ] Commit: `feat(integration-config): agregar taskName/defaultTimeMinutes/descripciones a ExpirationTypeConfigEntry`

---

### Task 3: `IntegrationConfigService` — propagar los campos nuevos

**Files:** `integration-config.service.ts`, `.spec.ts`

- [ ] Tests que fallan: `getOdoo()`/`getOdooConfigDecrypted()` devuelven los 4 campos nuevos
  dentro de cada entrada de `expirationsTypeConfigs` cuando existen en la fila;
  `validateExpirationTypeConfigs` no rechaza una entrada que los incluye; `patchOdoo` los
  persiste sin pisarlos con `undefined`.
- [ ] Implementar: extender los 4 tipos inline (`getOdoo`, `patchOdoo`'s cast,
  `validateExpirationTypeConfigs`, `getOdooConfigDecrypted`) con los mismos 4 campos —
  agregar validación opcional para cada uno en `validateExpirationTypeConfigs` (mismo patrón
  que los 4 campos existentes: solo tira si el valor está presente y es inválido).
- [ ] `npx jest integration-config.service.spec --no-coverage` → pasan.
- [ ] Commit: `feat(integration-config): propagar taskName/defaultTimeMinutes/descripciones en getOdoo/patchOdoo`

---

### Task 4: `TaskConfigService` — excluir `EXPIRATION_CONTROL` de Mantenimientos

**Files:** `task-config/task-config.service.ts`, `.spec.ts`

- [ ] Test que falla: `findAll()` no incluye una entrada con `taskType: EXPIRATION_CONTROL`
  aunque el enum lo tenga.
- [ ] Implementar:
```typescript
const MANTENIMIENTOS_TASK_TYPES = ALL_TASK_TYPES.filter(t => t !== TaskType.EXPIRATION_CONTROL);
```
y usar esta constante en el `.map` de `findAll()` en vez de `ALL_TASK_TYPES`. `findOne`/`upsert`
no cambian.
- [ ] Test collateral: si algún test existente asume `findAll()` devuelve N tipos, actualizar
  el conteo esperado (va a bajar en 1 respecto al estado actual con `EXPIRATION_CONTROL`
  incluido — revisar `task-config.controller.spec.ts` también, mismo ajuste que se hizo al
  sumar el tipo).
- [ ] Commit: `fix(task-config): excluir EXPIRATION_CONTROL de Admin → Mantenimientos`

---

### Task 5: `OdooService.createExpirationTicket` — nombre y descripción configurables

**Files:** `odoo.service.ts`, `.spec.ts`

- [ ] Tests que fallan (agregar al `describe('createExpirationTicket', ...)` existente):
  - Usa `taskName` recibido en el `name` del ticket en vez de `EXPIRATION_TYPE_LABELS` cuando
    viene no vacío.
  - Cae al label default (ahora `DEFAULT_EXPIRATION_TYPE_LABELS`) cuando `taskName` es
    `undefined`/vacío/solo espacios.
  - Antepone `plainTextToHtml(ticketDescription)` a la descripción cuando viene no vacío.
  - La descripción siempre incluye fecha de vencimiento y días restantes, con o sin
    `ticketDescription` configurado.
- [ ] Implementar: renombrar `EXPIRATION_TYPE_LABELS` → `DEFAULT_EXPIRATION_TYPE_LABELS`;
  agregar params `taskName?: string | null, ticketDescription?: string | null` al final de la
  firma; construir `name`/`description` como se detalla en la spec (sección "5. OdooService.createExpirationTicket").
- [ ] `npx jest odoo.service.spec --no-coverage` → pasan.
- [ ] Commit: `feat(odoo): nombre y descripción de ticket configurables por tipo de vencimiento`

---

### Task 6: `OdooService.closeTicket` — timesheet por tipo de vencimiento

**Files:** `odoo.service.ts`, `.spec.ts`

- [ ] Tests que fallan (agregar al `describe('closeTicket', ...)` existente, o crear uno si no
  existe — revisar antes):
  - Para `taskType: EXPIRATION_CONTROL` con `expirationType` provisto, usa
    `expirationsTypeConfigs[expirationType].timesheetDescription`.
  - Cae a `TIMESHEET_DESCRIPTION_DEFAULT` si esa entrada no tiene `timesheetDescription`.
  - Para cualquier otro `taskType`, sigue usando `taskConfigService.findOne(taskType)` como
    hoy (no debe romper ningún test existente).
  - Si `taskType === EXPIRATION_CONTROL` pero no se provee `expirationType` (dato faltante),
    cae al default sin lanzar.
- [ ] Implementar `resolveTimesheetDescription` como método privado (ver spec sección 6) y
  usarlo en `closeTicket`. Agregar el quinto parámetro opcional `expirationType?: string | null`.
- [ ] `npx jest odoo.service.spec --no-coverage` → pasan.
- [ ] Commit: `feat(odoo): resolver descripción de timesheet por tipo de vencimiento al cerrar el ticket`

---

### Task 7: `TasksService` — pasar `expirationType` de punta a punta

**Files:** `tasks.service.ts`, `.spec.ts`

- [ ] Tests que fallan:
  - `createFromExistingTicket` persiste `expirationType` cuando se provee en `params`.
  - `createFromExistingTicket` guarda `expirationType: null` cuando no se provee (compatibilidad
    con cualquier otro llamador futuro que no lo use).
  - `updateStatus`, al llamar a `odooService.closeTicket` para una tarea con
    `odooTicketId !== null`, pasa `task.expirationType` como quinto argumento.
- [ ] Implementar: agregar `expirationType?: string | null` a los `params` de
  `createFromExistingTicket` y al objeto que se pasa a `taskRepository.create`; agregar
  `task.expirationType` como quinto argumento en la llamada a `odooService.closeTicket` dentro
  de `updateStatus`.
- [ ] `npx jest tasks.service.spec --no-coverage` → pasan.
- [ ] Commit: `feat(tasks): propagar expirationType a createFromExistingTicket y closeTicket`

---

### Task 8: `ExpirationTicketsService` — guardado por tipo + wiring de los campos nuevos

**Files:** `expiration-tickets.service.ts`, `.spec.ts`, eliminar `patch-expiration-type-configs.dto.ts`

- [ ] Tests que fallan:
  - `saveTypeConfig(type, entry, updatedBy)`: mergea la entrada del tipo editado sobre el
    blob existente sin pisar los otros 3 tipos (mockear `getOdoo()` devolviendo 2 tipos ya
    configurados, guardar uno, verificar que `patchOdoo` se llama con los 2 + el editado).
  - Siembra backlog (`seedBacklogForType`) solo cuando el tipo editado pasa de `enabled: false`
    a `enabled: true` — no cuando ya estaba habilitado o pasa a deshabilitado.
  - `createPendingExpirationTickets`: llama a `createExpirationTicket` con `cfg.taskName` y
    `cfg.ticketDescription` además de los args ya existentes.
  - `createPendingExpirationTickets`: llama a `tasksService.createFromExistingTicket` con
    `expirationType: item.type`.
  - `getExpirationByTaskId`: el resultado incluye `defaultTimeMinutes` resuelto desde
    `expirationsTypeConfigs[row.type]`, `null` si no hay config para ese tipo.
- [ ] Implementar `saveTypeConfig` (ver spec sección 2), eliminar `saveTypeConfigs` (bulk) y el
  DTO `PatchExpirationTypeConfigsDto` (queda huérfano). Actualizar los dos call sites señalados
  arriba.
- [ ] `npx jest expiration-tickets.service.spec --no-coverage` → pasan.
- [ ] Commit: `feat(notifications): guardar config de vencimientos por tipo y propagar nombre/tiempo/descripciones`

---

### Task 9: `NotificationsConfigController` — endpoint por tipo

**Files:** `notifications-config.controller.ts`, `.spec.ts`

- [ ] Tests que fallan: `PATCH /notifications/config/:type` requiere ADMIN (guard ya aplicado a
  nivel de clase, verificar que sigue); delega en `expirationTicketsService.saveTypeConfig(type, dto, user.email)`.
- [ ] Implementar: reemplazar `@Patch() patch(@Body() dto: PatchExpirationTypeConfigsDto, ...)`
  por `@Patch(':type') patch(@Param('type') type: string, @Body() dto: ExpirationTypeConfigEntryDto, ...)`.
- [ ] `npx jest notifications-config.controller.spec --no-coverage` → pasan.
- [ ] `npx jest --no-coverage` (suite completa backend) → pasan.
- [ ] `npx tsc --noEmit` → sin errores.
- [ ] Commit: `feat(notifications): PATCH /notifications/config/:type reemplaza el guardado por blob completo`

---

### Task 10: Frontend — extraer `shared/utils/time-format.ts`

**Files:** nuevo util + spec, `task-edit-dialog.component.ts`

- [ ] Test que falla (`time-format.spec.ts`, archivo nuevo): `timeToMinutes('01:30')` → `90`;
  `minutesToTime(90)` → `'01:30'`; `TIME_PATTERN` matchea `'9:05'` y `'23:59'`, no matchea
  `'abc'` ni `'25:00'` (el pattern actual no valida horas >23 — mantener el comportamiento
  exacto que ya tiene `task-edit-dialog`, no agregar validación nueva).
- [ ] Mover `TIME_PATTERN`, `minutesToTime`, `timeToMinutes` de
  `task-edit-dialog.component.ts` al util nuevo, exportadas. Actualizar
  `task-edit-dialog.component.ts` para importarlas en vez de tener su propia copia.
- [ ] `npx ng test --include="**/time-format.spec.ts" --include="**/task-edit-dialog.component.spec.ts" --watch=false --browsers=ChromeHeadless` → pasan.
- [ ] Commit: `refactor(shared): extraer time-format util desde task-edit-dialog`

---

### Task 11: Frontend — modelos y `NotificationsService.patchTypeConfig`

**Files:** `notification.models.ts`, `notifications.service.ts`, `.spec.ts`

- [ ] Extender `ExpirationTypeConfigEntry` con los 4 campos nuevos (mismos nombres que el
  backend); extender `ExpirationDetail` con `defaultTimeMinutes: number | null`.
- [ ] Test que falla: `patchTypeConfig(type, entry)` hace `PATCH /notifications/config/:type`
  con el `entry` completo como body.
- [ ] Implementar `patchTypeConfig` en `NotificationsService`; eliminar `patchConfig` (bulk) —
  revisar que no quede ningún otro consumidor antes de borrarlo.
- [ ] `npx ng test --include="**/notifications.service.spec.ts" --watch=false --browsers=ChromeHeadless` → pasan.
- [ ] Commit: `feat(frontend): NotificationsService.patchTypeConfig reemplaza patchConfig`

---

### Task 12: Frontend — `NotificationsTypeEditDialogComponent` (nuevo)

**Files:** 4 archivos nuevos (`.ts/.html/.scss/.spec.ts`)

- [ ] Mirror exacto de `TaskEditDialogComponent`/`.html` en estructura, con estos campos en el
  form (usar `time-format.ts` para el campo de tiempo):
  - `enabled` (slide toggle)
  - `helpdeskTeamId` (select, con opción "— Sin equipo —")
  - `daysAhead` (number)
  - `taskName` (input de texto)
  - `time` (input HH:MM, mismo validator que Mantenimientos)
  - `tagIds` (multi-select)
  - `ticketDescription` (textarea, mismo hint que Mantenimientos sobre texto plano → HTML)
  - `timesheetDescription` (textarea)
- [ ] `data: { type: ExpirationType; entry: ExpirationTypeConfigEntry }` como
  `MAT_DIALOG_DATA` — el padre arma este objeto por fila.
- [ ] `ngOnInit`: carga `getHelpdeskTeams()`/`getHelpdeskTags()` (ya existen en
  `IntegrationConfigService`) en paralelo (`forkJoin`), popula el form con `data.entry`.
- [ ] `save()`: arma el `ExpirationTypeConfigEntry` completo desde el form, llama a
  `notificationsSvc.patchTypeConfig(data.type, entry)`, cierra el diálogo con la entidad
  actualizada (`dialogRef.close(entry)`), igual que `TaskEditDialogComponent`.
- [ ] Tests (mismo nivel que `task-edit-dialog.component.spec.ts` si existe, o el nivel general
  de specs de diálogos Material en este repo): carga inicial completa el form; guarda con los
  valores correctos; deshabilita "Guardar" mientras `saving`; error de red no rompe el diálogo.
- [ ] `npx ng test --include="**/notifications-type-edit-dialog.component.spec.ts" --watch=false --browsers=ChromeHeadless` → pasan.
- [ ] Declarar el componente en `admin.module.ts` (`declarations`).
- [ ] Commit: `feat(admin): NotificationsTypeEditDialogComponent — editor por tipo de vencimiento`

---

### Task 13: Frontend — `notifications-config.component` a tabla de solo lectura

**Files:** `.ts/.html/.spec.ts`

- [ ] Reescribir `NotificationsConfigComponent`:
  - `configs: (ExpirationTypeConfigEntry & { type: ExpirationType })[]` en vez del
    `FormGroup` actual — se carga una vez en `ngOnInit` desde `getOdoo()` (sin form reactivo).
  - `displayedColumns = ['type', 'enabled', 'helpdeskTeamId', 'daysAhead', 'defaultTimeMinutes', 'tagIds', 'actions']`.
  - `openEdit(config)`: abre `NotificationsTypeEditDialogComponent` con
    `{ type: config.type, entry: config }`, en `afterClosed()` actualiza `configs` en el
    array local (mismo patrón que `TaskConfigComponent.onConfigUpdated`) — sin recargar todo.
  - Se elimina `save()`, `formValid`, `onToggleChange`, `applyEnabledState` (ya no aplica,
    cada fila se guarda desde su propio diálogo).
- [ ] Reescribir el `.html`: `mat-table` de solo lectura (sin `[formGroupName]`), columna
  `defaultTimeMinutes` formateada igual que Mantenimientos (`formatMinutes` — puede
  reutilizarse la lógica de `TaskConfigComponent.formatMinutes` o extraerse también a
  `time-format.ts` ya que es la misma fórmula).
- [ ] Reescribir el `.spec.ts` acorde (va a cambiar sustancialmente — de "formulario reactivo +
  guardar todo" a "tabla + abrir diálogo por fila").
- [ ] `npx ng test --include="**/notifications-config.component.spec.ts" --watch=false --browsers=ChromeHeadless` → pasan.
- [ ] Commit: `refactor(admin): Vencimientos pasa a tabla de solo lectura + diálogo por tipo, igual que Mantenimientos`

---

### Task 14: Frontend — Task drawer lee `defaultTimeMinutes` desde `expirationDetail`

**Files:** `task-drawer.component.ts`, `.spec.ts`

- [ ] Tests que fallan:
  - Para una tarea `EXPIRATION_CONTROL`, `ngOnChanges` ya no llama a `taskConfigService.getAll()`
    — llama solo a `loadExpirationDetail()`.
  - Tras `loadExpirationDetail()` con un detalle que trae `defaultTimeMinutes: 45`,
    `component.taskConfig?.defaultTimeMinutes` es `45`.
  - `isConfigMissing` sigue funcionando igual que antes para este tipo (test ya existente, no
    debería romperse — confirmar).
- [ ] Implementar: en `ngOnChanges`, separar el branch por tipo (ver spec sección "Task drawer");
  en `loadExpirationDetail`, sintetizar `this.taskConfig` desde `detail.defaultTimeMinutes` como
  se detalla en la spec.
- [ ] `npx ng test --include="**/task-drawer.component.spec.ts" --watch=false --browsers=ChromeHeadless` → pasan.
- [ ] Commit: `fix(task-drawer): tiempo predefinido de EXPIRATION_CONTROL viene del detalle por tipo, no de task-config`

---

## Verificación final

- [ ] `cd backend && npx jest --no-coverage` — suite completa verde.
- [ ] `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless` — suite completa verde.
- [ ] `cd backend && npx tsc --noEmit` y `cd frontend && npx tsc --noEmit` — sin errores.
- [ ] Confirmar en Admin → Mantenimientos que `EXPIRATION_CONTROL` ya no aparece.
- [ ] Confirmar en Admin → Vencimientos que la tabla es de solo lectura, el diálogo por tipo
  trae/guarda los 8 campos correctamente, y que guardar un tipo no pisa los otros 3.
