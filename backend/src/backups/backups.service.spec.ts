import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BackupsService } from './backups.service';
import { VeeamClientConfig } from './entities/veeam-client-config.entity';
import { VeeamDailySnapshot } from './entities/veeam-daily-snapshot.entity';
import { VeeamService } from '../integrations/veeam/veeam.service';
import { IntegrationConfigService } from '../integration-config/integration-config.service';

const mockConfigRepo = { find: jest.fn(), findOne: jest.fn(), save: jest.fn(), delete: jest.fn(), create: jest.fn() };
const mockSnapshotRepo = {
  upsert: jest.fn().mockResolvedValue(undefined),
  findOne: jest.fn(),
  find: jest.fn(),
};
const mockVeeamService = { getJobStatuses: jest.fn(), testConnection: jest.fn() };
const mockIntegrationConfigSvc = { getVeeamConfigDecrypted: jest.fn() };

describe('BackupsService', () => {
  let svc: BackupsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BackupsService,
        { provide: getRepositoryToken(VeeamClientConfig), useValue: mockConfigRepo },
        { provide: getRepositoryToken(VeeamDailySnapshot), useValue: mockSnapshotRepo },
        { provide: VeeamService, useValue: mockVeeamService },
        { provide: IntegrationConfigService, useValue: mockIntegrationConfigSvc },
      ],
    }).compile();
    svc = module.get(BackupsService);
    jest.clearAllMocks();
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
      { clientId: 'c1', jobId: 'j1', jobName: 'Job1', jobType: 'Backup',
        result: 'Success', message: null, lastRunAt, hoursAgo: 2, snapshotDate: '2026-10-12' },
    ]);
    const result = await svc.getLastSnapshot();
    expect(result[0].status).toBe('ok');
    expect(result[0].isSnapshot).toBe(true);
  });

  it('getLastSnapshot retorna disconnectedDto para clientes deshabilitados', async () => {
    mockConfigRepo.find.mockResolvedValue([
      { id: '1', clientId: 'c1', clientName: 'Client 1', host: 'h', port: 9419, isEnabled: false, lastConnectedAt: null },
    ]);
    const result = await svc.getLastSnapshot();
    expect(result[0].status).toBe('disconnected');
    expect(mockSnapshotRepo.findOne).not.toHaveBeenCalled();
  });
});
