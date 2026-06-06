# Spec: Eliminar tareas desde la vista admin

**Fecha:** 2026-06-06
**Estado:** Aprobado

## Contexto

La tabla de tareas en la vista admin (`/admin/tasks`) permite crear y filtrar tareas pero no eliminarlas. Los administradores necesitan poder eliminar cualquier tarea, independientemente de su estado.

## Decisiones de diseño

- **Hard delete** — borrado real de la DB, no soft delete ni nuevo estado.
- **Cualquier estado** — el admin puede eliminar tareas PENDING, IN_PROGRESS, DONE, ESCALATED o NOT_DONE.
- **Cascade en servicio** — si la tarea tiene un `MaintenanceLog` asociado, se elimina primero en el service (sin migración de DB).
- **Solo ADMIN** — el endpoint DELETE queda protegido con `@Roles(UserRole.ADMIN)`.
- **ConfirmDialogComponent en shared** — reutilizable para futuros módulos (clientes, técnicos).

## Cambios por capa

### Backend — `tasks`

**`tasks.service.ts`**
- Nuevo método `remove(id: string): Promise<void>`:
  1. Verifica que la tarea exista (`NotFoundException` si no).
  2. Busca `MaintenanceLog` con `taskId = id`.
  3. Si existe, lo elimina primero.
  4. Elimina la tarea.

**`tasks.controller.ts`**
- Nuevo endpoint `DELETE /tasks/:id` con `@Roles(UserRole.ADMIN)`.
- Retorna 204 No Content.

**Tests**
- Tarea sin log asociado → elimina correctamente.
- Tarea con log asociado → elimina log y luego tarea.
- Tarea inexistente → lanza `NotFoundException`.

### Frontend — `shared/`

**Nuevo `ConfirmDialogComponent`** en `shared/components/confirm-dialog/`:
- Recibe vía `MAT_DIALOG_DATA`: `{ title: string; message: string }`.
- Botones: "Cancelar" (`mat-stroked-button`) y "Eliminar" (`mat-flat-button color="warn"`).
- Retorna `true` al confirmar, cierra sin valor al cancelar.
- Declarado y exportado en `SharedModule`.

### Frontend — `TasksService`

- Nuevo método `delete(id: string): Observable<void>` → `DELETE /tasks/:id`.

### Frontend — `TasksComponent`

**Template:**
- `displayedColumns` agrega `'actions'` como última columna.
- Nueva columna `matColumnDef="actions"`:
  - Header: celda vacía (sin label).
  - Celda: `mat-icon-button` con SVG de tres puntos vertical (`[matMenuTriggerFor]="menu"`).
  - `mat-menu` con una opción "Eliminar" (ícono SVG de papelera + texto).

**Lógica:**
- Método `deleteTask(task: Task)`:
  1. Abre `ConfirmDialogComponent` con `title: 'Eliminar tarea'` y `message: '¿Eliminar la tarea de ${task.client?.name ?? "este cliente"}? Esta acción no se puede deshacer.'`.
  2. Si el usuario confirma: llama `tasksService.delete(task.id)`.
  3. En éxito: `this.dataSource.data = this.dataSource.data.filter(t => t.id !== task.id)` + snackbar "Tarea eliminada".
  4. En error: snackbar "No se pudo eliminar la tarea".

## Lo que NO cambia

- La lógica de transición de estados (`VALID_TRANSITIONS`).
- Los endpoints existentes (GET, POST, PATCH).
- El filtro de estado en la tabla.
- La vista del técnico (no tiene acceso a esta acción).
