# Schedules de Mantenimiento — Spec de Diseño

**Fecha:** 2026-08-11  
**Scope:** V1 — generación automática de tareas mensuales por cliente con grupos bimestrales y rotación de técnicos

---

## Problema que resuelve

Hoy la asignación de tareas mensuales se coordina manualmente en una planilla Excel:
- Qué clientes corresponden a qué mes
- Qué técnico atiende cada cliente
- Seguimiento de estado por mes

InfraOps reemplaza esto con una funcionalidad integrada, trazable y con generación automática de tickets Odoo.

---

## Alcance V1

**Incluido:**
- Grupos de ejecución bimestral (A·Par y B·Impar)
- Un técnico por cliente (aplica a todas sus tareas)
- Tipos de tarea: `SERVER_HOST_MAINTENANCE`, `WINDOWS_DOMAIN_MAINTENANCE`, `QNAP_MAINTENANCE`, `VEEAM_BACKUP`, `ROUTER_MAINTENANCE`
- Generación manual con confirmación (no cron automático)
- Creación throttleada de tickets Odoo (800ms entre requests)
- Rotación automática equilibrada de técnicos por cliente
- Vista de historial/calendario anual

**Fuera de scope V1 (trabajo futuro):**
- Cierre automático de tareas pendientes del mes anterior en Odoo al generar
- Grupos mensual y trimestral
- Frecuencia de tarea por tipo (ej: SERVER_HOST bimestral, AV_CONTROL mensual)
- Cron automático sin intervención humana

---

## Modelo de datos

### Enum `ScheduleGroup`

```typescript
enum ScheduleGroup {
  BIMONTHLY_ODD  = 'BIMONTHLY_ODD',   // Ene · Mar · May · Jul · Sep · Nov
  BIMONTHLY_EVEN = 'BIMONTHLY_EVEN',  // Feb · Abr · Jun · Ago · Oct · Dic
}
```

Mapeo de mes a grupo:

```typescript
const MONTH_TO_GROUP: Record<number, ScheduleGroup> = {
  1: BIMONTHLY_ODD,  2: BIMONTHLY_EVEN, 3: BIMONTHLY_ODD,
  4: BIMONTHLY_EVEN, 5: BIMONTHLY_ODD,  6: BIMONTHLY_EVEN,
  7: BIMONTHLY_ODD,  8: BIMONTHLY_EVEN, 9: BIMONTHLY_ODD,
  10: BIMONTHLY_EVEN, 11: BIMONTHLY_ODD, 12: BIMONTHLY_EVEN,
};
```

### Entidad `ClientSchedule`

```typescript
@Entity('client_schedules')
class ClientSchedule {
  id:            uuid          // PK
  clientId:      uuid          // FK → clients, UNIQUE
  scheduleGroup: ScheduleGroup // nullable — cliente sin grupo no se genera
  technicianId:  uuid | null   // FK → technicians, nullable
  isActive:      boolean       // default true
  createdAt:     timestamptz
  updatedAt:     timestamptz
}
```

**Restricciones:**
- `clientId` unique — un cliente tiene a lo sumo una regla de schedule
- `technicianId` nullable — cliente configurado sin técnico bloquea la generación de ese mes
- `scheduleGroup` nullable — cliente sin grupo no aparece en ninguna generación

### Entidad `RotationConfig` (tabla singleton)

```typescript
@Entity('rotation_config')
class RotationConfig {
  id:                  uuid     // siempre 1 fila
  isActive:            boolean  // default false
  frequency:           'EVERY_GENERATION' | 'EVERY_TWO_GENERATIONS'
  generationsSinceLastRotation: number  // para respetar frecuencia
  updatedAt:           timestamptz
}
```

---

## Backend — `SchedulesModule`

### Estructura de archivos

```
backend/src/schedules/
├── client-schedule.entity.ts
├── rotation-config.entity.ts
├── schedule-group.enum.ts
├── schedules.module.ts
├── schedules.controller.ts
├── schedules.controller.spec.ts
├── schedules.service.ts
├── schedules.service.spec.ts
└── dto/
    ├── upsert-client-schedule.dto.ts
    ├── generate-month.dto.ts
    └── rotation-config.dto.ts
```

### `SchedulesService` — métodos principales

```typescript
// Lista todas las reglas con relaciones client + technician
findAll(): Promise<ClientSchedule[]>

// Crea o actualiza la regla de un cliente (reactive save desde frontend)
upsert(clientId: string, dto: UpsertClientScheduleDto): Promise<ClientSchedule>

// Devuelve preview del mes: qué clientes y qué tareas se generarían
getMonthlyPreview(year: number, month: number): Promise<MonthlyPreviewDto>

// Genera tareas para todos los clientes del grupo del mes dado
// Throttle: 800ms entre llamadas Odoo
generateMonth(year: number, month: number): Promise<GenerationResultDto>

// Devuelve distribución propuesta tras aplicar rotación
previewRotation(): Promise<RotationPreviewDto>

// Guarda y aplica la configuración de rotación
saveRotationConfig(dto: RotationConfigDto): Promise<RotationConfig>
```

### Lógica de generación (`generateMonth`)

```
1. Determinar grupo activo del mes (BIMONTHLY_ODD / BIMONTHLY_EVEN)
2. Cargar ClientSchedules activos del grupo con technicianId != null
3. Para cada ClientSchedule:
   a. Verificar que no existan tareas de ese mes+cliente ya generadas (idempotencia)
   b. Para cada TaskType implementado (los 5 de V1):
      - Consultar InfraDoc; si el cliente no tiene la infra requerida → skip
      - Llamar TasksService.create() con throttle de 800ms
      - Si Odoo falla → registrar error, continuar con el siguiente
4. Devolver resumen: N tareas creadas, N errores, clientes omitidos
```

**Idempotencia:** antes de crear, verificar `tasks WHERE clientId = X AND scheduledDate >= primer día del mes AND scheduledDate <= último día del mes AND type = Y`. Si existe → skip.

### Lógica de rotación

- Carga lista de técnicos activos
- Distribuye los clientes en round-robin ordenado por `clientId` para reproducibilidad
- Balance garantizado: diferencia máxima de 1 cliente entre técnicos
- Guarda la nueva asignación actualizando `technicianId` en cada `ClientSchedule`
- Si `frequency = EVERY_TWO_GENERATIONS`: incrementa contador, solo rota cuando llega a 2

### Endpoints

```
GET    /schedules              → findAll()
PUT    /schedules/:clientId    → upsert() [reactive save]
GET    /schedules/preview?year=&month=   → getMonthlyPreview()
POST   /schedules/generate     → generateMonth() { year, month }
GET    /schedules/rotation     → getRotationConfig()
PUT    /schedules/rotation     → saveRotationConfig()
GET    /schedules/rotation/preview → previewRotation()
```

**Guards:** todos los endpoints requieren rol `ADMIN` o `TL`.

---

## Frontend — `SchedulesModule`

### Estructura

```
frontend/src/app/schedules/
├── schedules.module.ts
├── schedules-routing.module.ts
├── schedules.component.ts / .html / .scss   ← shell con 3 tabs
├── config-tab/
│   ├── config-tab.component.ts / .html / .scss
│   └── rotation-modal/
│       └── rotation-modal.component.ts / .html / .scss
├── generation-tab/
│   └── generation-tab.component.ts / .html / .scss
└── calendar-tab/
    └── calendar-tab.component.ts / .html / .scss
```

### Tab 1 — Configuración

- Tabla de todos los clientes activos
- Por fila: **selector de grupo** (botones segmentados A·Par / B·Impar / —) + **selector de técnico** (mat-select)
- Filtros: por grupo, búsqueda por nombre de cliente
- Cambios guardados de forma reactiva con debounce de 300ms + toast "Guardado"
- Badge "Rotación automática activa" con indicador animado cuando está activa
- Botón "↺ Configurar rotación" abre el modal

**Modal de rotación:**
- Toggle on/off para activar/desactivar rotación automática
- Selector de frecuencia (cada generación / cada 2 generaciones)
- Preview de distribución propuesta con barras de balance por técnico
- Botón "Desactivar y cerrar" (footer izquierdo) para salir de la rotación
- Botón "Guardar configuración" (footer derecho)

### Tab 2 — Generación mensual

- Navegador de mes (◀ Mes ▶)
- Banner con grupo activo del mes (verde=A, naranja=B)
- Stats: N clientes, N tareas estimadas, N ya generadas
- Tabla: cliente | técnico | chips de tareas (detectadas por InfraDoc)
- Filas con `⚠ Sin técnico` en rojo bloquean el botón de generación
- Botón "Generar [Mes] [Año] →" deshabilitado si hay clientes sin técnico
- Al generar: spinner de progreso con contador de tareas creadas

### Tab 3 — Historial / Calendario

- Navegador de año (◀ 2026 ▶)
- Grid 4×3 de cards mensuales
- Cada card: línea de color superior (verde=A, naranja=B), nombre del mes, badge de grupo, estado y barra de progreso
- Card desplegable al hacer clic en el header:
  - Meses pasados con pendientes: sección "Pendientes/no completados" primero (cliente + técnico + estado), luego "Completados"
  - Mes actual sin generar: lista de clientes previstos + link a tab de Generación
  - Meses futuros: lista de clientes previstos en opacidad reducida
- Estados posibles: `✓ Completo` · `N / M (parcial)` · `Sin generar` · `Futuro`

---

## Comportamiento de guardado

| Acción | Comportamiento |
|---|---|
| Cambiar grupo A/B de un cliente | Reactive — guarda inmediatamente, toast "Guardado" |
| Cambiar técnico asignado | Reactive — guarda inmediatamente, toast "Guardado" |
| Configuración de rotación | Explícito — botón "Guardar configuración" en modal |
| Generación del mes | Explícito — botón "Generar" con confirmación implícita |

---

## Decisiones de diseño

1. **Un técnico por cliente, aplica a todas sus tareas:** simplifica la V1. La granularidad por tipo de tarea queda para V2.

2. **Generación manual con preview:** aunque el trigger podría ser automático, la etapa de revisión antes de generar (validar técnicos, verificar clientes) reproduce el flujo actual de la planilla y evita generaciones incorrectas en Odoo.

3. **InfraDoc determina qué tareas crear:** no se configura por tipo de tarea en V1. Si el cliente tiene ESXi hosts → SERVER_HOST; si tiene QNAP → QNAP + VEEAM; etc. Usa la validación ya existente en `TasksService`.

4. **Throttle 800ms entre Odoo calls:** evita flood a la API de Odoo al generar ~30 tickets en simultáneo.

5. **Idempotencia en generación:** si se ejecuta dos veces el mismo mes, no duplica tareas. Verifica existencia por `(clientId, taskType, mes)` antes de crear.

6. **Rotación equilibrada:** round-robin sobre lista de técnicos activos. Diferencia máxima de 1 cliente entre cualquier par de técnicos.

---

## Trabajo futuro

- Cierre automático en Odoo de tareas pendientes del mes anterior al generar el siguiente
- Grupos `MONTHLY` y `QUARTERLY_1/2/3`
- Override de frecuencia por tipo de tarea (ej: AV_CONTROL mensual aunque el cliente sea bimestral)
- Cron de recordatorio cuando el mes arrancó y no se generaron las tareas
