import { TaskType } from '../tasks/task-type.enum';

const CLOSING_NOTE = 'Ante cualquier anomalía detectada, se creará un ticket de soporte para su seguimiento y resolución.';

export const TICKET_DESCRIPTION_DEFAULTS: Record<TaskType, string> = {
  [TaskType.SERVER_HOST_MAINTENANCE]: `Control mensual preventivo sobre los hosts de virtualización ESXi y su infraestructura asociada.

Se verifican los siguientes puntos:
- Estado general del host: versión de ESXi, uptime y alertas de hardware
- Consumo de recursos: uso de CPU y memoria
- Estado de datastores: capacidad total, espacio libre y accesibilidad
- Máquinas virtuales: estado de encendido, snapshots acumulados y antigüedad, estado de VMware Tools
- Red: estado de vSwitches y NICs, velocidades de enlace

${CLOSING_NOTE}`,

  [TaskType.WINDOWS_DOMAIN_MAINTENANCE]: `Control mensual preventivo sobre la infraestructura de servidores Windows.

Se verifican los siguientes puntos:
- Estado de actualizaciones del sistema operativo (Windows Updates) en cada servidor
- Revisión de logs de eventos: errores y advertencias críticas
- Replicación de Active Directory y salud general de controladores de dominio
- Estado del servicio DNS: resolución, SRV records y zonas configuradas
- Consistencia de SYSVOL / DFSR
- Espacio en disco y rendimiento general del sistema

${CLOSING_NOTE}`,

  [TaskType.QNAP_MAINTENANCE]: `Control mensual preventivo sobre el repositorio de backups QNAP/NAS.

Se verifican los siguientes puntos:
- Estado de los discos físicos: cantidad instalada y detección de fallas o alertas por unidad
- Estado del volumen RAID: degradación, falta de sincronización o error crítico
- Capacidad de almacenamiento: espacio utilizado sobre el total disponible
- Versión de firmware del dispositivo y aplicación de actualizaciones disponibles

${CLOSING_NOTE}`,

  [TaskType.VEEAM_BACKUP]: `Control mensual preventivo sobre los trabajos de backup administrados con Veeam Backup & Replication.

Se verifican los siguientes puntos:
- Cobertura de backup por máquina virtual: job de Veeam, agente instalado o exclusión justificada
- Cantidad de backups completos (full) realizados en el mes por cada VM
- Identificación de VMs sin cobertura o con cadena de incrementales sin full base reciente

${CLOSING_NOTE}`,

  [TaskType.ROUTER_MAINTENANCE]: `Control mensual preventivo sobre routers y firewalls de la infraestructura del cliente.

Se verifican los siguientes puntos:
- Versión de firmware instalada y aplicación de actualizaciones disponibles
- Generación de backup de configuración del dispositivo

${CLOSING_NOTE}`,

  [TaskType.TERMINAL_MAINTENANCE]: 'Mantenimiento mensual de terminales.',
  [TaskType.SITE_VISIT]:           'Visita técnica presencial al cliente.',
  [TaskType.AV_CONTROL]:           'Control mensual de antivirus.',
  [TaskType.UPS_CONTROL]:          'Control mensual de equipos UPS.',
  [TaskType.ENDPOINT_INVENTORY]:   'Relevamiento de endpoints.',
};
