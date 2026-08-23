# Coordinación de visitas

> Esta sección aplica a roles **TL**, **COORDINATOR** y **ADMIN**.

## Flujo de visita presencial

1. InfraOps genera la tarea de visita
2. TL asigna técnico
3. COORDINATOR coordina fecha y hora con el cliente
4. Se abre ticket en Odoo (SLA extendido) → estado **PENDIENTE**

## Si la visita no se concreta

- Sin horas disponibles o cancelada por el cliente:
  1. Cerrar ticket Odoo sin remito + registrar motivo
  2. Marcar tarea como **NO REALIZADO** con el motivo

## Si la visita se realiza

1. Técnico va al cliente y ejecuta el mantenimiento de terminales
2. Si hay problemas sin tiempo para resolver: abrir nuevo ticket HD remoto y registrar en el drawer
3. Cerrar ticket original con número de remito → estado **HECHO**
4. Post-cierre: actualizar métricas y generar reporte
