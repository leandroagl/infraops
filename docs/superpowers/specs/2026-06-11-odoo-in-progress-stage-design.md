# Odoo "En Curso" al pasar tarea a IN_PROGRESS — Diseño

**Fecha:** 2026-06-11  
**Branch:** feat/odoo-timesheet  
**Estado:** Aprobado

---

## Contexto

Cuando una tarea pasa a `IN_PROGRESS` en InfraOps, el ticket de Odoo asociado debe
avanzar al stage "En Curso". Ese stage cierra el primer SLA del equipo de helpdesk
(siendo 2 SLAs en total; el segundo lo cierra el stage "Hecho" ya implementado).

El orden de stages en Odoo es: **Backlog → En Curso → Hecho**.

---

## Decisiones de diseño

| Decisión | Elección | Razón |
|---|---|---|
| Cómo identificar el stage | Buscar por `name = 'En Curso'` scoped al team | Nombre estable, sin env var extra, consistente con `resolveDoneStageId` |
| Comportamiento ante fallo Odoo | Fire-and-forget (log + continúa) | El técnico no debe quedar bloqueado si Odoo no responde |
| Frontend | Sin cambios | Ya envía `PATCH /tasks/:id/status` con `IN_PROGRESS`; el backend orquesta |

---

## Flujo

```
PATCH /tasks/:id/status { status: 'IN_PROGRESS' }
  └─ TasksService.updateStatus()
       ├─ valida transición PENDING → IN_PROGRESS  ✓
       ├─ si task.odooTicketId !== null:
       │    odooService.markTicketInProgress(ticketId)
       │      ├─ OK → ticket Odoo pasa a "En Curso", SLA 1 cerrado
       │      └─ FAIL → Logger.error(), continúa  (fire-and-forget)
       └─ taskRepository.update({ status: IN_PROGRESS })  ← siempre ejecuta
```

---

## Cambios por archivo

| Archivo | Cambio |
|---|---|
| `backend/src/integrations/odoo/odoo.service.ts` | `resolveInProgressStageId()` + `markTicketInProgress()` |
| `backend/src/integrations/odoo/odoo.service.spec.ts` | Tests para ambos métodos |
| `backend/src/tasks/tasks.service.ts` | Bloque fire-and-forget en `updateStatus` al transicionar a `IN_PROGRESS` |
| `backend/src/tasks/tasks.service.spec.ts` | Tests: llama `markTicketInProgress`, no bloquea si falla |

---

## Especificación de métodos nuevos

### `OdooService.resolveInProgressStageId(): Promise<number>`

- Cachea el resultado en `private inProgressStageId: number | null = null`
- Busca: `helpdesk.stage search_read [[['team_ids', 'in', [teamId]], ['name', '=', 'En Curso']]]`
- Si no encuentra ninguno: lanza `ServiceUnavailableException`
- Si encuentra: guarda en caché y retorna el id

### `OdooService.markTicketInProgress(odooTicketId: number): Promise<void>`

- Llama `resolveInProgressStageId()` para obtener el stage id
- Llama `helpdesk.ticket write [[odooTicketId], { stage_id: inProgressStageId }]`
- No acepta parámetros de timesheet (no hay imputación de horas en este punto)

### `TasksService.updateStatus()` — bloque nuevo

```typescript
if (newStatus === TaskStatus.IN_PROGRESS && task.odooTicketId !== null) {
  this.odooService.markTicketInProgress(task.odooTicketId).catch((err) => {
    this.logger.error(`Error al marcar ticket ${task.odooTicketId} en curso en Odoo`, err);
  });
}
```

El `await` se omite intencionalmente: fire-and-forget.

`TasksService` no tiene Logger actualmente — hay que agregar `private readonly logger = new Logger(TasksService.name)` como campo de clase (sin cambio de constructor, NestJS lo resuelve).

---

## Tests

### odoo.service.spec.ts

- `resolveInProgressStageId`: resuelve por nombre, cachea, lanza si no encuentra
- `markTicketInProgress`: llama write con stage id correcto, propaga error si Odoo falla

### tasks.service.spec.ts

- Llama `markTicketInProgress` al transicionar a `IN_PROGRESS` con ticket
- No llama `markTicketInProgress` si `odooTicketId` es null
- No llama `markTicketInProgress` al transicionar a otros estados
- Si `markTicketInProgress` falla, `taskRepository.update` igual se ejecuta

---

## Lo que NO cambia

- Frontend — ningún archivo
- DTO `UpdateTaskStatusDto` — ningún cambio
- Lógica de cierre (`closeTicket`) — sin modificar
- Transiciones válidas (`VALID_TRANSITIONS`) — sin modificar
