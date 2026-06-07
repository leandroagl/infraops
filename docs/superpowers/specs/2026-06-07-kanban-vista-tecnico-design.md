# Spec: Kanban — Vista Técnico

**Fecha:** 2026-06-07
**Alcance:** Frontend — `features/technician/task-list` + `shared/components/task-card`
**Archivos afectados:**
- `frontend/src/app/features/technician/task-list/task-list.component.{html,scss,ts,spec.ts}`
- `frontend/src/app/shared/components/task-card/task-card.component.{html,scss,ts,spec.ts}` *(nuevo)*
- `frontend/src/app/shared/shared.module.ts`

---

## Contexto

La vista de tareas del técnico es actualmente una lista vertical con tres secciones (Requieren atención / Pendientes / Completadas). Se convierte en un tablero Kanban horizontal donde cada columna representa un grupo de estados. El formato de las cards y el drawer lateral se mantienen; solo cambia la organización visual.

---

## Columnas del Kanban

| Columna | Estados incluidos | Color header |
|---|---|---|
| **Pendientes** | `PENDING`, `IN_PROGRESS` | `var(--srv)` (azul) |
| **Completadas** | `DONE` | `var(--tx-lo)` (neutro) |
| **Cerradas** | `ESCALATED`, `NOT_DONE` | `var(--tx-lo)` (neutro) |

Las columnas se renderizan siempre (aunque estén vacías muestran estado vacío). No hay drag & drop — el cambio de estado ocurre únicamente desde el drawer.

---

## Greeting bar — mejoras de estilo

La barra de saludo se mantiene como header del kanban con las siguientes correcciones de estilo Angular Material:

- **KPI values:** `font-family: var(--font-ui)` (Roboto), `font-size: 22px`, `font-weight: 400`, `letter-spacing: -0.5px`. Se elimina `var(--font-mono)` de los valores numéricos.
- **KPI labels:** sin cambios (10px, uppercase, `var(--tx-lo)`).
- **Contenedor greeting:** `mat-card` con `appearance="outlined"` para respetar el sistema Material. Eliminar el borde y `background` manuales — el tema provee el borde y el fondo de la card outlined.

---

## `TaskCardComponent` (nuevo)

**Ubicación:** `frontend/src/app/shared/components/task-card/`

### Interfaz

```typescript
@Input()  task:   Task
@Input()  active: boolean = false
@Output() selected = new EventEmitter<Task>()
```

### Lógica interna

El componente computa todo desde `task.status` y `task.scheduledDate` — no recibe columna ni contexto externo.

**Borde izquierdo (`::before`) — en orden de precedencia:**
1. Tarea activa (`PENDING` / `IN_PROGRESS`) + `daysFromToday < 0` → `var(--crit)` *(urgencia gana sobre tipo)*
2. Tarea activa + tipo `TERMINAL_MAINTENANCE` / `SITE_VISIT` + no vencida → `var(--purple)`
3. Tarea activa + resto de tipos + no vencida → `var(--srv)`
4. Tarea terminal (`DONE` / `ESCALATED` / `NOT_DONE`) → `var(--border)`

**Contenido de la card:**
- Fila superior: nombre del cliente (bold) + tipo de tarea (muted)
- Fila inferior:
  - Si activa: urgency badge (días) a la izquierda + status dot + texto a la derecha
  - Si terminal: badge de estado (`Listo` / `Escalado` / `No hecho`) a la derecha

**Urgency badge** (solo en tareas activas): reutiliza las funciones `urgencyLabel` y `urgencyClass` de `shared/utils/urgency`.

**Opacidad:** tareas terminales renderizan con `opacity: 0.6`.

### Template Angular Material

Usa `mat-card` con `appearance="outlined"`. No usa `<button>`, `<div>` clickable nativo — el click handler va en el `mat-card` con `(click)="selected.emit(task)"` y `role="button"` + `tabindex="0"` para accesibilidad.

### Módulo

Se declara y exporta en `SharedModule`. Importa: `MatCardModule`, `CommonModule`.

---

## `TaskListComponent` — cambios

### TypeScript

**Getters nuevos** (reemplazan `overdueTasks`, `pendingTasks`, `doneTasks`):

```typescript
get kanbanPending(): Task[] {
  // activeTasks ordenados: overdue → thisWeek → onTime
  return [...this.activeTasks].sort((a, b) =>
    daysFromToday(a.scheduledDate) - daysFromToday(b.scheduledDate)
  );
}

get kanbanDone(): Task[] {
  return this.tasks.filter(t => t.status === 'DONE');
}

get kanbanClosed(): Task[] {
  return this.tasks.filter(t => t.status === 'ESCALATED' || t.status === 'NOT_DONE');
}
```

`activeTasks` (privado) no cambia.

Los getters `overdueTasks`, `pendingTasks`, `doneTasks` se eliminan.

### HTML

Las tres secciones `*ngIf` se reemplazan por el board:

```html
<div class="kanban">
  <div class="kanban__col">
    <div class="kanban__col-header">
      <span class="col-label col-label--active">Pendientes</span>
      <span class="col-cnt col-cnt--active">{{ kanbanPending.length }}</span>
    </div>
    <div class="kanban__col-body">
      <app-task-card
        *ngFor="let task of kanbanPending"
        [task]="task"
        [active]="selectedTask?.id === task.id"
        (selected)="selectTask($event)">
      </app-task-card>
      <div *ngIf="kanbanPending.length === 0" class="col-empty">Sin tareas pendientes</div>
    </div>
  </div>

  <!-- columna Completadas -->
  <!-- columna Cerradas -->
</div>
```

Drawer y overlay no cambian.

### SCSS

- `.tl-page`: eliminar `max-width: 720px`; mantener `padding` y `gap`.
- Agregar `.kanban`: `display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; align-items: start`.
- Agregar `.kanban__col`, `.kanban__col-header`, `.kanban__col-body`, `.col-label`, `.col-cnt`, `.col-empty`.
- El estilo de la card se mueve a `task-card.component.scss`; se eliminan `.task`, `.task-list`, `.task__*`, `.ti-*`, `.sdot`, `.task-st` del `task-list.component.scss`.

---

## Módulos

`SharedModule`:
- Agregar `TaskCardComponent` a `declarations` y `exports`.
- Agregar `MatCardModule` a `imports` si no está.

`TechnicianModule` ya importa `SharedModule` — sin cambios adicionales.

---

## Tests

### `task-card.component.spec.ts`

- Borde crit cuando tarea activa y `scheduledDate` en el pasado
- Borde purple cuando tarea activa tipo `TERMINAL_MAINTENANCE` o `SITE_VISIT` sin vencer
- Borde srv cuando tarea activa tipo servidor sin vencer
- Borde neutro cuando status `DONE`
- Emite `selected` con la tarea al hacer click
- Muestra urgency badge cuando status `PENDING` o `IN_PROGRESS`
- Muestra badge "Listo" cuando status `DONE`
- Muestra badge "Escalado" cuando status `ESCALATED`
- Muestra badge "No hecho" cuando status `NOT_DONE`
- Card con `active=true` aplica clase `.active`

### `task-list.component.spec.ts`

- `kanbanPending` incluye tareas `PENDING` e `IN_PROGRESS` y excluye terminales
- `kanbanPending` ordena overdue primero (días negativos antes que positivos)
- `kanbanDone` incluye solo `DONE`
- `kanbanClosed` incluye `ESCALATED` y `NOT_DONE`
- Eliminar tests de `overdueTasks`, `pendingTasks`, `doneTasks`

---

## Decisiones de diseño

| Decisión | Razón |
|---|---|
| TaskCardComponent en `shared/` | La card se repite 3 veces hoy. El panel admin la necesitará. Es el momento justo de extraerla. |
| Columna "Cerradas" agrupa ESCALATED + NOT_DONE | Son dos estados terminales negativos poco frecuentes; una columna separada por cada uno fragmenta innecesariamente el tablero. |
| Columnas siempre visibles (incluso vacías) | El kanban comunica estado; una columna vacía es información ("no tenés nada cerrado este mes"). |
| Sin drag & drop | El cambio de status DONE requiere el flujo del drawer (formulario + confirmación). Drag & drop saltearía esa validación. |
| Ordenamiento por urgencia en Pendientes | Overdue primero garantiza que el técnico ve lo crítico en el top de la columna sin tener que buscar. |
| KPI font → Roboto sin monospace | Los números de KPI son indicadores de gestión, no datos técnicos. Roboto 400 se lee mejor en grande y respeta el sistema Material. |
