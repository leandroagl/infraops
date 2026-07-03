# Odoo Ticket ID Display — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar el ID del ticket Odoo (`#05137`) como link clickeable en las tres superficies donde aparecen tareas: task-card (kanban), task-drawer (panel de detalle) y tabla admin.

**Architecture:** Se agrega `odooTicketsUrl` a los environments del frontend, se crea una utilidad pura `shared/utils/odoo.ts` con `formatOdooTicketId` y `odooTicketUrl`, y se actualizan los tres componentes para exponer el link y renderizarlo condicionalmente (solo cuando `odooTicketId !== null`). El link abre en nueva pestaña y detiene propagación del click para no interferir con la selección del card.

**Tech Stack:** Angular 19 · Angular Material · TypeScript · Jasmine/Karma

---

## File Map

| Acción | Archivo |
|---|---|
| Modificar | `frontend/src/environments/environment.ts` |
| Modificar | `frontend/src/environments/environment.development.ts` |
| Crear | `frontend/src/app/shared/utils/odoo.ts` |
| Crear | `frontend/src/app/shared/utils/odoo.spec.ts` |
| Modificar | `frontend/src/app/shared/components/task-card/task-card.component.ts` |
| Modificar | `frontend/src/app/shared/components/task-card/task-card.component.html` |
| Modificar | `frontend/src/app/shared/components/task-card/task-card.component.spec.ts` |
| Modificar | `frontend/src/app/features/technician/task-drawer/task-drawer.component.ts` |
| Modificar | `frontend/src/app/features/technician/task-drawer/task-drawer.component.html` |
| Modificar | `frontend/src/app/features/technician/task-drawer/task-drawer.component.spec.ts` |
| Modificar | `frontend/src/app/features/admin/tasks/tasks.component.ts` |
| Modificar | `frontend/src/app/features/admin/tasks/tasks.component.html` |
| Modificar | `frontend/src/app/features/admin/tasks/tasks.component.spec.ts` |

---

## Task 1: Agregar `odooTicketsUrl` a los environments

**Files:**
- Modify: `frontend/src/environments/environment.ts`
- Modify: `frontend/src/environments/environment.development.ts`

- [ ] **Step 1: Agregar la propiedad en `environment.ts` (producción)**

Reemplazar el contenido de `frontend/src/environments/environment.ts`:

```typescript
export const environment = {
  production: true,
  apiUrl: '/api',
  odooTicketsUrl: 'https://ondratest.odoo.com/odoo/helpdesk/7/tickets',
};
```

- [ ] **Step 2: Agregar la propiedad en `environment.development.ts`**

Reemplazar el contenido de `frontend/src/environments/environment.development.ts`:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000',
  odooTicketsUrl: 'https://ondratest.odoo.com/odoo/helpdesk/7/tickets',
};
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/environments/environment.ts frontend/src/environments/environment.development.ts
git commit -m "feat(frontend): agregar odooTicketsUrl a environments"
```

---

## Task 2: Crear utilidad `shared/utils/odoo.ts`

**Files:**
- Create: `frontend/src/app/shared/utils/odoo.spec.ts`
- Create: `frontend/src/app/shared/utils/odoo.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `frontend/src/app/shared/utils/odoo.spec.ts`:

```typescript
import { formatOdooTicketId, odooTicketUrl } from './odoo';
import { environment } from '../../../environments/environment';

describe('formatOdooTicketId()', () => {
  it('pads 1 to #00001', () => {
    expect(formatOdooTicketId(1)).toBe('#00001');
  });

  it('pads 137 to #00137', () => {
    expect(formatOdooTicketId(137)).toBe('#00137');
  });

  it('formats 5137 as #05137', () => {
    expect(formatOdooTicketId(5137)).toBe('#05137');
  });

  it('no trunca números de más de 5 dígitos', () => {
    expect(formatOdooTicketId(123456)).toBe('#123456');
  });
});

describe('odooTicketUrl()', () => {
  it('construye la URL usando environment.odooTicketsUrl', () => {
    expect(odooTicketUrl(5174)).toBe(`${environment.odooTicketsUrl}/5174`);
  });

  it('el resultado contiene el id como segmento final', () => {
    expect(odooTicketUrl(99)).toContain('/99');
  });
});
```

- [ ] **Step 2: Verificar que los tests fallan**

```bash
cd frontend && npx ng test --include="**/shared/utils/odoo.spec.ts" --watch=false
```

Esperado: FAILED — `formatOdooTicketId` y `odooTicketUrl` no existen.

- [ ] **Step 3: Implementar `odoo.ts`**

Crear `frontend/src/app/shared/utils/odoo.ts`:

```typescript
import { environment } from '../../../environments/environment';

export function formatOdooTicketId(id: number): string {
  return '#' + String(id).padStart(5, '0');
}

export function odooTicketUrl(id: number): string {
  return `${environment.odooTicketsUrl}/${id}`;
}
```

- [ ] **Step 4: Verificar que los tests pasan**

```bash
cd frontend && npx ng test --include="**/shared/utils/odoo.spec.ts" --watch=false
```

Esperado: 6 specs PASSED.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/shared/utils/odoo.ts frontend/src/app/shared/utils/odoo.spec.ts
git commit -m "feat(shared): agregar utilidades formatOdooTicketId y odooTicketUrl"
```

---

## Task 3: Mostrar ticket ID en `TaskCardComponent`

**Files:**
- Modify: `frontend/src/app/shared/components/task-card/task-card.component.spec.ts`
- Modify: `frontend/src/app/shared/components/task-card/task-card.component.ts`
- Modify: `frontend/src/app/shared/components/task-card/task-card.component.html`

- [ ] **Step 1: Agregar tests que fallan al spec existente**

En `frontend/src/app/shared/components/task-card/task-card.component.spec.ts`, agregar al final (dentro del `describe('TaskCardComponent', ...)` principal, antes del cierre `}`):

```typescript
  // ── odoo ticket link ───────────────────────────────────────
  describe('odoo ticket link', () => {
    it('muestra el link del ticket cuando odooTicketId está definido', () => {
      component.task = makeTask({ odooTicketId: 5137 });
      fixture.detectChanges();
      const link = fixture.nativeElement.querySelector('.tc-odoo-link');
      expect(link).toBeTruthy();
      expect(link.textContent.trim()).toBe('#05137');
    });

    it('el href del link contiene el id del ticket', () => {
      component.task = makeTask({ odooTicketId: 5137 });
      fixture.detectChanges();
      const link: HTMLAnchorElement = fixture.nativeElement.querySelector('.tc-odoo-link');
      expect(link.getAttribute('href')).toContain('5137');
    });

    it('no renderiza el link cuando odooTicketId es null', () => {
      component.task = makeTask({ odooTicketId: null });
      fixture.detectChanges();
      const link = fixture.nativeElement.querySelector('.tc-odoo-link');
      expect(link).toBeNull();
    });

    it('el click en el link no emite el evento selected', () => {
      component.task = makeTask({ odooTicketId: 5137 });
      fixture.detectChanges();
      const emitted: Task[] = [];
      component.selected.subscribe(t => emitted.push(t));
      const link: HTMLElement = fixture.nativeElement.querySelector('.tc-odoo-link');
      link.click();
      expect(emitted.length).toBe(0);
    });
  });
```

- [ ] **Step 2: Verificar que los tests fallan**

```bash
cd frontend && npx ng test --include="**/task-card/task-card.component.spec.ts" --watch=false
```

Esperado: 4 specs nuevas FAILED (`.tc-odoo-link` no existe).

- [ ] **Step 3: Agregar getters al componente**

En `frontend/src/app/shared/components/task-card/task-card.component.ts`, agregar el import y los getters:

```typescript
// Agregar al bloque de imports existente:
import { formatOdooTicketId, odooTicketUrl } from '../../utils/odoo';
```

Y agregar los getters al final de la clase (antes del cierre `}`):

```typescript
  get odooLabel(): string | null {
    return this.task.odooTicketId !== null ? formatOdooTicketId(this.task.odooTicketId) : null;
  }

  get odooLink(): string | null {
    return this.task.odooTicketId !== null ? odooTicketUrl(this.task.odooTicketId) : null;
  }
```

- [ ] **Step 4: Agregar el link al template**

En `frontend/src/app/shared/components/task-card/task-card.component.html`, dentro de `<div class="tc-bottom">`, agregar el link al final (después del `</ng-container>` de las tareas no activas):

```html
  <a
    *ngIf="odooLink"
    [href]="odooLink"
    target="_blank"
    rel="noopener"
    class="tc-odoo-link"
    (click)="$event.stopPropagation()">{{ odooLabel }}</a>
```

El template completo de `tc-bottom` debe quedar:

```html
  <div class="tc-bottom">
    <ng-container *ngIf="isActive">
      <span class="urg" [ngClass]="urgencyClassStr">{{ urgencyLabelText }}</span>
      <div class="tc-status">
        <span class="sdot" [style.background]="statusDotColor"></span>
        {{ statusLabel }}
      </div>
    </ng-container>
    <ng-container *ngIf="!isActive">
      <span class="badge" [ngClass]="task.status === 'DONE' ? 'badge--ok' : 'badge--muted'">
        {{ statusLabel }}
      </span>
    </ng-container>
    <a
      *ngIf="odooLink"
      [href]="odooLink"
      target="_blank"
      rel="noopener"
      class="tc-odoo-link"
      (click)="$event.stopPropagation()">{{ odooLabel }}</a>
  </div>
```

- [ ] **Step 5: Verificar que los tests pasan**

```bash
cd frontend && npx ng test --include="**/task-card/task-card.component.spec.ts" --watch=false
```

Esperado: todos los specs PASSED (incluyendo los anteriores).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/shared/components/task-card/task-card.component.ts \
        frontend/src/app/shared/components/task-card/task-card.component.html \
        frontend/src/app/shared/components/task-card/task-card.component.spec.ts
git commit -m "feat(task-card): mostrar link de ticket Odoo"
```

---

## Task 4: Mostrar ticket ID en `TaskDrawerComponent`

**Files:**
- Modify: `frontend/src/app/features/technician/task-drawer/task-drawer.component.spec.ts`
- Modify: `frontend/src/app/features/technician/task-drawer/task-drawer.component.ts`
- Modify: `frontend/src/app/features/technician/task-drawer/task-drawer.component.html`

- [ ] **Step 1: Agregar tests que fallan al spec existente**

En `frontend/src/app/features/technician/task-drawer/task-drawer.component.spec.ts`, agregar dentro del bloque `describe('TaskDrawerComponent — pure unit tests', ...)` (al final, antes del cierre `}`):

```typescript
  // ── odoo ticket getters ───────────────────────────────────────────────────

  describe('odooLabel / odooLink', () => {
    it('odooLabel retorna el ID formateado cuando odooTicketId está definido', () => {
      component.task = makeTask({ odooTicketId: 5137 });
      expect(component.odooLabel).toBe('#05137');
    });

    it('odooLabel retorna null cuando odooTicketId es null', () => {
      component.task = makeTask({ odooTicketId: null });
      expect(component.odooLabel).toBeNull();
    });

    it('odooLink retorna null cuando odooTicketId es null', () => {
      component.task = makeTask({ odooTicketId: null });
      expect(component.odooLink).toBeNull();
    });

    it('odooLink contiene el id cuando odooTicketId está definido', () => {
      component.task = makeTask({ odooTicketId: 5174 });
      expect(component.odooLink).toContain('5174');
    });
  });
```

Y agregar dentro del bloque `describe('TaskDrawerComponent — template tests', ...)`, dentro del `describe('header', ...)` existente (al final, antes del cierre `}`):

```typescript
    it('renderiza el link del ticket en el header cuando odooTicketId está definido', () => {
      component.task = makeTask({ odooTicketId: 5137, scheduledDate: futureDate(10) });
      fixture.detectChanges();
      const link = fixture.nativeElement.querySelector('.d-odoo-link');
      expect(link).toBeTruthy();
      expect(link.textContent.trim()).toBe('#05137');
    });

    it('no renderiza el link del ticket cuando odooTicketId es null', () => {
      component.task = makeTask({ odooTicketId: null, scheduledDate: futureDate(10) });
      fixture.detectChanges();
      const link = fixture.nativeElement.querySelector('.d-odoo-link');
      expect(link).toBeNull();
    });
```

- [ ] **Step 2: Verificar que los tests fallan**

```bash
cd frontend && npx ng test --include="**/task-drawer/task-drawer.component.spec.ts" --watch=false
```

Esperado: 6 specs nuevas FAILED (`odooLabel`, `odooLink` no existen; `.d-odoo-link` no existe).

- [ ] **Step 3: Agregar getters al componente**

En `frontend/src/app/features/technician/task-drawer/task-drawer.component.ts`, agregar el import:

```typescript
import { formatOdooTicketId, odooTicketUrl } from '../../../shared/utils/odoo';
```

Y agregar los getters al final de la clase (antes del bloque `// ── Labels`):

```typescript
  get odooLabel(): string | null {
    return this.task.odooTicketId !== null ? formatOdooTicketId(this.task.odooTicketId) : null;
  }

  get odooLink(): string | null {
    return this.task.odooTicketId !== null ? odooTicketUrl(this.task.odooTicketId) : null;
  }
```

- [ ] **Step 4: Agregar el link al template**

En `frontend/src/app/features/technician/task-drawer/task-drawer.component.html`, dentro de `<div class="d-meta">`, agregar el link al final:

```html
<div class="d-meta">
  <span class="urg" [ngClass]="urgencyClass(daysFromToday(task.scheduledDate))">
    {{ urgencyLabel(daysFromToday(task.scheduledDate)) }}
  </span>
  <span class="badge" [ngClass]="statusBadge(task.status)">{{ statusLabel(task.status) }}</span>
  <a
    *ngIf="odooLink"
    [href]="odooLink"
    target="_blank"
    rel="noopener"
    class="d-odoo-link">{{ odooLabel }}</a>
</div>
```

- [ ] **Step 5: Verificar que los tests pasan**

```bash
cd frontend && npx ng test --include="**/task-drawer/task-drawer.component.spec.ts" --watch=false
```

Esperado: todos los specs PASSED.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/features/technician/task-drawer/task-drawer.component.ts \
        frontend/src/app/features/technician/task-drawer/task-drawer.component.html \
        frontend/src/app/features/technician/task-drawer/task-drawer.component.spec.ts
git commit -m "feat(task-drawer): mostrar link de ticket Odoo en header"
```

---

## Task 5: Mostrar ticket ID en tabla admin (`TasksComponent`)

**Files:**
- Modify: `frontend/src/app/features/admin/tasks/tasks.component.spec.ts`
- Modify: `frontend/src/app/features/admin/tasks/tasks.component.ts`
- Modify: `frontend/src/app/features/admin/tasks/tasks.component.html`

- [ ] **Step 1: Agregar tests que fallan al spec existente**

En `frontend/src/app/features/admin/tasks/tasks.component.spec.ts`, agregar al final (dentro del `describe('TasksComponent', ...)`, antes del cierre `}`):

```typescript
  describe('odooTicket column', () => {
    it('renderiza el link del ticket cuando odooTicketId está definido', () => {
      tasksServiceSpy.getAll.and.returnValue(
        of([{ ...mockTask('t1'), odooTicketId: 5137 }])
      );
      component.load();
      fixture.detectChanges();

      const link = fixture.nativeElement.querySelector('.odoo-ticket-link');
      expect(link).toBeTruthy();
      expect(link.textContent.trim()).toBe('#05137');
    });

    it('el href del link contiene el id del ticket', () => {
      tasksServiceSpy.getAll.and.returnValue(
        of([{ ...mockTask('t1'), odooTicketId: 5137 }])
      );
      component.load();
      fixture.detectChanges();

      const link: HTMLAnchorElement = fixture.nativeElement.querySelector('.odoo-ticket-link');
      expect(link.getAttribute('href')).toContain('5137');
    });

    it('renderiza — cuando odooTicketId es null', () => {
      // mockTask ya tiene odooTicketId: null
      fixture.detectChanges();
      const link = fixture.nativeElement.querySelector('.odoo-ticket-link');
      expect(link).toBeNull();
      const dash = Array.from(fixture.nativeElement.querySelectorAll('td'))
        .find((td: any) => td.textContent?.trim() === '—');
      expect(dash).toBeTruthy();
    });
  });
```

- [ ] **Step 2: Verificar que los tests fallan**

```bash
cd frontend && npx ng test --include="**/admin/tasks/tasks.component.spec.ts" --watch=false
```

Esperado: 3 specs nuevas FAILED (columna `odooTicket` no existe).

- [ ] **Step 3: Agregar métodos al componente**

En `frontend/src/app/features/admin/tasks/tasks.component.ts`, agregar el import de las utilidades:

```typescript
import { formatOdooTicketId, odooTicketUrl } from '../../../shared/utils/odoo';
```

Cambiar `displayedColumns` para incluir la nueva columna:

```typescript
readonly displayedColumns = ['client', 'type', 'technician', 'scheduledDate', 'status', 'odooTicket', 'actions'];
```

Agregar los métodos al final de la clase (antes del cierre `}`):

```typescript
  odooLabelFor(id: number): string { return formatOdooTicketId(id); }
  odooLinkFor(id: number): string  { return odooTicketUrl(id); }
```

- [ ] **Step 4: Agregar la columna al template**

En `frontend/src/app/features/admin/tasks/tasks.component.html`, agregar la definición de columna antes de la columna `actions`:

```html
      <ng-container matColumnDef="odooTicket">
        <th mat-header-cell *matHeaderCellDef>Ticket</th>
        <td mat-cell *matCellDef="let row" class="cell-mono">
          <a
            *ngIf="row.odooTicketId"
            [href]="odooLinkFor(row.odooTicketId)"
            target="_blank"
            rel="noopener"
            class="odoo-ticket-link">{{ odooLabelFor(row.odooTicketId) }}</a>
          <span *ngIf="!row.odooTicketId">—</span>
        </td>
      </ng-container>
```

- [ ] **Step 5: Verificar que los tests pasan**

```bash
cd frontend && npx ng test --include="**/admin/tasks/tasks.component.spec.ts" --watch=false
```

Esperado: todos los specs PASSED.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/features/admin/tasks/tasks.component.ts \
        frontend/src/app/features/admin/tasks/tasks.component.html \
        frontend/src/app/features/admin/tasks/tasks.component.spec.ts
git commit -m "feat(admin/tasks): agregar columna de ticket Odoo con link"
```

---

## Verificación final

- [ ] **Correr todos los tests del frontend**

```bash
cd frontend && npx ng test --watch=false
```

Esperado: todos los specs PASSED, sin regresiones.

- [ ] **Commit final (si hay cambios residuales)**

```bash
git status
# Si hay algo sin commitear:
git add -p
git commit -m "chore: limpieza post-implementación odoo ticket display"
```
