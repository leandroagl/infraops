# Notificaciones in-app

El icono de campana en la toolbar superior muestra las notificaciones no leídas del sistema.

## Badge

Un badge rojo con número indica cuántas notificaciones nuevas hay. Desaparece cuando todas están leídas.

## Panel de notificaciones

Hacer clic en la campana abre un panel con la lista de notificaciones pendientes. Cada notificación muestra:
- Título y descripción del evento
- Cuándo fue generada

## Acciones

- **Clic en una notificación** → marca como leída y la elimina del panel
- **"Marcar todas como leídas"** → limpia todas de una vez

Las notificaciones se eliminan del panel inmediatamente (actualización optimista). Si el servidor no confirma el cambio, reaparecerán en el próximo ciclo de actualización.

## Actualización automática

El panel se actualiza automáticamente cada **60 segundos** en segundo plano mientras la aplicación está abierta.

## Qué genera notificaciones

Actualmente, las notificaciones se crean cuando el cron diario genera un **ticket de vencimiento** en Odoo (licencia, garantía, dominio o certificado dentro de la ventana configurada).
