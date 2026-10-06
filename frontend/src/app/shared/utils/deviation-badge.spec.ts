import { MaintenanceDeviationDto } from '../../core/models/maintenance-deviation.models';
import { computeDeviationBadge } from './deviation-badge';

function makeDeviation(overrides: Partial<MaintenanceDeviationDto> = {}): MaintenanceDeviationDto {
  return {
    id: 'dev-1',
    logId: 'log-1',
    taskId: 'task-1',
    ruleId: 'rule-1',
    taskType: 'QNAP_MAINTENANCE',
    signalKey: 'maxUsedSpacePct',
    operator: 'gt',
    thresholdNumber: 90,
    thresholdBoolean: null,
    detectedValueNumber: 95,
    detectedValueBoolean: null,
    helpdeskTeamId: 7,
    tagIds: [],
    status: 'PENDING',
    detectedAt: '2026-06-01T00:00:00Z',
    resolvedAt: null,
    resolvedByUserId: null,
    odooTicketId: null,
    ...overrides,
  };
}

describe('computeDeviationBadge', () => {
  it('devuelve null si no hay detecciones', () => {
    expect(computeDeviationBadge([])).toBeNull();
  });

  it('devuelve PENDING si hay al menos una detección pendiente', () => {
    const badge = computeDeviationBadge([
      makeDeviation({ status: 'CONFIRMED', odooTicketId: 1 }),
      makeDeviation({ id: 'dev-2', status: 'PENDING' }),
    ]);
    expect(badge).toEqual({ status: 'PENDING', count: 1, ticketIds: [] });
  });

  it('cuenta todas las pendientes cuando hay más de una', () => {
    const badge = computeDeviationBadge([
      makeDeviation({ status: 'PENDING' }),
      makeDeviation({ id: 'dev-2', status: 'PENDING' }),
    ]);
    expect(badge?.count).toBe(2);
  });

  it('devuelve CONFIRMED con los ticketIds si no hay pendientes pero sí confirmadas', () => {
    const badge = computeDeviationBadge([
      makeDeviation({ status: 'CONFIRMED', odooTicketId: 123 }),
      makeDeviation({ id: 'dev-2', status: 'DISMISSED' }),
    ]);
    expect(badge).toEqual({ status: 'CONFIRMED', count: 1, ticketIds: [123] });
  });

  it('devuelve null si todas las detecciones están descartadas', () => {
    const badge = computeDeviationBadge([
      makeDeviation({ status: 'DISMISSED' }),
    ]);
    expect(badge).toBeNull();
  });

  it('PENDING tiene prioridad sobre CONFIRMED', () => {
    const badge = computeDeviationBadge([
      makeDeviation({ status: 'CONFIRMED', odooTicketId: 1 }),
      makeDeviation({ id: 'dev-2', status: 'PENDING' }),
    ]);
    expect(badge?.status).toBe('PENDING');
  });
});
