import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BackupsCron } from './backups.cron';
import { BackupsService } from './backups.service';
import { VeeamClientConfig } from './entities/veeam-client-config.entity';
import { JetbackupJobConfig } from './entities/jetbackup-job-config.entity';
import { VeeamService } from '../integrations/veeam/veeam.service';
import { JetbackupService } from '../integrations/jetbackup/jetbackup.service';
import { IntegrationConfigService } from '../integration-config/integration-config.service';

const veeamRepo = { find: jest.fn() };
const jetRepo = { find: jest.fn() };
const veeamService = { getJobStatuses: jest.fn() };
const jetbackupService = { getJobStatuses: jest.fn() };
const backupsService = { saveSnapshot: jest.fn().mockResolvedValue(undefined) };
const integrationConfig = { getVeeamConfigDecrypted: jest.fn(), getJetbackupConfigDecrypted: jest.fn() };

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
        { provide: VeeamService, useValue: veeamService },
        { provide: JetbackupService, useValue: jetbackupService },
        { provide: BackupsService, useValue: backupsService },
        { provide: IntegrationConfigService, useValue: integrationConfig },
      ],
    }).compile();
    cron = module.get(BackupsCron);
    jest.clearAllMocks();
    veeamRepo.find.mockResolvedValue([]);
    jetRepo.find.mockResolvedValue([]);
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
});
