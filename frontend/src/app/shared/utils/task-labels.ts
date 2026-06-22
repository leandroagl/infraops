import { TaskStatus, TaskType } from '../../core/models/task.models';

/** Texto legible en español para un TaskStatus. */
export function statusLabel(status: TaskStatus): string {
  const labels: Record<TaskStatus, string> = {
    PENDING:     'Pendiente',
    IN_PROGRESS: 'En curso',
    DONE:        'Listo',
    ESCALATED:   'Escalado',
    NOT_DONE:    'No hecho',
  };
  return labels[status] ?? status;
}

/** Clase CSS badge para un TaskStatus. */
export function statusBadge(status: TaskStatus): string {
  const map: Record<TaskStatus, string> = {
    PENDING:     'badge--neutral',
    IN_PROGRESS: 'badge--accent',
    DONE:        'badge--ok',
    ESCALATED:   'badge--warn',
    NOT_DONE:    'badge--crit',
  };
  return map[status] ?? 'badge--neutral';
}

/** Label corta en español para un TaskType (uso en tablas). */
export function typeLabel(type: TaskType): string {
  const labels: Record<TaskType, string> = {
    SERVER_MAINTENANCE:   'Servidores',
    QNAP_MAINTENANCE:     'QNAP/NAS',
    TERMINAL_MAINTENANCE: 'Terminales',
    SITE_VISIT:           'Visita',
    AV_CONTROL:           'Antivirus',
    UPS_CONTROL:          'UPS',
    ENDPOINT_INVENTORY:   'Inventario',
  };
  return labels[type];
}

/** Label larga en español para un TaskType (uso en drawers y listas). */
export function typeLabelLong(type: TaskType): string {
  const labels: Record<TaskType, string> = {
    SERVER_MAINTENANCE:   'Mantenimiento de servidores',
    QNAP_MAINTENANCE:     'Mantenimiento QNAP/NAS',
    TERMINAL_MAINTENANCE: 'Visita de terminales',
    SITE_VISIT:           'Visita presencial',
    AV_CONTROL:           'Control antivirus',
    UPS_CONTROL:          'Control UPS',
    ENDPOINT_INVENTORY:   'Inventario',
  };
  return labels[type];
}

/** Clase CSS badge para un TaskType según si es visita o servicio. */
export function typeBadge(type: TaskType): string {
  return type === 'TERMINAL_MAINTENANCE' || type === 'SITE_VISIT'
    ? 'badge--purple'
    : 'badge--srv';
}
