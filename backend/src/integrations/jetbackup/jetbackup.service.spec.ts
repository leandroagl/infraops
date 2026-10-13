import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { JetbackupService } from './jetbackup.service';

const CONN = { url: 'https://whm.test:2087/', username: 'root', apiKey: 'tok' };
const hoursAgoIso = (h: number) => new Date(Date.now() - h * 3600000).toISOString();

const JOB_PSQ: { _id: string; name: string; type: number; disabled: number; running: number | null } =
  { _id: 'job-psq', name: 'PSQ', type: 1, disabled: 0, running: null };
const JOB_CONFIG = { _id: 'job-cfg', name: 'JetBackup Config', type: 3, disabled: 0, running: null };

type Handler = (params: URLSearchParams) => unknown;

describe('JetbackupService', () => {
  let service: JetbackupService;
  let post: jest.Mock;
  let handlers: Record<string, Handler>;

  const ok = (data: unknown) => ({ data: { success: 1, message: '', data } });

  beforeEach(async () => {
    handlers = {};
    post = jest.fn((_url: string, body: URLSearchParams) => {
      const fn = body.get('function') ?? '';
      const handler = handlers[fn];
      if (!handler) throw new Error(`Sin handler para ${fn}`);
      const result = handler(body);
      return result instanceof Error ? throwError(() => result) : of(result);
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [JetbackupService, { provide: HttpService, useValue: { post } }],
    }).compile();
    service = module.get(JetbackupService);
  });

  describe('listJobs', () => {
    it('llama a la API del WHM con el header de autenticación', async () => {
      handlers['listBackupJobs'] = () => ok({ jobs: [JOB_PSQ], total: 1 });
      await service.listJobs(CONN);
      const [url, , opts] = post.mock.calls[0];
      expect(url).toBe('https://whm.test:2087/cgi/addons/jetbackup5/api.cgi');
      expect(opts.headers.Authorization).toBe('whm root:tok');
    });

    it('devuelve id, nombre y estado de cada job y excluye el job de configuración (type 3)', async () => {
      handlers['listBackupJobs'] = () => ok({
        jobs: [JOB_CONFIG, JOB_PSQ, { _id: 'job-x', name: 'X', type: 1, disabled: 1 }],
        total: 3,
      });
      const jobs = await service.listJobs(CONN);
      expect(jobs).toEqual([
        { jobId: 'job-psq', name: 'PSQ', disabled: false },
        { jobId: 'job-x', name: 'X', disabled: true },
      ]);
    });

    it('lanza un error con el mensaje de JetBackup cuando success = 0', async () => {
      handlers['listBackupJobs'] = () => ({ data: { success: 0, message: 'Invalid token' } });
      await expect(service.listJobs(CONN)).rejects.toThrow('Invalid token');
    });

    it('lanza un error cuando falla la conexión', async () => {
      handlers['listBackupJobs'] = () => new Error('ECONNREFUSED');
      await expect(service.listJobs(CONN)).rejects.toThrow('ECONNREFUSED');
    });
  });

  describe('getJobStatuses', () => {
    const cfgs = [{ jobId: 'job-psq', jobName: 'PSQ' }];

    const withLog = (log: Record<string, unknown> | null, items: unknown[] = [], job = JOB_PSQ) => {
      handlers['listBackupJobs'] = () => ok({ jobs: [job], total: 1 });
      handlers['listLogs'] = () => ok({ logs: log ? [log] : [], total: log ? 1 : 0 });
      handlers['listLogItems'] = () => ok({ items, total: items.length });
    };

    it('pide el último log del job filtrando por info.ID y type 1, ordenado por start_time descendente', async () => {
      withLog(null);
      await service.getJobStatuses(CONN, cfgs);
      const logsCall = post.mock.calls.map(c => c[1] as URLSearchParams).find(b => b.get('function') === 'listLogs')!;
      expect(logsCall.get('find[info.ID]')).toBe('job-psq');
      expect(logsCall.get('find[type]')).toBe('1');
      expect(logsCall.has('find[Type]')).toBe(false);
      expect(logsCall.get('sort[start_time]')).toBe('-1');
      expect(logsCall.get('limit')).toBe('1');
    });

    it('status 1 del log es Success y toma el mensaje del ítem', async () => {
      withLog(
        { _id: 'log-1', start_time: hoursAgoIso(5), end_time: hoursAgoIso(4.9), status: 1, type: 1 },
        [{ status: 100, message: 'Backup completed successfully' }],
      );
      const [s] = await service.getJobStatuses(CONN, cfgs);
      expect(s).toMatchObject({
        jobId: 'job-psq', jobName: 'PSQ', jobType: 'JetBackup',
        lastResult: 'Success', lastMessage: 'Backup completed successfully',
        isRunning: false, isStale: false,
      });
      expect(s.hoursAgo).toBeCloseTo(4.9, 0);
    });

    it('cualquier status distinto de 1 es Failed y el mensaje junta los ítems que no terminaron bien', async () => {
      withLog(
        { _id: 'log-2', start_time: hoursAgoIso(3), end_time: hoursAgoIso(2.9), status: 4, type: 1 },
        [
          { status: 100, message: 'ok' },
          { status: 101, message: 'Quota exceeded' },
          { status: 102, message: 'Destination unreachable' },
        ],
      );
      const [s] = await service.getJobStatuses(CONN, cfgs);
      expect(s.lastResult).toBe('Failed');
      expect(s.lastMessage).toBe('Quota exceeded; Destination unreachable');
    });

    it('sigue devolviendo el resultado, con mensaje null, si falla la lectura de los ítems', async () => {
      withLog({ _id: 'log-3', start_time: hoursAgoIso(2), end_time: hoursAgoIso(1.9), status: 1, type: 1 });
      handlers['listLogItems'] = () => new Error('timeout');
      const [s] = await service.getJobStatuses(CONN, cfgs);
      expect(s.lastResult).toBe('Success');
      expect(s.lastMessage).toBeNull();
    });

    it('un job sin logs queda sin resultado ni fecha', async () => {
      withLog(null);
      const [s] = await service.getJobStatuses(CONN, cfgs);
      expect(s).toMatchObject({ lastResult: null, lastMessage: null, lastRunAt: null, hoursAgo: null, isStale: false });
    });

    it('marca isRunning cuando el job está corriendo y no lo considera desactualizado', async () => {
      withLog(
        { _id: 'log-4', start_time: hoursAgoIso(40), end_time: hoursAgoIso(39.9), status: 1, type: 1 },
        [{ status: 100, message: 'ok' }],
        { ...JOB_PSQ, running: 1 },
      );
      const [s] = await service.getJobStatuses(CONN, cfgs);
      expect(s.isRunning).toBe(true);
      expect(s.isStale).toBe(false);
    });

    it('marca isStale cuando la última ejecución tiene más de 30 horas', async () => {
      withLog(
        { _id: 'log-5', start_time: hoursAgoIso(50), end_time: hoursAgoIso(49.9), status: 1, type: 1 },
        [{ status: 100, message: 'ok' }],
      );
      const [s] = await service.getJobStatuses(CONN, cfgs);
      expect(s.isStale).toBe(true);
    });

    it('si el job ya no existe en JetBackup devuelve Failed con un mensaje claro y no consulta logs', async () => {
      handlers['listBackupJobs'] = () => ok({ jobs: [], total: 0 });
      const [s] = await service.getJobStatuses(CONN, cfgs);
      expect(s).toMatchObject({ jobId: 'job-psq', jobName: 'PSQ', lastResult: 'Failed' });
      expect(s.lastMessage).toMatch(/ya no existe/i);
      expect(post.mock.calls.some(c => (c[1] as URLSearchParams).get('function') === 'listLogs')).toBe(false);
    });

    it('con una lista vacía no llama a la API', async () => {
      expect(await service.getJobStatuses(CONN, [])).toEqual([]);
      expect(post).not.toHaveBeenCalled();
    });
  });
});
