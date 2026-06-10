# Spec: Creación de ticket Odoo al crear tarea

**Fecha:** 2026-06-10
**Rama:** feat/odoo-module

---

## Contexto

Al crear una tarea en InfraOps, debe abrirse automáticamente un ticket en el helpdesk de Odoo. Esta es una regla de negocio crítica: el ticket en Odoo siempre precede cualquier acción técnica. Si Odoo no está disponible, la creación de la tarea falla.

---

## Decisiones de diseño

- **Odoo es requerido:** si Odoo falla, la tarea no se crea (error 503).
- **IDs de Odoo bajo demanda:** no se requiere sincronización previa. `resolvePartnerId` y `resolveUserId` consultan la DB local; si no hay ID cacheado, van a Odoo, lo obtienen y lo persisten. Los IDs no cambian en Odoo.
- **Sin capa intermedia:** `OdooService` recibe el nuevo método `createTicket()`; `TasksService` lo inyecta directamente. No hay servicio intermediario.
- **Ticket huérfano como edge case aceptado:** si la DB falla tras crear el ticket en Odoo, el ticket queda sin tarea asociada. Es un escenario extremadamente improbable y no justifica una transacción distribuida.

---

## Campos del ticket Odoo

| Campo Odoo     | Valor                              | Origen                          |
|----------------|------------------------------------|---------------------------------|
| `team_id`      | `ODOO_HELPDESK_TEAM_ID` (env var)  | Fijo — equipo de mantenimientos |
| `partner_id`   | `client.odooPartnerId`             | `resolvePartnerId(clientId)`    |
| `user_id`      | `technician.user.odooUserId`       | `resolveUserId(user.id)`        |
| `name`         | `"Mantenimiento de infraestructura"` | Fijo                          |
| `description`  | `"Mantenimiento mensual!"`         | Fijo                            |

---

## Cambios por archivo

### `backend/src/integrations/odoo/odoo.service.ts`

Nuevo método público:

```typescript
async createTicket(clientId: string, technicianId: string): Promise<number>
```

Flujo interno:
1. `resolvePartnerId(clientId)` → `odooPartnerId` (null → `BadRequestException`)
2. Carga `Technician` con relación `user` via `technicianRepo`
3. `resolveUserId(technician.user.id)` → `odooUserId` (null → `BadRequestException`)
4. Lee `ODOO_HELPDESK_TEAM_ID` desde `ConfigService`
5. `callKw('helpdesk.ticket', 'create', [{ team_id, partner_id, user_id, name, description }], {})`
6. Retorna el ID del ticket creado (número)

Dependencias nuevas en el constructor: `technicianRepository` (inyectado via `TechniciansModule`).

### `backend/src/integrations/odoo/odoo-integration.module.ts`

Importar `TechniciansModule` para exponer el repositorio de `Technician`.

### `backend/src/tasks/tasks.service.ts`

En `create()`, antes del `taskRepository.create()`:

```typescript
const odooTicketId = await this.odooService.createTicket(dto.clientId, dto.technicianId);
const task = this.taskRepository.create({ ...fields, odooTicketId });
```

Inyectar `OdooService` en el constructor.

### `backend/src/tasks/tasks.module.ts`

Importar `OdooIntegrationModule`.

### `.env` / variables de entorno

Nueva variable requerida: `ODOO_HELPDESK_TEAM_ID` (número entero).

---

## Manejo de errores

| Situación | Comportamiento |
|-----------|---------------|
| Cliente sin `odooPartnerId` y no encontrado en Odoo | `BadRequestException` |
| Técnico sin `odooUserId` y no encontrado en Odoo | `BadRequestException` |
| Odoo caído al crear ticket | `ServiceUnavailableException` (propagado desde `OdooRpcService`) |
| DB falla tras crear ticket | Ticket huérfano en Odoo — aceptado |

---

## Tests

### `odoo.service.spec.ts` — `createTicket()`

- Éxito: `resolvePartnerId` y `resolveUserId` retornan IDs, `callKw` retorna ticket ID
- `resolvePartnerId` retorna `null` → lanza `BadRequestException`
- `resolveUserId` retorna `null` → lanza `BadRequestException`
- `callKw` lanza `ServiceUnavailableException` → se propaga

### `tasks.service.spec.ts` — `create()`

- Éxito: `odooService.createTicket` retorna ID, tarea guardada con `odooTicketId`
- `odooService.createTicket` lanza → tarea no se guarda, error propagado
