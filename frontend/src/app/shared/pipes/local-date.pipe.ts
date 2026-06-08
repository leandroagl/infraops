import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formatea una fecha ISO a formato legible en es-AR.
 * Ejemplo: "2026-03-15" → "15 mar. 2026"
 * Con format='month': "2026-03-15" → "Marzo 2026"
 */
@Pipe({ name: 'localDate' })
export class LocalDatePipe implements PipeTransform {
  transform(value: string | null | undefined, format?: 'month'): string {
    if (!value) return '';
    const [year, month, day] = value.split('T')[0].split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (format === 'month') {
      const label = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
      return label.charAt(0).toUpperCase() + label.slice(1);
    }
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}
