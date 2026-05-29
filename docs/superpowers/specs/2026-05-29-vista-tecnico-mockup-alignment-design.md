# Spec: Alineación Vista Técnico con Mockup

**Fecha:** 2026-05-29  
**Alcance:** Frontend — `features/technician`  
**Archivos afectados:**
- `task-list.component.{html,scss,ts}`
- `task-drawer.component.{html,scss,ts}`
- `maintenance-form.component.{html,scss,ts}`

---

## Contexto

La Vista Técnico fue implementada con estructura simplificada que diverge significativamente del mockup de referencia (`docs/mockups/InfraOps-tecnico.html`). Este spec define las correcciones para alinear la implementación al diseño aprobado.

---

## Cambios por componente

### 1. `task-list`

#### Greeting card
- **Nombre del técnico:** derivar de `tasks[0]?.technician?.user?.name` cuando las tareas estén cargadas. Mientras carga o si no hay tareas, usar prefijo del email (`valen@ondra.com.ar` → "Valen"). No requiere cambios de backend.
- **Subtítulo:** dinámico — `"Tenés N tareas asignadas · X requieren atención"`
- **KPIs:** reemplazar los actuales (Total / Urgentes / Completadas) por:
  - `Vencidas` — color crit — tareas activas con `scheduledDate < hoy`
  - `Esta semana` — color warn — tareas activas con `0 ≤ diasRestantes ≤ 7`
  - `En plazo` — color ok — tareas activas con `diasRestantes > 7`

#### Secciones de la lista
| Sección | Criterio | Header |
|---|---|---|
| Requieren atención | activas con `scheduledDate < hoy` | `"Requieren atención (N)"` |
| Pendientes | activas con `scheduledDate ≥ hoy` | `"Pendientes (N)"` |
| Completadas | status DONE / ESCALATED / NOT_DONE | `"Completadas (N)"` |

Las secciones vacías no se renderizan.

#### Urgency badge con días exactos
```
overdue    → "+Xd vencido"     clase urg-crit
≤ 7 días   → "vence en Xd"     clase urg-warn
> 7 días   → "Xd restantes"    clase urg-ok
```
Método auxiliar `daysFromToday(date: string): number` en el componente.

#### Task card
- Eliminar bloque `__chips` (no hay chips)
- Mantener barra lateral de color + ícono con color según urgencia/tipo
- Agregar: dot de color + texto de estado (`· Pendiente`, `· En curso`)
- Columna derecha: urgency badge únicamente

---

### 2. `task-drawer`

#### Header (reestructurado)
- Ícono 42×42 con `background` y `border-color` según urgencia del task:
  - Vencida (crit) → `var(--crit-bg)` / `var(--crit-bd)` / `var(--crit)`
  - Visita → `var(--purple-bg)` / `var(--purple-bd)` / `var(--purple)`
  - Servidor activo → `var(--srv-bg)` / `var(--srv-bd)` / `var(--srv)`
- Nombre del cliente (16px, `var(--tx-hi)`)
- Subtítulo: tipo de tarea
- Meta row: urgency badge + status badge
- Botón cerrar (arriba derecha)

#### Body — nuevo orden
1. **"Contexto del cliente · InfraDoc"** — grid 2 columnas con assets (nombre + IP). Loading skeleton mientras carga. Error inline si falla InfraDoc.
2. **`<app-maintenance-form>`** — formulario contextual por tipo.

#### Eliminaciones
- Sección "Detalle de la tarea" del body (tipo/fecha/estado pasan al header).

#### Footer — pertenece al drawer, no al form
El footer se renderiza en `task-drawer.component.html` según `task.type`. El form emite eventos al padre:
- `(requestComplete)` → abre modal de confirmación
- `(requestNotDone)` → cierra drawer, emite NOT_DONE al padre
- `(requestEscalate)` → abre modal de confirmación en modo escalada

Botones según tipo:
- SERVER_MAINTENANCE: `"Completar mantenimiento"` (primary) + `"Cerrar"` (secondary)
- TERMINAL_MAINTENANCE / SITE_VISIT: `"Marcar visita como realizada"` (primary) + `"No concretada"` (danger)
- AV_CONTROL / UPS_CONTROL / ENDPOINT_INVENTORY: `"Completar"` deshabilitado

---

### 3. `maintenance-form`

#### Inputs del componente
```typescript
@Input() task: Task
@Input() infrastructure: ClientInfrastructure
@Output() requestComplete = new EventEmitter<ServerMaintenancePayload | TerminalPayload>()
@Output() requestNotDone = new EventEmitter<void>()
```

El form **no** llama directamente a la API. Emite el payload al padre (task-drawer), que es quien llama a `logsService` y `tasksService`. No hay botón "Escalar" en el formulario — la escalada es un flujo posterior que ocurre a través de Odoo.

#### Estructura para `SERVER_MAINTENANCE`

Secciones renderizadas condicionalmente según assets de InfraDoc:

**Windows Server** — si `infrastructure.servers.length > 0`
- Tabla de servidores: columnas Nombre · Reinicio (select) · Win Updates (select) · Expandir
- Opciones Reinicio: `"—"` / `"OK"` / `"Reinicio aplicado"` / `"Pendiente — ventana"` / `"Error"`
- Opciones Win Updates: `"—"` / `"OK — todo aplicado"` / `"Aplicados hoy"` / `"Pendientes sin aplicar"` / `"Error al actualizar"`
- Al expandir fila: campo nota libre
- Color semántico del select según valor (ok/warn/crit)
- DCDIAG (sección global, debajo de la tabla):
  - Select: `"OK"` / `"OK (FSR)"` / `"ERROR"` / `"ERROR (Systemlog)"` / `"ERROR (DNS)"` / `"ERROR (replicación)"` / `"ERROR (otro)"`
  - Si ERROR: input detalle + alert "Recordá abrir ticket en Odoo antes de resolver"

**VMware** — si `infrastructure.vms.length > 0`
- Inputs numéricos: CPU% · Mem% · Storage%
- Umbrales de color: warn a 60/70/70, crit a 80/85/85
- Si alguna métrica ≥ umbral warn: aparece campo "VMs con alto consumo"
- Checklist: "Revisar y limpiar snapshots pendientes"

**QNAP / NAS** — si `infrastructure.nas.length > 0`
- Input numérico: espacio utilizado %  (warn 70, crit 85)
- Select estado RAID: `"OK — RAID saludable"` / `"Degradado"` / `"Error — disco fallando"` / `"Reconstruyendo"`
- Checklist: "Aplicar actualizaciones de firmware QNAP"

**Veeam** — si `infrastructure.vms.length > 0`
- Select estado general: `"Todas las VMs cubiertas"` / `"Hay VMs excluidas (intencional)"` / `"Hay VMs sin backup — falta agregar"`
- Si partial o missing: input "VMs afectadas"

**Router / MikroTik** — si `infrastructure.routers.length > 0`
- Checklist: "Actualizar firmware a última versión estable"
- Input: versión firmware aplicada
- Checklist: "Realizar backup de configuración"

**Notas adicionales** — siempre presente (textarea)

#### Estructura para `TERMINAL_MAINTENANCE` / `SITE_VISIT`

Checklist terminales (5 ítems):
1. Limpieza de temporales y caché del sistema
2. Revisar y aplicar Windows Updates en equipos con pendientes
3. Verificar estado del antivirus en cada equipo
4. Liberar espacio en disco C: donde sea necesario
5. Revisar licencias AV (Kaspersky / Trend)

Textarea: observaciones generales

Checklist red (2 ítems):
1. Verificar conectividad general
2. Revisar switches si corresponde

#### Tipos sin formulario (`AV_CONTROL`, `UPS_CONTROL`, `ENDPOINT_INVENTORY`)

- Mensaje: `"Formulario no disponible para este tipo de tarea."`
- Textarea de notas disponible
- Emit `requestComplete` bloqueado (el botón en el footer queda deshabilitado)

#### Modal de confirmación

Disparado por `(requestComplete)` en el padre (`task-drawer`). Se renderiza en `task-drawer.component.html`.

El drawer tiene un método `detectIssues(payload)` que analiza el payload recibido antes de mostrar el modal:
1. **DCDIAG con ERROR** → detectado si `payload.windows.dcdiag.startsWith('ERROR')` → `alert-box` rojo — "Se enviará alerta al TL"
2. **Veeam status === 'missing'** → detectado si `payload.veeam?.status === 'missing'` → `alert-box` rojo
3. **Campos numéricos vacíos** (CPU, Mem, Storage vacíos o NaN; espacio QNAP vacío) → `warning-box` amarillo con lista de campos
4. **Todo completo** → mensaje verde "Todos los campos están completos ✓"

Footer del modal:
- "Volver a revisar" (secondary) → cierra modal
- "Confirmar" (primary) → ejecuta la llamada API. Si hay errores detectados, el label es "Confirmar · enviar alerta"

#### Payload jsonb (nuevo formato)

```typescript
// SERVER_MAINTENANCE
interface ServerMaintenancePayload {
  type: 'SERVER_MAINTENANCE';
  windows: {
    servers: Array<{ name: string; reboot: string; updates: string; notes?: string }>;
    dcdiag: string;
    dcdiagDetail?: string;
  };
  vmware?: { cpu: number; mem: number; storage: number; highVMs?: string; snapshotsOk: boolean };
  qnap?:   { spaceUsed: number; diskStatus: string; firmwareUpdated: boolean };
  veeam?:  { status: 'ok' | 'partial' | 'missing'; affectedVMs?: string };
  router?: { firmwareVersion: string; firmwareUpdated: boolean; backupDone: boolean };
  notes?: string;
}

// TERMINAL_MAINTENANCE / SITE_VISIT
interface TerminalPayload {
  type: 'TERMINAL_MAINTENANCE' | 'SITE_VISIT';
  checks: {
    cleanedTemp: boolean;
    windowsUpdates: boolean;
    antivirusOk: boolean;
    diskSpace: boolean;
    licenses: boolean;
  };
  network: { connectivity: boolean; switches: boolean };
  observations?: string;
  notes?: string;
}
```

El payload reemplaza el array plano de `LogItem[]` existente. El backend almacena jsonb sin validar estructura.

---

## Tests requeridos (TDD)

### `task-list.component.spec.ts`
- `daysFromToday()` retorna días positivos (futuro) y negativos (pasado)
- `urgencyLabel()` retorna "+Xd vencido" / "vence en Xd" / "Xd restantes"
- `urgencyClass()` retorna clase correcta por días
- `overdueCount`, `thisWeekCount`, `onTimeCount` — KPI getters
- `technicianName` — devuelve nombre de primer task, fallback a email prefix
- Secciones: `overdueTasks`, `pendingTasks`, `doneTasks` filtran correctamente

### `task-drawer.component.spec.ts`
- `drawerIconColor()` retorna colores correctos según urgencia y tipo
- `detectIssues(payload)` detecta DCDIAG error correctamente
- `detectIssues(payload)` detecta veeam missing correctamente
- `detectIssues(payload)` detecta campos numéricos vacíos correctamente
- `detectIssues(payload)` retorna vacío cuando todo está completo
- Modal: `showConfirmModal` se activa con `onRequestComplete(payload)`
- Modal: se cierra con `onCancelModal()`
- Footer: botones correctos según `task.type`

### `maintenance-form.component.spec.ts`
- `hasServers`, `hasVMware`, `hasQNAP`, `hasVeeam`, `hasRouter` — getters condicionales
- `buildPayload()` produce estructura correcta para SERVER_MAINTENANCE
- `buildPayload()` produce estructura correcta para TERMINAL_MAINTENANCE
- Emit `requestComplete` con payload correcto al llamar `submit()`
- Emit `requestNotDone` al llamar `submitNotDone()`

---

## Decisiones de diseño

| Decisión | Razón |
|---|---|
| Footer en task-drawer, no en maintenance-form | El form no debería conocer el contexto de botones. El drawer es el dueño de la acción de completar. |
| Payload jsonb reestructurado | El formato plano `LogItem[]` no representa la riqueza del nuevo formulario. El backend ya usa jsonb sin schema fijo. |
| Nombre del técnico desde tasks[0] | Evita cambio de backend. `AuthUser` no incluye `name` actualmente. |
| Modal en task-drawer | El modal de confirmación es lógica de flujo, no de formulario. |
| Sin chips en la lista | Evita N llamadas a InfraDoc al cargar la lista. Se puede agregar en el futuro con datos en caché. |
