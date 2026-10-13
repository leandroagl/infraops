import { toBackupJobStatus } from './acronis.mapper';
import type { AcronisPlanStatus, AcronisResourceStatus, AcronisThresholds } from './dto/acronis-api.dto';

const NOW = new Date('2026-10-13T12:00:00.000Z');
const TH: AcronisThresholds = { staleWarningHours: 26, staleErrorHours: 48 };

const res = (over: Partial<AcronisResourceStatus>): AcronisResourceStatus => ({
  resourceId: over.name ?? 'r', name: 'VM1', type: 'machine', severity: 'ok', hoursSinceOk: 2,
  latestCode: 'ok', latestAt: '2026-10-13T10:00:00.000Z', ...over,
});
const plan = (resources: AcronisResourceStatus[], over: Partial<AcronisPlanStatus> = {}): AcronisPlanStatus => ({
  policyId: 'pol-1', policyName: 'Plan Demo', tenantId: 't1', tenantName: 'Cliente Demo',
  lastRunAt: '2026-10-13T10:00:00.000Z', resources, ...over,
});

describe('toBackupJobStatus', () => {
  beforeEach(() => { jest.useFakeTimers().setSystemTime(NOW); });
  afterEach(() => { jest.useRealTimers(); });

  it('mapea plan → job: id, nombre, tipo y horas desde la última corrida', () => {
    const job = toBackupJobStatus(plan([res({})]), TH);
    expect(job).toMatchObject({
      jobId: 'pol-1', jobName: 'Plan Demo', jobType: 'Acronis', isRunning: false,
      lastResult: 'Success', lastMessage: null, lastRunAt: '2026-10-13T10:00:00.000Z', hoursAgo: 2, isStale: false,
    });
  });

  it('lastResult es el peor de los recursos: warning → Warning, error → Failed', () => {
    expect(toBackupJobStatus(plan([res({}), res({ name: 'B', severity: 'warning', latestCode: 'warning' })]), TH).lastResult).toBe('Warning');
    expect(toBackupJobStatus(plan([res({ severity: 'warning' }), res({ name: 'B', severity: 'error', latestCode: 'error' })]), TH).lastResult).toBe('Failed');
  });

  it('el mensaje resume los recursos con problema (hasta 5 y "y N más")', () => {
    const many = Array.from({ length: 7 }, (_, i) => res({ name: `VM${i}`, severity: 'error', latestCode: 'error', hoursSinceOk: 49 }));
    const job = toBackupJobStatus(plan([res({ name: 'Sano' }), ...many]), TH);
    expect(job.lastMessage).toBe('7 de 8 recurso(s) con problema: VM0, VM1, VM2, VM3, VM4 y 2 más');
  });

  it('items solo trae los recursos no agregados, con su resultado', () => {
    const job = toBackupJobStatus(plan([
      res({ name: 'VM-A' }), res({ name: 'VM-B', severity: 'error', latestCode: 'error', hoursSinceOk: 49 }),
    ]), TH);
    expect(job.items?.map(i => [i.name, i.result])).toEqual([['VM-A', 'Success'], ['VM-B', 'Failed']]);
    expect(job.items?.[1]).toMatchObject({ itemId: 'VM-B', type: 'machine', lastCode: 'error', hoursSinceOk: 49 });
    expect(job.aggregate).toBeNull();
  });

  it('los recursos M365 van agregados en conteos y no en items', () => {
    const job = toBackupJobStatus(plan([
      res({ name: 'Buzón 1', type: 'MAILBOX' }),
      res({ name: 'Buzón 2', type: 'MAILBOX', severity: 'warning', latestCode: 'warning' }),
      res({ name: 'Buzón 3', type: 'MAILBOX', severity: 'error', hoursSinceOk: 768 }),
      res({ name: 'Equipo 1', type: 'TEAM' }),
    ]), TH);
    expect(job.items).toEqual([]);
    expect(job.aggregate).toEqual({ total: 4, okCount: 2, warnCount: 1, critCount: 1, worst: ['Buzón 3', 'Buzón 2'] });
    expect(job.lastResult).toBe('Failed');
  });

  it('plan mixto: VMs en items y M365 en aggregate', () => {
    const job = toBackupJobStatus(plan([res({ name: 'VM' }), res({ name: 'Buzón', type: 'MAILBOX' })]), TH);
    expect(job.items?.length).toBe(1);
    expect(job.aggregate?.total).toBe(1);
  });

  it('isStale: un recurso cuya última corrida fue ok pero hace más de 26h; no por fallo duro', () => {
    const viejo = res({ severity: 'warning', hoursSinceOk: 30 });
    expect(toBackupJobStatus(plan([viejo]), TH).isStale).toBe(true);
    const fallo = res({ severity: 'error', latestCode: 'error', hoursSinceOk: 49 });
    expect(toBackupJobStatus(plan([fallo]), TH).isStale).toBe(false);
  });

  it('sin lastRunAt las horas quedan en null', () => {
    const job = toBackupJobStatus(plan([res({})], { lastRunAt: null }), TH);
    expect(job.hoursAgo).toBeNull();
  });
});
