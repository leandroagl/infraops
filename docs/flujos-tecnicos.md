# Flujos técnicos de InfraOps

> Este documento describe cómo funciona cada tipo de tarea de mantenimiento: qué hace el sistema automáticamente y qué hace el técnico. Se actualiza a medida que se incorporan nuevas funcionalidades.

---

## Flujo común: integración con Odoo

Todos los tipos de tarea comparten el mismo comportamiento con Odoo Helpdesk:

1. **Apertura del ticket**: al crear la tarea en InfraOps, el sistema abre automáticamente un ticket en Odoo asignado al técnico responsable y vinculado al cliente, con una descripción predefinida según el tipo de mantenimiento.

2. **Inicio del trabajo**: cuando el técnico comienza la tarea, el ticket pasa automáticamente al estado "En curso" en Odoo.

3. **Cierre**: al completar la tarea, InfraOps cierra el ticket y registra las horas trabajadas en el timesheet del técnico. Este paso utiliza las credenciales personales de Odoo de cada técnico, que deben estar configuradas en su perfil de InfraOps.

---

## Tabla comparativa

| Tipo de tarea | Inventario del cliente | Automatización | Rol del técnico |
|---|---|---|---|
| Hosts VMware / BMC | InfraDoc | Script conecta al host ESXi y obtiene métricas en tiempo real | Revisar datos precargados + completar sección de hardware físico |
| Dominio Windows | InfraDoc | Ninguna | Ejecutar diagnósticos en el controlador de dominio |
| QNAP / NAS | InfraDoc | Ninguna | Ingresar datos desde la interfaz web del QNAP |
| Backups Veeam | — | Ninguna | Revisar la consola de Veeam |
| Router / Firewall | InfraDoc | Ninguna | Verificar firmware y backup de configuración |

> **InfraDoc** es el sistema de inventario de infraestructura de ONDRA. InfraOps lo consulta en tiempo real al abrir cada tarea para saber qué dispositivos tiene el cliente.

---

## Hosts VMware / BMC

Control mensual preventivo sobre los hosts de virtualización de la infraestructura del cliente.

**Inventario del cliente**
InfraOps consulta InfraDoc para obtener la lista de hosts ESXi del cliente (nombre y dirección de acceso).

**Automatización**
Por cada host ESXi, InfraOps ejecuta automáticamente un script que se conecta directamente al host a través de la API oficial de VMware. El script recopila en tiempo real:

- Estado general del host y versión de ESXi instalada
- Uso de CPU y memoria
- Estado y espacio disponible en los datastores (almacenamiento)
- Estado de las máquinas virtuales: encendidas, apagadas, snapshots acumulados y su antigüedad
- Estado de VMware Tools en cada VM
- Estado de la red: switches virtuales y velocidad de los enlaces físicos

Estos datos se precargan en el formulario antes de que el técnico interactúe con él.

**Tarea del técnico**
Revisar los datos precargados y agregar observaciones si corresponde. Además, completar manualmente la sección de **hardware físico (BMC/iDRAC)**: alertas de sensores (temperatura, fuentes de alimentación, ventiladores), versiones de firmware del servidor físico. Esta información no puede obtenerse a través de VMware y requiere acceso a la interfaz de administración del hardware.

**Qué queda registrado**
Un log en InfraOps con todos los valores del host (automatizados y manuales), vinculado a la tarea y al cliente. El ticket de Odoo se cierra con las horas trabajadas.

---

## Dominio Windows

Control mensual sobre los servidores Windows y el estado del dominio Active Directory.

**Inventario del cliente**
InfraOps consulta InfraDoc para obtener la lista de servidores Windows del cliente.

**Automatización**
Ninguna. Todos los controles los ejecuta el técnico de forma manual.

**Tarea del técnico**
El técnico se conecta al entorno del cliente y realiza los siguientes controles:

- **Estado de actualizaciones** en cada servidor Windows: verifica si hay actualizaciones pendientes o fallidas.
- **Script de reinicios programados**: en el controlador de dominio existe un script preconfigurado ubicado en `C:\SCRIPTS` que el técnico ejecuta para verificar el estado de los reinicios automáticos. El resultado puede ser: correcto, con error, o pendiente de configurar.
- **DCDiag**: el técnico ejecuta esta herramienta de diagnóstico de Windows directamente en el controlador de dominio para verificar la salud general del Active Directory: replicación, DNS, SYSVOL/DFSR y otros servicios críticos.

**Qué queda registrado**
El resultado de cada servidor (actualizaciones, estado del script de reinicios) y el resultado del DCDiag, junto con las observaciones del técnico. El ticket de Odoo se cierra con las horas trabajadas.

---

## QNAP / NAS

Control mensual sobre el repositorio de backups QNAP o NAS del cliente.

**Inventario del cliente**
InfraOps consulta InfraDoc para obtener los dispositivos QNAP o NAS del cliente.

**Automatización**
Ninguna. El técnico accede directamente a la interfaz web de administración del dispositivo.

**Tarea del técnico**
Desde la interfaz web del QNAP, el técnico verifica y registra en InfraOps:

- Estado de cada disco físico instalado
- Estado del volumen RAID: si está en buen estado, degradado o con falla
- Capacidad de almacenamiento utilizada sobre el total disponible
- Versión de firmware del dispositivo y si hay una actualización disponible

**Qué queda registrado**
El estado de cada dispositivo QNAP del cliente. El ticket de Odoo se cierra con las horas trabajadas.

---

## Backups Veeam

Control mensual sobre la cobertura y estado de los backups administrados con Veeam Backup & Replication.

**Inventario del cliente**
No se consulta InfraDoc. La fuente de información es la propia consola de Veeam, que muestra todas las máquinas virtuales y sus jobs de backup.

**Automatización**
Ninguna. El técnico accede directamente a la consola de Veeam.

**Tarea del técnico**
Desde la consola de Veeam, el técnico verifica:

- Qué máquinas virtuales tienen un job de Veeam activo, cuáles tienen un agente instalado, y cuáles están excluidas del backup con justificación
- Cantidad de backups completos realizados en el mes por cada VM
- VMs sin cobertura o con cadenas de backups incrementales sin un backup completo reciente como base

**Qué queda registrado**
El estado de cobertura de cada VM (cubierta por job, por agente, excluida o sin cobertura) con el recuento de backups del mes. El ticket de Odoo se cierra con las horas trabajadas.

---

## Router / Firewall

Control mensual sobre routers y firewalls de la infraestructura del cliente.

**Inventario del cliente**
InfraOps consulta InfraDoc para obtener los routers y firewalls del cliente.

**Automatización**
Ninguna. El técnico accede directamente a la interfaz de administración de cada dispositivo.

**Tarea del técnico**
Por cada router o firewall, el técnico verifica y registra:

- Versión de firmware instalada actualmente
- Si se aplicó una actualización de firmware disponible
- Si se generó y descargó un backup de la configuración del dispositivo

**Qué queda registrado**
El estado de cada dispositivo: versión de firmware y si el backup de configuración fue realizado. El ticket de Odoo se cierra con las horas trabajadas.
