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

/** Etiqueta de urgencia legible a partir de días. */
export function urgencyLabel(days: number): string {
  if (days < 0) return `+${Math.abs(days)}d vencido`;
  if (days <= 7) return `vence en ${days}d`;
  return `${days}d restantes`;
}

/** Clase CSS de urgencia a partir de días. */
export function urgencyClass(days: number): string {
  if (days < 0) return 'urg-crit';
  if (days <= 7) return 'urg-warn';
  return 'urg-ok';
}
