# Form Persistence — Diseño

**Fecha:** 2026-05-31  
**Contexto:** InfraOps — Vista Técnico, formulario de mantenimiento  
**Alcance:** Pre-cargar el formulario con el progreso guardado cuando un técnico reabre una tarea en curso

---

## Problema

Cuando un técnico guarda progreso parcial en un mantenimiento (botón "Guardar progreso") y luego cierra el sistema, al volver a abrir la tarea el formulario aparece vacío. Los datos fueron persistidos en el log del backend pero no se recuperan al reabrir.

---

## Solución

El `TaskDrawerComponent` orquesta dos cargas secuenciales al abrir una tarea. La segunda carga (el log guardado) no agrega latencia perceptible porque ocurre mientras el técnico ya está leyendo la interfaz. El formulario no se renderiza hasta que ambas cargas terminan, evitando un flash de valores vacíos.

---

## Flujo de carga

```
Tarea seleccionada
  → loadingInfra = true
  → GET /infradoc/:clientId
      → éxito: infra en memoria
          → GET /tasks/:taskId/log
              → 200: savedPayload = payload del log
              → 404: savedPayload = null   (tarea nueva sin log)
              → otro error: savedPayload = null  (degradación silenciosa)
          → loadingInfra = false
      → error de infra: mensaje de error (comportamiento actual)
```

El formulario se muestra únicamente cuando `infrastructure !== null && !loadingInfra`. Esto garantiza que los datos de infra y el log guardado estén listos antes de que el form se construya y parchee.

---

## Arquitectura de componentes

### `TaskDrawerComponent`

**Nuevo estado:**
- `savedPayload: MaintenancePayload | null = null`

**Cambio en `loadInfrastructure()`:**  
Después del éxito de infra, encadena `logsService.get(taskId)`. El 404 se trata como "sin log" (no error). Cualquier otro error también deja `savedPayload = null` sin mostrar mensaje (el formulario simplemente arranca vacío). `loadingInfra` se pone en `false` sólo al terminar el log fetch (éxito o error).

**Template:**  
Agrega `[savedPayload]="savedPayload"` al `app-maintenance-form`. La condición `*ngIf` del form ya es `infrastructure && isActiveTask`; como `infrastructure` sólo se asigna cuando ambas cargas terminan, no se necesita agregar `!loadingInfra` explícitamente — la asignación de `infrastructure` y `savedPayload` es atómica (ocurre en el mismo `next` handler).

### `MaintenanceFormComponent`

**Nuevo input:**
- `@Input() savedPayload: MaintenancePayload | null = null`

**Cambio en `ngOnChanges()`:**  
Después de `buildForm()` (cuando `infrastructure` cambia), si `savedPayload` está presente, llama a `patchFormFromPayload(savedPayload)`. Si `savedPayload` también cambia en el mismo ciclo, el parcheo sucede en el mismo `ngOnChanges`.

**Nuevo método privado `patchFormFromPayload(payload)`:**  
Distingue por `payload.type`:

- `SERVER_MAINTENANCE`: parchea campos planos con `patchValue` y arrays con match por ID:
  - `servers[]` → match `serverId === vm.assetId`
  - `vmwareHosts[]` → match `hostId === esxiHost.assetId`
  - `bmcHosts[]` → match `hostId === esxiHost.assetId`
  - `qnapDevices[]` → match `deviceId === nas.assetId`
- `TERMINAL_MAINTENANCE`: todos los campos son planos, `patchValue` directo.

---

## Reglas de borde

| Caso | Comportamiento |
|---|---|
| Log no existe (tarea nueva, 404) | `savedPayload = null` → formulario vacío, sin error |
| Error al obtener log (5xx, red) | `savedPayload = null` → formulario vacío, sin error |
| ID de infra cambia entre guardado y reapertura | Ítem sin match → mantiene default del form |
| Ítem nuevo en infra sin dato guardado | Mantiene default del form (`'ok'`, `null`, `false`) |
| `savedPayload` llega antes de que el form esté construido | Imposible por diseño: infra y log se cargan secuencialmente, el form se construye cuando ambos llegan |

---

## Testing

### `task-drawer.component.spec.ts`

- Cuando `logsService.get()` devuelve 200: `savedPayload` contiene el payload del log
- Cuando `logsService.get()` devuelve 404: `savedPayload` queda `null`, no se muestra error
- `loadingInfra` permanece `true` hasta que el log también resuelve (no muestra el form prematuramente)
- Cuando el log falla con error que no es 404: `savedPayload = null`, `loadingInfra = false`

### `maintenance-form.component.spec.ts`

- `patchFormFromPayload` con `ServerMaintenancePayload`: verifica que `dcdiag`, `veeamStatus`, `servers[i]` queden con los valores correctos
- `patchFormFromPayload` con ID de servidor no presente en la infra actual: los demás items se parchean, el faltante se ignora
- `patchFormFromPayload` con `TerminalPayload`: verifica que `cleanedTemp`, `connectivity` etc. queden correctos
- Si `savedPayload` es `null`: el formulario no se parchea (queda con defaults)

---

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `task-drawer.component.ts` | Propiedad `savedPayload`; refactor de `loadInfrastructure()` |
| `task-drawer.component.html` | Binding `[savedPayload]` en `app-maintenance-form` |
| `maintenance-form.component.ts` | `@Input() savedPayload`; `ngOnChanges` actualizado; `patchFormFromPayload()` |
| `task-drawer.component.spec.ts` | Tests de carga secuencial y estados de `savedPayload` |
| `maintenance-form.component.spec.ts` | Tests de `patchFormFromPayload` |

No se requieren cambios en el backend.
