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

## Estado: implementado completo (Pasos A–D)

Todo lo de abajo ya está construido, con TDD, y mergeado a `develop` (pusheado a
origin). `main` sigue sin sincronizar — nadie lo pidió todavía. **Pendiente real:
correr la migración `1790000000000-CreateDeviationRules` y
`1790100000000-CreateMaintenanceDeviations` en la DB del server de pruebas** — no
hay Docker levantado desde que se escribió el código, así que nada de esto se
probó todavía end-to-end contra una base real.

Quedan documentados los 4 pasos tal como se planearon, con los ajustes reales que
se hicieron durante la implementación (marcados donde difieren de lo planeado).

### Paso A — Evaluador (backend) ✅

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
**Ajuste real:** se agregaron también `helpdeskTeamId` (int, nullable) y `tagIds`
(int[], default `[]`) como snapshot — no estaban en el diseño original de esta
tabla, pero el Paso B los necesita para crear el ticket con el equipo/tags de la
regla *al momento de la detección*, no la regla viva (que el admin puede haber
editado o borrado después). Sin esto, confirmar un desvío antiguo hubiera usado
la config actual de la regla en vez de la que estaba vigente cuando se detectó.

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

TDD hecho: 7 specs (matchea y crea PENDING; no matchea; señal `null` no evalúa; no
duplica; regla deshabilitada se ignora; regla de otro taskType se ignora; señal
booleana matchea con `thresholdBoolean`).

**Nota:** solo se llama desde `MaintenanceLogsService.create()`. `update()` sigue
sin evaluar — ver "Pendiente de definir".

### Paso B — Confirmar / Descartar (backend) ✅

En el mismo módulo `maintenance-deviations/`:
- `GET /maintenance-deviations/by-task/:taskId` — devuelve **todas** las
  detecciones de la tarea (con `status`), cualquier autenticado. El frontend
  filtra a `PENDING` para el banner del drawer; el resto queda disponible para
  mostrar histórico si se quiere en el futuro.
- **Ajuste real:** en vez de `POST /:id/confirm` + `POST /:id/dismiss`, quedó
  `PATCH /maintenance-deviations/:id/status` con body `{ status: 'CONFIRMED' |
  'DISMISSED' }` — mismo patrón que ya usa `tasks.controller.ts` para
  transiciones de `TaskStatus` (`PATCH /tasks/:id/status`), en vez de inventar
  un verbo por acción. Roles: `ADMIN`, `TL`, `TECHNICIAN` (confirmado con el
  usuario — los mismos que escriben el `MaintenanceLog`).
  - `CONFIRMED`: crea el ticket en Odoo usando el snapshot de la fila
    (`helpdeskTeamId`/`tagIds`, no la regla viva) y pasa a `CONFIRMED` con
    `odooTicketId`, `resolvedAt`, `resolvedByUserId`. Si Odoo falla, no cambia
    el estado — queda `PENDING` y propaga el error.
  - `DISMISSED`: pasa a `DISMISSED` con `resolvedAt`/`resolvedByUserId`, sin
    ticket. No se borra la fila — queda de auditoría.
  - Ambas rechazan (`ConflictException`) si el desvío ya estaba resuelto.

`OdooService.createDeviationTicket(clientId, helpdeskTeamId, tagIds, name,
description)` — método nuevo, modelado sobre `createExpirationTicket` (team/tags
explícitos por llamada, no el equipo default de `createTicket()`).

### Paso C — Admin UI: tabla "Reglas de desvío" (frontend) ✅

`DeviationRulesComponent` (`frontend/src/app/features/admin/deviation-rules/`),
embebido con `<app-deviation-rules>` debajo de la tabla de `TaskTypeConfig` en
`task-config.component.html` (mismo tab, Admin → Mantenimientos). `mat-table`,
como estaba planeado.

Por fila: `TaskType | Señal | Operador | Umbral | Habilitado | Equipo Odoo | Tags`.
`DeviationRuleEditDialogComponent`: selector de `TaskType` → señal (filtrada por
`GET /deviation-rules/signals`) → operador (limitado a `eq` si la señal es
booleana) → umbral → equipo/tags de Odoo, reusando `IntegrationConfigService`
(mismo patrón que ya usa el diálogo de Vencimientos — no se duplicó nada). Borrado
reusa `ConfirmDialogComponent` de `shared/`.

33 tests. Suite completo del frontend corrido antes/después: mismos 77 fallos
preexistentes en `NotificationsComponent`, no relacionados.

### Paso D — Banner en el task drawer (frontend) ✅

Banner en `TaskDrawerComponent` (`frontend/src/app/features/technician/task-drawer/`)
por cada desvío `PENDING` de la tarea, con **"Confirmar y crear ticket"** /
**"Descartar"**. Se recarga al abrir la tarea (`ngOnChanges`) y después de cada
guardado exitoso del log — ahí es donde el evaluador puede haber creado una
detección nueva. Confirmar/descartar mutan `pendingDeviations` localmente al
éxito, sin recargar (regla de reactividad del proyecto).

**Ajuste real:** `MaintenanceDeviationsService` y `DeviationRulesService` quedaron
como parámetros **opcionales** del constructor (mismo patrón que ya usaba
`notificationsService?`) — el spec de este componente tiene 14 sitios que
instancian la clase a mano (`new TaskDrawerComponent(...)`) sin pasar por Angular
DI; hacerlos obligatorios rompía esos tests.

12 tests nuevos.

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

## Lo que quedó pendiente de verdad

- **Evaluar en `update()` del log** — sigue sin implementarse. Si un técnico edita
  un log ya guardado y el valor cambia (ej. corrige el % de disco), no se
  re-evalúa. Solo dispara en el primer guardado (`create()`). Queda como mejora
  futura si se necesita.
- **Correr las migraciones en una DB real** — `1790000000000-CreateDeviationRules`
  y `1790100000000-CreateMaintenanceDeviations` existen como archivos pero nunca
  se corrieron (no había Docker levantado durante esta sesión). Nada de este
  spec se probó end-to-end contra una base real todavía.
- Decisiones que estaban abiertas y ya se resolvieron durante la implementación
  (roles de confirmar/descartar, filtro PENDING vs histórico en el `GET`, nombre
  del endpoint) — ver el detalle en cada paso arriba.

## Estado de git

Todo (Pasos A–D) mergeado a `develop` con un solo branch por paso
(`feature/maintenance-deviations-evaluator` para A+B+C+D, además de
`feature/maintenance-deviation-signals` y `feature/deviation-rules-admin` de
sesiones previas), `--no-ff`, pusheado a `origin/develop`. `main` sigue sin
sincronizar — nadie lo pidió todavía; confirmar con el usuario antes de tocarlo.

Commits y merge messages en español, con:
```
Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```
Nunca se commiteó/mergeó/pusheó sin que el usuario lo pidiera explícitamente —
cada paso fue confirmado uno por uno.
