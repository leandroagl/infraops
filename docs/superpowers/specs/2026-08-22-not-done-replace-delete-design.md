# Diseño: Reemplazar eliminación de tareas por "No realizada"

**Fecha:** 2026-08-22  
**Estado:** aprobado

## Contexto

Actualmente el drawer de tareas expone un botón "Eliminar tarea" (solo ADMIN) que borra la tarea de la DB sin tocar Odoo — perdiendo trazabilidad. El equipo decidió que ninguna tarea debe eliminarse: cuando no se realizó, debe quedar registrada como `NOT_DONE` tanto en InfraOps como en Odoo, con un motivo explicativo.

## Cambios por capa

### 1. Odoo — nuevo stage "No realizadas"

**Nuevo método `OdooService.markTicketNotDone(ticketId, employeeId, reason)`:**
- Resuelve el stage ID de "No realizadas" por nombre (cacheado en instancia, igual que `doneStageId` / `inProgressStageId`)
- Llama a `logTimesheet(ticketId, employeeId, 0, reason)` — 0 horas, motivo como descripción
- Mueve el ticket al stage "No realizadas" vía `write`
- Sin variables de entorno nuevas — nombre hardcodeado `"No realizadas"`

**Cambio en `TasksService.updateStatus()`:**  
Cuando `newStatus === NOT_DONE`: en lugar de `closeTicket()` llama a `markTicketNotDone()`. El `reason` se propaga desde el DTO.

### 2. Backend — propagar `reason` y cierre automático de mes

**`UpdateTaskStatusDto`:**  
Agregar `reason?: string` (opcional). El backend usa `"Cierre automático de fin de mes"` como fallback cuando `reason` es undefined.

**`TasksService.updateStatus()` — firma actualizada:**  
```
updateStatus(id, newStatus, options?: { timeSpentMinutes?: number; reason?: string })
```

**`SchedulesService.generateMonth(year, month)`:**  
Al inicio del método, antes de crear tareas nuevas:
1. Calcula el mes anterior (`month === 1 → { year: year-1, month: 12 }`)
2. Busca tareas de ese mes con status `PENDING` o `IN_PROGRESS`
3. Para cada una llama `tasksService.updateStatus(id, NOT_DONE, { reason: 'Cierre automático de fin de mes' })`
4. Errores individuales se loguean (logger.warn) pero no detienen la generación del nuevo mes

**Eliminados:**
- `TasksService.remove()` — método eliminado
- `DELETE /tasks/:id` — endpoint eliminado del controller

### 3. Frontend — drawer + diálogo

**`ConfirmCloseDialogComponent` — modo `NOT_DONE`:**
- Muestra `mat-form-field` con `matTextarea` para ingresar motivo (Validators.required, mínimo 1 caracter)
- Muestra banner warn: `"Se imputarán 0:00 hs en Odoo y el ticket pasará al stage 'No realizadas'. El motivo ingresado se usará como descripción de la imputación."`
- Tipo de retorno del diálogo pasa de `boolean` a `{ confirmed: boolean; reason?: string }` — el modo `DONE` no usa `reason`, sigue funcionando igual

**`TaskDrawerComponent`:**
- **Eliminar:** output `taskDeleted`, getter `canDelete`, ambos botones "Eliminar tarea" del template
- **Agregar getter `canMarkNotDone`:**
  ```typescript
  get canMarkNotDone(): boolean {
    return !this.cycleClosed && this.isActiveTask
      && (this.userRole === 'ADMIN' || this.userRole === 'TL');
  }
  ```
- **Botón "No realizada"** (warn stroked) con `*ngIf="canMarkNotDone"` — visible para todos los task types activos, en el área de acciones activas
- **`onRequestNotDone()`** pasa el `reason` retornado por el diálogo al `tasksService.updateStatus()`

**`TasksService` (frontend):**  
`updateStatus()` acepta `{ status, timeSpentMinutes?, reason? }` en el body. Método `delete()` eliminado.

### 4. Bloqueo de edición — mes anterior

El padre del drawer (componente technician/admin que instancia `<app-task-drawer>`) calcula `cycleClosed` como:
```typescript
const scheduled = new Date(task.scheduledDate);
const now = new Date();
cycleClosed = scheduled.getFullYear() < now.getFullYear()
  || (scheduled.getFullYear() === now.getFullYear() && scheduled.getMonth() < now.getMonth());
```
Las tareas de meses anteriores quedan en modo solo-lectura aunque sigan en `PENDING` o `IN_PROGRESS`. El cierre automático al generar el mes siguiente las mueve a `NOT_DONE`.

## Tests

**Backend:**
- `OdooService`: test para `markTicketNotDone` (spy en `callKw`, verifica stage y timesheet)
- `TasksService.updateStatus NOT_DONE`: verifica que llama a `markTicketNotDone` con el `reason` correcto y no a `closeTicket`
- `SchedulesService.generateMonth`: verifica que cierra tareas PENDING/IN_PROGRESS del mes anterior antes de crear las nuevas

**Frontend:**
- `ConfirmCloseDialogComponent`: test modo NOT_DONE — renderiza textarea + banner warn, retorna `{ confirmed: true, reason }` al confirmar
- `TaskDrawerComponent`: test `canMarkNotDone` (true para ADMIN/TL activo, false para TECHNICIAN), test que no renderiza "Eliminar tarea", test que emite con reason correcto

## Decisiones descartadas

- **Cron de fin de mes** — descartado en favor del hook en `generateMonth()` para no requerir `@nestjs/schedule` y mantener el control explícito en manos del admin
- **Mantener endpoint DELETE** para uso interno — descartado; las tareas existentes pueden cerrarse como NOT_DONE si fuera necesario
