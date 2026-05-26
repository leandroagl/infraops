---
title: Módulo maintenance-logs — Diseño
date: 2026-05-26
status: approved
---

# Módulo `maintenance-logs`

Registro de controles ejecutados por los técnicos al completar una tarea de mantenimiento.

## Contexto

El módulo `tasks` ya está completo. Un `MaintenanceLog` es el registro formal de lo que hizo el técnico al ejecutar una tarea. Log y cierre de tarea son operaciones independientes: primero se crea el log, luego el técnico transiciona la tarea a `DONE` via `PATCH /tasks/:id/status`.

## Entidad

```typescript
@Entity('maintenance_logs')
export class MaintenanceLog {
  id: string          // uuid, PK
  taskId: string      // FK → tasks.id, UNIQUE (relación 1:1)
  task: Task          // relación ManyToOne (cargada en lecturas)
  technicianId: string  // FK → technicians.id (quién registró, tomado del JWT)
  technician: Technician
  payload: LogItem[]  // jsonb — lista de ítems controlados
  notes: string | null  // texto libre opcional a nivel del log
  registeredAt: Date  // CreateDateColumn (automático)
}
```

### Tipo `LogItem`

Interfaz TypeScript pura (no entidad), almacenada como jsonb:

```typescript
interface LogItem {
  item: string;                       // ej: "WinServer", "QNAP", "Veeam"
  result: 'ok' | 'warn' | 'error';
  notes?: string;
}
```

La estructura del payload es genérica para todos los `TaskType`. Campos específicos por tipo se agregarán cuando surja la necesidad real (YAGNI).

## Endpoints

Base path: `/tasks/:taskId/log`

| Método  | Ruta                    | Roles                      | Descripción                              |
|---------|-------------------------|----------------------------|------------------------------------------|
| `POST`  | `/tasks/:taskId/log`    | ADMIN, TL, TECHNICIAN      | Crear log (409 si ya existe)             |
| `GET`   | `/tasks/:taskId/log`    | todos los autenticados     | Leer log de la tarea                     |
| `PATCH` | `/tasks/:taskId/log`    | ADMIN, TL, TECHNICIAN      | Actualizar payload y/o notes             |

El `taskId` viene siempre del path. El `technicianId` se toma del JWT (`@CurrentUser()`), nunca del body.

## Reglas de negocio

1. **Unicidad:** `POST` devuelve `409 Conflict` si ya existe un log para ese `taskId`.
2. **Tarea debe existir:** los tres endpoints devuelven `404` si `taskId` no corresponde a ninguna tarea.
3. **Log debe existir para GET y PATCH:** `404` si aún no fue creado.
4. **`technicianId` automático:** se deriva del usuario autenticado. Si ese usuario no tiene perfil técnico, `403 Forbidden`.
5. **Sin restricción de estado de la tarea:** se puede crear el log en cualquier estado.
6. **Sin DELETE:** los logs son registros de auditoría inmutables en ese sentido.

## DTOs

```typescript
// create-log.dto.ts
class CreateLogDto {
  payload: LogItemDto[];   // array de ítems, mínimo 1
  notes?: string;
}

// update-log.dto.ts
class UpdateLogDto {
  payload?: LogItemDto[];
  notes?: string;
  // al menos uno de los dos debe estar presente (validado en service)
}

// log-item.dto.ts (anidado en CreateLogDto / UpdateLogDto)
class LogItemDto {
  item: string;                        // @IsString(), @IsNotEmpty()
  result: 'ok' | 'warn' | 'error';    // @IsIn(['ok', 'warn', 'error'])
  notes?: string;                      // @IsString(), @IsOptional()
}
```

## Estructura de archivos

```
backend/src/maintenance-logs/
├── maintenance-log.entity.ts
├── log-item.interface.ts
├── maintenance-logs.module.ts
├── maintenance-logs.service.ts
├── maintenance-logs.service.spec.ts
├── maintenance-logs.controller.ts
├── maintenance-logs.controller.spec.ts
└── dto/
    ├── create-log.dto.ts
    ├── update-log.dto.ts
    └── log-item.dto.ts
```

## Dependencias del módulo

`MaintenanceLogsModule` importa:
- `TypeOrmModule.forFeature([MaintenanceLog, Task, Technician])` — acceso a los tres repos
- No necesita importar `TasksModule` ni `TechniciansModule` — accede directo a los repos vía `forFeature`

Se registra en `AppModule` junto al resto de módulos.

## Plan de tests (TDD — spec rojo primero)

### `MaintenanceLogsService`

- `create`:
  - éxito: devuelve el log creado con relaciones cargadas
  - tarea inexistente: `404 NotFoundException`
  - log duplicado: `409 ConflictException`
  - usuario sin perfil técnico: `403 ForbiddenException`
- `findByTaskId`:
  - éxito: devuelve el log
  - tarea inexistente: `404`
  - log aún no creado: `404`
- `update`:
  - éxito: devuelve el log actualizado
  - log inexistente: `404`
  - body vacío (sin payload ni notes): `400 BadRequestException`

### `MaintenanceLogsController`

- `POST /tasks/:taskId/log`: delega a service, devuelve `201`
- `GET /tasks/:taskId/log`: delega a service, devuelve `200`
- `PATCH /tasks/:taskId/log`: delega a service, devuelve `200`