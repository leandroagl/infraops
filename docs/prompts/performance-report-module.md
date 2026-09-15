# Módulo de reportes de desempeño — Performance Report

## Qué es y por qué existe

InfraOps necesita un módulo que automatice la generación de evidencia para las evaluaciones de desempeño semestrales del equipo técnico de ONDRA. Hoy el coordinador extrae datos manualmente desde Odoo → Excel → normaliza → cruza → arma el informe. Este módulo elimina ese proceso.

El reporte se genera enteramente desde Odoo on-demand. No se cachean datos en InfraOps.

## Contexto de la evaluación de desempeño

La planilla de evaluación tiene 4 secciones:

| Sección | Fuente | Automatizable |
|---|---|---|
| Datos semestre (horas, SLA, calificación, ausentismo, puntualidad) | Odoo + RRHH | Parcial (horas/SLA/calificación sí; ausentismo/puntualidad no) |
| Competencias (soft skills) | Subjetivo | No — el evaluador pone la nota |
| Tareas (gestión técnica, proactiva, proyectos, admin, comercial) | Tickets Odoo con etiquetas | Sí — la evidencia es automática, la nota la pone el evaluador |
| Tareas TO (liderazgo, ownership, proyectos) | Tickets Odoo con etiquetas | Sí — ídem |

## Cómo funciona Odoo para este caso

### Hub central: `account.analytic.line`

Todo el trabajo de un técnico —sea en helpdesk o en proyectos— termina en `account.analytic.line`. Campos clave:
- `employee_id` → el técnico
- `unit_amount` → horas imputadas
- `date` → cuándo
- `helpdesk_ticket_id` → si vino de helpdesk (con `team_id` del ticket para saber el equipo)
- `task_id` → si vino de un proyecto (con `project_id`)

Con un filtro por `employee_id` + rango de fechas se obtiene TODO el trabajo del técnico en el período, sin importar en qué helpdesk team o proyecto fue. Es posible buscar en todos los proyectos y grupos de helpdesk simultáneamente desde esta única tabla.

### Modelos que se cruzan

```
account.analytic.line          ← hub principal (timesheets)
  └─ helpdesk_ticket_id →  helpdesk.ticket
                               ├─ team_id              (distingue helpdesk de proyectos)
                               ├─ tag_ids              (etiquetas de clasificación)
                               ├─ priority             (para horas por prioridad)
                               └─ sla_status_ids →  helpdesk.sla.status
  └─ task_id →             project.task
                               ├─ project_id
                               └─ tag_ids
```

### Datos automáticos disponibles por técnico en un período

1. **Horas totales imputadas** — `account.analytic.line` por `employee_id`
2. **% SLA cumplido** — `helpdesk.sla.status` linkado a los tickets
3. **Calificación del cliente** — `rating_ids` en tickets (si el módulo está activo)
4. **Tickets agrupados por etiqueta** — base de la evidencia por criterio de evaluación
5. **Tickets sin etiqueta** — señal de alerta de gestión administrativa (hoy Laura los lista manualmente)
6. **Horas por prioridad** — cruzando `helpdesk.ticket.priority` con `account.analytic.line`

### Restricciones del XML-RPC

Odoo XML-RPC no hace JOINs nativos. El flujo de queries es:
1. Query `account.analytic.line` → obtener IDs de tickets y tareas
2. Query `helpdesk.ticket` por esos IDs → obtener tags, priority, team_id
3. Query `project.task` por esos IDs → obtener tags, project_id
4. Query `helpdesk.sla.status` → compliance por ticket
5. Todo el cruce se hace en código (en el service de NestJS)

## Arquitectura del módulo

### Dos vistas principales

**Tab "Reporte":**
- Selector: técnico + período (mensual o semestral)
- Botón "Generar reporte" → llama al backend que consulta Odoo
- 5 KPIs: horas imputadas, % SLA, tickets totales, tickets sin etiqueta (warn), calificación cliente
- Master-detail: lista de criterios a la izquierda → detalle a la derecha
  - Cada criterio muestra: etiquetas configuradas, tickets de evidencia, horas, SLA parcial
  - Sección warning: lista de tickets sin etiqueta (actualmente se hace a mano)
  - Selector de nota 1-5 (el evaluador la pone, puede ser sugerida automáticamente)
  - Campo de notas del evaluador

**Tab "Configuración de criterios":**
- El coordinador (Laura) mapea etiquetas de Odoo a criterios de evaluación
- Por criterio: qué etiquetas, fuente (helpdesk/proyectos/ambos), umbrales de nota sugerida
- Las reglas viven en la DB de InfraOps, no en el código
- Se puede configurar nota sugerida automática basada en % de tickets sin etiqueta

### Badges en la lista de criterios
- `auto` → toda la evidencia viene de Odoo
- `manual` → no tiene origen en Odoo (ej: ausentismo, puntualidad)
- `mixto` → Odoo aporta evidencia pero la nota requiere juicio del evaluador

## Mockup de referencia

`docs/mockups/performance-report-v1.html`

## Lo que NO se automatiza

- **Ausentismo y puntualidad** — sistema de fichada, ajeno a Odoo
- **La nota final de cualquier criterio** — siempre la pone el evaluador; el sistema sugiere basado en datos
- **Competencias (soft skills)** — subjetivas por definición

## Decisiones de diseño tomadas

- Las reglas de mapeo etiqueta → criterio viven en la DB de InfraOps (tabla configurable por coordinador), no hardcodeadas
- El reporte se genera on-demand, no hay snapshot ni caché
- La nota sugerida es orientativa; el evaluador siempre puede overridear
- Los tickets sin etiqueta se muestran como lista clickeable tipo warning (exactamente los que hoy lista Laura manualmente)
- Mismo patrón visual que el resto del sistema: dark theme, master-detail drawer

## Pendiente de definir antes de implementar

- Estructura de la tabla de configuración en DB (criterios, etiquetas, umbrales, fuente)
- Si el módulo de ratings de Odoo Helpdesk está activo (para calificación del cliente)
- Roles que acceden: coordinador puede configurar y generar; admins también; técnicos ¿ven su propio reporte?
- ¿Exportar reporte a PDF o solo visualización en app?
- Ruta de la vista (`/reports` standalone o sección dentro de `/admin`)
