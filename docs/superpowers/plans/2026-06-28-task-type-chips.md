# Task Type Chips — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar `SERVER_MAINTENANCE` del código (la DB ya fue migrada) y mostrar chips de colores por tipo de tarea en la task card y en los drawers de detalle.

**Architecture:** Dos fases independientes: (1) limpieza del tipo huérfano `SERVER_MAINTENANCE` en backend y frontend; (2) nuevos tokens CSS + variantes de badge + `typeBadge()` expandida aplicadas a `task-card` y ambos drawers.

**Tech Stack:** NestJS (backend), Angular + Angular Material (frontend), SCSS con CSS custom properties.

## Global Constraints

- Sin migración de base de datos — la migración `1782432000000` ya ejecutó el UPDATE.
- TDD obligatorio para código nuevo; tests existentes se actualizan junto con los archivos que cambian.
- Angular sin standalone components.
- Un archivo a la vez — confirmar antes de continuar al siguiente task.
- Inglés en código, español en commits y docs.
- `appearance="outline"` en todo `mat-form-field`.
- Worktrees en `.claude/worktrees/` son ignorados — solo tocar el working tree principal.

---

## File Map

| Archivo | Qué cambia |
|---|---|
| `backend/src/tasks/task-type.enum.ts` | Remover `SERVER_MAINTENANCE` |
| `backend/src/maintenance-logs/log-item.interface.ts` | Remover `ServerMaintenancePayload` del union |
| `backend/src/integrations/odoo/odoo.service.ts` | Remover entrada `SERVER_MAINTENANCE` de `TICKET_META` |
| `backend/src/tasks/tasks.service.spec.ts` | `SERVER_MAINTENANCE` → `WINDOWS_DOMAIN_MAINTENANCE` |
| `backend/src/tasks/tasks.controller.spec.ts` | Idem |
| `backend/src/maintenance-logs/maintenance-logs.service.spec.ts` | Tipo + payload fixture |
| `backend/src/maintenance-logs/maintenance-logs.controller.spec.ts` | Tipo de mock task |
| `backend/src/integrations/odoo/odoo.service.spec.ts` | Tipo + expected name/description |
| `frontend/src/app/core/models/task.models.ts` | Remover `'SERVER_MAINTENANCE'` del union |
| `frontend/src/app/shared/utils/task-labels.ts` | Remover `SERVER_MAINTENANCE`; reescribir `typeBadge()` |
| `frontend/src/app/shared/utils/task-labels.spec.ts` | Remover casos `SERVER_MAINTENANCE`; agregar casos nuevos `typeBadge` |
| `frontend/src/app/shared/components/task-card/task-card.component.ts` | Getter `typeBadgeClass`; usar `typeLabel` (corto) |
| `frontend/src/app/shared/components/task-card/task-card.component.html` | `.tc-type` → badge span |
| `frontend/src/app/shared/components/task-card/task-card.component.scss` | Remover `.tc-type` |
| `frontend/src/app/shared/components/task-card/task-card.component.spec.ts` | Tipo default + test badge |
| `frontend/src/app/shared/components/kanban-board/kanban-board.component.spec.ts` | Tipo default |
| `frontend/src/styles/tokens.scss` | 5 tokens nuevos (`--vmware`, `--win`, `--nas`, `--bkp`, `--net`) |
| `frontend/src/styles/components.scss` | 5 variantes de `.badge` nuevas |
| `frontend/src/app/features/admin/tasks/admin-task-drawer/admin-task-drawer.component.ts` | Import + getter `typeBadgeClass` |
| `frontend/src/app/features/admin/tasks/admin-task-drawer/admin-task-drawer.component.html` | Badge en campo Tipo |
| `frontend/src/app/features/technician/task-drawer/task-drawer.component.ts` | Import + método `typeBadge` |
| `frontend/src/app/features/technician/task-drawer/task-drawer.component.html` | Badge en `.d-sub` |

---

## Task 1: Backend — eliminar SERVER_MAINTENANCE

**Files:**
- Modify: `backend/src/tasks/task-type.enum.ts`
- Modify: `backend/src/maintenance-logs/log-item.interface.ts`
- Modify: `backend/src/integrations/odoo/odoo.service.ts`
- Modify: `backend/src/tasks/tasks.service.spec.ts`
- Modify: `backend/src/tasks/tasks.controller.spec.ts`
- Modify: `backend/src/maintenance-logs/maintenance-logs.service.spec.ts`
- Modify: `backend/src/maintenance-logs/maintenance-logs.controller.spec.ts`
- Modify: `backend/src/integrations/odoo/odoo.service.spec.ts`

**Interfaces:**
- Produces: `TaskType` enum sin `SERVER_MAINTENANCE`; `MaintenancePayload` union sin `ServerMaintenancePayload`

- [ ] **Step 1: Remover SERVER_MAINTENANCE del enum**

  En `backend/src/tasks/task-type.enum.ts`, eliminar la línea `SERVER_MAINTENANCE`:

  ```typescript
  export enum TaskType {
    SERVER_HOST_MAINTENANCE    = 'SERVER_HOST_MAINTENANCE',
    WINDOWS_DOMAIN_MAINTENANCE = 'WINDOWS_DOMAIN_MAINTENANCE',
    QNAP_MAINTENANCE           = 'QNAP_MAINTENANCE',
    VEEAM_BACKUP               = 'VEEAM_BACKUP',
    ROUTER_MAINTENANCE         = 'ROUTER_MAINTENANCE',
    TERMINAL_MAINTENANCE       = 'TERMINAL_MAINTENANCE',
    SITE_VISIT                 = 'SITE_VISIT',
    AV_CONTROL                 = 'AV_CONTROL',
    UPS_CONTROL                = 'UPS_CONTROL',
    ENDPOINT_INVENTORY         = 'ENDPOINT_INVENTORY',
  }
  ```

- [ ] **Step 2: Remover ServerMaintenancePayload de log-item.interface.ts**

  En `backend/src/maintenance-logs/log-item.interface.ts`, eliminar toda la interfaz `ServerMaintenancePayload` (líneas 64–73) y removerla del union `MaintenancePayload`:

  ```typescript
  export type MaintenancePayload =
    | ServerHostPayload
    | WindowsDomainPayload
    | RouterMaintenancePayload
    | TerminalPayload;
  ```

- [ ] **Step 3: Remover entrada SERVER_MAINTENANCE de TICKET_META**

  En `backend/src/integrations/odoo/odoo.service.ts`, en el objeto `TICKET_META`, eliminar la línea:
  ```typescript
  [TaskType.SERVER_MAINTENANCE]: { name: 'Mantenimiento de infraestructura', description: 'Mantenimiento mensual de infraestructura.' },
  ```

- [ ] **Step 4: Actualizar tasks.service.spec.ts**

  Reemplazar todas las ocurrencias de `TaskType.SERVER_MAINTENANCE` por `TaskType.WINDOWS_DOMAIN_MAINTENANCE`. Son 5 ocurrencias: en `mockTask.type` y en los tests de `findAll` y `create`.

- [ ] **Step 5: Actualizar tasks.controller.spec.ts**

  Reemplazar `TaskType.SERVER_MAINTENANCE` por `TaskType.WINDOWS_DOMAIN_MAINTENANCE` en `mockTask.type` y en el DTO de creación.

- [ ] **Step 6: Actualizar maintenance-logs.service.spec.ts**

  Cambiar import: reemplazar `ServerMaintenancePayload` por `WindowsDomainPayload`:

  ```typescript
  import { WindowsDomainPayload } from './log-item.interface';
  ```

  Cambiar `mockTask.type`:
  ```typescript
  type: TaskType.WINDOWS_DOMAIN_MAINTENANCE,
  ```

  Cambiar las dos fixtures de payload:
  ```typescript
  const mockPayload: WindowsDomainPayload = {
    type: 'WINDOWS_DOMAIN_MAINTENANCE',
    windows: {
      servers: [
        { serverId: 1, serverName: '47DC', rebootScript: 'ok', updates: 'ok' },
      ],
      dcdiag: 'OK',
    },
  };
  ```
  Hacer lo mismo para `updatedPayload` en el test de actualización (línea ~224).

- [ ] **Step 7: Actualizar maintenance-logs.controller.spec.ts**

  Reemplazar `TaskType.SERVER_MAINTENANCE` por `TaskType.WINDOWS_DOMAIN_MAINTENANCE` en `mockTask.type`.

- [ ] **Step 8: Actualizar odoo.service.spec.ts**

  Reemplazar todas las ocurrencias de `TaskType.SERVER_MAINTENANCE` por `TaskType.WINDOWS_DOMAIN_MAINTENANCE`.

  Actualizar el test "crea un ticket SERVER_MAINTENANCE..." (línea ~394):
  - Cambiar descripción del test a `'crea un ticket WINDOWS_DOMAIN_MAINTENANCE con título y descripción correctos'`
  - Cambiar expected name y description:
    ```typescript
    expect.objectContaining({
      name: 'Mantenimiento Windows y dominios',
      description: 'Mantenimiento mensual de servidores Windows y controladores de dominio.',
    }),
    ```

  Actualizar el test "NO incluye tag_ids al crear ticket SERVER_MAINTENANCE" (línea ~504):
  - Cambiar descripción a `'NO incluye tag_ids al crear ticket WINDOWS_DOMAIN_MAINTENANCE'`
  - Ya usa `TaskType.SERVER_MAINTENANCE` → cambiar a `TaskType.WINDOWS_DOMAIN_MAINTENANCE`

- [ ] **Step 9: Correr tests de backend**

  ```bash
  cd backend && npx jest --testPathPattern="tasks.service|tasks.controller|maintenance-logs|odoo.service" --no-coverage
  ```

  Esperado: todos los tests pasan sin errores de TypeScript.

- [ ] **Step 10: Commit**

  ```bash
  git add backend/src/tasks/task-type.enum.ts \
          backend/src/maintenance-logs/log-item.interface.ts \
          backend/src/integrations/odoo/odoo.service.ts \
          backend/src/tasks/tasks.service.spec.ts \
          backend/src/tasks/tasks.controller.spec.ts \
          backend/src/maintenance-logs/maintenance-logs.service.spec.ts \
          backend/src/maintenance-logs/maintenance-logs.controller.spec.ts \
          backend/src/integrations/odoo/odoo.service.spec.ts
  git commit -m "refactor(backend): eliminar TaskType.SERVER_MAINTENANCE — datos ya migrados a WINDOWS_DOMAIN_MAINTENANCE"
  ```

---

## Task 2: Frontend — eliminar SERVER_MAINTENANCE del modelo y labels

**Files:**
- Modify: `frontend/src/app/core/models/task.models.ts`
- Modify: `frontend/src/app/shared/utils/task-labels.ts`
- Modify: `frontend/src/app/shared/utils/task-labels.spec.ts`
- Modify: `frontend/src/app/shared/components/task-card/task-card.component.spec.ts`
- Modify: `frontend/src/app/shared/components/kanban-board/kanban-board.component.spec.ts`

**Interfaces:**
- Consumes: Task 1 (conceptualmente independiente — codebase distinto)
- Produces: `TaskType` frontend sin `'SERVER_MAINTENANCE'`; `task-labels.ts` limpio

- [ ] **Step 1: Remover 'SERVER_MAINTENANCE' del union TaskType**

  En `frontend/src/app/core/models/task.models.ts`, eliminar `| 'SERVER_MAINTENANCE'`:

  ```typescript
  export type TaskType =
    | 'SERVER_HOST_MAINTENANCE'
    | 'WINDOWS_DOMAIN_MAINTENANCE'
    | 'QNAP_MAINTENANCE'
    | 'VEEAM_BACKUP'
    | 'ROUTER_MAINTENANCE'
    | 'TERMINAL_MAINTENANCE'
    | 'SITE_VISIT'
    | 'AV_CONTROL'
    | 'UPS_CONTROL'
    | 'ENDPOINT_INVENTORY';
  ```

- [ ] **Step 2: Remover SERVER_MAINTENANCE de task-labels.ts**

  En `frontend/src/app/shared/utils/task-labels.ts`, en las funciones `typeLabel`, `typeLabelLong` y `typeBadge`, eliminar la entrada `SERVER_MAINTENANCE` de cada `Record`. El `Record<TaskType, string>` ya no compilará si el tipo existe en la clave pero no en el union — lo contrario es lo que buscamos: que TypeScript falle si olvidamos un tipo.

  Estado de `typeBadge` después de este step (la reescritura completa viene en Task 4):
  ```typescript
  export function typeBadge(type: TaskType): string {
    return type === 'TERMINAL_MAINTENANCE' || type === 'SITE_VISIT'
      ? 'badge--purple'
      : 'badge--srv';
  }
  ```

- [ ] **Step 3: Actualizar task-labels.spec.ts**

  Eliminar el caso `['SERVER_MAINTENANCE', 'Servidores']` del array `cases` de `typeLabel()`.
  Eliminar el caso `['SERVER_MAINTENANCE', 'Mantenimiento de servidores']` del array `cases` de `typeLabelLong()`.
  Eliminar el test `it('SERVER_MAINTENANCE → "badge--srv"', ...)`.

- [ ] **Step 4: Actualizar task-card.component.spec.ts**

  En la función `makeTask`, cambiar el tipo por defecto:
  ```typescript
  type: 'WINDOWS_DOMAIN_MAINTENANCE', status: 'PENDING',
  ```

  Actualizar el test de `borderClass` que referenciaba `SERVER_MAINTENANCE`:
  ```typescript
  it('returns tc-srv when WINDOWS_DOMAIN_MAINTENANCE not overdue', () => {
    component.task = makeTask({ type: 'WINDOWS_DOMAIN_MAINTENANCE', scheduledDate: dateOffsetDays(10) });
    expect(component.borderClass).toBe('tc-srv');
  });
  ```

- [ ] **Step 5: Actualizar kanban-board.component.spec.ts**

  En la función `makeTask` del spec, cambiar:
  ```typescript
  type: 'WINDOWS_DOMAIN_MAINTENANCE', status: 'PENDING',
  ```

- [ ] **Step 6: Correr tests de frontend afectados**

  ```bash
  cd frontend && npx ng test --include="**/task-labels.spec.ts" --no-watch --browsers=ChromeHeadless
  cd frontend && npx ng test --include="**/task-card.component.spec.ts" --no-watch --browsers=ChromeHeadless
  cd frontend && npx ng test --include="**/kanban-board.component.spec.ts" --no-watch --browsers=ChromeHeadless
  ```

  Esperado: todos pasan.

- [ ] **Step 7: Commit**

  ```bash
  git add frontend/src/app/core/models/task.models.ts \
          frontend/src/app/shared/utils/task-labels.ts \
          frontend/src/app/shared/utils/task-labels.spec.ts \
          frontend/src/app/shared/components/task-card/task-card.component.spec.ts \
          frontend/src/app/shared/components/kanban-board/kanban-board.component.spec.ts
  git commit -m "refactor(frontend): eliminar SERVER_MAINTENANCE del modelo y labels"
  ```

---

## Task 3: CSS — tokens y variantes de badge

**Files:**
- Modify: `frontend/src/styles/tokens.scss`
- Modify: `frontend/src/styles/components.scss`

**Interfaces:**
- Produces: clases CSS `badge--vmware`, `badge--win`, `badge--nas`, `badge--bkp`, `badge--net`

- [ ] **Step 1: Agregar tokens en tokens.scss**

  En `frontend/src/styles/tokens.scss`, después del bloque de `--srv` y `--purple` (línea ~32), agregar:

  ```scss
  // Por tipo de tarea — dominio específico
  --vmware: #4ade80;  --vmware-bg: rgba( 74, 222, 128, 0.12);  --vmware-bd: rgba( 74, 222, 128, 0.25);
  --win:    #818cf8;  --win-bg:    rgba(129, 140, 248, 0.12);  --win-bd:    rgba(129, 140, 248, 0.25);
  --nas:    #2dd4bf;  --nas-bg:    rgba( 45, 212, 191, 0.12);  --nas-bd:    rgba( 45, 212, 191, 0.25);
  --bkp:    #a3e635;  --bkp-bg:    rgba(163, 230,  53, 0.12);  --bkp-bd:    rgba(163, 230,  53, 0.25);
  --net:    #f97316;  --net-bg:    rgba(249, 115,  22, 0.12);  --net-bd:    rgba(249, 115,  22, 0.25);
  ```

- [ ] **Step 2: Agregar variantes de badge en components.scss**

  En `frontend/src/styles/components.scss`, dentro del bloque `.badge { ... }`, después de `&--accent`, agregar:

  ```scss
  &--vmware { background: var(--vmware-bg); color: var(--vmware); border: 1px solid var(--vmware-bd); .dot { background: var(--vmware); } }
  &--win    { background: var(--win-bg);    color: var(--win);    border: 1px solid var(--win-bd);    .dot { background: var(--win);    } }
  &--nas    { background: var(--nas-bg);    color: var(--nas);    border: 1px solid var(--nas-bd);    .dot { background: var(--nas);    } }
  &--bkp    { background: var(--bkp-bg);   color: var(--bkp);    border: 1px solid var(--bkp-bd);    .dot { background: var(--bkp);    } }
  &--net    { background: var(--net-bg);    color: var(--net);    border: 1px solid var(--net-bd);    .dot { background: var(--net);    } }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/styles/tokens.scss frontend/src/styles/components.scss
  git commit -m "feat(design): tokens y variantes de badge para tipos de tarea (vmware, win, nas, bkp, net)"
  ```

---

## Task 4: typeBadge() + task-card badge

**Files:**
- Modify: `frontend/src/app/shared/utils/task-labels.ts`
- Modify: `frontend/src/app/shared/utils/task-labels.spec.ts`
- Modify: `frontend/src/app/shared/components/task-card/task-card.component.ts`
- Modify: `frontend/src/app/shared/components/task-card/task-card.component.html`
- Modify: `frontend/src/app/shared/components/task-card/task-card.component.scss`
- Modify: `frontend/src/app/shared/components/task-card/task-card.component.spec.ts`

**Interfaces:**
- Consumes: Task 2 (TaskType sin SERVER_MAINTENANCE); Task 3 (clases CSS existentes)
- Produces: `typeBadge(type: TaskType): string` con mapeo completo; task-card con `.badge` en lugar de `.tc-type`

- [ ] **Step 1: Escribir los tests que fallarán para typeBadge()**

  En `frontend/src/app/shared/utils/task-labels.spec.ts`, reemplazar el bloque `describe('typeBadge()', ...)` completo con:

  ```typescript
  describe('typeBadge()', () => {
    const cases: [TaskType, string][] = [
      ['SERVER_HOST_MAINTENANCE',    'badge--vmware'],
      ['WINDOWS_DOMAIN_MAINTENANCE', 'badge--win'],
      ['QNAP_MAINTENANCE',           'badge--nas'],
      ['VEEAM_BACKUP',               'badge--bkp'],
      ['ROUTER_MAINTENANCE',         'badge--net'],
      ['TERMINAL_MAINTENANCE',       'badge--purple'],
      ['SITE_VISIT',                 'badge--purple'],
      ['AV_CONTROL',                 'badge--neutral'],
      ['UPS_CONTROL',                'badge--neutral'],
      ['ENDPOINT_INVENTORY',         'badge--neutral'],
    ];
    cases.forEach(([type, expected]) => {
      it(`${type} → "${expected}"`, () => {
        expect(typeBadge(type)).toBe(expected);
      });
    });
  });
  ```

  También eliminar los tests sueltos de `typeBadge` que quedaron fuera del describe (líneas ~99–136):
  - `it('typeBadge retorna "badge--srv" para VEEAM_BACKUP', ...)`
  - `it('typeBadge retorna "badge--srv" para SERVER_HOST_MAINTENANCE', ...)`
  - `it('typeBadge retorna "badge--srv" para WINDOWS_DOMAIN_MAINTENANCE', ...)`
  - `it('typeBadge retorna "badge--srv" para ROUTER_MAINTENANCE', ...)`

- [ ] **Step 2: Correr los tests — deben fallar**

  ```bash
  cd frontend && npx ng test --include="**/task-labels.spec.ts" --no-watch --browsers=ChromeHeadless
  ```

  Esperado: FAIL — los nuevos casos de `typeBadge` fallan porque aún devuelve `badge--srv` para `VEEAM_BACKUP`, `SERVER_HOST_MAINTENANCE`, etc.

- [ ] **Step 3: Reescribir typeBadge() en task-labels.ts**

  Reemplazar la función `typeBadge` con:

  ```typescript
  export function typeBadge(type: TaskType): string {
    const map: Record<TaskType, string> = {
      SERVER_HOST_MAINTENANCE:    'badge--vmware',
      WINDOWS_DOMAIN_MAINTENANCE: 'badge--win',
      QNAP_MAINTENANCE:           'badge--nas',
      VEEAM_BACKUP:               'badge--bkp',
      ROUTER_MAINTENANCE:         'badge--net',
      TERMINAL_MAINTENANCE:       'badge--purple',
      SITE_VISIT:                 'badge--purple',
      AV_CONTROL:                 'badge--neutral',
      UPS_CONTROL:                'badge--neutral',
      ENDPOINT_INVENTORY:         'badge--neutral',
    };
    return map[type] ?? 'badge--neutral';
  }
  ```

- [ ] **Step 4: Correr tests de task-labels — deben pasar**

  ```bash
  cd frontend && npx ng test --include="**/task-labels.spec.ts" --no-watch --browsers=ChromeHeadless
  ```

  Esperado: todos los tests de `typeBadge` pasan.

- [ ] **Step 5: Escribir test que verifica el badge en task-card**

  En `frontend/src/app/shared/components/task-card/task-card.component.spec.ts`, agregar dentro del describe del componente:

  ```typescript
  describe('typeBadgeClass getter', () => {
    it('devuelve badge--vmware para SERVER_HOST_MAINTENANCE', () => {
      component.task = makeTask({ type: 'SERVER_HOST_MAINTENANCE' });
      expect(component.typeBadgeClass).toBe('badge--vmware');
    });

    it('devuelve badge--bkp para VEEAM_BACKUP', () => {
      component.task = makeTask({ type: 'VEEAM_BACKUP' });
      expect(component.typeBadgeClass).toBe('badge--bkp');
    });
  });

  describe('template — badge de tipo', () => {
    it('renderiza un span.badge con la clase del tipo', () => {
      component.task = makeTask({ type: 'ROUTER_MAINTENANCE' });
      fixture.detectChanges();
      const badge = fixture.nativeElement.querySelector('.badge');
      expect(badge).toBeTruthy();
      expect(badge.classList).toContain('badge--net');
      expect(badge.textContent.trim()).toBe('Router / FW');
    });
  });
  ```

- [ ] **Step 6: Correr el test — debe fallar**

  ```bash
  cd frontend && npx ng test --include="**/task-card.component.spec.ts" --no-watch --browsers=ChromeHeadless
  ```

  Esperado: FAIL — `typeBadgeClass` no existe, el template no tiene `.badge`.

- [ ] **Step 7: Actualizar task-card.component.ts**

  Cambiar el import de labels:
  ```typescript
  import { typeLabel, typeBadge, statusLabel as getStatusLabel } from '../../utils/task-labels';
  ```

  Reemplazar el getter `typeLabel` y agregar `typeBadgeClass`:
  ```typescript
  get typeLabel(): string      { return typeLabel(this.task.type); }
  get typeBadgeClass(): string { return typeBadge(this.task.type); }
  ```

- [ ] **Step 8: Actualizar task-card.component.html**

  Reemplazar:
  ```html
  <div class="tc-type">{{ typeLabel }}</div>
  ```
  con:
  ```html
  <span class="badge" [ngClass]="typeBadgeClass">{{ typeLabel }}</span>
  ```

- [ ] **Step 9: Remover .tc-type de task-card.component.scss**

  Eliminar la regla:
  ```scss
  .tc-type { font-size: 11px; color: var(--tx-md); margin-top: 2px; }
  ```

- [ ] **Step 10: Correr tests del task-card — deben pasar**

  ```bash
  cd frontend && npx ng test --include="**/task-card.component.spec.ts" --no-watch --browsers=ChromeHeadless
  ```

  Esperado: todos los tests pasan.

- [ ] **Step 11: Commit**

  ```bash
  git add frontend/src/app/shared/utils/task-labels.ts \
          frontend/src/app/shared/utils/task-labels.spec.ts \
          frontend/src/app/shared/components/task-card/task-card.component.ts \
          frontend/src/app/shared/components/task-card/task-card.component.html \
          frontend/src/app/shared/components/task-card/task-card.component.scss \
          frontend/src/app/shared/components/task-card/task-card.component.spec.ts
  git commit -m "feat(task-card): mostrar tipo de tarea como chip de color"
  ```

---

## Task 5: Chips en drawers

**Files:**
- Modify: `frontend/src/app/features/admin/tasks/admin-task-drawer/admin-task-drawer.component.ts`
- Modify: `frontend/src/app/features/admin/tasks/admin-task-drawer/admin-task-drawer.component.html`
- Modify: `frontend/src/app/features/technician/task-drawer/task-drawer.component.ts`
- Modify: `frontend/src/app/features/technician/task-drawer/task-drawer.component.html`

**Interfaces:**
- Consumes: Task 3 (clases CSS); Task 4 (`typeBadge()` con mapeo completo, `typeLabel()` corto)

### Sub-tarea A: admin-task-drawer

- [ ] **Step 1: Actualizar admin-task-drawer.component.ts**

  Cambiar el import de labels (quitar `typeLabelLong`, agregar `typeLabel` y `typeBadge`):
  ```typescript
  import { typeLabel, typeBadge, statusLabel, statusBadge } from '../../../../shared/utils/task-labels';
  ```

  Reemplazar el getter `typeLabel` y agregar `typeBadgeClass`:
  ```typescript
  get typeLabel(): string      { return typeLabel(this.task.type); }
  get typeBadgeClass(): string { return typeBadge(this.task.type); }
  ```

- [ ] **Step 2: Actualizar admin-task-drawer.component.html**

  En el campo "Tipo", reemplazar:
  ```html
  <span class="adr-value">{{ typeLabel }}</span>
  ```
  con:
  ```html
  <span class="badge" [ngClass]="typeBadgeClass">{{ typeLabel }}</span>
  ```

- [ ] **Step 3: Correr tests del admin-task-drawer**

  ```bash
  cd frontend && npx ng test --include="**/admin-task-drawer.component.spec.ts" --no-watch --browsers=ChromeHeadless
  ```

  Esperado: todos los tests existentes pasan (no hay tests de typeLabel rotos).

### Sub-tarea B: task-drawer

- [ ] **Step 4: Actualizar task-drawer.component.ts**

  Agregar `typeBadge` al import existente de task-labels:
  ```typescript
  import { statusLabel, statusBadge, typeLabel, typeLabelLong, typeBadge } from '../../../shared/utils/task-labels';
  ```

  Agregar el método `typeBadge` (mismo patrón que los otros helpers inline):
  ```typescript
  typeBadge(type: TaskType): string { return typeBadge(type); }
  ```

  > Nota: el `typeLabel(type)` ya existe como método en el componente y llama a `typeLabelLong`. Agregar también `typeLabel` corto como método separado:
  ```typescript
  typeLabel(type: TaskType): string     { return typeLabelLong(type); }   // mantener para otros usos
  typeLabelShort(type: TaskType): string { return typeLabel(type); }       // para el badge
  ```

  O bien cambiar `typeLabel` en el componente para usar `typeLabel` (corto) directamente si no hay otro uso de `typeLabelLong` en el template. Revisar: el template solo usa `typeLabel(task.type)` en `.d-sub`, que es exactamente lo que reemplazamos. Por lo tanto, es más limpio cambiar `typeLabel` para que devuelva el label corto y eliminar `typeLabelLong` del import si no lo usa más:

  ```typescript
  import { statusLabel, statusBadge, typeLabel, typeBadge } from '../../../shared/utils/task-labels';
  ```

  ```typescript
  typeLabel(type: TaskType): string  { return typeLabel(type); }
  typeBadge(type: TaskType): string  { return typeBadge(type); }
  ```

- [ ] **Step 5: Actualizar task-drawer.component.html**

  Reemplazar:
  ```html
  <div class="d-sub">{{ typeLabel(task.type) }}</div>
  ```
  con:
  ```html
  <span class="badge" [ngClass]="typeBadge(task.type)">{{ typeLabel(task.type) }}</span>
  ```

- [ ] **Step 6: Correr tests del task-drawer**

  ```bash
  cd frontend && npx ng test --include="**/task-drawer.component.spec.ts" --no-watch --browsers=ChromeHeadless
  ```

  Esperado: todos los tests pasan.

- [ ] **Step 7: Commit**

  ```bash
  git add frontend/src/app/features/admin/tasks/admin-task-drawer/admin-task-drawer.component.ts \
          frontend/src/app/features/admin/tasks/admin-task-drawer/admin-task-drawer.component.html \
          frontend/src/app/features/technician/task-drawer/task-drawer.component.ts \
          frontend/src/app/features/technician/task-drawer/task-drawer.component.html
  git commit -m "feat(drawers): agregar chip de tipo de tarea en headers de admin-task-drawer y task-drawer"
  ```
