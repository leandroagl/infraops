# Router Maintenance Split — Design Spec

**Fecha:** 2026-06-27
**Objetivo:** Extraer la sección Router/Firewall de `WINDOWS_DOMAIN_MAINTENANCE` como tipo de tarea independiente `ROUTER_MAINTENANCE`, con su propio formulario standalone, siguiendo el mismo patrón que el split `SERVER_HOST_MAINTENANCE` / `WINDOWS_DOMAIN_MAINTENANCE`.

---

## Contexto

`MaintenanceFormComponent` maneja actualmente `WINDOWS_DOMAIN_MAINTENANCE`, que incluye:
- Servidores Windows (windowsVMs)
- Controladores de dominio (domainControllers)
- **Router / Firewall** (routers) ← a extraer

`WindowsDomainPayload` tiene `router?: RouterEntry[]` que pasará al nuevo payload.

Al completar este split, `WINDOWS_DOMAIN_MAINTENANCE` queda limpio: solo Windows Servers + DCs.

---

## Nuevo TaskType

```
ROUTER_MAINTENANCE
```

Convención coherente con `QNAP_MAINTENANCE`, `SERVER_HOST_MAINTENANCE`, `VEEAM_BACKUP`.

---

## Arquitectura

### Backend

| Archivo | Cambio |
|---|---|
| `backend/src/tasks/task-type.enum.ts` | Agrega `ROUTER_MAINTENANCE = 'ROUTER_MAINTENANCE'` |
| `backend/src/migrations/<ts>-AddRouterMaintenanceTaskType.ts` | `ALTER TYPE … ADD VALUE` con `transaction = false` |
| `backend/src/maintenance-logs/log-item.interface.ts` | Agrega `RouterMaintenancePayload` |

**Nuevo payload (backend):**
```typescript
export interface RouterMaintenancePayload {
  type: 'ROUTER_MAINTENANCE';
  router: RouterEntry[];
  notes?: string;
}
```

`RouterEntry` ya existe en el backend — no se modifica.

### Frontend — Modelos

| Archivo | Cambio |
|---|---|
| `frontend/src/app/core/models/task.models.ts` | Agrega `'ROUTER_MAINTENANCE'` al union `TaskType` |
| `frontend/src/app/core/models/maintenance-log.models.ts` | Nuevo `RouterMaintenancePayload`, lo agrega a `MaintenancePayload`, elimina `router?` de `WindowsDomainPayload` |
| `frontend/src/app/shared/utils/task-labels.ts` | Agrega label para `ROUTER_MAINTENANCE` |
| `frontend/src/app/shared/utils/task-labels.spec.ts` | Agrega caso de test |

**Nuevo payload (frontend):**
```typescript
export interface RouterMaintenancePayload {
  type: 'ROUTER_MAINTENANCE';
  router: RouterEntry[];
  notes?: string;
}
```

`WindowsDomainPayload` queda sin `router?`:
```typescript
export interface WindowsDomainPayload {
  type: 'WINDOWS_DOMAIN_MAINTENANCE';
  windows: WindowsSection;
  notes?: string;
}
```

### Frontend — Componente nuevo: `RouterFormComponent`

**Ubicación:** `frontend/src/app/features/technician/task-drawer/router-form/`

**Archivos:** `.component.ts`, `.component.html`, `.component.scss`, `.component.spec.ts`

**Selector:** `app-router-form`

**Inputs/Outputs** (mismo contrato que `ServerHostFormComponent`):
```typescript
@Input() task!: Task;
@Input() infrastructure!: ClientInfrastructure;
@Input() savedPayload: MaintenancePayload | null = null;
@Input() readOnly = false;

@Output() requestComplete = new EventEmitter<RouterMaintenancePayload>();
@Output() requestSave     = new EventEmitter<RouterMaintenancePayload>();
@Output() requestNotDone  = new EventEmitter<void>();
```

**Form:**
```typescript
form = fb.group({
  routerDevices: fb.array(
    infrastructure.routers.map(() => fb.group({
      firmwareUpdated: [false],
      firmwareVersion: [''],
      backupDone:      [false],
    }))
  ),
  notes: [''],
})
```

**buildPayload()** construye `RouterMaintenancePayload` con `router: RouterEntry[]`.

**Lógica de ciclo de vida:** igual a `ServerHostFormComponent` — `ngOnChanges` reactivo, `applyReadOnlyState()`.

**Template:** replica las cards de Router/Firewall que actualmente están en `maintenance-form.component.html`, adaptadas al prefijo CSS `rf-` (router-form).

### Frontend — Modificaciones a componentes existentes

**`MaintenanceFormComponent`**
- Eliminar `routerDevices` FormArray del `buildForm()`
- Eliminar getter `routerDeviceControls` y `hasRouter`
- Eliminar sección Router/Firewall del HTML
- Eliminar lógica de router en `buildPayload()` y `patchFormFromPayload()`
- `WindowsDomainPayload` ya no tiene `router?` — actualizar tipos

**`TaskDrawerComponent`**
- Agrega `@ViewChild(RouterFormComponent) routerForm?: RouterFormComponent`
- Agrega import de `RouterFormComponent` y `RouterMaintenancePayload`
- Template: agrega `<app-router-form>` con condición `task.type === 'ROUTER_MAINTENANCE'`
- Ajusta el catch-all de `<app-maintenance-form>` para excluir `ROUTER_MAINTENANCE`
- Agrega footer block `<ng-container *ngIf="task.type === 'ROUTER_MAINTENANCE'">` con "Completar mantenimiento" + "Guardar progreso" + "Cerrar"
- Agrega `triggerRouterFormSave()` helper
- `detectIssues()` — `ROUTER_MAINTENANCE` no tiene validaciones especiales, retorna vacío

**`TechnicianModule`**
- Declara `RouterFormComponent`

---

## Datos y migración

- La migración usa `transaction = false` (requisito de `ALTER TYPE ADD VALUE` en PostgreSQL).
- No hay datos existentes con tipo `ROUTER_MAINTENANCE` que migrar.
- `RouterEntry` ya existe en ambos lados — no hay cambio de estructura de datos.

---

## Testing

- `RouterFormComponent` spec: construye form con `esxiHosts` stub vacío, prueba `buildPayload()`, prueba `patchFormFromPayload()`, prueba `readOnly`.
- `MaintenanceFormComponent` spec: actualizar para no esperar sección router.
- `TaskDrawerComponent` spec: actualizar mocks para nuevo tipo.
- `task-labels.spec.ts`: agregar caso `ROUTER_MAINTENANCE`.

---

## File Map

| Archivo | Acción |
|---|---|
| `backend/src/tasks/task-type.enum.ts` | Modify |
| `backend/src/migrations/<ts>-AddRouterMaintenanceTaskType.ts` | Create |
| `backend/src/maintenance-logs/log-item.interface.ts` | Modify |
| `frontend/src/app/core/models/task.models.ts` | Modify |
| `frontend/src/app/core/models/maintenance-log.models.ts` | Modify |
| `frontend/src/app/shared/utils/task-labels.ts` | Modify |
| `frontend/src/app/shared/utils/task-labels.spec.ts` | Modify |
| `frontend/.../router-form/router-form.component.ts` | Create |
| `frontend/.../router-form/router-form.component.html` | Create |
| `frontend/.../router-form/router-form.component.scss` | Create |
| `frontend/.../router-form/router-form.component.spec.ts` | Create |
| `frontend/.../technician.module.ts` | Modify |
| `frontend/.../maintenance-form/maintenance-form.component.ts` | Modify |
| `frontend/.../maintenance-form/maintenance-form.component.html` | Modify |
| `frontend/.../maintenance-form/maintenance-form.component.spec.ts` | Modify |
| `frontend/.../task-drawer/task-drawer.component.ts` | Modify |
| `frontend/.../task-drawer/task-drawer.component.html` | Modify |
| `frontend/.../task-drawer/task-drawer.component.spec.ts` | Modify |
