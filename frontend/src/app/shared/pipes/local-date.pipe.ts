import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formatea una fecha ISO a formato legible en es-AR.
 * Ejemplo: "2026-03-15" → "15 mar. 2026"
 */
@Pipe({ name: 'localDate' })
export class LocalDatePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';
    // Parsear YYYY-MM-DD como hora local para evitar desplazamiento por offset UTC
    const [year, month, day] = value.split('T')[0].split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}
