# Creación automática de tickets por desvío detectado en mantenimientos

## Qué es y por qué existe

Hoy, si un técnico detecta un problema durante un control de mantenimiento (un QNAP
con el disco lleno, una VM sin backup, un disco con error), el flujo depende de que
el técnico lo note y decida manualmente abrir el ticket en Odoo (regla de negocio 1
del proyecto: "ticket Odoo siempre primero ante cualquier error detectado").

Este módulo automatiza la **detección** del desvío a partir de datos objetivos que
el técnico ya carga en el payload del `MaintenanceLog` — no reemplaza el juicio
humano, lo asiste: cuando el sistema detecta un desvío, lo marca como pendiente y
un humano (técnico/TL) confirma antes de que se cree el ticket. Nunca crea el
ticket sin confirmación.

Ejemplos concretos que dispararon esto: espacio en disco de un QNAP por arriba de
un umbral, un disco con error en un QNAP, una VM sin backup en Veeam.

## Enfoque elegido (y el que se descartó)

- **Enfoque A — elegido:** reglas sobre el payload que el técnico ya registra al
  completar el control. Costo bajo, no requiere integraciones nuevas.
- **Enfoque B — descartado por ahora:** leer en vivo de Veeam/QNAP/VMware al momento
  de abrir la tarea, sin depender de que el técnico transcriba el dato. Quedó
  descartado por costo (integraciones nuevas), salvo para VMware que ya tiene
  integración (`integrations/vmware`) — queda como mejora futura, no en este spec.
- **Automático vs. sugerido:** sugerido. El sistema marca "desvío detectado,
  pendiente de confirmación"; un humano confirma o descarta. Confirmar crea el
  ticket en Odoo. Descartar no crea nada, pero queda el registro (auditable).
- **Configuración de umbrales:** configurable desde Admin, no hardcodeada.

## Ya implementado (no volver a construir esto)

Todo lo de abajo está en `develop` (pusheado a origin). `main` está un merge atrás
de `develop` — no se sincronizó después de estos dos últimos cambios a propósito,
nadie lo pidió todavía.

### 1. Tipo del payload corregido

`backend/src/maintenance-logs/log-item.interface.ts` fue reescrito para que coincida
con la forma real que manda el frontend (`frontend/src/app/core/models/maintenance-log.models.ts`).
Antes estaba desalineado (faltaban `QnapPayload`/`VeeamBackupPayload` completos,
`vmwareCheck` era un blob opaco). Ahora el `MaintenancePayload` union incluye:
`ServerHostPayload | WindowsDomainPayload | RouterMaintenancePayload | TerminalPayload
| QnapPayload | VeeamBackupPayload | ExpirationControlPayload`.

Campos relevantes para este módulo:
- `QnapPayload.qnap: QNAPSection[]` — cada entrada tiene `usedSpaceGB`, `totalSpaceGB`,
  `usedSpaceUnit?/totalSpaceUnit?: 'GB'|'TB'`, `disksWithError: string[]`,
  `raidStatus: 'ok'|'degraded'|'failed'`.
- `VeeamBackupPayload.vms: VeeamVmEntry[]` — cada entrada tiene
  `coverage: 'job'|'agent'|'excluded'|'no_backup'`.

No se migró `ServerMaintenancePayload`, `VMwareHostEntry`, `VeeamSection`,
`VeeamJobEntry` — son código muerto en el frontend (su `type: 'SERVER_MAINTENANCE'`
no matchea ningún `TaskType` real). Sigue sin limpiar ahí, es un cleanup aparte.

### 2. Registro de señales

`backend/src/maintenance-logs/deviation-signals/`:
- `deviation-signal.interface.ts` — `DeviationSignal<TPayload>`: `{ key, label,
  valueType: 'number'|'boolean', compute: (payload) => number|boolean|null }`.
- `qnap.signals.ts` — `anyDiskWithError(payload)`, `maxUsedSpacePct(payload)`
  (normaliza TB→GB ×1024, igual que `qnap-device-card.component.ts` del frontend;
  devuelve `null` si `qnap: []`).
- `veeam.signals.ts` — `anyVmWithoutBackup(payload)`.
- `deviation-signals.registry.ts` — `getDeviationSignals(taskType: TaskType):
  DeviationSignal<unknown>[]`. Hoy solo tiene entradas para `QNAP_MAINTENANCE` (2
  señales) y `VEEAM_BACKUP` (1 señal). Cualquier otro `TaskType` devuelve `[]`.

Todo con tests (TDD), 14 specs, todos verdes.

### 3. Entidad y CRUD admin de reglas configurables

`backend/src/deviation-rules/`:
- `deviation-operator.enum.ts` — `DeviationOperator: gt|gte|lt|lte|eq`.
- `deviation-rule.entity.ts` — tabla `deviation_rules`: `id (uuid), taskType (enum
  TaskType), signalKey (varchar), operator (enum DeviationOperator), thresholdNumber
  (numeric | null), thresholdBoolean (boolean | null), enabled (boolean, default
  true), helpdeskTeamId (int | null), tagIds (int[], default []), createdAt,
  updatedAt`. Unique constraint `(taskType, signalKey)` — una sola regla por señal.
- `dto/create-deviation-rule.dto.ts`, `dto/update-deviation-rule.dto.ts`.
- `deviation-rules.service.ts`:
  - `findAll()`, `getAvailableSignals(): AvailableDeviationSignal[]` (flatten del
    registro con `taskType` agregado — esto es lo que va a alimentar el combo del
    admin).
  - `create(dto)` valida que `signalKey` exista en el registro para ese `taskType`
    (`BadRequestException` si no), valida coherencia operador/threshold según el
    `valueType` de la señal (booleana → solo `eq` + `thresholdBoolean`; numérica →
    `thresholdNumber` requerido), y rechaza duplicados de `(taskType, signalKey)`
    con `ConflictException`.
  - `update(id, dto)`, `remove(id)` — ambos `NotFoundException` si no existe.
- `deviation-rules.controller.ts` — `/deviation-rules` (GET/POST/PATCH :id/DELETE
  :id) + `GET /deviation-rules/signals`. Todo bajo `@Roles(UserRole.ADMIN)` (a
  diferencia de `task-config`, donde el GET es abierto a cualquier autenticado —
  acá no hay razón para que un técnico lo lea).
- `deviation-rules.module.ts`, registrado en `app.module.ts`, exporta
  `DeviationRulesService`.
- Migración `backend/src/migrations/1790000000000-CreateDeviationRules.ts` — crea
  el tipo `deviation_rules_operator_enum` y la tabla. Reusa el enum `tasks_type_enum`
  ya existente para la columna `task_type` (mismo patrón que
  `1787200000000-CreateTaskTypeConfig.ts`).

**⚠️ Esta migración todavía NO se corrió en ninguna base real** (ni dev ni el
server de pruebas) — no había Docker levantado cuando se escribió. Correr
`npm run migration:run` ahí antes de probar nada de esto.

20 specs entre service y controller, todos verdes. 643/643 tests del backend
pasan en total, 38 errores preexistentes de `tsc --noEmit` sin cambios (no
relacionados a este módulo, confirmado comparando contra el baseline de `develop`).

## Lo que falta implementar

### Paso A — Evaluador (backend)

Nuevo módulo `backend/src/maintenance-deviations/` (separado de `deviation-rules`:
ese módulo es config pura; este es runtime + estado).

**Entidad `MaintenanceDeviation`** (tabla `maintenance_deviations`):
```
id                  uuid PK
logId               uuid NOT NULL   FK → maintenance_logs(id)
taskId              uuid NOT NULL   FK → tasks(id)  -- denormalizado, para no tener
                                                          que joinear en el drawer
ruleId              uuid NULL       FK → deviation_rules(id) ON DELETE SET NULL
taskType            enum TaskType NOT NULL   -- snapshot al detectar
signalKey           varchar NOT NULL          -- snapshot al detectar
operator            enum DeviationOperator NOT NULL  -- snapshot
thresholdNumber     numeric NULL              -- snapshot
thresholdBoolean    boolean NULL              -- snapshot
detectedValueNumber numeric NULL              -- el valor calculado que matcheó
detectedValueBoolean boolean NULL
status              enum PENDING|CONFIRMED|DISMISSED, default PENDING
detectedAt          timestamptz default now()
resolvedAt          timestamptz NULL
resolvedByUserId    uuid NULL FK → users(id)
odooTicketId        integer NULL
```
Unique constraint `(logId, signalKey)` — un log solo puede generar una detección
por señal (evita duplicar si se re-evalúa en un update).

Por qué snapshot y no solo `ruleId`: si el admin edita o borra la regla después de
que ya se detectó un desvío, la fila de detección tiene que seguir siendo legible
tal cual era en el momento de la detección.

**Servicio `MaintenanceDeviationEvaluatorService`** (o el nombre que se prefiera):
- Método `evaluate(log: MaintenanceLog, task: Task): Promise<MaintenanceDeviation[]>`.
- Trae las reglas habilitadas (`enabled: true`) de `DeviationRulesService` para
  `task.type`.
- Por cada regla: busca la señal en `getDeviationSignals(task.type)` por
  `signalKey`, corre `signal.compute(log.payload)`. Si el resultado es `null`
  (no hay datos, ej. `qnap: []`), no evalúa. Si no es `null`, compara contra el
  operador+threshold de la regla.
- Si matchea Y no existe ya una fila en `maintenance_deviations` para
  `(logId, signalKey)` → crea una fila `PENDING` con el snapshot completo.
- Si matchea pero ya existe una fila para esa combinación → no duplica (idempotente
  ante reevaluación).

**Dónde se llama:** inyectar este evaluador en `MaintenanceLogsService`
(`backend/src/maintenance-logs/maintenance-logs.service.ts`) y llamarlo al final de
`create()` (y decidir si también en `update()` — ver "Pendiente de definir").
`MaintenanceLogsModule` va a necesitar importar el nuevo
`MaintenanceDeviationsModule` para inyectar el evaluador (dirección de dependencia:
`MaintenanceLogsModule → MaintenanceDeviationsModule → DeviationRulesModule`, sin
ciclos).

TDD: escribir el spec del evaluador primero (casos: matchea y crea PENDING; no
matchea y no crea nada; señal devuelve `null` y no evalúa; ya existe detección para
esa combinación y no duplica; regla deshabilitada se ignora).

### Paso B — Confirmar / Descartar (backend)

En el mismo módulo `maintenance-deviations/`:
- `GET /maintenance-deviations/by-task/:taskId` — devuelve las detecciones de esa
  tarea (para el drawer). Decidir si filtrar solo `PENDING` o devolver todas
  (con status) para mostrar histórico — ver "Pendiente de definir".
- `POST /maintenance-deviations/:id/confirm` — roles: los mismos que pueden escribir
  el `MaintenanceLog` (`ADMIN`, `TL`, `TECHNICIAN`, a confirmar). Crea el ticket en
  Odoo usando `rule.helpdeskTeamId`/`tagIds` (snapshot en la fila, no la regla viva)
  y pasa a `CONFIRMED` con `odooTicketId`, `resolvedAt`, `resolvedByUserId`. Si Odoo
  falla, no cambiar el estado — dejar `PENDING` y propagar el error (mismo criterio
  que `ExpirationTicketsService` ante fallas de Odoo).
- `POST /maintenance-deviations/:id/dismiss` — pasa a `DISMISSED` con `resolvedAt`,
  `resolvedByUserId`. No crea ticket. No se borra la fila — queda de auditoría.

**Falta un método nuevo en `OdooService`** (`backend/src/integrations/odoo/odoo.service.ts`)
para crear el ticket con team/tags explícitos por parámetro — el más parecido que
ya existe es `createExpirationTicket(item, infraopsClientId, helpdeskTeamId, tagIds,
taskName?, ticketDescription?)` (línea ~579), que sí acepta `helpdeskTeamId`/`tagIds`
explícitos por llamada (a diferencia de `createTicket()`, que usa el equipo default
de la config de Odoo). Conviene modelar el método nuevo sobre ese, no sobre
`createTicket()`.

### Paso C — Admin UI: tabla "Reglas de desvío" (frontend)

En el módulo de admin, tab **Mantenimientos** (donde ya vive la tabla de
`TaskTypeConfig` — buscar el componente en
`frontend/src/app/features/admin/task-config/`), agregar una tabla nueva **debajo**
de la existente, mismo tab. `mat-table` (no Ag-Grid — no se pidió explícitamente
para esta vista y el dataset va a ser chico).

Por fila: `TaskType | Señal | Operador | Umbral | Habilitado | Equipo Odoo | Tags`.
Diálogo de alta/edición: selector de `TaskType` → al elegir, pedir
`GET /deviation-rules/signals` y filtrar por ese `taskType` para poblar el selector
de señal → según el `valueType` de la señal elegida, mostrar el input de umbral
correcto (numérico, o un toggle/checkbox si es `boolean`) y limitar el selector de
operador a `eq` si es booleana. Revisar si ya existe un componente compartido para
elegir tags/equipo de Odoo (el patrón ya se usa en `task-config` y en
`notifications-config` — no duplicar si ya hay uno en `shared/`).

Seguir las reglas obligatorias de Angular Material del proyecto (`appearance="outline"`,
sin elementos nativos, etc. — ver CLAUDE.md).

### Paso D — Banner en el task drawer (frontend)

En el drawer de tarea (`frontend/src/app/features/technician/task-drawer/`), después
de guardar el log (o al abrir un log ya guardado), pedir
`GET /maintenance-deviations/by-task/:taskId` y si hay alguna `PENDING`, mostrar un
banner con la descripción del desvío y dos botones: **"Confirmar y crear ticket"** /
**"Descartar"**. Al confirmar/descartar, seguir la regla de reactividad de estado
del proyecto: mutar el array local con la fila actualizada, no recargar con `load()`.
El componente hijo debe emitir la entidad actualizada (`EventEmitter<MaintenanceDeviation>`),
no `EventEmitter<void>`.

## Decisiones de diseño tomadas

- El desvío nunca crea el ticket solo — siempre pasa por confirmación humana.
- Los umbrales son configurables desde Admin, no hardcodeados.
- Se snapshotea la regla en la fila de detección (taskType/signalKey/operator/
  threshold) en vez de depender solo del FK — la regla puede cambiar o borrarse
  después de que ya se detectó algo.
- Dedup por `(logId, signalKey)`, no por `(logId, ruleId)` — más robusto porque no
  depende de que la regla siga existiendo.
- Descartar un desvío no borra la fila — queda de auditoría (coherente con el valor
  central de InfraOps: hacer el trabajo técnico trazable).
- El módulo de evaluación/detección (`maintenance-deviations`) queda separado del de
  configuración (`deviation-rules`) — uno es config admin, el otro es runtime +
  estado + integración con Odoo.

## Lo que NO se automatiza / queda fuera de este spec

- Lectura en vivo de Veeam/QNAP (Enfoque B) — sigue siendo el técnico quien carga el
  dato en el payload.
- Cualquier señal para `TaskType`s que no sean `QNAP_MAINTENANCE`/`VEEAM_BACKUP` —
  se puede sumar después con el mismo patrón (agregar al registro de señales +
  regla de admin), no hace falta tocar el evaluador.
- Cleanup de `ServerMaintenancePayload`/`VMwareHostEntry`/`VeeamSection`/
  `VeeamJobEntry` (código muerto en el frontend) y del `describe('ServerMaintenancePayload', ...)`
  en `maintenance-log.models.spec.ts` — queda anotado, no es parte de este módulo.

## Pendiente de definir antes de implementar

- **¿Evaluar solo en `create()` del log, o también en `update()`?** Si un técnico
  edita un log ya guardado y el valor cambia, ¿se re-evalúa? Probablemente sí para
  detectar señales nuevas, pero sin tocar detecciones que ya estén `CONFIRMED`/
  `DISMISSED` para esa combinación `(logId, signalKey)`.
- **Roles que pueden confirmar/descartar** — asumido `ADMIN`, `TL`, `TECHNICIAN`
  (los mismos que escriben el log), a confirmar con el usuario.
- **`GET /maintenance-deviations/by-task/:taskId`: ¿solo `PENDING` o todo el
  histórico con status?** Afecta si el drawer muestra también lo ya resuelto.
- **Nombre exacto del endpoint/acción de confirmar** — ¿`POST /:id/confirm` o
  `PATCH /:id` con `{ action: 'confirm' }`? Mantener consistencia con el resto de
  la API (la mayoría de las acciones de transición de estado en este proyecto usan
  verbos en la URL, ej. revisar cómo lo hace `tasks.controller.ts` para transiciones
  de `TaskStatus`).
- Correr la migración `1790000000000-CreateDeviationRules` en la DB del server de
  pruebas (y en dev) antes de poder probar cualquier cosa de este spec end-to-end.

## Estado de git al momento de escribir este spec

Todo mergeado a `develop` y pusheado a `origin/develop`. Rama actual: `develop`.
`main` no se actualizó con los últimos dos merges (nadie lo pidió) — antes de tocar
`main` de nuevo, confirmar con el usuario como se hizo las veces anteriores.

Convención del repo para este trabajo: un branch nuevo por paso
(`feature/maintenance-deviation-signals`, `feature/deviation-rules-admin`, etc.),
mergeado con `--no-ff` a `develop`, commits y merge messages en español, con:
```
Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```
Nunca commitear/pushear sin que el usuario lo pida explícitamente — en esta sesión
cada commit/merge/push fue un paso separado, confirmado uno por uno.
