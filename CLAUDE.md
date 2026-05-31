# InfraOps — Contexto de desarrollo para Claude Code

## Qué es este sistema

InfraOps es el sistema de orquestación de trabajo interno de **ONDRA**, un MSP
argentino de ~20 empleados. Reemplaza planillas Excel para coordinar tareas técnicas
recurrentes: mantenimientos de servidores, visitas a clientes, controles de UPS,
control de antivirus, e inventario de parque informático.

**InfraOps NO es:**
- Un sistema de tickets general (eso es Odoo)
- Un sistema de documentación de infraestructura (eso es InfraDoc)
- Un reemplazo de ManageEngine

Su valor está en hacer visible, trazable y medible el trabajo técnico recurrente
que hoy se coordina manualmente en planillas.

---

## Equipo y roles

| Persona | Rol en ONDRA | Rol en InfraOps |
|---|---|---|
| Pepe, Marce | Socios administradores técnicos | `ADMIN` |
| Omar | Coordinador de operaciones | `ADMIN` |
| El Pana | Team Leader / Técnico SR | `TL` |
| Leando (yo) | Technical Owner | `ADMIN` |
| Lau | Coordinadora del equipo | `COORDINATOR` |
| Valen | Técnico SSR | `TECHNICIAN` |
| Enzo, Tow, Santi, Gian | Técnicos JR | `TECHNICIAN` |

---

## Stack técnico

```
Backend:   NestJS · REST · TypeORM · PostgreSQL
Frontend:  Angular · Angular Material · Ag-Grid (sin standalone components salvo necesidad real)
Deploy:    Docker Compose · VMware ESXi (autohosteado ONDRA)
Auth:      JWT · Guards por rol
TDD:       Jest (backend) · Angular Testing Library (frontend)
```

---

## Convenciones de código

- **Idioma del código:** inglés (variables, funciones, clases, archivos)
- **Idioma de la documentación y commits:** español
- **TDD obligatorio:** siempre el test antes que la implementación
- **Un archivo a la vez:** no generar múltiples archivos sin confirmación entre cada uno
- **Sin código especulativo:** si algo no está definido, preguntar antes de asumir
- **Simplicidad sobre over-engineering:** soluciones mantenibles por cualquier técnico del equipo
- **Sin standalone components** en Angular salvo que haya una razón técnica concreta
- **Componentes reutilizables:** antes de implementar cualquier componente, revisar si la lógica ya existe o puede extraerse a `shared/` — no duplicar

---

## Estructura del backend (NestJS)

```
backend/src/
├── auth/              # JWT, login, guards, decorators de rol
├── users/             # Entidad User, roles, gestión interna
├── clients/           # Entidad Client (~35 clientes activos)
├── technicians/       # Entidad Technician (relación con User)
├── assets/            # Servidor, terminal, UPS, router
├── tasks/             # MaintenanceTask + Schedule + TaskStatus
├── maintenance-logs/  # MaintenanceLog + payload jsonb por tipo
├── ups/               # UpsDevice + UpsServiceRecord
├── notifications/     # Alertas de vencimiento (licencias, dominios, baterías)
├── integrations/
│   ├── infradoc/      # Lectura de inventario de infraestructura
│   ├── odoo/          # Apertura/cierre de tickets, métricas
│   └── manage-engine/ # Inventario de parque informático
└── common/            # Guards, decorators, DTOs compartidos, interceptors
```

**Orden de desarrollo:**
1. `auth` + `users` → 2. `clients` → 3. `technicians` → 4. `tasks` → 5. `maintenance-logs` → 6. `ups` → 7. `notifications` → 8. `integrations`

---

## Entidades principales

### User
```typescript
id, email, passwordHash, role: UserRole, 
technicianId?: FK, isActive: boolean, createdAt
```

### UserRole (enum)
```typescript
ADMIN | TL | TECHNICIAN | COORDINATOR
```

### Client
```typescript
id, name, isActive, createdAt
// Infraestructura detallada viene de InfraDoc API en tiempo real, no cacheada
```

### MaintenanceTask
```typescript
id, clientId, technicianId, type: TaskType, status: TaskStatus,
scheduledDate, completedDate, odooTicketId?, createdAt
```

### TaskType (enum)
```typescript
SERVER_MAINTENANCE | TERMINAL_MAINTENANCE | SITE_VISIT | 
AV_CONTROL | UPS_CONTROL | ENDPOINT_INVENTORY
```

### TaskStatus (enum)
```typescript
PENDING | IN_PROGRESS | DONE | ESCALATED | NOT_DONE
```

### MaintenanceLog
```typescript
id, taskId, technicianId, payload: jsonb, // estructura variable por TaskType
registeredAt, notes?
```

---

## Reglas de negocio críticas

1. **Ticket Odoo siempre primero:** ante cualquier error detectado, se abre ticket
   en Odoo ANTES de intentar resolver o escalar. Nunca al revés.

2. **Escalada en el mismo ticket:** no se crea un ticket nuevo al escalar. El ticket
   existente se reasigna al técnico senior.

3. **InfraDoc como fuente de inventario:** los datos de infraestructura de cada cliente
   se consultan a InfraDoc API en el momento de abrir la tarea. No se cachean en la DB
   de InfraOps.

4. **Asignación fija por defecto:** cada cliente tiene un técnico asignado por defecto
   para cada tipo de tarea. El TL puede reasignar antes de ejecutar.

5. **Alertas de vencimiento:** InfraOps notifica visualmente y por mail ante vencimientos
   de licencias, garantías, dominios y baterías UPS. Estas alertas pertenecen al flujo
   de mantenimiento de servidores, no al de visitas.

6. **Payload jsonb:** el payload de MaintenanceLog varía según TaskType. Usar jsonb
   en PostgreSQL. No crear tablas separadas por tipo de control.

---

## Flujos de trabajo aprobados

### Flujo mantenimiento de servidores ✅
```
Mes nuevo → TL revisa → Técnico asignado ejecuta y registra controles
(WinServer / QNAP / Router / VMware / Veeam / Métricas)
→ Sin error: DONE
→ Con error: abre ticket Odoo → intenta resolver (cierra ticket) → DONE
           → no puede: escala mismo ticket a senior → senior resuelve → cierra → ESCALATED
```

### Flujo visitas de terminales ✅ (v2)
```
InfraOps genera tarea → TL asigna → Laura coordina fecha con cliente
→ Odoo abre ticket mantenimiento (SLA extendido) → PENDING
→ No concretada (sin horas / cancelada): cierra ticket sin remito + motivo → NOT_DONE
→ Técnico va al cliente → mantenimiento terminales + HDs pendientes
  → Problema sin tiempo: abre nuevo ticket HD remoto → registra en drawer
  → Cierra ticket original con remito → DONE
  → Post-cierre: actualiza métricas + genera reporte
```

---

## Integraciones externas

| Sistema | Dirección | Uso |
|---|---|---|
| InfraDoc | Lectura (API) | Inventario de infraestructura por cliente |
| Odoo | Lectura + escritura (API) | Tickets, métricas de técnicos y clientes |

---

## UI — Patrones aprobados

- **Patrón principal:** Master/Detail Drawer (lista a la izquierda, panel deslizable a la derecha)
- **Tablas:** Ag-Grid **cuando se solicite explícitamente**; `mat-table` para tablas simples o secundarias
- **Todos los componentes interactivos:** Angular Material — sin excepción (ver reglas abajo)
- **Tema:** dark, con variables CSS definidas en los mockups de referencia

### Reactividad de estado — regla obligatoria

**Cuando una acción en un componente hijo cambia el estado de una entidad, el componente padre actualiza su array local inmediatamente, sin recargar desde la API.**

- No llamar a `load()` ni hacer un nuevo request HTTP para reflejar un cambio que ya conocemos.
- Mutar el array local con `tasks[idx] = { ...tasks[idx], status: newStatus }` (inmutable, dispara change detection).
- Si el hijo necesita señalar un cambio de estado, emitir el nuevo estado o la entidad actualizada como `EventEmitter<T>`, no `EventEmitter<void>`.
- Los eventos de "cerrar panel" y "acción completada" deben ser outputs separados para mantener semántica limpia:

```typescript
// ✅ Correcto — semántica separada
@Output() taskCompleted = new EventEmitter<void>(); // acción con cambio de estado
@Output() drawerClosed  = new EventEmitter<void>(); // cierre sin acción

// ❌ Incorrecto — evento sobrecargado
@Output() taskCompleted = new EventEmitter<void>(); // usado para ambas cosas
```

```typescript
// ✅ En el padre — actualización local instantánea
onTaskCompleted(): void {
  const idx = this.tasks.findIndex(t => t.id === this.selectedTask?.id);
  if (idx !== -1) this.tasks[idx] = { ...this.tasks[idx], status: 'DONE' };
  this.closeDrawer();
}

// ❌ Incorrecto — recarga innecesaria
onTaskCompleted(): void {
  this.closeDrawer();
  this.load(); // evitar
}
```

---

## Angular Material — Reglas obligatorias

**Todo elemento interactivo usa Angular Material. No hay excepciones.**
Nunca usar `<input>`, `<select>`, `<textarea>`, `<button>` nativos en templates Angular.

### Formularios

```html
<!-- Inputs de texto y área -->
<mat-form-field appearance="outline" subscriptSizing="dynamic">
  <mat-label>Label</mat-label>
  <input matInput formControlName="field" />
</mat-form-field>

<!-- Select simple -->
<mat-form-field appearance="outline" subscriptSizing="dynamic">
  <mat-label>Label</mat-label>
  <mat-select formControlName="field">
    <mat-option value="x">Opción</mat-option>
  </mat-select>
</mat-form-field>

<!-- Multi-select -->
<mat-select multiple formControlName="field">
  <mat-option *ngFor="let item of items" [value]="item.id">{{ item.name }}</mat-option>
</mat-select>

<!-- Checkbox -->
<mat-checkbox formControlName="active">Activo</mat-checkbox>
```

**`appearance="outline"` es el único estilo permitido para `mat-form-field`.**
No usar `appearance="fill"` ni `appearance="legacy"`.

### Botones

```html
<button mat-flat-button color="primary">Guardar</button>
<button mat-stroked-button>Cancelar</button>
<button mat-flat-button color="warn">Eliminar</button>
<button mat-icon-button><mat-icon>close</mat-icon></button>
```

### Coloring semántico en mat-form-field

Usar CSS custom properties con `[ngClass]`, nunca `::ng-deep`:

```scss
mat-form-field.mf-sel--ok   { --mdc-outlined-text-field-container-color: var(--ok-bg);   --mat-select-trigger-text-color: var(--ok);   }
mat-form-field.mf-sel--warn { --mdc-outlined-text-field-container-color: var(--warn-bg); --mat-select-trigger-text-color: var(--warn); }
mat-form-field.mf-sel--crit { --mdc-outlined-text-field-container-color: var(--crit-bg); --mat-select-trigger-text-color: var(--crit); }
```

### Tablas

- **Ag-Grid** (`ag-grid-angular`, tema `ag-theme-alpine-dark`) → cuando se solicita **explícitamente** o para la tabla principal de una vista con >20 filas, ordenamiento complejo o celdas con renderers custom.
- **`mat-table`** → tablas secundarias, paneles de detalle, listas cortas dentro de un drawer.
- **Nunca `mat-table` cuando ya se definió Ag-Grid** para esa vista — no mezclar ambas en la misma pantalla.

### Módulos por módulo Angular

Importar únicamente los módulos que el template usa. Módulos base requeridos:

| Módulo Angular | Módulos Material obligatorios |
|---|---|
| `auth` | MatFormFieldModule, MatInputModule, MatButtonModule, MatProgressSpinnerModule |
| `admin` | MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatDialogModule, MatSnackBarModule, MatMenuModule, MatProgressSpinnerModule |
| `technician` | MatFormFieldModule, MatInputModule, MatSelectModule, MatCheckboxModule, MatButtonModule, MatSnackBarModule |

**Specs:** agregar `NoopAnimationsModule` + todos los módulos Material usados en el template al `TestBed.configureTestingModule`.

### Componentes reutilizables — criterios de extracción

Antes de escribir cualquier componente, evaluar si pertenece a `shared/`:

| Señal | Acción |
|---|---|
| El mismo bloque HTML aparece en 2+ vistas | Extraer a `shared/components/` |
| La lógica de un pipe o formato se repite | Extraer a `shared/pipes/` |
| Un formulario de filtros se usa en múltiples tablas | Componente `FilterBarComponent` en shared |
| Un badge, chip o celda de estado se repite | Componente o directiva en shared |
| Un diálogo de confirmación se usa en más de un módulo | `ConfirmDialogComponent` en shared |

**Estructura de shared:**
```
frontend/src/app/shared/
├── components/   ← componentes visuales reutilizables
├── directives/   ← directivas de comportamiento
├── pipes/        ← transformaciones de datos
└── shared.module.ts
```

Cuando un componente nuevo duplique lógica existente, **refactorizar primero** y luego continuar.

### Vistas definidas
- `Panel Admin` — gestión de tareas + indicadores generales
- `Vista Técnico` — mantenimientos asignados + ejecución
- `Perfil de cliente` — métricas, logs, alertas por cliente
- `Dashboard general` — tabla global de estado de todos los clientes

---

## Archivos de referencia en este proyecto

```
docs/
├── domain-model.md         # Modelo de dominio completo
├── flows/
│   ├── server-maintenance.md
│   └── terminal-visits.md
|── infradoc/ api.md
├── mockups/                
# HTML mockups de referencia visual
└── REVIEW_RULES.md         # Criterios de revisión de código
```

---

## Lo que NO hacer

- No generar múltiples archivos sin esperar confirmación
- No asumir requisitos no discutidos — preguntar
- No mezclar lógica de negocio en controllers (va en services)
- No usar `any` en TypeScript salvo casos excepcionales justificados
- No saltear tests — TDD es obligatorio en todo el proyecto
- No cachear datos de InfraDoc en la base de datos de InfraOps
- No crear standalone components en Angular sin justificación explícita
- **No usar elementos HTML nativos en formularios:** prohibido `<input>`, `<select>`, `<textarea>`, `<button>` sueltos en templates Angular — siempre Angular Material
- **No usar `appearance="fill"` ni `appearance="legacy"`** en `mat-form-field` — solo `appearance="outline"`
- **No usar `mat-table` cuando la vista ya tiene Ag-Grid** — no mezclar motores de tabla en la misma pantalla
- **No implementar Ag-Grid si no fue solicitado explícitamente** para esa vista
- **No duplicar lógica de componentes:** si dos componentes hacen lo mismo, extraer a `shared/` antes de continuar

---

## Design System — Tokens y convenciones visuales

InfraOps usa un tema dark inspirado en dashboards de monitoreo (estilo PRTG).
Todo el sistema visual está definido con CSS custom properties.
**No inventar colores ni estilos fuera de este sistema.**

### Variables CSS globales
Definidas en `frontend/src/styles/tokens.scss` e importadas en `styles.scss`.

```scss
:root {
  // Superficies (de más oscuro a más claro)
  --base:     #0f1117;   // fondo de página
  --surface:  #161b22;   // sidebar, topbar, panels
  --card:     #1e2530;   // cards, filas de tabla
  --elevated: #252e3f;   // headers de tabla, elementos elevados
  --hover:    #2a3447;   // hover de filas y elementos

  // Bordes
  --border:    #2d3748;  // borde estándar
  --border-lo: #1e2737;  // borde sutil (separadores internos)
  --border-md: #3d4f6a;  // borde énfasis

  // Texto
  --tx-hi: #f0f4f8;      // texto principal
  --tx-md: #8b95a6;      // texto secundario
  --tx-lo: #4a5568;      // texto deshabilitado / labels

  // Semánticos de estado
  --crit:    #f87171;  --crit-bg:  #450a0a;  --crit-bd:  #7f1d1d;
  --warn:    #fb923c;  --warn-bg:  #431407;  --warn-bd:  #7c2d12;
  --ok:      #4ade80;  --ok-bg:    #052e16;  --ok-bd:    #166534;
  --neutral: #9ca3af;  --neutral-bg:#1c1f26; --neutral-bd:#374151;

  // Accent (interacciones, links, elementos activos)
  --accent:  #0ea5e9;  --accent-bg: #071a29; --accent-bd: #0c3454;

  // Por tipo de tarea
  --srv:    #60a5fa;  --srv-bg:    #0c1a3a;  --srv-bd:    #1e3a8a;  // servidores
  --purple: #a78bfa;  --purple-bg: #1a0c3a;  --purple-bd: #4c1d95;  // visitas

  // Tipografía
  --font-ui:   -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;

  // Radio de borde
  --radius:    8px;
  --radius-lg: 12px;
  --radius-sm: 6px;
}
```

### Reglas de uso de colores

- `--crit` → tarea vencida, error, DCDIAG con error
- `--warn` → vence esta semana, métrica en zona de alerta
- `--ok`   → al día, control exitoso, métricas normales
- `--accent` → elementos interactivos, links, estado activo en sidebar
- `--srv`    → todo lo relacionado a servidores
- `--purple` → todo lo relacionado a visitas presenciales
- **Nunca usar colores hardcodeados** fuera de este sistema de variables

### Tipografía

- **UI general:** `var(--font-ui)` — 13px base, line-height 1.4
- **Valores numéricos, IPs, métricas, badges:** `var(--font-mono)` — IBM Plex Mono
- **Labels de sección:** 9px · font-weight 600 · uppercase · letter-spacing 0.8px · `var(--tx-lo)`
- **Títulos de card:** 11–12px · font-weight 600 · `var(--tx-hi)` · font-mono
- **Texto secundario:** `var(--tx-md)`

### Componentes estándar

#### Badge de estado
```html
<span class="badge badge--crit">Vencido</span>
<span class="badge badge--warn">Esta semana</span>
<span class="badge badge--ok">Al día</span>
<span class="badge badge--srv">Servidores</span>
```
```scss
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 5px;
  font-size: 10px;
  font-weight: 500;
  font-family: var(--font-mono);
  border: 1px solid;
  &--crit { background: var(--crit-bg); color: var(--crit); border-color: var(--crit-bd); }
  &--warn { background: var(--warn-bg); color: var(--warn); border-color: var(--warn-bd); }
  &--ok   { background: var(--ok-bg);   color: var(--ok);   border-color: var(--ok-bd);   }
  &--srv  { background: var(--srv-bg);  color: var(--srv);  border-color: var(--srv-bd);  }
  &--na   { background: var(--elevated); color: var(--tx-md); border-color: var(--border); }
}
```

#### Card estándar
```scss
.card {
  background: var(--card);
  border: 1px solid var(--border-lo);
  border-radius: var(--radius-lg);
  padding: 14px;
}
.surface-card {
  background: var(--surface);
  border: 1px solid var(--border-lo);
  border-radius: var(--radius-lg);
}
```

#### KPI card
```scss
.kpi {
  background: var(--surface);
  border: 1px solid var(--border-lo);
  border-radius: var(--radius);
  padding: 10px 14px;
  .kpi__value { font-size: 22px; font-weight: 500; line-height: 1; }
  .kpi__label { font-size: 9px; color: var(--tx-lo); margin-top: 3px;
                letter-spacing: .3px; text-transform: uppercase; font-family: var(--font-mono); }
}
```

#### Sidebar
```scss
.sidebar {
  width: 52px;
  background: var(--surface);
  border-right: 1px solid var(--border-lo);
}
.nav-item {
  width: 34px; height: 34px;
  border-radius: 8px;
  &.active {
    background: var(--accent-bg);
    border: 1px solid var(--accent-bd);
    svg { stroke: var(--accent); }
  }
}
```

#### Topbar
```scss
.topbar {
  height: 50px;
  background: var(--surface);
  border-bottom: 1px solid var(--border-lo);
}
```

#### Tabla (Ag-Grid theme override)
```scss
// Aplicar sobre el tema alpine-dark de Ag-Grid
.ag-theme-alpine-dark {
  --ag-background-color: var(--surface);
  --ag-odd-row-background-color: var(--card);
  --ag-row-hover-color: var(--hover);
  --ag-border-color: var(--border-lo);
  --ag-header-background-color: var(--elevated);
  --ag-header-foreground-color: var(--tx-lo);
  --ag-foreground-color: var(--tx-hi);
  --ag-font-size: 12px;
  --ag-row-height: 50px;
  --ag-header-height: 36px;
}
```

#### Inputs y selects
```scss
.input {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--tx-hi);
  font-size: 12px;
  padding: 6px 12px;
  &:focus { border-color: var(--accent-bd); outline: none; }
  &::placeholder { color: var(--tx-lo); }
}
```

#### Botones
```scss
.btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 14px; border-radius: var(--radius-sm);
  font-size: 12px; font-weight: 500; border: 1px solid; cursor: pointer;
  &--primary   { background: var(--accent);   color: #fff;          border-color: var(--accent);   }
  &--secondary { background: var(--elevated);  color: var(--tx-md);  border-color: var(--border);   }
  &--danger    { background: var(--crit-bg);   color: var(--crit);   border-color: var(--crit-bd);  }
}
```

### Estructura de estilos en Angular

```
frontend/src/styles/
├── tokens.scss       ← variables CSS (este sistema)
├── reset.scss        ← box-sizing, margin, padding reset
├── typography.scss   ← clases de texto reutilizables
├── components.scss   ← badge, card, kpi, btn, input
├── ag-grid.scss      ← theme overrides para Ag-Grid
└── styles.scss       ← importa todo lo anterior (entry point)
```

### Íconos

Usar **únicamente SVG inline** con estas propiedades base:
```html
<svg viewBox="0 0 24 24"
     style="width:15px;height:15px;stroke:currentColor;fill:none;
            stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round">
```
- Stroke, no fill (estilo outline)
- Tamaño estándar: 15×15px en sidebar, 14×14px en cards, 12×12px en badges
- Color heredado via `currentColor` — no hardcodear stroke color en el SVG

### Mockups de referencia

Los archivos HTML en `docs/mockups/` son la referencia visual definitiva:
- `infraops-dashboard.html` — dashboard general con tabla expandible
- `infraops-admin.html` — panel admin con drawer de detalle
- `infraops-tecnico.html` — vista del técnico con formulario de registro
- `infraops-client-profile.html` — perfil de cliente con tabs

Ante cualquier duda de estilo, **el mockup manda**.
