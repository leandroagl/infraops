# Spec: Filtros y scroll en vista de tareas del técnico

**Fecha:** 2026-08-11  
**Branch:** feature/schedules-module (o nuevo branch)  
**Estado:** Aprobado

---

## Contexto

La vista de tareas del técnico (`TaskListComponent`) muestra un kanban con columnas Backlog / En curso / Completadas. El problema actual:

1. No hay forma de filtrar por cliente ni por tipo de tarea.
2. Las columnas crecen sin límite, empujando el scroll vertical de la página entera.

---

## Requisitos

1. **Filtro por cliente** — select con buscador (mat-autocomplete). Lista de clientes derivada de las tareas ya cargadas, sin request adicional. Selección única.
2. **Filtro por tipo de tarea** — mat-select simple con las 10 opciones en español (usando `typeLabel()` existente). Selección única.
3. **Combinación AND** — ambos filtros se aplican simultáneamente. Cada filtro es opcional; si no está seleccionado no restringe nada.
4. **KPIs del greeting inalterados** — vencidas / esta semana / en plazo siguen contando sobre `tasks` completas (carga real del técnico), no sobre `filteredTasks`.
5. **Columnas scrolleables** — la página ocupa el viewport sin scroll exterior. Cada columna del kanban hace scroll interno en su cuerpo.

---

## Diseño

### Flujo de datos

```
tasks[] (cargadas del API)
  ├── KPI getters (sin filtro)
  └── filteredTasks getter (clientFilter AND typeFilter)
        └── [tasks]="filteredTasks" → KanbanBoardComponent
```

### Filtros — TaskListComponent

Nuevas propiedades:
```typescript
clientFilter: string | null = null;   // client.id seleccionado
typeFilter: TaskType | null = null;    // TaskType seleccionado
clientSearch = '';                     // texto de búsqueda en autocomplete
```

Getter derivado:
```typescript
get filteredTasks(): Task[] {
  return this.tasks.filter(t =>
    (!this.clientFilter || t.clientId === this.clientFilter) &&
    (!this.typeFilter   || t.type     === this.typeFilter)
  );
}
```

Getter de opciones para autocomplete:
```typescript
get clientOptions(): { id: string; name: string }[] {
  const seen = new Set<string>();
  return this.tasks
    .filter(t => t.client)
    .filter(t => { if (seen.has(t.clientId)) return false; seen.add(t.clientId); return true; })
    .map(t => ({ id: t.clientId, name: t.client!.name }))
    .filter(c => c.name.toLowerCase().includes(this.clientSearch.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
}
```

### Barra de filtros — template

Ubicación: entre el greeting y el kanban. Dos controles en fila:

```html
<!-- Cliente con buscador (mat-autocomplete) -->
<mat-form-field appearance="outline" subscriptSizing="dynamic">
  <mat-label>Cliente</mat-label>
  <input matInput [matAutocomplete]="autoCliente"
         [(ngModel)]="clientSearch"
         (ngModelChange)="onClientSearchChange($event)"
         placeholder="Todos los clientes" />
  <mat-autocomplete #autoCliente (optionSelected)="onClientSelected($event)">
    <mat-option [value]="null">Todos</mat-option>
    <mat-option *ngFor="let c of clientOptions" [value]="c.id">{{ c.name }}</mat-option>
  </mat-autocomplete>
  <button *ngIf="clientFilter" matSuffix mat-icon-button (click)="clearClientFilter()">
    <mat-icon>close</mat-icon>
  </button>
</mat-form-field>

<!-- Tipo de tarea (mat-select) -->
<mat-form-field appearance="outline" subscriptSizing="dynamic">
  <mat-label>Tipo de tarea</mat-label>
  <mat-select [(ngModel)]="typeFilter">
    <mat-option [value]="null">Todos los tipos</mat-option>
    <mat-option *ngFor="let t of taskTypes" [value]="t.value">{{ t.label }}</mat-option>
  </mat-select>
</mat-form-field>
```

El `taskTypes` es un array estático construido con `typeLabel()`.

### Scroll de columnas — KanbanBoardComponent

Nuevo input:
```typescript
@Input() scrollable = false;
```

Aplicación de clase condicional en el template:
```html
<div class="kanban" [class.kanban--scrollable]="scrollable">
```

CSS en `kanban-board.component.scss`:
```scss
.kanban--scrollable {
  align-items: stretch;
  height: 100%;

  .kanban__col {
    min-height: 0;
    flex: 1 1 0;
  }

  .kanban__col-body {
    overflow-y: auto;
    flex: 1 1 0;
    min-height: 0;
  }
}
```

### Layout de página — TaskListComponent

`.tl-page` pasa a ocupar el viewport:
```scss
.tl-page {
  height: 100%;
  overflow: hidden;
  // ...mismo padding y gap
}
```

El kanban (y su skeleton de loading) recibe `flex: 1 1 0; min-height: 0` para ocupar el espacio restante:
```scss
app-kanban-board, .kanban--loading {
  flex: 1 1 0;
  min-height: 0;
}
```

En el template:
```html
<app-kanban-board
  [tasks]="filteredTasks"
  [scrollable]="true"
  ...>
```

---

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `task-list/task-list.component.ts` | clientFilter, typeFilter, clientSearch, filteredTasks, clientOptions, taskTypes, helpers |
| `task-list/task-list.component.html` | Barra de filtros + `[tasks]="filteredTasks"` + `[scrollable]="true"` |
| `task-list/task-list.component.scss` | height: 100%, overflow: hidden, flex en kanban |
| `kanban-board/kanban-board.component.ts` | `@Input() scrollable = false` |
| `kanban-board/kanban-board.component.html` | `[class.kanban--scrollable]="scrollable"` |
| `kanban-board/kanban-board.component.scss` | reglas `.kanban--scrollable` |

---

## Módulos Angular Material requeridos

`MatAutocompleteModule` debe agregarse al `TechnicianModule` (y al `SharedModule` si KanbanBoard lo necesita — pero no lo necesita). También `FormsModule` para `[(ngModel)]` en la barra de filtros (ya que no es un formulario reactivo).

---

## Testing

- `task-list.component.spec.ts`: tests para `filteredTasks` getter con combinaciones de filtros (solo cliente, solo tipo, ambos, ninguno).
- `kanban-board.component.spec.ts`: test que verifica que `[scrollable]="true"` agrega la clase CSS correcta.
- No se necesitan tests de integración adicionales; los filtros son cálculos puros sobre datos ya testeados.
