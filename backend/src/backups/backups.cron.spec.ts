import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BackupsCron } from './backups.cron';
import { BackupsService } from './backups.service';
import { VeeamClientConfig } from './entities/veeam-client-config.entity';
import { JetbackupJobConfig } from './entities/jetbackup-job-config.entity';
import { AcronisPlanConfig } from './entities/acronis-plan-config.entity';
import { VeeamService } from '../integrations/veeam/veeam.service';
import { JetbackupService } from '../integrations/jetbackup/jetbackup.service';
import { AcronisService } from '../integrations/acronis/acronis.service';
import { IntegrationConfigService } from '../integration-config/integration-config.service';

const veeamRepo = { find: jest.fn() };
const jetRepo = { find: jest.fn() };
const acrRepo = { find: jest.fn() };
const veeamService = { getJobStatuses: jest.fn() };
const jetbackupService = { getJobStatuses: jest.fn() };
const acronisService = { getJobStatuses: jest.fn() };
const backupsService = { saveSnapshot: jest.fn().mockResolvedValue(undefined) };
const integrationConfig = {
  getVeeamConfigDecrypted: jest.fn(), getJetbackupConfigDecrypted: jest.fn(), getAcronisConfigDecrypted: jest.fn(),
};
const ACR_CONN = { baseUrl: 'https://eu2-cloud.acronis.com', clientId: 'cid', clientSecret: 'sec' };

const CONN = { url: 'https://whm:2087', username: 'root', apiKey: 'tok' };
const job = (id: string) => ({ jobId: id, jobName: id, jobType: 'x', isRunning: false, lastResult: 'Success', lastMessage: null, lastRunAt: null, hoursAgo: 1, isStale: false });

describe('BackupsCron', () => {
  let cron: BackupsCron;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BackupsCron,
        { provide: getRepositoryToken(VeeamClientConfig), useValue: veeamRepo },
        { provide: getRepositoryToken(JetbackupJobConfig), useValue: jetRepo },
        { provide: getRepositoryToken(AcronisPlanConfig), useValue: acrRepo },
        { provide: VeeamService, useValue: veeamService },
        { provide: JetbackupService, useValue: jetbackupService },
        { provide: AcronisService, useValue: acronisService },
        { provide: BackupsService, useValue: backupsService },
        { provide: IntegrationConfigService, useValue: integrationConfig },
      ],
    }).compile();
    cron = module.get(BackupsCron);
    jest.clearAllMocks();
    veeamRepo.find.mockResolvedValue([]);
    jetRepo.find.mockResolvedValue([]);
    acrRepo.find.mockResolvedValue([]);
    integrationConfig.getAcronisConfigDecrypted.mockResolvedValue(ACR_CONN);
    integrationConfig.getVeeamConfigDecrypted.mockResolvedValue({ username: 'u', password: 'p' });
    integrationConfig.getJetbackupConfigDecrypted.mockResolvedValue(CONN);
  });

  it('guarda el snapshot de Veeam de cada cliente habilitado', async () => {
    veeamRepo.find.mockResolvedValue([{ clientId: 'c1', host: 'h', port: 9419, isEnabled: true }]);
    veeamService.getJobStatuses.mockResolvedValue([job('v1')]);
    await cron.runDailySnapshot();
    expect(backupsService.saveSnapshot).toHaveBeenCalledWith('c1', 'VEEAM', [job('v1')]);
  });

  it('agrupa los jobs de JetBackup por cliente y guarda un snapshot por cliente', async () => {
    jetRepo.find.mockResolvedValue([
      { clientId: 'c1', jobId: 'a', jobName: 'A', isEnabled: true },
      { clientId: 'c1', jobId: 'b', jobName: 'B', isEnabled: true },
      { clientId: 'c2', jobId: 'c', jobName: 'C', isEnabled: true },
    ]);
    jetbackupService.getJobStatuses.mockImplementation((_c: unknown, refs: { jobId: string }[]) =>
      Promise.resolve(refs.map(r => job(r.jobId))));
    await cron.runDailySnapshot();
    expect(jetbackupService.getJobStatuses).toHaveBeenCalledWith(CONN, [
      { jobId: 'a', jobName: 'A' }, { jobId: 'b', jobName: 'B' },
    ]);
    expect(backupsService.saveSnapshot).toHaveBeenCalledWith('c1', 'JETBACKUP', [job('a'), job('b')]);
    expect(backupsService.saveSnapshot).toHaveBeenCalledWith('c2', 'JETBACKUP', [job('c')]);
  });

  it('solo consulta los jobs de JetBackup habilitados', async () => {
    jetRepo.find.mockResolvedValue([{ clientId: 'c1', jobId: 'a', jobName: 'A', isEnabled: true }]);
    jetbackupService.getJobStatuses.mockResolvedValue([job('a')]);
    await cron.runDailySnapshot();
    expect(jetRepo.find).toHaveBeenCalledWith({ where: { isEnabled: true } });
  });

  it('un fallo de JetBackup no impide guardar el snapshot de Veeam', async () => {
    veeamRepo.find.mockResolvedValue([{ clientId: 'c1', host: 'h', port: 9419, isEnabled: true }]);
    veeamService.getJobStatuses.mockResolvedValue([job('v1')]);
    jetRepo.find.mockResolvedValue([{ clientId: 'c2', jobId: 'a', jobName: 'A', isEnabled: true }]);
    jetbackupService.getJobStatuses.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(cron.runDailySnapshot()).resolves.toBeUndefined();
    expect(backupsService.saveSnapshot).toHaveBeenCalledWith('c1', 'VEEAM', [job('v1')]);
    expect(backupsService.saveSnapshot).not.toHaveBeenCalledWith('c2', 'JETBACKUP', expect.anything());
  });

  it('un fallo de Veeam en un cliente no impide el snapshot de JetBackup', async () => {
    veeamRepo.find.mockResolvedValue([{ clientId: 'c1', host: 'h', port: 9419, isEnabled: true }]);
    veeamService.getJobStatuses.mockRejectedValue(new Error('boom'));
    jetRepo.find.mockResolvedValue([{ clientId: 'c2', jobId: 'a', jobName: 'A', isEnabled: true }]);
    jetbackupService.getJobStatuses.mockResolvedValue([job('a')]);
    await cron.runDailySnapshot();
    expect(backupsService.saveSnapshot).toHaveBeenCalledWith('c2', 'JETBACKUP', [job('a')]);
  });

  describe('Acronis', () => {
    const plan = (clientId: string, policyId: string) => ({ clientId, policyId, policyName: `Plan ${policyId}`, isEnabled: true });

    it('agrupa los planes por cliente y guarda un snapshot por cliente', async () => {
      acrRepo.find.mockResolvedValue([plan('c1', 'a'), plan('c1', 'b'), plan('c2', 'c')]);
      acronisService.getJobStatuses.mockImplementation((_c: unknown, refs: { policyId: string }[]) =>
        Promise.resolve(refs.map(r => job(r.policyId))));
      await cron.runDailySnapshot();
      expect(acronisService.getJobStatuses).toHaveBeenCalledWith(ACR_CONN, [
        { policyId: 'a', policyName: 'Plan a' }, { policyId: 'b', policyName: 'Plan b' },
      ]);
      expect(backupsService.saveSnapshot).toHaveBeenCalledWith('c1', 'ACRONIS', [job('a'), job('b')]);
      expect(backupsService.saveSnapshot).toHaveBeenCalledWith('c2', 'ACRONIS', [job('c')]);
    });

    it('solo consulta los planes habilitados', async () => {
      acrRepo.find.mockResolvedValue([plan('c1', 'a')]);
      acronisService.getJobStatuses.mockResolvedValue([job('a')]);
      await cron.runDailySnapshot();
      expect(acrRepo.find).toHaveBeenCalledWith({ where: { isEnabled: true } });
    });

    it('no consulta Acronis si no hay planes configurados', async () => {
      await cron.runDailySnapshot();
      expect(acronisService.getJobStatuses).not.toHaveBeenCalled();
    });

    it('un fallo de Acronis en un cliente no impide el snapshot de otro ni de Veeam', async () => {
      veeamRepo.find.mockResolvedValue([{ clientId: 'c0', host: 'h', port: 9419, isEnabled: true }]);
      veeamService.getJobStatuses.mockResolvedValue([job('v1')]);
      acrRepo.find.mockResolvedValue([plan('c1', 'a'), plan('c2', 'b')]);
      acronisService.getJobStatuses
        .mockRejectedValueOnce(new Error('Acronis respondió HTTP 503'))
        .mockResolvedValueOnce([job('b')]);
      await expect(cron.runDailySnapshot()).resolves.toBeUndefined();
      expect(backupsService.saveSnapshot).toHaveBeenCalledWith('c0', 'VEEAM', [job('v1')]);
      expect(backupsService.saveSnapshot).toHaveBeenCalledWith('c2', 'ACRONIS', [job('b')]);
      expect(backupsService.saveSnapshot).not.toHaveBeenCalledWith('c1', 'ACRONIS', expect.anything());
    });

    it('un fallo al leer la config de Acronis no rompe el cron', async () => {
      acrRepo.find.mockResolvedValue([plan('c1', 'a')]);
      integrationConfig.getAcronisConfigDecrypted.mockRejectedValue(new Error('clave inválida'));
      await expect(cron.runDailySnapshot()).resolves.toBeUndefined();
    });
  });
});
