# Clientes

Accesible para todos los roles desde la barra lateral. Ruta: `/clients`.

Vista de todos los clientes activos con el estado de consumo de horas de suscripción del mes seleccionado.

## Navegación por mes

Las flechas `[< Mes Año >]` permiten navegar a meses anteriores. No es posible avanzar más allá del mes actual.

## KPI strip

Muestra el total de horas contratadas, entregadas y disponibles para todos los clientes del mes. El estado se desglosa en cuatro zonas:

| Zona | Criterio |
|---|---|
| **Crítico** | Sin horas entregadas (0%) |
| **Bajo** | Entregado entre 1% y 59% |
| **OK** | Entregado entre 60% y 100% |
| **Excedido** | Entregado más del 100% |

Hacer clic en una zona filtra la tabla a esa categoría.

## Filtros

- **Zona de horas:** clic en el KPI strip
- **Servicio activo:** select con los servicios registrados en InfraDoc para los clientes
- **Cliente:** select por nombre

Los filtros se combinan. El ordenamiento de la tabla es clickeable por columna (nombre, horas, estado).

## Tabla de clientes

Columnas: nombre del cliente · horas contratadas · horas entregadas · barra de avance · servicios activos

La barra de avance cambia de color según el porcentaje:
- Verde → consumo normal
- Naranja → consumo bajo o excedido

Hacer clic en una fila navega al **detalle del cliente** (`/clients/:id`).
