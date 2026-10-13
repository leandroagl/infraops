# Backups

Accesible para todos los roles desde la barra lateral. Ruta: `/backups`.

Monitoreo del estado de los jobs de Veeam por cliente. Los datos se consultan en tiempo real al servidor Veeam de cada cliente.

## KPI strip

| Estado | Significado |
|---|---|
| **OK** | Todos los jobs con último resultado exitoso |
| **Warning** | Al menos un job con advertencia |
| **Crítico** | Al menos un job fallido |
| **Sin datos** | Sin conexión al servidor Veeam o sin datos |

Hacer clic en un estado filtra las cards a esa categoría. Volver a hacer clic lo quita.

## Cards de clientes

Cada cliente aparece como una card con:
- Nombre del cliente
- Indicador de estado (OK / Warning / Crítico / Sin datos)
- Conteo de jobs por resultado

Hacer clic en una card abre el **drawer de detalle** desde la derecha.

## Drawer de detalle

Muestra la lista de jobs del cliente con:

| Columna | Detalle |
|---|---|
| **Nombre** | Nombre del job en Veeam |
| **Tipo** | Tipo de job (Backup, Replication, etc.) |
| **Último resultado** | Success / Warning / Failed |
| **Hace cuánto** | Horas desde la última ejecución |
| **En ejecución** | Indicador si el job está corriendo en este momento |

El botón **"Actualizar"** en el drawer recarga los datos de ese cliente sin recargar toda la vista.

## Configuración (solo ADMIN)

El botón **"Ir a configuración"** lleva a Admin → Backups, donde se registra el host y credenciales del servidor Veeam de cada cliente.
