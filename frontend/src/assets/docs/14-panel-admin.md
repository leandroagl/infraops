# Panel Admin

> Esta sección aplica únicamente al rol **ADMIN**.

Acceso: barra lateral → Admin. Ruta: `/admin`.

El panel admin agrupa toda la configuración del sistema en pestañas.

## Usuarios

Gestión de usuarios internos de InfraOps. Ver sección **Gestión de usuarios** para el detalle completo.

## Sync

Sincronización manual de datos desde sistemas externos (Odoo, InfraDoc). Permite forzar una sincronización fuera del ciclo automático.

## Integraciones

Credenciales de conexión para los sistemas integrados:

| Integración | Qué se configura |
|---|---|
| **Odoo** | URL, base de datos, usuario, API key |
| **InfraDoc** | URL, API key |
| **VMware** | Usuario y contraseña del host ESXi |
| **Veeam** | Usuario y contraseña globales del servidor Veeam |

Cada card tiene un botón **"Probar conexión"** que verifica la conectividad sin guardar. Las credenciales se almacenan cifradas en la base de datos.

## Mantenimientos

Configuración por tipo de tarea: nombre de la tarea en Odoo, tiempo estimado en minutos, descripción del ticket y descripción para el timesheet. Se usa al abrir tickets en Odoo desde el flujo de mantenimiento.

## Vencimientos

Configuración de la creación automática de tickets por tipo de vencimiento:

| Campo | Descripción |
|---|---|
| **Habilitado** | Si está apagado, nunca se generan tickets para ese tipo |
| **Equipo Odoo** | Equipo de helpdesk donde se crea el ticket |
| **Días de anticipación** | Cuántos días antes del vencimiento activar la creación |
| **Tags** | Tags que se agregan al ticket en Odoo |

Al activar un tipo por primera vez, no se generan tickets para vencimientos ya existentes — solo para los que aparezcan a partir de ese momento.

## Backups

Configuración de la conexión al servidor Veeam de cada cliente:

| Campo | Descripción |
|---|---|
| **Host** | IP o nombre del servidor Veeam |
| **Puerto** | Puerto de la API REST de Veeam |
| **Habilitado** | Si está desactivado, el cliente no aparece en la vista Backups |

El botón **"Probar conexión"** verifica la conectividad con el servidor Veeam del cliente sin guardar.
