export const TIME_PATTERN = /^[0-9]{1,2}:[0-5][0-9]$/;

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Formato legible "1:30 h" para mostrar en tablas — distinto de minutesToTime (HH:MM para forms). */
export function formatMinutes(minutes: number | null): string {
  if (minutes == null) return '— sin configurar';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${m.toString().padStart(2, '0')} h`;
}
