import { MaintenanceDeviationDto } from '../../core/models/maintenance-deviation.models';

export interface DeviationBadge {
  status: 'PENDING' | 'CONFIRMED';
  count: number;
  ticketIds: number[];
}

/** Reduce las detecciones de una tarea a un único badge — PENDING tiene prioridad sobre CONFIRMED; DISMISSED no genera badge. */
export function computeDeviationBadge(deviations: MaintenanceDeviationDto[]): DeviationBadge | null {
  const pending = deviations.filter(d => d.status === 'PENDING');
  if (pending.length > 0) {
    return { status: 'PENDING', count: pending.length, ticketIds: [] };
  }

  const confirmed = deviations.filter(d => d.status === 'CONFIRMED');
  if (confirmed.length > 0) {
    return {
      status: 'CONFIRMED',
      count: confirmed.length,
      ticketIds: confirmed.map(d => d.odooTicketId).filter((id): id is number => id != null),
    };
  }

  return null;
}
