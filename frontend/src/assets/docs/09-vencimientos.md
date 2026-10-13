# Vencimientos

Accesible para todos los roles desde la barra lateral. Ruta: `/notifications`.

Muestra todos los ítems próximos a vencer o ya vencidos: licencias de software, garantías de equipos, dominios y certificados. Los datos provienen de InfraDoc en tiempo real.

## KPI strip

| Zona | Color | Criterio |
|---|---|---|
| **Vencidos** | Rojo | Fecha ya pasada |
| **Esta semana** | Rojo | Vence en 0–7 días |
| **Próximos** | Naranja | Vence en 8–20 días |
| **Atención** | Azul | Vence en 21–45 días |

Hacer clic en una zona filtra la tabla a esa urgencia. Volver a hacer clic la quita.

## Filtros

- **Cliente:** select con todos los clientes con ítems activos
- **Tipo:** Garantía · Certificado · Dominio · Licencia

Los filtros se combinan con el filtro de zona del KPI strip.

## Tabla

Columnas: cliente · nombre del ítem · tipo · fecha de vencimiento · días restantes

Cada fila muestra:
- Un **badge de urgencia** con color según la zona (rojo/naranja/azul/gris)
- Si hay un **ticket Odoo** ya creado: badge con el número de ticket (enlace directo)
- Si el ítem está dentro de la ventana configurada y **no tiene ticket**: indicador "Ticket pendiente" en gris

El badge de ticket confirma que el proceso automático ya generó el ticket en Odoo.

## Configuración (solo ADMIN)

El botón **"Ir a configuración"** en la parte superior lleva a Admin → Vencimientos, donde se configura para qué tipos crear tickets automáticamente y con qué parámetros.
