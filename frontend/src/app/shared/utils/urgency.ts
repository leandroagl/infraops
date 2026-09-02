/**
 * Días enteros entre hoy (medianoche local) y la fecha dada.
 * Positivo = futuro, negativo = pasado.
 */
export function daysFromToday(date: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Parsear como hora local para evitar desplazamiento por offset UTC
  const [year, month, day] = date.split('T')[0].split('-').map(Number);
  const target = new Date(year, month - 1, day, 0, 0, 0, 0);
  return Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Días restantes hasta el cierre automático del ciclo (último día del mes
 * actual). Es el único vencimiento real del lado de InfraOps — el SLA de
 * cada tarea lo maneja el helpdesk de Odoo.
 */
export function daysUntilCycleClose(): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  lastDay.setHours(0, 0, 0, 0);
  return Math.floor((lastDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** Etiqueta de urgencia legible a partir de días restantes hasta el cierre de ciclo. */
export function urgencyLabel(days: number): string {
  if (days === 0) return 'cierra hoy';
  if (days <= 7) return `cierra en ${days}d`;
  return `${days}d para el cierre`;
}

/** Clase CSS de urgencia a partir de días restantes hasta el cierre de ciclo. */
export function urgencyClass(days: number): string {
  if (days <= 7) return 'urg-warn';
  return 'urg-ok';
}
