# Vista de Tareas Unificada por Ciclo — Diseño

**Fecha:** 2026-08-17
**Estado:** Aprobado para implementación

---

## Contexto y motivación

InfraOps tiene actualmente dos vistas de tareas separadas: `admin/tasks` (kanban con filtros) y `technician/task-list` (kanban con KPIs personales). La separación es artificial: la diferencia real entre roles no es de vista sino de **filtro por defecto y permisos de acción**.

El modelo de kanban por estado no refleja cómo piensa el equipo. ONDRA opera en **ciclos mensuales**: cada mes se genera un lote de tareas, el equipo las ejecuta, y al cierre del mes el ciclo queda cerrado. La pregunta operativa real es "¿cómo vamos con agosto?", no "¿cuántas tareas están en PENDING?".

**Decisión:** reemplazar ambas vistas por una única vista de ciclo mensual con comportamiento controlado por rol.

---

## Qué se reemplaza

| Vista actual | Destino |
|---|---|
| `features/admin/tasks/tasks.component` | Eliminada |
| `features/technician/task-list/task-list.component` | Eliminada |
| `shared/components/kanban-board/` | Se mantiene (usada en schedules u otras vistas futuras) |

La ruta `/admin/tasks` y `/technician/tasks` convergen en una sola ruta `/tasks`, protegida por el guard existente. El guard determina qué rol está activo; el componente adapta su comportamiento.

---

## Vista unificada — Comportamiento por rol

| Elemento | TECHNICIAN | TL | COORDINATOR | ADMIN |
|---|---|---|---|---|
| Filtro técnico por defecto | Propio (removible) | Todos | Todos | Todos |
| Ver tareas de otros técnicos | Sí (quitando filtro) | Sí | Sí | Sí |
| Botón "Nueva tarea" | No | Sí | No | Sí |
| Ciclos cerrados | Solo lectura | Solo lectura | Solo lectura | Solo lectura |

El técnico arranca con el filtro aplicado a sus propias tareas por conveniencia, pero puede quitarlo para ver el ciclo completo del equipo.

---

## Estructura de la vista

```
┌─────────────────────────────────────────────────────────────┐
│ Topbar: logo · página · [role indicator] · [Nueva tarea?]   │
├─────────────────────────────────────────────────────────────┤
│ Controls bar: [< Agosto 2026 >] | filtros | buscar cliente  │
├─────────────────────────────────────────────────────────────┤
│ KPI strip: Asignadas · En curso · Pendientes · Completadas  │
│            ════════ barra de avance del ciclo ════ [badge]  │
├─────────────────────────────────────────────────────────────┤
│ [banner: ciclo cerrado — solo lectura]  (condicional)       │
├─────────────────────────────────────────────────────────────┤
│ Tabla agrupada por cliente                                   │
│  ▸ ACME S.A. ─────────────────── 3 tareas ─── 2/3 ███░     │
│    Server Host   Valen   Completada   #3810   —             │
│    Veeam         Valen   Completada   #3811   —             │
│    Server Host   Valen   Pendiente    #3812   —             │
│  ▸ Distribuidora Norte ─────────                             │
│    ...                                                       │
└─────────────────────────────────────────────────────────────┘
```

### Controls bar

- **Navegador de mes:** patrón idéntico al de `generation-tab` en schedules — `[<] Agosto 2026 [>]`, misma tipografía y espaciado
- **Filtro técnico:** chip aplicable. Para TECHNICIAN fija al técnico propio y no es removible en MVP. Para otros roles arranca en "Todos"
- **Filtro tipo:** chip multi-select de TaskType
- **Filtro estado:** chip multi-select de TaskStatus
- **Búsqueda de cliente:** input de texto, filtra los grupos de la tabla

### KPI strip

Cuatro bloques fijos separados por divisores verticales:

| KPI | Fuente | Color |
|---|---|---|
| Asignadas | `total` del ciclo (o del técnico si filtrado) | `--tx-hi` |
| En curso | tareas con `IN_PROGRESS` | `--accent` |
| Pendientes | tareas con `PENDING` | `--warn` |
| Completadas | tareas con `DONE` | `--ok` |

A la derecha: barra de progreso `done/total` + badge "Ciclo abierto / Ciclo cerrado".

### Tabla

Agrupada por cliente. Cada grupo muestra:
- Header de grupo: nombre del cliente · conteo · mini barra de progreso `done/total`
- Filas de tarea con columnas: **Tipo** · **Técnico** · **Estado** · **Ticket Odoo** · **Notas**

Columnas eliminadas respecto al diseño anterior: **Fecha prog.** (implícita en el ciclo activo).

El click en una fila abre el drawer existente (`AdminTaskDrawerComponent` o `TaskDrawerComponent` según rol).

---

## Navegación por ciclo

- El mes activo por defecto es el mes actual (servidor)
- Navegar a meses pasados muestra datos históricos con banner de solo lectura
- Navegar a meses futuros muestra estado vacío con mensaje "Sin tareas generadas aún"
- No se cachean ciclos previos en frontend — cada navegación hace un request al backend

---

## API backend requerida

### Endpoint nuevo (o extensión del existente)

```
GET /tasks?month=8&year=2026&technicianId=UUID&type=SERVER_HOST&status=PENDING
```

**Respuesta:** array de `MaintenanceTask` con los campos actuales. El agrupamiento por cliente se hace en frontend.

**Parámetros:**
| Param | Tipo | Descripción |
|---|---|---|
| `month` | number 1-12 | Mes del ciclo |
| `year` | number | Año del ciclo |
| `technicianId` | UUID (opcional) | Filtro por técnico |
| `type` | TaskType (opcional) | Filtro por tipo |
| `status` | TaskStatus (opcional, multi) | Filtro por estado |

El backend filtra por `scheduledDate` dentro del rango `[inicio del mes, fin del mes]`.

> **Nota:** verificar si el endpoint existente en `tasks.service.ts` ya acepta filtros de fecha o si hay que extender el DTO y el service.

---

## Componentes Angular

### Nuevo módulo: `features/tasks/`

```
features/tasks/
├── tasks.module.ts
├── tasks.component.ts          ← componente raíz de la vista
├── tasks.component.html
├── tasks.component.scss
├── tasks-cycle-table/
│   ├── tasks-cycle-table.component.ts    ← tabla agrupada
│   ├── tasks-cycle-table.component.html
│   └── tasks-cycle-table.component.scss
└── tasks-kpi-strip/
    ├── tasks-kpi-strip.component.ts      ← strip de KPIs
    ├── tasks-kpi-strip.component.html
    └── tasks-kpi-strip.component.scss
```

**`tasks.component`** (Smart):
- Gestiona estado: `currentMonth`, `currentYear`, `filters`, `tasks[]`
- Llama a `TasksService.getTasksByCycle(month, year, filters)`
- Computa los KPI agregados a partir del array plano
- Agrupa las tareas por `clientId` para pasarlas a `tasks-cycle-table`
- Pasa el task seleccionado al drawer existente

**`tasks-cycle-table`** (Presentational):
- Recibe `groups: TaskGroup[]` y `selectedTaskId`
- Emite `taskSelected: EventEmitter<MaintenanceTask>`
- Sin lógica de negocio

**`tasks-kpi-strip`** (Presentational):
- Recibe `stats: CycleStats` y `closed: boolean`
- Sin lógica

### Tipos nuevos

```typescript
interface TaskGroup {
  clientId: string;
  clientName: string;
  tasks: MaintenanceTask[];
}

interface CycleStats {
  assigned: number;
  inprogress: number;
  pending: number;
  done: number;
}
```

### Drawer unificado

Los drawers actuales (`AdminTaskDrawerComponent`, `TaskDrawerComponent`) se eliminan y se reemplaza por un único `TaskDrawerComponent` en el nuevo módulo `features/tasks/`.

**La razón del cambio:** separar drawers por rol produce duplicación y escala mal. Un TL ejecuta tareas igual que un técnico; un ADMIN puede necesitar ver el formulario de ejecución. El criterio correcto es **qué acciones tiene permitidas el usuario sobre esa tarea específica**, no cuál es su rol.

Los bloques de acción del drawer se renderizan condicionalmente según permisos:

| Bloque | Visible para |
|---|---|
| Formulario de ejecución (completar, registrar controles) | TECHNICIAN asignado · TL · ADMIN |
| Marcar como "No realizada" con motivo | TECHNICIAN asignado · TL · ADMIN |
| Reasignar técnico | TL · ADMIN |
| Cancelar / eliminar tarea | ADMIN |
| Solo lectura (ver log, ver ticket) | COORDINATOR · cualquier rol en ciclo cerrado |

Esta lógica vive en el drawer — `TasksComponent` siempre monta el mismo componente y le pasa el task y el rol del usuario autenticado.

---

## Routing

```typescript
// app-routing.module.ts (o el módulo de routing correspondiente)
{ path: 'tasks', component: TasksComponent, canActivate: [AuthGuard] }
```

Las rutas antiguas (`/admin/tasks`, `/technician/tasks`) se redirigen a `/tasks`.

---

## Módulos Angular Material requeridos

`MatButtonModule`, `MatIconModule`, `MatProgressSpinnerModule`, `MatSnackBarModule`

La tabla es HTML nativo (`<table>`) siguiendo el patrón del mockup — **no** `mat-table`, **no** Ag-Grid (la vista no fue pedida con Ag-Grid explícitamente).

---

## Testing

### Backend
- `TasksService.getTasksByCycle` filtra correctamente por mes/año
- Tareas con `scheduledDate` fuera del mes no aparecen
- El filtro por `technicianId` es opcional y aditivo

### Frontend
- `TasksComponent` agrupa correctamente por cliente
- Los KPIs reflejan el estado real del array de tareas
- Navegación de mes dispara nuevo request
- El filtro de técnico arranca aplicado para TECHNICIAN y es removible
- Roles sin permiso no ven el botón "Nueva tarea"
- Ciclo cerrado muestra banner y deshabilita acciones de escritura en drawer
- El drawer muestra solo los bloques de acción correspondientes al rol del usuario
- COORDINATOR ve el drawer en modo solo lectura

---

## Lo que queda fuera de scope (MVP)

- Exportar ciclo a PDF/Excel
- Resumen comparativo entre ciclos (mes anterior vs actual)
- Notificaciones en tiempo real sobre cambios de estado en el ciclo activo
