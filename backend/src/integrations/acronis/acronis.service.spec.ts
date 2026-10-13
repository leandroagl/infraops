import * as fs from 'fs';
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AcronisService } from './acronis.service';
import { isBackupTask } from './acronis.evaluation';
import type { AcronisActivity, AcronisConnection, AcronisTask } from './dto/acronis-api.dto';

const fixture = <T>(name: string): T =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../test/fixtures/acronis', name), 'utf-8')) as T;

const CONN: AcronisConnection = { baseUrl: 'https://eu2-cloud.acronis.com/', clientId: 'cid', clientSecret: 'csecret' };
const NOW = new Date('2026-10-13T12:00:00.000Z');
const TASKS_URL = 'https://eu2-cloud.acronis.com/api/task_manager/v2/tasks';
const ACTIVITIES_URL = 'https://eu2-cloud.acronis.com/api/task_manager/v2/activities';
const TOKEN_URL = 'https://eu2-cloud.acronis.com/api/2/idp/token';

const allTasks = fixture<{ items: AcronisTask[] }>('tasks.sample.json').items;
const backups = allTasks.filter(isBackupTask);
const wrapperTask = backups.find(t => t.context?.HasChildren) as AcronisTask;
const mailboxPolicyId = backups.find(t => t.resource?.type === 'MAILBOX')?.policy?.id as string;
const mailboxTasks = backups.filter(t => t.policy?.id === mailboxPolicyId);
const activities = fixture<{ items: AcronisActivity[] }>('activities.sample.json');

type GetParams = Record<string, string>;

describe('AcronisService', () => {
  let service: AcronisService;
  let post: jest.Mock;
  let get: jest.Mock;
  let onGet: (url: string, params: GetParams) => unknown;

  const page = (items: unknown[], after?: string) => ({
    data: { items, paging: { cursors: after ? { after } : {} } },
  });

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(NOW);
    post = jest.fn(() => of({ data: { access_token: 'tok-1', expires_on: Math.floor(NOW.getTime() / 1000) + 3600 } }));
    onGet = () => page([]);
    get = jest.fn((url: string, opts: { params: GetParams }) => {
      const result = onGet(url, opts.params);
      return result instanceof Error ? throwError(() => result) : of(result);
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [AcronisService, { provide: HttpService, useValue: { post, get } }],
    }).compile();
    service = module.get(AcronisService);
  });

  afterEach(() => { jest.useRealTimers(); });

  describe('autenticación', () => {
    it('pide el token con Basic auth y form-urlencoded, y usa el Bearer en los GET', async () => {
      onGet = () => page(mailboxTasks);
      await service.getPlanStatus(CONN, mailboxPolicyId);
      const [url, body, opts] = post.mock.calls[0];
      expect(url).toBe(TOKEN_URL);
      expect(String(body)).toBe('grant_type=client_credentials');
      expect(opts.headers.Authorization).toBe(`Basic ${Buffer.from('cid:csecret').toString('base64')}`);
      expect(opts.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
      expect(get.mock.calls[0][1].headers.Authorization).toBe('Bearer tok-1');
    });

    it('reusa el token mientras no venza y lo renueva al vencer', async () => {
      onGet = () => page(mailboxTasks);
      await service.listPlans(CONN);
      await service.listPlans(CONN);
      expect(post).toHaveBeenCalledTimes(1);
      jest.setSystemTime(new Date(NOW.getTime() + 3600 * 1000));
      await service.listPlans(CONN);
      expect(post).toHaveBeenCalledTimes(2);
    });

    it('ante un 401 en un GET renueva el token y reintenta una vez', async () => {
      let calls = 0;
      onGet = () => (calls++ === 0 ? Object.assign(new Error('Unauthorized'), { response: { status: 401 } }) : page(mailboxTasks));
      const res = await service.listPlans(CONN);
      expect(res.plans.length).toBe(1);
      expect(post).toHaveBeenCalledTimes(2);
    });

    it('falla sin llamar a la API cuando faltan credenciales', async () => {
      await expect(service.listPlans({ baseUrl: '', clientId: '', clientSecret: '' })).rejects.toThrow(/no está configurado/i);
      expect(post).not.toHaveBeenCalled();
    });

    it('falla con el status cuando Acronis rechaza la autenticación', async () => {
      post.mockReturnValue(throwError(() => Object.assign(new Error('x'), { response: { status: 401 } })));
      await expect(service.listPlans(CONN)).rejects.toThrow(/autenticaci.*401/i);
    });

    it('falla cuando la respuesta no trae access_token', async () => {
      post.mockReturnValue(of({ data: {} }));
      await expect(service.listPlans(CONN)).rejects.toThrow(/access_token/);
    });

    it('falla con mensaje claro ante caída de red', async () => {
      post.mockReturnValue(throwError(() => new Error('ECONNREFUSED')));
      await expect(service.listPlans(CONN)).rejects.toThrow(/ECONNREFUSED/);
    });
  });

  describe('getPlanStatus', () => {
    it('consulta /tasks con el set completo de filtros, sin barra final en la baseUrl', async () => {
      onGet = () => page(mailboxTasks);
      await service.getPlanStatus(CONN, mailboxPolicyId);
      const [url, opts] = get.mock.calls[0];
      expect(url).toBe(TASKS_URL);
      expect(opts.params).toEqual({ limit: '500', order: 'desc(id)', state: 'completed', policyId: mailboxPolicyId });
    });

    it('evalúa por recurso y devuelve datos del plan y del tenant', async () => {
      onGet = () => page(mailboxTasks);
      const plan = await service.getPlanStatus(CONN, mailboxPolicyId);
      expect(plan.policyId).toBe(mailboxPolicyId);
      expect(plan.tenantName).toMatch(/^Cliente Demo/);
      expect(plan.resources.length).toBeGreaterThan(0);
      expect(plan.resources.every(r => r.severity === 'ok')).toBe(true);
      expect(plan.lastRunAt).not.toBeNull();
    });

    it('ignora tasks que no son de backup (antimalware) dentro de la respuesta', async () => {
      const antimalware: AcronisTask = {
        ...mailboxTasks[0], policy: { id: mailboxPolicyId, type: 'policy.security.antimalware_protection', name: 'AV' },
        resource: { id: 'otro', type: 'machine', name: 'PC-AV' },
      };
      onGet = () => page([antimalware, ...mailboxTasks]);
      const plan = await service.getPlanStatus(CONN, mailboxPolicyId);
      expect(plan.resources.some(r => r.name === 'PC-AV')).toBe(false);
    });

    it('con cursor "after" las páginas siguientes llevan solo limit + after', async () => {
      onGet = (_url, params) => (params.after ? page(mailboxTasks.slice(2)) : page(mailboxTasks.slice(0, 2), 'CURSOR-1'));
      await service.getPlanStatus(CONN, mailboxPolicyId);
      expect(get).toHaveBeenCalledTimes(2);
      expect(get.mock.calls[1][1].params).toEqual({ limit: '500', after: 'CURSOR-1' });
    });

    it('falla fuerte (no devuelve datos parciales) si tras el tope de páginas queda cursor', async () => {
      onGet = () => page(mailboxTasks, 'SIEMPRE-HAY-MAS');
      await expect(service.getPlanStatus(CONN, mailboxPolicyId)).rejects.toThrow(/truncad/i);
      expect(get).toHaveBeenCalledTimes(20);
    });

    it('falla si el plan no tiene tasks de backup (nunca "todo ok" por falta de datos)', async () => {
      onGet = () => page([]);
      await expect(service.getPlanStatus(CONN, 'pol-inexistente')).rejects.toThrow(/No se encontraron tasks de backup/);
    });

    it('plan wrapper: expande la última corrida con /activities usando idString (ids > 2^53)', async () => {
      onGet = url => (url === ACTIVITIES_URL ? page(activities.items) : page([wrapperTask]));
      const plan = await service.getPlanStatus(CONN, wrapperTask.policy?.id as string);
      const actCall = get.mock.calls.find(c => c[0] === ACTIVITIES_URL);
      expect(actCall?.[1].params).toEqual({ limit: '200', order: 'asc(id)', taskId: wrapperTask.idString });
      expect(plan.resources.map(r => [r.name, r.severity])).toEqual([
        ['VM-DEMO-01', 'ok'], ['VM-DEMO-02', 'warning'], ['VM-DEMO-03', 'error'],
      ]);
    });

    it('plan wrapper: falla si /activities queda truncado', async () => {
      onGet = url => (url === ACTIVITIES_URL ? page(activities.items, 'MAS') : page([wrapperTask]));
      await expect(service.getPlanStatus(CONN, wrapperTask.policy?.id as string)).rejects.toThrow(/activities.*truncad/i);
    });

    it('cachea el resultado por plan durante 5 minutos', async () => {
      onGet = () => page(mailboxTasks);
      await service.getPlanStatus(CONN, mailboxPolicyId);
      await service.getPlanStatus(CONN, mailboxPolicyId);
      expect(get).toHaveBeenCalledTimes(1);
      jest.setSystemTime(new Date(NOW.getTime() + 6 * 60000));
      await service.getPlanStatus(CONN, mailboxPolicyId);
      expect(get).toHaveBeenCalledTimes(2);
    });

    it('no cachea los fallos', async () => {
      onGet = () => new Error('boom');
      await expect(service.getPlanStatus(CONN, mailboxPolicyId)).rejects.toThrow();
      onGet = () => page(mailboxTasks);
      await expect(service.getPlanStatus(CONN, mailboxPolicyId)).resolves.toBeDefined();
    });
  });

  describe('getJobStatuses', () => {
    it('devuelve un job genérico por plan configurado', async () => {
      onGet = () => page(mailboxTasks);
      const jobs = await service.getJobStatuses(CONN, [{ policyId: mailboxPolicyId, policyName: 'Mi plan' }]);
      expect(jobs.length).toBe(1);
      expect(jobs[0]).toMatchObject({ jobId: mailboxPolicyId, jobType: 'Acronis', lastResult: 'Success' });
      expect(jobs[0].aggregate?.total).toBeGreaterThan(0);
    });

    it('un plan sin tasks se reporta como Failed (no como ok) con el nombre configurado', async () => {
      onGet = () => page([]);
      const [job] = await service.getJobStatuses(CONN, [{ policyId: 'pol-borrado', policyName: 'Plan viejo' }]);
      expect(job).toMatchObject({
        jobId: 'pol-borrado', jobName: 'Plan viejo', lastResult: 'Failed', lastRunAt: null, hoursAgo: null,
      });
      expect(job.lastMessage).toMatch(/no registra corridas/i);
    });

    it('propaga cualquier otro error (cliente desconectado en vez de estado parcial)', async () => {
      onGet = () => page(mailboxTasks, 'SIEMPRE-HAY-MAS');
      await expect(service.getJobStatuses(CONN, [{ policyId: mailboxPolicyId, policyName: 'x' }])).rejects.toThrow(/truncad/i);
    });

    it('devuelve [] sin llamar a la API si no hay planes', async () => {
      expect(await service.getJobStatuses(CONN, [])).toEqual([]);
      expect(post).not.toHaveBeenCalled();
    });
  });

  describe('listPlans', () => {
    it('agrupa por policy.id con tenant, tipos y cantidad de recursos; descarta el ruido', async () => {
      onGet = () => page(allTasks);
      const { plans, partial } = await service.listPlans(CONN);
      expect(partial).toBe(false);
      expect(plans.length).toBe(new Set(backups.map(t => t.policy?.id)).size);
      const mail = plans.find(p => p.policyId === mailboxPolicyId);
      expect(mail?.resourceTypes).toContain('MAILBOX');
      expect(mail?.resourceCount).toBe(new Set(mailboxTasks.map(t => t.resource?.id)).size);
    });

    it('barrido global: primera página con filtros, tolera truncado y lo marca como parcial', async () => {
      onGet = () => page(allTasks, 'MAS');
      const { partial } = await service.listPlans(CONN);
      expect(partial).toBe(true);
      expect(get.mock.calls[0][1].params).toEqual({ limit: '500', order: 'desc(id)', state: 'completed' });
    });
  });
});
