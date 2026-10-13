import * as fs from 'fs';
import * as path from 'path';
import {
  parseAcronisTimestamp, isBackupTask, groupByPlan, evaluateResources, evaluateActivityResources,
  summarizeResources, isAggregatedType,
} from './acronis.evaluation';
import type { AcronisActivity, AcronisTask, AcronisThresholds } from './dto/acronis-api.dto';

const fixture = <T>(name: string): T =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../test/fixtures/acronis', name), 'utf-8')) as T;

const NOW = new Date('2026-10-13T12:00:00.000Z');
const TH: AcronisThresholds = { staleWarningHours: 26, staleErrorHours: 48 };
const hoursAgoIso = (h: number) => new Date(NOW.getTime() - h * 3600000).toISOString();

const task = (over: {
  rid?: string; rname?: string; rtype?: string; code?: string; hoursAgo?: number;
  policyId?: string; policyType?: string; hasChildren?: boolean;
}): AcronisTask => ({
  id: 1,
  policy: { id: over.policyId ?? 'pol-1', type: over.policyType ?? 'backup', name: 'Plan' },
  resource: { id: over.rid ?? 'r1', type: over.rtype ?? 'machine', name: over.rname ?? 'VM1' },
  tenant: { id: 't1', name: 'Cliente' },
  result: { code: over.code ?? 'ok' },
  completedAt: hoursAgoIso(over.hoursAgo ?? 1),
  ...(over.hasChildren ? { context: { HasChildren: true } } : {}),
});

describe('acronis.evaluation', () => {
  beforeEach(() => { jest.useFakeTimers().setSystemTime(NOW); });
  afterEach(() => { jest.useRealTimers(); });

  describe('parseAcronisTimestamp', () => {
    it('parsea nanosegundos con sufijo Z', () => {
      const d = parseAcronisTimestamp('2026-10-13T11:45:57.720031579Z');
      expect(d?.toISOString()).toBe('2026-10-13T11:45:57.720Z');
    });
    it('parsea sin fracción y con offset', () => {
      expect(parseAcronisTimestamp('2026-10-13T11:45:57Z')?.toISOString()).toBe('2026-10-13T11:45:57.000Z');
      expect(parseAcronisTimestamp('2026-10-13T08:45:57-03:00')?.toISOString()).toBe('2026-10-13T11:45:57.000Z');
    });
    it('devuelve null para vacío o formato inválido', () => {
      expect(parseAcronisTimestamp(undefined)).toBeNull();
      expect(parseAcronisTimestamp('')).toBeNull();
      expect(parseAcronisTimestamp('ayer')).toBeNull();
    });
  });

  describe('isBackupTask', () => {
    it('acepta policy.type "backup" y "policy.protection.total" con policy y resource', () => {
      expect(isBackupTask(task({ policyType: 'backup' }))).toBe(true);
      expect(isBackupTask(task({ policyType: 'policy.protection.total' }))).toBe(true);
    });
    it('descarta antimalware y vulnerability assessment aunque traigan policy y resource', () => {
      expect(isBackupTask(task({ policyType: 'policy.security.antimalware_protection' }))).toBe(false);
      expect(isBackupTask(task({ policyType: 'policy.security.vulnerability_assessment' }))).toBe(false);
    });
    it('descarta tasks sin policy o sin resource', () => {
      expect(isBackupTask({ ...task({}), policy: undefined })).toBe(false);
      expect(isBackupTask({ ...task({}), resource: undefined })).toBe(false);
    });
    it('sobre el sample anonimizado deja solo los tasks de backup (descarta catalog_index)', () => {
      const items = fixture<{ items: AcronisTask[] }>('tasks.sample.json').items;
      const backups = items.filter(isBackupTask);
      expect(items.length).toBe(11);
      expect(backups.length).toBe(9);
      expect(backups.every(t => t.policy && t.resource)).toBe(true);
    });
  });

  describe('groupByPlan', () => {
    it('agrupa por policy.id (los nombres pueden colisionar entre clientes)', () => {
      const a = { ...task({ policyId: 'p-a' }), policy: { id: 'p-a', type: 'backup', name: 'El Tobiano' }, tenant: { id: '1', name: 'Cliente A' } };
      const b = { ...task({ policyId: 'p-b' }), policy: { id: 'p-b', type: 'backup', name: 'El Tobiano' }, tenant: { id: '2', name: 'Cliente B' } };
      const plans = groupByPlan([a, b, a]);
      expect(plans.size).toBe(2);
      expect(plans.get('p-a')?.tasks.length).toBe(2);
      expect(plans.get('p-b')?.tenantName).toBe('Cliente B');
    });
  });

  describe('evaluateResources', () => {
    it('ok: último resultado ok y reciente', () => {
      const [r] = evaluateResources([task({ code: 'ok', hoursAgo: 3 })], TH);
      expect(r.severity).toBe('ok');
      expect(r.hoursSinceOk).toBe(3);
      expect(r.latestCode).toBe('ok');
    });

    it('warning: último resultado "warning" aunque sea reciente; cuenta como corrida para la antigüedad', () => {
      const [r] = evaluateResources([task({ code: 'warning', hoursAgo: 2 })], TH);
      expect(r.severity).toBe('warning');
      expect(r.hoursSinceOk).toBe(2);
    });

    it('warning: último ok pero más viejo que el umbral de 26h', () => {
      const [r] = evaluateResources([task({ code: 'ok', hoursAgo: 30 })], TH);
      expect(r.severity).toBe('warning');
    });

    it('error: último ok más viejo que 48h aunque no haya errores recientes (backup que dejó de correr)', () => {
      const [r] = evaluateResources([task({ code: 'ok', hoursAgo: 32 * 24 })], TH);
      expect(r.severity).toBe('error');
      expect(r.hoursSinceOk).toBe(768);
    });

    it('error: fallo duro más reciente, y la antigüedad sale del último ok anterior', () => {
      const tasks = [task({ code: 'error', hoursAgo: 1 }), task({ code: 'ok', hoursAgo: 25 })];
      const [r] = evaluateResources(tasks, TH);
      expect(r.severity).toBe('error');
      expect(r.latestCode).toBe('error');
      expect(r.hoursSinceOk).toBe(49); // staleError + 1: sentinel de fallo duro
    });

    it('error: cancelled, abandoned y timedout cuentan como fallo', () => {
      for (const code of ['cancelled', 'abandoned', 'timedout']) {
        expect(evaluateResources([task({ code, hoursAgo: 1 })], TH)[0].severity).toBe('error');
      }
    });

    it('error: nunca hubo ok/warning', () => {
      const [r] = evaluateResources([task({ code: 'cancelled', hoursAgo: 2 })], TH);
      expect(r.severity).toBe('error');
    });

    it('toma el task más reciente (orden desc) como último resultado y el primer ok/warning como last_ok', () => {
      const tasks = [task({ code: 'ok', hoursAgo: 2 }), task({ code: 'error', hoursAgo: 26 }), task({ code: 'ok', hoursAgo: 50 })];
      const [r] = evaluateResources(tasks, TH);
      expect(r.severity).toBe('ok');
      expect(r.hoursSinceOk).toBe(2);
    });

    it('agrupa por resource.id y ordena por nombre', () => {
      const tasks = [task({ rid: 'b', rname: 'Zeta' }), task({ rid: 'a', rname: 'Alfa' }), task({ rid: 'b', rname: 'Zeta', hoursAgo: 5 })];
      const res = evaluateResources(tasks, TH);
      expect(res.map(r => r.name)).toEqual(['Alfa', 'Zeta']);
    });

    it('respeta umbrales configurables', () => {
      const [r] = evaluateResources([task({ code: 'ok', hoursAgo: 10 })], { staleWarningHours: 6, staleErrorHours: 9 });
      expect(r.severity).toBe('error');
    });

    it('sobre el sample anonimizado: todos los mailboxes ok y recientes salen ok', () => {
      jest.setSystemTime(new Date('2026-10-13T12:00:00Z'));
      const backups = fixture<{ items: AcronisTask[] }>('tasks.sample.json').items.filter(isBackupTask);
      const mailboxes = backups.filter(t => t.resource?.type === 'MAILBOX');
      const res = evaluateResources(mailboxes, TH);
      expect(res.length).toBeGreaterThan(0);
      expect(res.every(r => r.severity === 'ok')).toBe(true);
    });
  });

  describe('evaluateActivityResources', () => {
    const acts = fixture<{ items: AcronisActivity[] }>('activities.sample.json').items;
    const agentId = acts[0].resource?.id as string;

    it('agrupa por la VM real de cada actividad y excluye la actividad del agente raíz', () => {
      const res = evaluateActivityResources(acts, agentId, parseAcronisTimestamp(hoursAgoIso(3)), TH);
      expect(res.map(r => r.name)).toEqual(['VM-DEMO-01', 'VM-DEMO-02', 'VM-DEMO-03']);
    });

    it('severidad por códigos de las hijas: ok / warning / error', () => {
      const res = evaluateActivityResources(acts, agentId, parseAcronisTimestamp(hoursAgoIso(3)), TH);
      expect(res.map(r => r.severity)).toEqual(['ok', 'warning', 'error']);
      expect(res[0].hoursSinceOk).toBe(3);
      expect(res[2].hoursSinceOk).toBe(49);
    });

    it('la antigüedad de una corrida vieja degrada a warning y luego a error', () => {
      const ok: AcronisActivity[] = [{ resource: { id: 'v1', type: 'machine', name: 'V1' }, result: { code: 'ok' } }];
      expect(evaluateActivityResources(ok, 'agent', parseAcronisTimestamp(hoursAgoIso(30)), TH)[0].severity).toBe('warning');
      expect(evaluateActivityResources(ok, 'agent', parseAcronisTimestamp(hoursAgoIso(60)), TH)[0].severity).toBe('error');
    });

    it('sin completedAt todo recurso queda en error (antigüedad desconocida)', () => {
      const ok: AcronisActivity[] = [{ resource: { id: 'v1', type: 'machine', name: 'V1' }, result: { code: 'ok' } }];
      expect(evaluateActivityResources(ok, 'agent', null, TH)[0].severity).toBe('error');
    });
  });

  describe('isAggregatedType / summarizeResources', () => {
    it('MAILBOX, TEAM y SITE se agregan; el resto (incluidos tipos nuevos) no', () => {
      expect(['MAILBOX', 'TEAM', 'SITE'].every(isAggregatedType)).toBe(true);
      expect(['instance', 'machine', 'virtual_machine.vmwesx', 'tipo.nuevo'].some(isAggregatedType)).toBe(false);
    });

    it('cuenta ok/warning/error y lista hasta 5 peores (los más viejos primero)', () => {
      const resources = evaluateResources([
        ...Array.from({ length: 7 }, (_, i) => task({ rid: `bad${i}`, rname: `Malo ${i}`, code: 'ok', hoursAgo: 100 + i, rtype: 'MAILBOX' })),
        task({ rid: 'w', rname: 'Warn', code: 'warning', hoursAgo: 1, rtype: 'MAILBOX' }),
        task({ rid: 'g', rname: 'Good', code: 'ok', hoursAgo: 1, rtype: 'MAILBOX' }),
      ], TH);
      const s = summarizeResources(resources);
      expect(s).toMatchObject({ ok: 1, warn: 1, crit: 7 });
      expect(s.worst.length).toBe(5);
      expect(s.worst[0]).toBe('Malo 6');
    });
  });
});
