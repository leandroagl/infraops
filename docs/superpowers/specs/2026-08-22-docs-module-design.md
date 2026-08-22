# Módulo Documentación — Design Spec

**Fecha:** 2026-08-22  
**Estado:** aprobado en brainstorming

---

## Objetivo

Incorporar el manual de usuario de InfraOps dentro del sistema como un módulo Angular independiente accesible desde el shell principal. El contenido vive en el repositorio como archivos Markdown, se bundlea con el frontend y se renderiza filtrado por el rol del usuario logueado.

---

## Decisiones de diseño

| Decisión | Elección | Razón |
|---|---|---|
| Acceso | Todos los roles | El manual cubre flujos de todos los perfiles |
| Segmentación | Secciones con metadata de roles | Cada usuario ve solo lo relevante a su perfil |
| Almacenamiento del contenido | Bundled en frontend (`assets/docs/`) | Sin endpoint backend; sin rebuild al editar en repo |
| Renderizado | `ngx-markdown` | Librería estándar Angular, bien mantenida, soporte syntax highlighting |
| Navegación interna | Sidebar izquierda + área de contenido derecha | Patrón docs estándar, escala al crecer el manual |
| Estado de sección activa | Local al componente (no URL) | No requiere rutas hijas; navegación interna liviana |

---

## Estructura de archivos

### Assets (contenido Markdown)

```
frontend/src/assets/docs/
├── 01-que-es-infraops.md
├── 02-primer-acceso.md
├── 03-vista-tareas.md
├── 04-ejecutar-mantenimiento.md
├── 05-estados-tarea.md
├── 06-asignacion-tecnicos.md     ← TL, ADMIN
├── 07-coordinacion-visitas.md    ← TL, ADMIN, COORDINATOR
└── 08-gestion-usuarios.md        ← ADMIN
```

Los archivos se nombran con prefijo numérico para mantener el orden natural del índice.

### Módulo Angular

```
frontend/src/app/features/docs/
├── docs.module.ts
├── docs-routing.module.ts
├── docs.component.ts
├── docs.component.html
├── docs.component.scss
└── data/
    └── docs-sections.ts          ← config central de secciones
```

---

## Config central de secciones (`docs-sections.ts`)

```typescript
export type DocRole = 'ADMIN' | 'TL' | 'COORDINATOR' | 'TECHNICIAN' | '*';

export interface DocSection {
  id: string;
  title: string;
  file: string;         // relativo a assets/docs/
  group: string;        // label de agrupación en sidebar
  roles: DocRole[];     // ['*'] = todos los roles
}

export const DOCS_SECTIONS: DocSection[] = [
  // General
  { id: 'que-es',      title: '¿Qué es InfraOps?',      file: '01-que-es-infraops.md',        group: 'General',        roles: ['*'] },
  { id: 'acceso',      title: 'Primer acceso',           file: '02-primer-acceso.md',           group: 'General',        roles: ['*'] },
  // Tareas
  { id: 'tareas',      title: 'Vista de tareas',         file: '03-vista-tareas.md',            group: 'Tareas',         roles: ['*'] },
  { id: 'ejecucion',   title: 'Ejecutar mantenimiento',  file: '04-ejecutar-mantenimiento.md',  group: 'Tareas',         roles: ['*'] },
  { id: 'estados',     title: 'Estados de tarea',        file: '05-estados-tarea.md',           group: 'Tareas',         roles: ['*'] },
  // Coordinación
  { id: 'asignacion',  title: 'Asignación de técnicos',  file: '06-asignacion-tecnicos.md',    group: 'Coordinación',   roles: ['TL', 'ADMIN'] },
  { id: 'visitas',     title: 'Coordinación de visitas', file: '07-coordinacion-visitas.md',   group: 'Coordinación',   roles: ['TL', 'ADMIN', 'COORDINATOR'] },
  // Administración
  { id: 'usuarios',    title: 'Gestión de usuarios',     file: '08-gestion-usuarios.md',       group: 'Administración', roles: ['ADMIN'] },
];
```

Este archivo es la única fuente de verdad del índice. Agregar una sección nueva = agregar una entrada aquí + el archivo `.md` correspondiente.

---

## Componente `DocsComponent`

### Responsabilidades

1. Leer el rol del usuario logueado desde el `AuthService`
2. Filtrar `DOCS_SECTIONS` por rol para construir el índice visible
3. Agrupar las secciones por `group` para renderizar los labels del sidebar
4. Mantener `activeSection: DocSection` como estado local
5. Construir la ruta de asset: `assets/docs/<section.file>`

### Filtrado por rol

```typescript
// Lógica de filtrado — sección visible si roles incluye '*' o el rol del usuario
visibleSections = DOCS_SECTIONS.filter(s =>
  s.roles.includes('*') || s.roles.includes(this.currentUserRole)
);
```

### Template — estructura

```
<div class="docs-layout">
  <aside class="docs-sidebar">
    <!-- header -->
    <!-- nav: grupos con sus secciones filtradas -->
    <!-- badge de rol en secciones restringidas -->
  </aside>
  <main class="docs-content">
    <markdown [src]="activeAssetPath" />
  </main>
</div>
```

`activeAssetPath` es un getter: `'assets/docs/' + this.activeSection.file`

### Navegación anterior / siguiente

Botones en el footer del área de contenido que navegan entre las secciones visibles (no las globales), usando el índice de `activeSection` en `visibleSections`.

---

## Módulo Angular

### Imports requeridos

```typescript
imports: [
  CommonModule,
  MarkdownModule.forChild(),  // ngx-markdown lazy-loaded
  MatIconModule,              // íconos SVG opcionales
]
```

`MarkdownModule.forRoot()` va en `AppModule`; el módulo docs usa `forChild()`.

### Ruta

```typescript
// app-routing.module.ts
{ path: 'docs', loadChildren: () => import('./features/docs/docs.module').then(m => m.DocsModule) }
```

Ruta lazy-loaded, sin guard de rol (todos tienen acceso; el filtrado es visual en el sidebar).

---

## Estilos

El módulo hereda los tokens globales de `tokens.scss`. No requiere tokens nuevos.

Clases propias del componente (en `docs.component.scss`):

| Clase | Propósito |
|---|---|
| `.docs-layout` | Flex container: sidebar + content |
| `.docs-sidebar` | Panel izquierdo con índice |
| `.docs-nav-item` | Item del sidebar, con estado `.active` |
| `.docs-section-label` | Label de grupo (9px, uppercase) |
| `.role-badge` | Badge TL / ADM en items restringidos |
| `.docs-content` | Área de scroll para el markdown renderizado |
| `.docs-footer-nav` | Navegación anterior/siguiente |

Los estilos de contenido Markdown (headings, tablas, code blocks, callouts) se definen en `docs.component.scss` apuntando a `.docs-content markdown` para no contaminar el scope global.

---

## Entrada en la shell sidebar

Agregar un ítem "Documentación" al final de la sidebar del shell (antes del perfil), usando el ícono de libro SVG. Ruta: `/docs`.

---

## Testing

- **Unit:** `DocsComponent` — filtrado por rol (técnico no ve secciones TL/ADMIN, ADMIN ve todas)
- **Unit:** `docs-sections.ts` — validar que todos los archivos referenciados existen en `assets/docs/`
- **Integration:** navegación anterior/siguiente respeta el orden de `visibleSections`

---

## Fuera de scope (esta iteración)

- Búsqueda full-text dentro del manual
- Editor inline del Markdown
- Versionado / changelog de documentación
- Anclas por heading dentro de una sección
