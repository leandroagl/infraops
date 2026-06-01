# Shell — Migración a Angular Material (Sidenav + Toolbar)

**Fecha:** 2026-06-01  
**Módulo:** `frontend/src/app/core/shell/`  
**Objetivo:** Reemplazar el layout flex manual del shell por `mat-sidenav-container` + `mat-sidenav` + `mat-toolbar`, eliminando CSS estructural hardcodeado sin cambiar el comportamiento ni el look-and-feel.

---

## Contexto

El shell actual usa divs con CSS manual para construir el layout (sidebar + topbar + contenido). Aunque el CSS usa design tokens (`var(--surface)`, etc.), el layout en sí está hardcodeado como flexbox manual. Angular Material tiene componentes nativos para exactamente este patrón.

---

## Decisiones de diseño

| Decisión | Elección | Motivo |
|---|---|---|
| Enfoque sidebar | `mat-sidenav` siempre abierto (`mode="side" opened`) | Sin cambio de comportamiento; mat-sidenav-container elimina el flex manual |
| Dos anchos del sidebar | Clase CSS `.sidenav--wide` via `[class.sidenav--wide]="clientContext"` | Mismo mecanismo que hoy, solo se aplica al elemento mat-sidenav |
| Altura toolbar | 50px via CSS variable `--mat-toolbar-standard-height: 50px` | Respeta el design system; un solo override |
| Nav items | Sin cambio (SVG + `<a>` con clases actuales) | La migración es del contenedor, no de los hijos |

---

## Estructura de template resultante

```html
<mat-sidenav-container class="shell">

  <mat-sidenav [class.sidenav--wide]="clientContext" mode="side" opened>

    <div class="sidebar__logo"> ... </div>

    <!-- MODO CLIENTE -->
    <ng-container *ngIf="clientContext; else globalNav">
      <a class="client-nav-item client-nav-item--back" routerLink="/clients">...</a>
      <div class="sidebar__divider"></div>
      <nav class="sidebar__nav sidebar__nav--client"> ... </nav>
    </ng-container>

    <!-- MODO GLOBAL -->
    <ng-template #globalNav>
      <nav class="sidebar__nav sidebar__nav--global"> ... </nav>
    </ng-template>

    <div class="sidebar__bottom">
      <button mat-icon-button (click)="logout()"> ... </button>
    </div>

  </mat-sidenav>

  <mat-sidenav-content>
    <mat-toolbar class="shell-toolbar">
      <span class="toolbar__title">InfraOps</span>
      <span class="toolbar__spacer"></span>
      <div class="toolbar__user">
        <span class="toolbar__role">{{ currentUser?.role }}</span>
        <span class="toolbar__email">{{ currentUser?.email }}</span>
      </div>
    </mat-toolbar>

    <main class="shell__content">
      <router-outlet></router-outlet>
    </main>
  </mat-sidenav-content>

</mat-sidenav-container>
```

---

## CSS: lo que desaparece

Estos bloques se eliminan del SCSS porque Angular Material los maneja nativamente:

| Bloque CSS eliminado | Reemplazado por |
|---|---|
| `.shell { display: flex; height: 100vh; overflow: hidden }` | `mat-sidenav-container` |
| `.shell__body { flex: 1; display: flex; flex-direction: column; min-width: 0 }` | `mat-sidenav-content` |
| `.sidebar { width: 52px; flex-shrink: 0; display: flex; flex-direction: column }` | `mat-sidenav` con CSS semántico |
| `.topbar { height: 50px; display: flex; align-items: center; justify-content: space-between; padding: 0 20px }` | `mat-toolbar` |

---

## CSS: lo que queda (solo semántico)

```scss
// Layout container
mat-sidenav-container.shell {
  height: 100vh;
}

// Sidebar — colores, ancho base y ancho expandido
mat-sidenav {
  width: 52px;
  background: var(--surface);
  border-right-color: var(--border-lo);

  &.sidenav--wide {
    width: 180px;
  }
}

// Toolbar — altura y colores
mat-toolbar.shell-toolbar {
  --mat-toolbar-standard-height: 50px;
  background: var(--surface);
  border-bottom: 1px solid var(--border-lo);
  padding: 0 20px;
}

.toolbar__spacer { flex: 1; }

// Contenido interior del toolbar (ya existe, solo renombrado desde .topbar__*)
.toolbar__title  { font-size: 12px; font-weight: 600; font-family: var(--font-mono); color: var(--tx-hi); letter-spacing: 0.5px; }
.toolbar__user   { display: flex; align-items: center; gap: 10px; }
.toolbar__role   { /* igual al actual .topbar__role */ }
.toolbar__email  { /* igual al actual .topbar__email */ }

// Área de contenido
.shell__content  { flex: 1; overflow-y: auto; padding: 24px; }

// Todo el resto del SCSS (sidebar__logo, nav-item, client-nav-item, etc.) permanece sin cambios
```

---

## Módulos Angular Material a agregar

En `shell.module.ts`:

```typescript
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
```

`MatButtonModule` ya estaba importado.

---

## Tests

El spec del shell (`shell.component.spec.ts`) necesita:
- Agregar `MatSidenavModule` y `MatToolbarModule` a `TestBed.configureTestingModule`
- Agregar `NoopAnimationsModule` si no está (mat-sidenav tiene animaciones)
- Verificar que los selectores de los tests sigan encontrando los elementos (si hay queries por `.topbar` o `.sidebar`, actualizar a `mat-toolbar` / `mat-sidenav`)

---

## Alcance

**Incluido:**
- Reemplazar `<aside>` por `mat-sidenav`
- Reemplazar `<header class="topbar">` por `mat-toolbar`
- Actualizar ShellModule con los nuevos imports
- Actualizar spec para los nuevos componentes Material

**Excluido:**
- Cambios a nav items (SVGs, clases, comportamiento de routing)
- Cambios al `SidenavContextService`
- Responsive / toggle hamburguesa (YAGNI — no hay requerimiento)
- Migración de nav items a `mat-nav-list`

---

## Impacto esperado

- ~40 líneas de CSS estructural eliminadas
- 0 cambios visuales
- 0 cambios de comportamiento
