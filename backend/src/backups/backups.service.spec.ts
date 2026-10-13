import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadGatewayException, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { BackupsService } from './backups.service';
import { VeeamClientConfig } from './entities/veeam-client-config.entity';
import { VeeamDailySnapshot } from './entities/veeam-daily-snapshot.entity';
import { JetbackupJobConfig } from './entities/jetbackup-job-config.entity';
import { AcronisPlanConfig } from './entities/acronis-plan-config.entity';
import { VeeamService } from '../integrations/veeam/veeam.service';
import { JetbackupService } from '../integrations/jetbackup/jetbackup.service';
import { AcronisService } from '../integrations/acronis/acronis.service';
import { IntegrationConfigService } from '../integration-config/integration-config.service';

const mockConfigRepo = { find: jest.fn(), findOne: jest.fn(), save: jest.fn(), delete: jest.fn(), create: jest.fn() };
const mockJetRepo = {
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
  create: jest.fn((d: unknown) => d),
};
const mockAcrRepo = {
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
  create: jest.fn((d: unknown) => d),
};
const mockSnapshotRepo = {
  upsert: jest.fn().mockResolvedValue(undefined),
  findOne: jest.fn(),
  find: jest.fn(),
};
const mockVeeamService = { getJobStatuses: jest.fn(), testConnection: jest.fn() };
const mockJetbackupService = { getJobStatuses: jest.fn(), listJobs: jest.fn() };
const mockAcronisService = { getJobStatuses: jest.fn(), listPlans: jest.fn() };
const mockIntegrationConfigSvc = {
  getVeeamConfigDecrypted: jest.fn(), getJetbackupConfigDecrypted: jest.fn(), getAcronisConfigDecrypted: jest.fn(),
};
const ACR_CONN = { baseUrl: 'https://eu2-cloud.acronis.com', clientId: 'cid', clientSecret: 'sec' };
const acrCfg = (over: Partial<AcronisPlanConfig> = {}) => ({
  id: 'ac1', clientId: 'c1', clientName: 'Client 1', policyId: 'pol-1', policyName: 'Plan 1', tenantName: 'Tenant 1', isEnabled: true, ...over,
});
const acrJob = (over: Record<string, unknown> = {}) => ({
  jobId: 'pol-1', jobName: 'Plan 1', jobType: 'Acronis', isRunning: false, lastResult: 'Success', lastMessage: null,
  lastRunAt: new Date().toISOString(), hoursAgo: 2, isStale: false, items: [], aggregate: null, ...over,
});

const JET_CONN = { url: 'https://whm:2087', username: 'root', apiKey: 'tok' };
const jetCfg = (over: Partial<JetbackupJobConfig> = {}) => ({
  id: 'jc1', clientId: 'c1', clientName: 'Client 1', jobId: 'job-1', jobName: 'PSQ', isEnabled: true, ...over,
});
const jetJob = (over: Record<string, unknown> = {}) => ({
  jobId: 'job-1', jobName: 'PSQ', jobType: 'JetBackup', isRunning: false,
  lastResult: 'Success', lastMessage: 'ok', lastRunAt: new Date().toISOString(), hoursAgo: 2, isStale: false, ...over,
});

describe('BackupsService', () => {
  let svc: BackupsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BackupsService,
        { provide: getRepositoryToken(VeeamClientConfig), useValue: mockConfigRepo },
        { provide: getRepositoryToken(VeeamDailySnapshot), useValue: mockSnapshotRepo },
        { provide: getRepositoryToken(JetbackupJobConfig), useValue: mockJetRepo },
        { provide: getRepositoryToken(AcronisPlanConfig), useValue: mockAcrRepo },
        { provide: VeeamService, useValue: mockVeeamService },
        { provide: JetbackupService, useValue: mockJetbackupService },
        { provide: AcronisService, useValue: mockAcronisService },
        { provide: IntegrationConfigService, useValue: mockIntegrationConfigSvc },
      ],
    }).compile();
    svc = module.get(BackupsService);
    jest.clearAllMocks();
    mockJetRepo.find.mockResolvedValue([]);
    mockAcrRepo.find.mockResolvedValue([]);
    mockIntegrationConfigSvc.getJetbackupConfigDecrypted.mockResolvedValue(JET_CONN);
    mockIntegrationConfigSvc.getAcronisConfigDecrypted.mockResolvedValue(ACR_CONN);
  });

  it('debería calcular estado del cliente como el peor estado de sus jobs', () => {
    const jobs = [
      { lastResult: 'Success', isRunning: false, isStale: false } as any,
      { lastResult: 'Warning', isRunning: false, isStale: false } as any,
    ];
    expect((svc as any).deriveClientStatus(jobs)).toBe('warn');
  });

  it('debería devolver crit si hay al menos un job Failed', () => {
    const jobs = [
      { lastResult: 'Success', isRunning: false, isStale: false } as any,
      { lastResult: 'Failed', isRunning: false, isStale: false } as any,
    ];
    expect((svc as any).deriveClientStatus(jobs)).toBe('crit');
  });

  it('debería devolver no_data si no hay jobs', () => {
    expect((svc as any).deriveClientStatus([])).toBe('no_data');
  });

  it('debería devolver no_data si ningún job tiene resultado todavía', () => {
    const jobs = [{ lastResult: null, isRunning: false, isStale: false } as any];
    expect((svc as any).deriveClientStatus(jobs)).toBe('no_data');
  });

  it('debería ignorar los jobs sin resultado si otro job sí tiene uno', () => {
    const jobs = [
      { lastResult: null, isRunning: false, isStale: false } as any,
      { lastResult: 'Success', isRunning: false, isStale: false } as any,
    ];
    expect((svc as any).deriveClientStatus(jobs)).toBe('ok');
  });

  it('crea config sin campos de credencial', async () => {
    mockConfigRepo.create.mockImplementation((d: any) => ({ ...d }));
    mockConfigRepo.save.mockResolvedValue({
      id: 'uuid', clientId: 'c1', clientName: 'Client 1', host: 'h', port: 9419,
      isEnabled: true, lastConnectedAt: null, createdAt: new Date(), updatedAt: new Date(),
    });
    await svc.createConfig({ clientId: 'c1', clientName: 'Client 1', host: 'h', port: 9419, isEnabled: true });
    expect(mockConfigRepo.save).toHaveBeenCalled();
  });

  it('testConnection usa credenciales globales de IntegrationConfigService', async () => {
    mockConfigRepo.findOne.mockResolvedValue({
      id: 'cfg1', clientId: 'c1', clientName: 'Client 1',
      host: '10.0.0.1', port: 9419, isEnabled: true, lastConnectedAt: null,
    });
    mockIntegrationConfigSvc.getVeeamConfigDecrypted.mockResolvedValue({ username: 'admin', password: 'secret' });
    mockVeeamService.testConnection.mockResolvedValue({ success: true, message: 'OK', jobCount: 3 });
    await svc.testConnection('cfg1');
    expect(mockIntegrationConfigSvc.getVeeamConfigDecrypted).toHaveBeenCalled();
    expect(mockVeeamService.testConnection).toHaveBeenCalledWith('10.0.0.1', 9419, 'admin', 'secret');
  });

  it('getClientStatus usa credenciales globales para llamar a VeeamService', async () => {
    mockConfigRepo.findOne.mockResolvedValue({
      id: '1', clientId: 'c1', clientName: 'Client 1',
      host: 'h', port: 9419, isEnabled: true, lastConnectedAt: null,
    });
    mockIntegrationConfigSvc.getVeeamConfigDecrypted.mockResolvedValue({ username: 'veeamadmin', password: 'pass' });
    mockVeeamService.getJobStatuses.mockResolvedValue([]);
    await svc.getClientStatus('c1');
    expect(mockVeeamService.getJobStatuses).toHaveBeenCalledWith('h', 9419, 'veeamadmin', 'pass');
  });

  it('getAllClientStatuses incluye configs deshabilitadas con status disconnected', async () => {
    mockConfigRepo.find.mockResolvedValue([
      { id: '1', clientId: 'c1', clientName: 'Client 1', host: 'h', port: 9419, isEnabled: false, lastConnectedAt: null },
    ]);
    const result = await svc.getAllClientStatuses();
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('disconnected');
    expect(mockVeeamService.getJobStatuses).not.toHaveBeenCalled();
  });

  it('getAllClientStatuses retorna disconnected cuando la conexión falla en un config habilitado', async () => {
    mockConfigRepo.find.mockResolvedValue([
      { id: '1', clientId: 'c1', clientName: 'Client 1', host: 'h', port: 9419, isEnabled: true, lastConnectedAt: null },
    ]);
    mockConfigRepo.findOne.mockResolvedValue({
      id: '1', clientId: 'c1', clientName: 'Client 1', host: 'h', port: 9419, isEnabled: true, lastConnectedAt: null,
    });
    mockIntegrationConfigSvc.getVeeamConfigDecrypted.mockResolvedValue({ username: 'u', password: 'p' });
    mockVeeamService.getJobStatuses.mockRejectedValue(new Error('Connection refused'));
    const result = await svc.getAllClientStatuses();
    expect(result[0].status).toBe('disconnected');
  });

  it('getClientStatus llama saveSnapshot tras conexión exitosa', async () => {
    mockConfigRepo.findOne.mockResolvedValue({
      id: '1', clientId: 'c1', clientName: 'Client 1', host: 'h', port: 9419, isEnabled: true, lastConnectedAt: null,
    });
    mockIntegrationConfigSvc.getVeeamConfigDecrypted.mockResolvedValue({ username: 'u', password: 'p' });
    mockVeeamService.getJobStatuses.mockResolvedValue([
      { jobId: 'j1', jobName: 'Job1', jobType: 'Backup', isRunning: false,
        lastResult: 'Success', lastMessage: null, lastRunAt: new Date().toISOString(), hoursAgo: 2, isStale: false },
    ]);
    await svc.getClientStatus('c1');
    await Promise.resolve();
    expect(mockSnapshotRepo.upsert).toHaveBeenCalledTimes(1);
    const [rows, conflict] = mockSnapshotRepo.upsert.mock.calls[0];
    expect(rows[0]).toMatchObject({ provider: 'VEEAM', jobId: 'j1' });
    expect(conflict).toEqual(['clientId', 'provider', 'jobId', 'snapshotDate']);
  });

  it('getLastSnapshot retorna disconnectedDto cuando no hay snapshots para un cliente', async () => {
    mockConfigRepo.find.mockResolvedValue([
      { id: '1', clientId: 'c1', clientName: 'Client 1', host: 'h', port: 9419, isEnabled: true, lastConnectedAt: null },
    ]);
    mockSnapshotRepo.findOne.mockResolvedValue(null);
    const result = await svc.getLastSnapshot();
    expect(result[0].status).toBe('disconnected');
  });

  it('getLastSnapshot reconstruye status desde filas de snapshot', async () => {
    const lastRunAt = new Date(Date.now() - 2 * 3600000);
    mockConfigRepo.find.mockResolvedValue([
      { id: '1', clientId: 'c1', clientName: 'Client 1', host: 'h', port: 9419, isEnabled: true, lastConnectedAt: null },
    ]);
    mockSnapshotRepo.findOne.mockResolvedValue({ clientId: 'c1', jobId: 'j1', snapshotDate: '2026-10-12' });
    mockSnapshotRepo.find.mockResolvedValue([
      { clientId: 'c1', provider: 'VEEAM', jobId: 'j1', jobName: 'Job1', jobType: 'Backup',
        result: 'Success', message: null, lastRunAt, hoursAgo: 2, snapshotDate: '2026-10-12' },
    ]);
    const result = await svc.getLastSnapshot();
    expect(result[0].status).toBe('ok');
    expect(result[0].isSnapshot).toBe(true);
    expect(result[0].jobs[0].provider).toBe('VEEAM');
  });

  it('getLastSnapshot retorna disconnectedDto para clientes deshabilitados', async () => {
    mockConfigRepo.find.mockResolvedValue([
      { id: '1', clientId: 'c1', clientName: 'Client 1', host: 'h', port: 9419, isEnabled: false, lastConnectedAt: null },
    ]);
    const result = await svc.getLastSnapshot();
    expect(result[0].status).toBe('disconnected');
    expect(mockSnapshotRepo.findOne).not.toHaveBeenCalled();
  });

  describe('estado con JetBackup', () => {
    const veeamCfg = { id: 'v1', clientId: 'c1', clientName: 'Client 1', host: 'h', port: 9419, isEnabled: true, lastConnectedAt: null };

    it('getClientStatus de un cliente solo con JetBackup consulta únicamente los jobs habilitados', async () => {
      mockConfigRepo.findOne.mockResolvedValue(null);
      mockJetRepo.find.mockResolvedValue([jetCfg(), jetCfg({ id: 'jc2', jobId: 'job-2', jobName: 'Off', isEnabled: false })]);
      mockJetbackupService.getJobStatuses.mockResolvedValue([jetJob()]);

      const result = await svc.getClientStatus('c1');

      expect(mockJetbackupService.getJobStatuses).toHaveBeenCalledWith(JET_CONN, [{ jobId: 'job-1', jobName: 'PSQ' }]);
      expect(mockVeeamService.getJobStatuses).not.toHaveBeenCalled();
      expect(result.clientName).toBe('Client 1');
      expect(result.status).toBe('ok');
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].provider).toBe('JETBACKUP');
    });

    it('getClientStatus guarda el snapshot de JetBackup con su proveedor', async () => {
      mockConfigRepo.findOne.mockResolvedValue(null);
      mockJetRepo.find.mockResolvedValue([jetCfg()]);
      mockJetbackupService.getJobStatuses.mockResolvedValue([jetJob()]);
      await svc.getClientStatus('c1');
      await Promise.resolve();
      const [rows] = mockSnapshotRepo.upsert.mock.calls[0];
      expect(rows[0]).toMatchObject({ provider: 'JETBACKUP', jobId: 'job-1', clientId: 'c1' });
    });

    it('un cliente con Veeam y JetBackup junta los jobs de ambos y toma el peor estado', async () => {
      mockConfigRepo.findOne.mockResolvedValue(veeamCfg);
      mockIntegrationConfigSvc.getVeeamConfigDecrypted.mockResolvedValue({ username: 'u', password: 'p' });
      mockVeeamService.getJobStatuses.mockResolvedValue([
        { jobId: 'vj', jobName: 'VJ', jobType: 'Backup', isRunning: false, lastResult: 'Success', lastMessage: null, lastRunAt: null, hoursAgo: 1, isStale: false },
      ]);
      mockJetRepo.find.mockResolvedValue([jetCfg()]);
      mockJetbackupService.getJobStatuses.mockResolvedValue([jetJob({ lastResult: 'Failed' })]);

      const result = await svc.getClientStatus('c1');

      expect(result.totalJobs).toBe(2);
      expect(result.jobs.map(j => j.provider).sort()).toEqual(['JETBACKUP', 'VEEAM']);
      expect(result.status).toBe('crit');
      expect(result.critCount).toBe(1);
    });

    it('getClientStatus lanza NotFound si el cliente no tiene ninguna config', async () => {
      mockConfigRepo.findOne.mockResolvedValue(null);
      mockJetRepo.find.mockResolvedValue([]);
      await expect(svc.getClientStatus('c9')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('getAllClientStatuses incluye clientes que solo tienen JetBackup', async () => {
      mockConfigRepo.find.mockResolvedValue([]);
      mockJetRepo.find.mockResolvedValue([jetCfg(), jetCfg({ id: 'jc2', jobId: 'job-2', jobName: 'Otro' })]);
      mockJetbackupService.getJobStatuses.mockResolvedValue([jetJob(), jetJob({ jobId: 'job-2', jobName: 'Otro' })]);
      const result = await svc.getAllClientStatuses();
      expect(result).toHaveLength(1);
      expect(result[0].totalJobs).toBe(2);
    });

    it('getAllClientStatuses con Veeam deshabilitado y JetBackup habilitado muestra solo los jobs de JetBackup', async () => {
      mockConfigRepo.find.mockResolvedValue([{ ...veeamCfg, isEnabled: false }]);
      mockJetRepo.find.mockResolvedValue([jetCfg()]);
      mockJetbackupService.getJobStatuses.mockResolvedValue([jetJob()]);
      const result = await svc.getAllClientStatuses();
      expect(result[0].status).toBe('ok');
      expect(mockVeeamService.getJobStatuses).not.toHaveBeenCalled();
    });

    it('getAllClientStatuses devuelve disconnected si falla JetBackup', async () => {
      mockConfigRepo.find.mockResolvedValue([]);
      mockJetRepo.find.mockResolvedValue([jetCfg()]);
      mockJetbackupService.getJobStatuses.mockRejectedValue(new Error('ECONNREFUSED'));
      const result = await svc.getAllClientStatuses();
      expect(result[0].status).toBe('disconnected');
    });

    it('getLastSnapshot arma el estado desde snapshots de JetBackup e ignora los de jobs ya no configurados', async () => {
      const lastRunAt = new Date(Date.now() - 2 * 3600000);
      mockConfigRepo.find.mockResolvedValue([]);
      mockJetRepo.find.mockResolvedValue([jetCfg()]);
      mockSnapshotRepo.findOne.mockResolvedValue({ clientId: 'c1', snapshotDate: '2026-10-12' });
      mockSnapshotRepo.find.mockResolvedValue([
        { clientId: 'c1', provider: 'JETBACKUP', jobId: 'job-1', jobName: 'PSQ', jobType: 'JetBackup', result: 'Success', message: 'ok', lastRunAt, hoursAgo: 2, snapshotDate: '2026-10-12' },
        { clientId: 'c1', provider: 'JETBACKUP', jobId: 'job-borrado', jobName: 'Viejo', jobType: 'JetBackup', result: 'Failed', message: null, lastRunAt, hoursAgo: 2, snapshotDate: '2026-10-12' },
      ]);
      const result = await svc.getLastSnapshot();
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('ok');
      expect(result[0].jobs.map(j => j.jobId)).toEqual(['job-1']);
      expect(result[0].jobs[0].provider).toBe('JETBACKUP');
    });
  });

  describe('configs de JetBackup', () => {
    it('listConfigs junta Veeam y JetBackup con su proveedor', async () => {
      mockConfigRepo.find.mockResolvedValue([
        { id: 'v1', clientId: 'c1', clientName: 'Client 1', host: 'h', port: 9419, isEnabled: true, lastConnectedAt: null },
      ]);
      mockJetRepo.find.mockResolvedValue([jetCfg()]);
      const list = await svc.listConfigs();
      expect(list).toHaveLength(2);
      expect(list.find(c => c.provider === 'VEEAM')).toMatchObject({ id: 'v1', host: 'h', port: 9419 });
      expect(list.find(c => c.provider === 'JETBACKUP')).toMatchObject({ id: 'jc1', jobId: 'job-1', jobName: 'PSQ' });
    });

    it('createJetbackupConfigs guarda una fila por job', async () => {
      mockJetRepo.find.mockResolvedValue([]);
      mockJetRepo.save.mockImplementation((rows: unknown[]) => Promise.resolve(rows.map((r, i) => ({ id: `n${i}`, ...(r as object) }))));
      const result = await svc.createJetbackupConfigs({
        clientId: 'c1', clientName: 'Client 1', isEnabled: true,
        jobs: [{ jobId: 'job-1', jobName: 'PSQ' }, { jobId: 'job-2', jobName: 'PARADOR' }],
      });
      expect(mockJetRepo.save).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ provider: 'JETBACKUP', clientId: 'c1', jobId: 'job-1' });
    });

    it('createJetbackupConfigs rechaza jobs que ya están asignados', async () => {
      mockJetRepo.find.mockResolvedValue([jetCfg({ clientName: 'Otro cliente' })]);
      await expect(svc.createJetbackupConfigs({
        clientId: 'c2', clientName: 'Client 2', isEnabled: true, jobs: [{ jobId: 'job-1', jobName: 'PSQ' }],
      })).rejects.toBeInstanceOf(ConflictException);
      expect(mockJetRepo.save).not.toHaveBeenCalled();
    });

    it('updateJetbackupConfig cambia isEnabled', async () => {
      mockJetRepo.findOne.mockResolvedValue(jetCfg());
      mockJetRepo.save.mockImplementation((r: unknown) => Promise.resolve(r));
      const updated = await svc.updateJetbackupConfig('jc1', { isEnabled: false });
      expect(updated.isEnabled).toBe(false);
    });

    it('updateJetbackupConfig lanza NotFound si no existe', async () => {
      mockJetRepo.findOne.mockResolvedValue(null);
      await expect(svc.updateJetbackupConfig('x', { isEnabled: false })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deleteJetbackupConfig borra la fila', async () => {
      await svc.deleteJetbackupConfig('jc1');
      expect(mockJetRepo.delete).toHaveBeenCalledWith('jc1');
    });
  });

  describe('listJetbackupJobs', () => {
    it('marca los jobs ya configurados e indica a qué cliente pertenecen', async () => {
      mockJetbackupService.listJobs.mockResolvedValue([
        { jobId: 'job-1', name: 'PSQ', disabled: false },
        { jobId: 'job-2', name: 'PARADORATALAYA', disabled: false },
      ]);
      mockJetRepo.find.mockResolvedValue([jetCfg({ clientName: 'PSQ Hosting' })]);
      const jobs = await svc.listJetbackupJobs();
      expect(mockJetbackupService.listJobs).toHaveBeenCalledWith(JET_CONN);
      expect(jobs).toEqual([
        { jobId: 'job-1', name: 'PSQ', disabled: false, configured: true, configuredClientName: 'PSQ Hosting' },
        { jobId: 'job-2', name: 'PARADORATALAYA', disabled: false, configured: false, configuredClientName: null },
      ]);
    });

    it('lanza BadRequest si JetBackup no está configurado en Integraciones', async () => {
      mockIntegrationConfigSvc.getJetbackupConfigDecrypted.mockResolvedValue({ url: '', username: 'root', apiKey: '' });
      await expect(svc.listJetbackupJobs()).rejects.toBeInstanceOf(BadRequestException);
      expect(mockJetbackupService.listJobs).not.toHaveBeenCalled();
    });

    it('lanza BadGateway con el mensaje de JetBackup cuando falla la consulta', async () => {
      mockJetbackupService.listJobs.mockRejectedValue(new Error('Invalid token'));
      await expect(svc.listJetbackupJobs()).rejects.toBeInstanceOf(BadGatewayException);
      await expect(svc.listJetbackupJobs()).rejects.toThrow('Invalid token');
    });
  });

  describe('estado con Acronis', () => {
    it('getClientStatus de un cliente solo con Acronis consulta únicamente los planes habilitados', async () => {
      mockConfigRepo.findOne.mockResolvedValue(null);
      mockAcrRepo.find.mockResolvedValue([acrCfg(), acrCfg({ id: 'ac2', policyId: 'pol-2', policyName: 'Off', isEnabled: false })]);
      mockAcronisService.getJobStatuses.mockResolvedValue([acrJob()]);

      const result = await svc.getClientStatus('c1');

      expect(mockAcronisService.getJobStatuses).toHaveBeenCalledWith(ACR_CONN, [{ policyId: 'pol-1', policyName: 'Plan 1' }]);
      expect(result.status).toBe('ok');
      expect(result.jobs[0].provider).toBe('ACRONIS');
    });

    it('conserva items y aggregate del job al armar el estado del cliente', async () => {
      mockConfigRepo.findOne.mockResolvedValue(null);
      mockAcrRepo.find.mockResolvedValue([acrCfg()]);
      const aggregate = { total: 3, okCount: 2, warnCount: 0, critCount: 1, worst: ['Buzón 3'] };
      mockAcronisService.getJobStatuses.mockResolvedValue([acrJob({ lastResult: 'Failed', aggregate })]);
      const result = await svc.getClientStatus('c1');
      expect(result.status).toBe('crit');
      expect(result.jobs[0].aggregate).toEqual(aggregate);
    });

    it('guarda el snapshot de Acronis con su proveedor y el desglose en details', async () => {
      mockConfigRepo.findOne.mockResolvedValue(null);
      mockAcrRepo.find.mockResolvedValue([acrCfg()]);
      const items = [{ itemId: 'r1', name: 'VM1', type: 'machine', result: 'Success', hoursSinceOk: 2, lastCode: 'ok', lastRunAt: null }];
      mockAcronisService.getJobStatuses.mockResolvedValue([acrJob({ items })]);
      await svc.getClientStatus('c1');
      await Promise.resolve();
      const [rows] = mockSnapshotRepo.upsert.mock.calls[0];
      expect(rows[0]).toMatchObject({ provider: 'ACRONIS', jobId: 'pol-1', clientId: 'c1' });
      expect(rows[0].details).toEqual({ items, aggregate: null });
    });

    it('los snapshots de Veeam y JetBackup no llevan details', async () => {
      await svc.saveSnapshot('c1', 'VEEAM', [{
        jobId: 'j', jobName: 'J', jobType: 'Backup', isRunning: false, lastResult: 'Success', lastMessage: null,
        lastRunAt: null, hoursAgo: 1, isStale: false,
      }]);
      expect(mockSnapshotRepo.upsert.mock.calls[0][0][0].details).toBeNull();
    });

    it('un cliente con Veeam y Acronis junta los jobs de ambos', async () => {
      mockConfigRepo.findOne.mockResolvedValue({ id: 'v1', clientId: 'c1', clientName: 'Client 1', host: 'h', port: 9419, isEnabled: true, lastConnectedAt: null });
      mockIntegrationConfigSvc.getVeeamConfigDecrypted.mockResolvedValue({ username: 'u', password: 'p' });
      mockVeeamService.getJobStatuses.mockResolvedValue([
        { jobId: 'vj', jobName: 'VJ', jobType: 'Backup', isRunning: false, lastResult: 'Success', lastMessage: null, lastRunAt: null, hoursAgo: 1, isStale: false },
      ]);
      mockAcrRepo.find.mockResolvedValue([acrCfg()]);
      mockAcronisService.getJobStatuses.mockResolvedValue([acrJob({ lastResult: 'Warning' })]);
      const result = await svc.getClientStatus('c1');
      expect(result.jobs.map(j => j.provider).sort()).toEqual(['ACRONIS', 'VEEAM']);
      expect(result.status).toBe('warn');
    });

    it('getAllClientStatuses incluye clientes que solo tienen Acronis', async () => {
      mockConfigRepo.find.mockResolvedValue([]);
      mockAcrRepo.find.mockResolvedValue([acrCfg()]);
      mockAcronisService.getJobStatuses.mockResolvedValue([acrJob()]);
      const result = await svc.getAllClientStatuses();
      expect(result).toHaveLength(1);
      expect(result[0].jobs[0].provider).toBe('ACRONIS');
    });

    it('getAllClientStatuses devuelve disconnected si falla Acronis', async () => {
      mockConfigRepo.find.mockResolvedValue([]);
      mockAcrRepo.find.mockResolvedValue([acrCfg()]);
      mockAcronisService.getJobStatuses.mockRejectedValue(new Error('Acronis respondió HTTP 503'));
      const result = await svc.getAllClientStatuses();
      expect(result[0].status).toBe('disconnected');
    });

    it('getLastSnapshot reconstruye Acronis con su desglose e ignora planes ya no configurados', async () => {
      const lastRunAt = new Date(Date.now() - 2 * 3600000);
      const details = { items: [], aggregate: { total: 2, okCount: 2, warnCount: 0, critCount: 0, worst: [] } };
      mockConfigRepo.find.mockResolvedValue([]);
      mockAcrRepo.find.mockResolvedValue([acrCfg()]);
      mockSnapshotRepo.findOne.mockResolvedValue({ clientId: 'c1', snapshotDate: '2026-10-12' });
      mockSnapshotRepo.find.mockResolvedValue([
        { clientId: 'c1', provider: 'ACRONIS', jobId: 'pol-1', jobName: 'Plan 1', jobType: 'Acronis', result: 'Success', message: null, lastRunAt, hoursAgo: 2, details, snapshotDate: '2026-10-12' },
        { clientId: 'c1', provider: 'ACRONIS', jobId: 'pol-borrado', jobName: 'Viejo', jobType: 'Acronis', result: 'Failed', message: null, lastRunAt, hoursAgo: 2, details: null, snapshotDate: '2026-10-12' },
      ]);
      const result = await svc.getLastSnapshot();
      expect(result[0].jobs.map(j => j.jobId)).toEqual(['pol-1']);
      expect(result[0].jobs[0].provider).toBe('ACRONIS');
      expect(result[0].jobs[0].aggregate).toEqual(details.aggregate);
    });
  });

  describe('configs de Acronis', () => {
    it('listConfigs incluye los planes de Acronis con su proveedor', async () => {
      mockConfigRepo.find.mockResolvedValue([]);
      mockAcrRepo.find.mockResolvedValue([acrCfg()]);
      const list = await svc.listConfigs();
      expect(list.find(c => c.provider === 'ACRONIS')).toMatchObject({ id: 'ac1', policyId: 'pol-1', tenantName: 'Tenant 1' });
    });

    it('createAcronisConfigs guarda una fila por plan', async () => {
      mockAcrRepo.find.mockResolvedValue([]);
      mockAcrRepo.save.mockImplementation((rows: unknown[]) => Promise.resolve(rows.map((r, i) => ({ id: `n${i}`, ...(r as object) }))));
      const result = await svc.createAcronisConfigs({
        clientId: 'c1', clientName: 'Client 1', isEnabled: true,
        plans: [{ policyId: 'pol-1', policyName: 'Plan 1', tenantName: 'T' }, { policyId: 'pol-2', policyName: 'Plan 2' }],
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ provider: 'ACRONIS', clientId: 'c1', policyId: 'pol-1', tenantName: 'T' });
      expect(result[1].tenantName).toBe('');
    });

    it('createAcronisConfigs rechaza planes que ya están asignados', async () => {
      mockAcrRepo.find.mockResolvedValue([acrCfg({ clientName: 'Otro cliente' })]);
      await expect(svc.createAcronisConfigs({
        clientId: 'c2', clientName: 'Client 2', isEnabled: true, plans: [{ policyId: 'pol-1', policyName: 'Plan 1' }],
      })).rejects.toBeInstanceOf(ConflictException);
      expect(mockAcrRepo.save).not.toHaveBeenCalled();
    });

    it('updateAcronisConfig cambia isEnabled y lanza NotFound si no existe', async () => {
      mockAcrRepo.findOne.mockResolvedValue(acrCfg());
      mockAcrRepo.save.mockImplementation((r: unknown) => Promise.resolve(r));
      expect((await svc.updateAcronisConfig('ac1', { isEnabled: false })).isEnabled).toBe(false);
      mockAcrRepo.findOne.mockResolvedValue(null);
      await expect(svc.updateAcronisConfig('x', { isEnabled: false })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deleteAcronisConfig borra la fila', async () => {
      await svc.deleteAcronisConfig('ac1');
      expect(mockAcrRepo.delete).toHaveBeenCalledWith('ac1');
    });
  });

  describe('listAcronisPlans', () => {
    const plan = (policyId: string) => ({
      policyId, policyName: `Plan ${policyId}`, tenantId: 't', tenantName: 'Tenant', resourceTypes: ['machine'], resourceCount: 2,
    });

    it('marca los planes ya configurados, indica a qué cliente y propaga partial', async () => {
      mockAcronisService.listPlans.mockResolvedValue({ plans: [plan('pol-1'), plan('pol-2')], partial: true });
      mockAcrRepo.find.mockResolvedValue([acrCfg({ clientName: 'PSQ Hosting' })]);
      const res = await svc.listAcronisPlans();
      expect(mockAcronisService.listPlans).toHaveBeenCalledWith(ACR_CONN);
      expect(res.partial).toBe(true);
      expect(res.plans).toEqual([
        { policyId: 'pol-1', policyName: 'Plan pol-1', tenantName: 'Tenant', resourceTypes: ['machine'], resourceCount: 2, configured: true, configuredClientName: 'PSQ Hosting' },
        { policyId: 'pol-2', policyName: 'Plan pol-2', tenantName: 'Tenant', resourceTypes: ['machine'], resourceCount: 2, configured: false, configuredClientName: null },
      ]);
    });

    it('lanza BadRequest si Acronis no está configurado en Integraciones', async () => {
      mockIntegrationConfigSvc.getAcronisConfigDecrypted.mockResolvedValue({ baseUrl: '', clientId: '', clientSecret: '' });
      await expect(svc.listAcronisPlans()).rejects.toBeInstanceOf(BadRequestException);
      expect(mockAcronisService.listPlans).not.toHaveBeenCalled();
    });

    it('lanza BadGateway con el mensaje de Acronis cuando falla la consulta', async () => {
      mockAcronisService.listPlans.mockRejectedValue(new Error('Acronis rechazó la autenticación (HTTP 401)'));
      await expect(svc.listAcronisPlans()).rejects.toBeInstanceOf(BadGatewayException);
      await expect(svc.listAcronisPlans()).rejects.toThrow('HTTP 401');
    });
  });
});
