# Spec: chips de tipo de tarea + limpieza de SERVER_MAINTENANCE

**Fecha:** 2026-06-28  
**Estado:** aprobado

---

## Contexto

El campo `.tc-type` en las task cards muestra el tipo de tarea como texto plano (`var(--tx-md)`). Se aprobó convertirlo a chips coloreados (badges) usando el sistema de badges existente, y agregar los mismos chips en los headers de los drawers de detalle.

Simultáneamente, se detectó que `SERVER_MAINTENANCE` es un tipo huérfano: la migración `1782432000000` ya migró todos los datos a `WINDOWS_DOMAIN_MAINTENANCE`, pero el tipo sigue presente en el código. Se limpia en la misma sesión.

---

## Parte 1 — Limpieza de `SERVER_MAINTENANCE`

### Por qué

La migración `backend/src/migrations/1782432000000-AddServerHostAndWindowsDomainTaskTypes.ts` ejecutó:
```sql
UPDATE tasks SET type = 'WINDOWS_DOMAIN_MAINTENANCE' WHERE type = 'SERVER_MAINTENANCE'
```
No existe ninguna fila en producción con `type = 'SERVER_MAINTENANCE'`. El valor quedó como deuda técnica de la refactorización de formularios por dominio.

### Archivos backend

| Archivo | Cambio |
|---|---|
| `backend/src/tasks/task-type.enum.ts` | Remover `SERVER_MAINTENANCE` del enum |
| `backend/src/maintenance-logs/log-item.interface.ts` | Remover `ServerMaintenancePayload` (interfaz completa) y removerla del union `MaintenancePayload` |
| `backend/src/integrations/odoo/odoo.service.ts` | Remover entrada `[TaskType.SERVER_MAINTENANCE]` de `TICKET_META` |
| `backend/src/tasks/tasks.service.spec.ts` | Reemplazar `TaskType.SERVER_MAINTENANCE` → `TaskType.WINDOWS_DOMAIN_MAINTENANCE` |
| `backend/src/tasks/tasks.controller.spec.ts` | Idem |
| `backend/src/maintenance-logs/maintenance-logs.service.spec.ts` | Reemplazar tipo de mock task + reemplazar `ServerMaintenancePayload` → `WindowsDomainPayload` en fixtures |
| `backend/src/maintenance-logs/maintenance-logs.controller.spec.ts` | Reemplazar `TaskType.SERVER_MAINTENANCE` → `TaskType.WINDOWS_DOMAIN_MAINTENANCE` |
| `backend/src/integrations/odoo/odoo.service.spec.ts` | Reemplazar `TaskType.SERVER_MAINTENANCE` → `TaskType.WINDOWS_DOMAIN_MAINTENANCE` en todos los tests |

### Archivos frontend

| Archivo | Cambio |
|---|---|
| `frontend/src/app/core/models/task.models.ts` | Remover `'SERVER_MAINTENANCE'` del union `TaskType` |
| `frontend/src/app/shared/utils/task-labels.ts` | Remover entradas de `SERVER_MAINTENANCE` en `typeLabel`, `typeLabelLong`, `typeBadge` |
| `frontend/src/app/shared/utils/task-labels.spec.ts` | Remover casos de test de `SERVER_MAINTENANCE` |
| `frontend/src/app/shared/components/task-card/task-card.component.spec.ts` | Cambiar tipo por defecto del mock: `'SERVER_MAINTENANCE'` → `'WINDOWS_DOMAIN_MAINTENANCE'` |
| `frontend/src/app/shared/components/kanban-board/kanban-board.component.spec.ts` | Idem |

**No se necesita nueva migración de base de datos.**

---

## Parte 2 — Chips de tipo de tarea

### Tokens nuevos en `frontend/src/styles/tokens.scss`

Mismo patrón que los tokens existentes `--srv` / `--purple`:

```scss
--vmware: #4ade80;  --vmware-bg: rgba( 74, 222, 128, 0.12);  --vmware-bd: rgba( 74, 222, 128, 0.25);
--win:    #818cf8;  --win-bg:    rgba(129, 140, 248, 0.12);  --win-bd:    rgba(129, 140, 248, 0.25);
--nas:    #2dd4bf;  --nas-bg:    rgba( 45, 212, 191, 0.12);  --nas-bd:    rgba( 45, 212, 191, 0.25);
--bkp:    #a3e635;  --bkp-bg:    rgba(163, 230,  53, 0.12);  --bkp-bd:    rgba(163, 230,  53, 0.25);
--net:    #f97316;  --net-bg:    rgba(249, 115,  22, 0.12);  --net-bd:    rgba(249, 115,  22, 0.25);
```

### Semántica de color por tipo

| TaskType | Token | Color |
|---|---|---|
| `SERVER_HOST_MAINTENANCE` | `--vmware` | verde (#4ade80) |
| `WINDOWS_DOMAIN_MAINTENANCE` | `--win` | indigo (#818cf8) |
| `QNAP_MAINTENANCE` | `--nas` | teal (#2dd4bf) |
| `VEEAM_BACKUP` | `--bkp` | lime (#a3e635) |
| `ROUTER_MAINTENANCE` | `--net` | naranja (#f97316) |
| `TERMINAL_MAINTENANCE` / `SITE_VISIT` | `--purple` | (ya existe) |
| `AV_CONTROL` / `UPS_CONTROL` / `ENDPOINT_INVENTORY` | `--neutral` | (ya existe) |

### Variantes de badge en `frontend/src/styles/components.scss`

Agregar 5 variantes nuevas al bloque `.badge`, siguiendo el patrón existente:

```scss
&--vmware { background: var(--vmware-bg); color: var(--vmware); border: 1px solid var(--vmware-bd); }
&--win    { background: var(--win-bg);    color: var(--win);    border: 1px solid var(--win-bd);    }
&--nas    { background: var(--nas-bg);    color: var(--nas);    border: 1px solid var(--nas-bd);    }
&--bkp    { background: var(--bkp-bg);   color: var(--bkp);    border: 1px solid var(--bkp-bd);    }
&--net    { background: var(--net-bg);    color: var(--net);    border: 1px solid var(--net-bd);    }
```

### Cambios en `task-labels.ts`

Ampliar `typeBadge()` para cubrir todos los tipos con su clase badge:

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

### Cambios en `task-card.component`

**HTML** — reemplazar:
```html
<div class="tc-type">{{ typeLabel }}</div>
```
por:
```html
<span class="badge" [ngClass]="typeBadgeClass">{{ typeLabel }}</span>
```

Usar `typeLabel` (corto, ej. "VMware / BMC") no `typeLabelLong`.

**TS** — agregar getter:
```typescript
get typeBadgeClass(): string { return typeBadge(this.task.type); }
```

**SCSS** — remover la regla `.tc-type` (reemplazada por el badge global).

### Cambios en drawers

Tanto `admin-task-drawer` como `task-drawer` muestran el tipo de tarea en el header (actualmente como texto plano o label). En ambos, reemplazar esa línea de tipo con:

```html
<span class="badge" [ngClass]="typeBadgeClass">{{ typeLabel }}</span>
```

Usar `typeLabel` (corto). Cada componente TS agrega el getter `typeBadgeClass` importando `typeBadge` de `task-labels`.

### Tests

- **`task-labels.spec.ts`** — actualizar `typeBadge()`: agregar casos para los 5 tipos nuevos; remover caso de `SERVER_MAINTENANCE`.
- **`task-card.component.spec.ts`** — agregar test que verifica que el elemento `.badge` tiene la clase correcta según el tipo de la task.

---

## Lo que NO cambia

- Los tokens `--srv` y `--purple` no se reasignan — `SERVER_HOST_MAINTENANCE` obtiene su propio token `--vmware`; `--srv` queda disponible para usos futuros.
- La franja de color izquierda (`::before`) de las task cards — sigue usando `tc-srv` / `tc-visit` / `tc-crit` / `tc-done` (urgencia/estado, semántica distinta al tipo).
- `AV_CONTROL`, `UPS_CONTROL`, `ENDPOINT_INVENTORY` quedan en `--neutral` por ahora.
