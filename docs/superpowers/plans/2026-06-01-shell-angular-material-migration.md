# Shell — Migración a Angular Material Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el layout flex manual del shell (divs + CSS hardcodeado) por `mat-sidenav-container` + `mat-sidenav` + `mat-toolbar`, eliminando ~40 líneas de CSS estructural sin cambiar comportamiento ni aspecto visual.

**Architecture:** Se usa `mat-sidenav` en `mode="side" opened` (siempre visible), con una clase CSS `.sidenav--wide` controlada por `clientContext` para el cambio de ancho 52px→180px. El `mat-toolbar` reemplaza el `<header>` custom con `position: sticky` para que siempre sea visible durante el scroll.

**Tech Stack:** Angular 19, Angular Material (MatSidenavModule, MatToolbarModule), SCSS con design tokens del proyecto.

---

## Mapa de archivos

| Archivo | Acción | Qué cambia |
|---|---|---|
| `frontend/src/app/core/shell/shell.component.spec.ts` | Modificar | Agregar 3 tests TDD para la nueva estructura |
| `frontend/src/app/core/shell/shell.module.ts` | Modificar | Agregar MatSidenavModule, MatToolbarModule |
| `frontend/src/app/core/shell/shell.component.html` | Modificar | Reemplazar contenedores div/aside/header por equivalentes Material |
| `frontend/src/app/core/shell/shell.component.scss` | Modificar | Eliminar CSS estructural, agregar overrides de Material |

---

## Task 1: Tests TDD para la nueva estructura

**Files:**
- Modify: `frontend/src/app/core/shell/shell.component.spec.ts`

- [ ] **Step 1: Agregar 3 tests que fallan con el template actual**

Abrir `shell.component.spec.ts` y agregar los tres tests al final del bloque `describe`, antes del cierre `}`:

```typescript
  it('usa mat-sidenav-container como contenedor principal', () => {
    const container = fixture.nativeElement.querySelector('mat-sidenav-container');
    expect(container).toBeTruthy();
  });

  it('usa mat-toolbar como topbar', () => {
    const toolbar = fixture.nativeElement.querySelector('mat-toolbar');
    expect(toolbar).toBeTruthy();
  });

  it('aplica sidenav--wide en mat-sidenav cuando hay cliente activo', () => {
    clientSubject.next({ id: '1', name: 'ACME Corp' });
    fixture.detectChanges();
    const sidenav = fixture.nativeElement.querySelector('mat-sidenav');
    expect(sidenav.classList.contains('sidenav--wide')).toBeTrue();
  });
```

- [ ] **Step 2: Ejecutar los nuevos tests para confirmar que fallan**

```bash
cd frontend && npx ng test --watch=false --include="**/shell.component.spec.ts"
```

Resultado esperado: los 3 tests nuevos en FAIL, los 4 tests existentes en PASS.

Los fallos esperados son:
- `mat-sidenav-container` no encontrado (existe `div.shell`)
- `mat-toolbar` no encontrado (existe `header.topbar`)
- `mat-sidenav` no encontrado (existe `aside.sidebar`)

---

## Task 2: Agregar imports de Material a ShellModule

**Files:**
- Modify: `frontend/src/app/core/shell/shell.module.ts`

- [ ] **Step 1: Agregar MatSidenavModule y MatToolbarModule**

Reemplazar el contenido completo del archivo:

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';

import { ShellComponent } from './shell.component';

@NgModule({
  declarations: [ShellComponent],
  imports: [CommonModule, RouterModule, MatButtonModule, MatSidenavModule, MatToolbarModule],
  exports: [ShellComponent],
})
export class ShellModule {}
```

---

## Task 3: Migrar el template del shell

**Files:**
- Modify: `frontend/src/app/core/shell/shell.component.html`

- [ ] **Step 1: Reemplazar el template completo**

Reemplazar el contenido completo del archivo:

```html
<mat-sidenav-container class="shell">

  <!-- ── Sidenav ───────────────────────────────────────────── -->
  <mat-sidenav [class.sidenav--wide]="clientContext" mode="side" opened>

    <div class="sidebar__logo">
      <svg viewBox="0 0 24 24"
           style="width:22px;height:22px;stroke:var(--accent);fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <path d="M8 21h8M12 17v4"/>
      </svg>
    </div>

    <!-- MODO CLIENTE -->
    <ng-container *ngIf="clientContext; else globalNav">
      <a class="client-nav-item client-nav-item--back"
         routerLink="/clients"
         title="Volver a Clientes">
        <svg viewBox="0 0 24 24"
             style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        <span class="client-nav-item__label">Clientes</span>
      </a>

      <div class="sidebar__divider"></div>

      <nav class="sidebar__nav sidebar__nav--client">
        <a class="client-nav-item"
           [routerLink]="['/clients', clientContext.id, 'overview']"
           routerLinkActive="active"
           title="Overview">
          <svg viewBox="0 0 24 24"
               style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          <span class="client-nav-item__label">Overview</span>
        </a>

        <a class="client-nav-item"
           [routerLink]="['/clients', clientContext.id, 'mantenimientos']"
           routerLinkActive="active"
           title="Mantenimientos">
          <svg viewBox="0 0 24 24"
               style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
          <span class="client-nav-item__label">Mantenimientos</span>
        </a>
      </nav>
    </ng-container>

    <!-- MODO GLOBAL -->
    <ng-template #globalNav>
      <nav class="sidebar__nav sidebar__nav--global">
        <a *ngFor="let item of navItems"
           [routerLink]="item.route"
           class="nav-item"
           [class.active]="isActive(item.route)"
           [title]="item.label">

          <svg *ngIf="item.icon === 'dashboard'" viewBox="0 0 24 24"
               style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>

          <svg *ngIf="item.icon === 'tasks'" viewBox="0 0 24 24"
               style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round">
            <path d="M9 11l3 3L22 4"/>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>

          <svg *ngIf="item.icon === 'clients'" viewBox="0 0 24 24"
               style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>

          <svg *ngIf="item.icon === 'admin'" viewBox="0 0 24 24"
               style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
            <path d="M9 12h6M9 16h4"/>
          </svg>

        </a>
      </nav>
    </ng-template>

    <div class="sidebar__bottom">
      <button mat-icon-button class="nav-item nav-item--logout" (click)="logout()" title="Cerrar sesión">
        <svg viewBox="0 0 24 24"
             style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
      </button>
    </div>

  </mat-sidenav>

  <!-- ── Content ───────────────────────────────────────────── -->
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

- [ ] **Step 2: Ejecutar todos los tests del shell**

```bash
cd frontend && npx ng test --watch=false --include="**/shell.component.spec.ts"
```

Resultado esperado: los 7 tests en PASS.

---

## Task 4: Actualizar el SCSS

**Files:**
- Modify: `frontend/src/app/core/shell/shell.component.scss`

- [ ] **Step 1: Reemplazar el contenido completo del SCSS**

Los bloques `.shell`, `.shell__body` y `.topbar` (layout estructural) se eliminan. Se agregan overrides de Material apuntando directamente a los elementos `mat-sidenav-container`, `mat-sidenav` y `mat-toolbar`. Todo el CSS de contenido del sidebar (`.sidebar__logo`, `.nav-item`, `.client-nav-item`, etc.) se mantiene sin cambios.

```scss
// ── Shell container ────────────────────────────────────────────
mat-sidenav-container.shell {
  height: 100vh;
}

// ── Sidenav ────────────────────────────────────────────────────
mat-sidenav {
  width: 52px;
  background: var(--surface);
  border-right: 1px solid var(--border-lo);

  &.sidenav--wide {
    width: 180px;
  }
}

.sidebar__logo {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 50px;
  border-bottom: 1px solid var(--border-lo);
  flex-shrink: 0;
}

.sidebar__nav {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 0;
  flex: 1;
}

.sidebar__bottom {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 0;
  border-top: 1px solid var(--border-lo);
}

.nav-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  text-decoration: none;
  color: var(--tx-md);
  transition: color var(--transition), background var(--transition);

  &:hover {
    background: var(--hover);
    color: var(--tx-hi);
  }

  &.active {
    background: var(--accent-bg);
    border-color: var(--accent-bd);
    color: var(--accent);
  }

  &--logout {
    color: var(--tx-lo);

    &:hover {
      background: var(--crit-bg);
      border-color: var(--crit-bd);
      color: var(--crit);
    }
  }
}

// ── Toolbar ────────────────────────────────────────────────────
mat-toolbar.shell-toolbar {
  --mat-toolbar-standard-height: 50px;
  background: var(--surface);
  border-bottom: 1px solid var(--border-lo);
  padding: 0 20px;
  position: sticky;
  top: 0;
  z-index: 2;
}

.toolbar__spacer {
  flex: 1;
}

.toolbar__title {
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font-mono);
  color: var(--tx-hi);
  letter-spacing: 0.5px;
}

.toolbar__user {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toolbar__role {
  font-size: 9px;
  font-weight: 600;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--tx-lo);
  background: var(--elevated);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 2px 7px;
}

.toolbar__email {
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--tx-md);
}

// ── Content area ───────────────────────────────────────────────
.shell__content {
  padding: 24px;
}

// ── Client sidebar mode ────────────────────────────────────────
.sidebar__divider {
  height: 1px;
  background: var(--border-lo);
  margin: 4px 8px;
  flex-shrink: 0;
}

.sidebar__nav--client {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 0;
  flex: 1;
}

.client-nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  height: 34px;
  margin: 0 8px;
  border-radius: 8px;
  border: 1px solid transparent;
  text-decoration: none;
  color: var(--tx-md);
  font-size: 12px;
  font-family: var(--font-ui);
  transition: color var(--transition), background var(--transition);
  flex-shrink: 0;

  &__label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  svg {
    flex-shrink: 0;
  }

  &:hover {
    background: var(--hover);
    color: var(--tx-hi);
  }

  &.active {
    background: var(--accent-bg);
    border-color: var(--accent-bd);
    color: var(--accent);
  }

  &--back {
    margin-top: 8px;
    color: var(--tx-lo);
    font-size: 11px;
    font-family: var(--font-mono);
  }
}
```

- [ ] **Step 2: Ejecutar todos los tests del shell**

```bash
cd frontend && npx ng test --watch=false --include="**/shell.component.spec.ts"
```

Resultado esperado: 7 tests en PASS, 0 FAIL.

- [ ] **Step 3: Commit**

```bash
cd frontend/.. && git add frontend/src/app/core/shell/shell.component.spec.ts frontend/src/app/core/shell/shell.module.ts frontend/src/app/core/shell/shell.component.html frontend/src/app/core/shell/shell.component.scss && git commit -m "refactor(shell): migrar a mat-sidenav-container y mat-toolbar"
```

---

## Task 5: Verificación visual en el browser

**Files:** ninguno (verificación solamente)

- [ ] **Step 1: Levantar el servidor de desarrollo**

```bash
cd frontend && npx ng serve
```

- [ ] **Step 2: Verificar los siguientes puntos en http://localhost:4200**

1. El sidebar de 52px se muestra a la izquierda con los 4 íconos de navegación global
2. Al navegar a un cliente (`/clients/:id/overview`), el sidebar se expande a 180px con el back-link y los dos ítems de nav cliente
3. El topbar muestra "InfraOps" a la izquierda y rol/email a la derecha con altura correcta (~50px)
4. Al scrollear en una vista con contenido largo, el topbar permanece fijo en la parte superior
5. El botón de logout (ícono abajo del sidebar) funciona correctamente

- [ ] **Step 3: Si algo no coincide visualmente, ajustar el SCSS y repetir la verificación**

Los problemas más comunes con esta migración y sus fixes:

| Síntoma | Fix |
|---|---|
| Sidebar sin background (transparente) | Verificar que `mat-sidenav { background: var(--surface) }` aplique; si no, agregar `color: inherit` también |
| Topbar con altura 64px en lugar de 50px | Confirmar que `--mat-toolbar-standard-height: 50px` está dentro del selector `mat-toolbar.shell-toolbar { }` |
| Sidebar no ocupa el alto completo | Confirmar `mat-sidenav-container.shell { height: 100vh }` |
| Scroll incorrecto (la toolbar scrollea con el contenido) | Confirmar `position: sticky; top: 0` en `mat-toolbar.shell-toolbar` |
