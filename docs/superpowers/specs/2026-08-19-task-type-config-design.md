# Spec: Configuración de tipos de tarea (tiempo predefinido + tags Odoo)

**Fecha:** 2026-08-19  
**Scope:** Backend + Frontend Admin + flujo de cierre de tarea (técnico)

---

## Problema

Tres valores están hardcodeados en código y no pueden cambiarse sin un deploy:

1. **Tags de Odoo por tipo de tarea** — 6 métodos `resolveXxxTagId()` en `OdooService` que buscan tags por string literal (`'Backups (NAS)'`, `'Virtualización'`, etc.).
2. **Asignación taskType → tags** — bloques `if` en `OdooService.createTicket()`.
3. **Tiempo empleado al cerrar** — el técnico lo ingresa manualmente en `TimeSpentDialogComponent`; no hay referencia estándar por tipo de tarea.

---

## Solución

Nuevo módulo `task-config` en backend que persiste la configuración por tipo de tarea en DB. Un Admin configura los valores desde una nueva sección en el panel de administración. El cierre de tarea consume el tiempo configurado en lugar de pedirlo al técnico.

---

## Modelo de datos

### Nueva tabla: `task_type_config`

| Columna             | Tipo          | Nullable | Descripción |
|---------------------|---------------|----------|-------------|
| `task_type`         | enum (PK)     | NO       | TaskType — clave primaria |
| `default_time_minutes` | integer    | SÍ       | Minutos a imputar en Odoo al cerrar. `null` = sin configurar |
| `odoo_tag_ids`      | integer[]     | NO       | IDs de helpdesk.tag en Odoo |
| `odoo_tag_names`    | text[]        | NO       | Nombres correspondientes (para mostrar sin llamar a Odoo) |
| `updated_at`        | timestamptz   | NO       | Última modificación |

**Nota:** `odooTagIds` y `odooTagNames` son arrays paralelos (mismo índice). Se guardan juntos para que el Admin pueda ver los nombres sin depender de Odoo en cada render. Si un tag se elimina en Odoo, la configuración sigue funcionando hasta que el Admin la actualice.

La tabla se inicializa vacía — no hay filas por defecto. El Admin configura cada tipo manualmente.

---

## Backend

### Nuevo módulo: `backend/src/task-config/`

```
task-config/
├── task-type-config.entity.ts
├── task-config.module.ts
├── task-config.service.ts
├── task-config.controller.ts
├── dto/
│   └── update-task-config.dto.ts
└── task-config.controller.spec.ts
```

#### Entity

```typescript
@Entity('task_type_config')
export class TaskTypeConfig {
  @PrimaryColumn({ type: 'enum', enum: TaskType })
  taskType: TaskType;

  @Column({ name: 'default_time_minutes', type: 'int', nullable: true, default: null })
  defaultTimeMinutes: number | null;

  @Column({ name: 'odoo_tag_ids', type: 'int', array: true, default: [] })
  odooTagIds: number[];

  @Column({ name: 'odoo_tag_names', type: 'text', array: true, default: [] })
  odooTagNames: string[];

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

#### Endpoints

| Método | Ruta | Guard | Descripción |
|--------|------|-------|-------------|
| `GET`  | `/task-config` | JWT (todos los roles) | Devuelve array con la config de todos los TaskType. Si un tipo no tiene fila en DB, se devuelve con `defaultTimeMinutes: null` y arrays vacíos. |
| `PATCH` | `/task-config/:taskType` | JWT + `ADMIN` | Actualiza (upsert) la config de un tipo. |

**GET /task-config** — responde con los 10 tipos siempre, rellenando los que no tienen fila en DB con defaults:

```typescript
// El servicio hace find() y luego completa los tipos faltantes
const allTypes = Object.values(TaskType);
// → array de TaskTypeConfigDto, ordenado por TaskType
```

**PATCH /task-config/:taskType** DTO:

```typescript
export class UpdateTaskConfigDto {
  @IsInt() @Min(1) @IsOptional()
  defaultTimeMinutes?: number;          // en minutos, ej. 90

  @IsArray() @IsInt({ each: true }) @IsOptional()
  odooTagIds?: number[];

  @IsArray() @IsString({ each: true }) @IsOptional()
  odooTagNames?: string[];
}
```

Upsert: si no existe la fila para ese `taskType`, la crea. Si existe, la actualiza.

#### Refactor OdooService

Eliminar los 6 métodos privados `resolveXxxTagId()` y las propiedades de caché asociadas (`qnapTagId`, `windowsAdDomainTagId`, etc.).

En `createTicket()`, reemplazar los bloques `if` de tags por:

```typescript
const config = await this.taskConfigService.findOne(taskType);
if (config?.odooTagIds?.length) {
  payload['tag_ids'] = [[6, 0, config.odooTagIds]];
}
```

`OdooIntegrationModule` importa `TaskConfigModule`.

#### Nuevo endpoint en OdooController

```
GET /odoo/helpdesk-tags
```

Guard: JWT + `ADMIN`. Llama a Odoo y devuelve la lista de tags disponibles:

```typescript
// OdooService.getHelpdeskTags()
const tags = await this.systemRpc.callKw<Array<{ id: number; name: string }>>(
  'helpdesk.tag', 'search_read', [[]], { fields: ['id', 'name'] }
);
return tags.map(t => ({ id: t.id, name: t.name }));
```

Respuesta: `Array<{ id: number; name: string }>` ordenado por name.

#### Migración

Nueva migración TypeORM que crea la tabla `task_type_config`. Timestamp: `1787200000000`.

---

## Frontend Admin

### Nueva sección: `task-config/`

```
features/admin/task-config/
├── task-config.component.ts
├── task-config.component.html
├── task-config.component.scss
├── task-edit-dialog/
│   ├── task-edit-dialog.component.ts
│   └── task-edit-dialog.component.html
└── task-config.component.spec.ts
```

#### TaskConfigComponent — tabla principal

- Carga `GET /task-config` al iniciar.
- Muestra `mat-table` con columnas: **Tipo de tarea**, **Tiempo predefinido**, **Tags Odoo**, **Acciones**.
- Columna **Tiempo predefinido**: chip monoespacio si configurado (`01:30 h`), texto en gris itálico `— sin configurar` si `null`.
- Columna **Tags Odoo**: chips de badges por tag. Sin tags → `—` gris.
- Columna **Acciones**: botón icon `mat-icon-button` con ícono `edit`.
- Al presionar editar: abre `TaskEditDialogComponent` via `MatDialog`.
- Al recibir resultado del dialog: actualiza la fila en el array local (sin recargar desde API). Patrón reactividad establecido en CLAUDE.md.

#### TaskEditDialogComponent — diálogo de edición

**Datos de entrada (`MAT_DIALOG_DATA`):**
```typescript
{ config: TaskTypeConfigDto }
```

**Al abrir:** llama `GET /odoo/helpdesk-tags` para traer la lista de tags disponibles. Mientras carga, spinner en el campo de tags y botón Guardar deshabilitado.

**Formulario:**
- **Tiempo predefinido** — `mat-form-field` con `matInput` tipo text, validación de patrón `^[0-9]{1,2}:[0-5][0-9]$` (formato HH:MM). Se convierte a minutos antes de enviar: `h * 60 + m`.
- **Tags de Odoo** — `mat-select` con `multiple`, opciones cargadas desde Odoo. El valor del control son objetos `{ id, name }`. Al guardar se separan en `odooTagIds[]` y `odooTagNames[]`.

**Guardar:** llama `PATCH /task-config/:taskType`, cierra el dialog y emite el `TaskTypeConfigDto` actualizado como resultado (`dialogRef.close(updatedConfig)`).

**Cancelar:** `dialogRef.close(null)`.

#### Routing y módulo

En `admin-routing.module.ts`, agregar:
```typescript
{ path: 'task-config', component: TaskConfigComponent }
```

En `admin.module.ts`, agregar a `declarations`: `TaskConfigComponent`, `TaskEditDialogComponent`.

En `AdminLayoutComponent` (sidebar/nav), agregar ítem de menú "Configuración de tareas" que navega a `admin/task-config`.

#### Servicio frontend

`core/services/task-config.service.ts` — dos métodos:
- `getAll(): Observable<TaskTypeConfigDto[]>`
- `update(taskType: TaskType, dto: UpdateTaskConfigDto): Observable<TaskTypeConfigDto>`

---

## Frontend — flujo de cierre de tarea (técnico)

### Nuevo componente: `ConfirmCloseDialogComponent`

Reemplaza **ambos** diálogos actuales: `TimeSpentDialogComponent` y `ConfirmMaintenanceDialogComponent`.

```
task-drawer/confirm-close-dialog/
├── confirm-close-dialog.component.ts
└── confirm-close-dialog.component.html
```

**Datos de entrada (`MAT_DIALOG_DATA`):**
```typescript
export interface ConfirmCloseDialogData {
  taskType: TaskType;
  config: TaskTypeConfigDto;           // tiempo + tags + nombres
  odooTicketId: number | null;
  issuesSummary: { dcdiagErrors: string[]; veeamMissing: boolean; emptyFields: string[] };
}
```

**Resultado al cerrar:** `true` (confirmar) | `null` (cancelar).

**Template:**

- Header: ícono ✓ (ok) o ⚠ (warn si hay alertas) + nombre del tipo de tarea.
- Fila "Tiempo a imputar": valor en formato `h:mm h` desde `config.defaultTimeMinutes`.
- Fila "Tags Odoo": chips con `config.odooTagNames`. Si array vacío, no se muestra la fila.
- Fila "Ticket": `#XXXX` si `odooTicketId` existe, no se muestra si es null.
- Sección de alertas (solo si `issuesSummary` tiene contenido): bloque con lista de errores DCDiag. Visible siempre expandida, no colapsable.
- Footer: botón "Cancelar" (stroked) + botón "Confirmar cierre" (flat primary). Si hay alertas, el botón dice "Confirmar con alertas" y usa `color="warn"`.

### Cambios en `TaskDrawerComponent`

**Nueva dependencia:** `TaskConfigService` — inyectado en constructor.

**Al cargar una tarea** (`ngOnChanges`): además del infra, cargar la config del tipo:
```typescript
this.taskConfigService.getAll().subscribe(configs => {
  this.taskConfig = configs.find(c => c.taskType === this.task.type) ?? null;
});
```

**Getter `canComplete`** (nuevo):
```typescript
get canComplete(): boolean {
  return this.isActiveTask
    && this.canExecute
    && this.taskConfig?.defaultTimeMinutes != null;
}
```

**Template del drawer:** el botón "Completar tarea" usa `[disabled]="!canComplete"`. Si `!canComplete` por falta de config, mostrar `matTooltip="El administrador debe configurar el tiempo para este tipo de tarea"`.

**`onRequestComplete(payload)`** — nuevo flujo:
```typescript
onRequestComplete(payload: MaintenancePayload): void {
  this.pendingPayload = payload;
  const issuesSummary = this.detectIssues(payload);
  const data: ConfirmCloseDialogData = {
    taskType: this.task.type,
    config: this.taskConfig!,
    odooTicketId: this.task.odooTicketId,
    issuesSummary,
  };
  this.dialog.open(ConfirmCloseDialogComponent, { data, width: '420px' })
    .afterClosed()
    .subscribe((confirmed: boolean) => {
      if (confirmed) this.saveAndComplete(this.taskConfig!.defaultTimeMinutes!);
    });
}
```

`TimeSpentDialogComponent` y `ConfirmMaintenanceDialogComponent` quedan **sin uso** tras esta migración — se eliminan junto con sus archivos.

**`onRequestNotDone()`** — mismo cambio: reemplaza `TimeSpentDialogComponent` por `ConfirmCloseDialogComponent`. Se pasa `issuesSummary` vacío y se omiten las filas de tags y ticket. El header muestra el tipo de tarea y el tiempo que se imputará. El botón dice "Confirmar — no realizado".

---

## TDD — tests obligatorios

### Backend

- `task-config.controller.spec.ts`:
  - `GET /task-config` devuelve los 10 tipos, rellenando los que no tienen fila.
  - `PATCH /task-config/:taskType` hace upsert correcto.
  - `PATCH /task-config/:taskType` con rol no-ADMIN retorna 403.
  - `PATCH /task-config/INVALID_TYPE` retorna 400.

- `odoo.service.spec.ts` (actualizar):
  - `createTicket()` usa `odooTagIds` de la config en DB, no strings hardcodeados.
  - `createTicket()` sin config para el tipo no agrega `tag_ids` al payload (no lanza error).

### Frontend

- `task-config.component.spec.ts`: renderiza tabla, abre dialog al presionar editar, actualiza array local al recibir resultado.
- `task-edit-dialog.component.spec.ts`: carga tags de Odoo al abrir, deshabilita guardar mientras carga, convierte HH:MM a minutos correctamente.
- `confirm-close-dialog.component.spec.ts`: muestra tiempo formateado, muestra alertas, resultado correcto al confirmar/cancelar.
- `task-drawer.component.spec.ts` (actualizar): `canComplete` es false cuando `taskConfig` es null.

---

## Archivos a crear

```
backend/src/task-config/task-type-config.entity.ts
backend/src/task-config/task-config.module.ts
backend/src/task-config/task-config.service.ts
backend/src/task-config/task-config.controller.ts
backend/src/task-config/task-config.controller.spec.ts
backend/src/task-config/dto/update-task-config.dto.ts
backend/src/migrations/1787200000000-CreateTaskTypeConfig.ts

frontend/src/app/core/services/task-config.service.ts
frontend/src/app/features/admin/task-config/task-config.component.ts
frontend/src/app/features/admin/task-config/task-config.component.html
frontend/src/app/features/admin/task-config/task-config.component.scss
frontend/src/app/features/admin/task-config/task-config.component.spec.ts
frontend/src/app/features/admin/task-config/task-edit-dialog/task-edit-dialog.component.ts
frontend/src/app/features/admin/task-config/task-edit-dialog/task-edit-dialog.component.html
frontend/src/app/features/technician/task-drawer/confirm-close-dialog/confirm-close-dialog.component.ts
frontend/src/app/features/technician/task-drawer/confirm-close-dialog/confirm-close-dialog.component.html
```

## Archivos a modificar

```
backend/src/app.module.ts                              — importar TaskConfigModule
backend/src/integrations/odoo/odoo.service.ts          — eliminar resolveXxxTagId(), refactorizar createTicket(), agregar getHelpdeskTags()
backend/src/integrations/odoo/odoo.controller.ts       — agregar GET /helpdesk-tags
backend/src/integrations/odoo/odoo-integration.module.ts — importar TaskConfigModule

frontend/src/app/features/admin/admin.module.ts        — declarar nuevos componentes, agregar MatTooltipModule
frontend/src/app/features/admin/admin-routing.module.ts — agregar ruta task-config
frontend/src/app/features/admin/admin-layout/admin-layout.component.* — agregar ítem nav
frontend/src/app/features/technician/task-drawer/task-drawer.component.ts — nuevo flujo cierre
frontend/src/app/features/tasks/tasks.module.ts          — reemplazar TimeSpentDialogComponent + ConfirmMaintenanceDialogComponent por ConfirmCloseDialogComponent; agregar MatTooltipModule
```

## Archivos a eliminar

```
frontend/src/app/features/technician/task-drawer/time-spent-dialog/   (directorio completo)
frontend/src/app/features/technician/task-drawer/confirm-maintenance-dialog/  (directorio completo)
```
