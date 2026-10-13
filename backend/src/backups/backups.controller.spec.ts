import { Test } from '@nestjs/testing';
import { BackupsController } from './backups.controller';
import { BackupsService } from './backups.service';

const mockSvc = {
  getAllClientStatuses: jest.fn(),
  getClientStatus: jest.fn(),
  listConfigs: jest.fn(),
  createConfig: jest.fn(),
  updateConfig: jest.fn(),
  deleteConfig: jest.fn(),
  testConnection: jest.fn(),
  listJetbackupJobs: jest.fn(),
  createJetbackupConfigs: jest.fn(),
  updateJetbackupConfig: jest.fn(),
  deleteJetbackupConfig: jest.fn(),
  listAcronisPlans: jest.fn(),
  createAcronisConfigs: jest.fn(),
  updateAcronisConfig: jest.fn(),
  deleteAcronisConfig: jest.fn(),
};

describe('BackupsController', () => {
  let ctrl: BackupsController;
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [BackupsController],
      providers: [{ provide: BackupsService, useValue: mockSvc }],
    }).compile();
    ctrl = module.get(BackupsController);
    jest.clearAllMocks();
  });

  it('GET /backups → llama getAllClientStatuses', async () => {
    mockSvc.getAllClientStatuses.mockResolvedValue([]);
    const result = await ctrl.getAll();
    expect(mockSvc.getAllClientStatuses).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('POST /backups/configs/:id/test → devuelve resultado sin lanzar error si falla', async () => {
    mockSvc.testConnection.mockResolvedValue({ success: false, message: 'err' });
    const result = await ctrl.testConnection('id');
    expect(result.success).toBe(false);
  });

  it('GET /backups/jetbackup/jobs → llama listJetbackupJobs', async () => {
    mockSvc.listJetbackupJobs.mockResolvedValue([{ jobId: 'j1' }]);
    expect(await ctrl.listJetbackupJobs()).toEqual([{ jobId: 'j1' }]);
  });

  it('POST /backups/configs/jetbackup → llama createJetbackupConfigs con el dto', async () => {
    const dto = { clientId: 'c1', clientName: 'C', isEnabled: true, jobs: [{ jobId: 'j1', jobName: 'PSQ' }] };
    mockSvc.createJetbackupConfigs.mockResolvedValue([]);
    await ctrl.createJetbackupConfigs(dto);
    expect(mockSvc.createJetbackupConfigs).toHaveBeenCalledWith(dto);
  });

  it('PATCH /backups/configs/jetbackup/:id → llama updateJetbackupConfig', async () => {
    mockSvc.updateJetbackupConfig.mockResolvedValue({});
    await ctrl.updateJetbackupConfig('jc1', { isEnabled: false });
    expect(mockSvc.updateJetbackupConfig).toHaveBeenCalledWith('jc1', { isEnabled: false });
  });

  it('DELETE /backups/configs/jetbackup/:id → llama deleteJetbackupConfig', async () => {
    await ctrl.deleteJetbackupConfig('jc1');
    expect(mockSvc.deleteJetbackupConfig).toHaveBeenCalledWith('jc1');
  });

  it('GET /backups/acronis/plans → llama listAcronisPlans', async () => {
    mockSvc.listAcronisPlans.mockResolvedValue({ plans: [], partial: false });
    expect(await ctrl.listAcronisPlans()).toEqual({ plans: [], partial: false });
  });

  it('POST /backups/configs/acronis → llama createAcronisConfigs con el dto', async () => {
    const dto = { clientId: 'c1', clientName: 'C', isEnabled: true, plans: [{ policyId: 'p1', policyName: 'Plan' }] };
    mockSvc.createAcronisConfigs.mockResolvedValue([]);
    await ctrl.createAcronisConfigs(dto);
    expect(mockSvc.createAcronisConfigs).toHaveBeenCalledWith(dto);
  });

  it('PATCH /backups/configs/acronis/:id → llama updateAcronisConfig', async () => {
    mockSvc.updateAcronisConfig.mockResolvedValue({});
    await ctrl.updateAcronisConfig('ac1', { isEnabled: false });
    expect(mockSvc.updateAcronisConfig).toHaveBeenCalledWith('ac1', { isEnabled: false });
  });

  it('DELETE /backups/configs/acronis/:id → llama deleteAcronisConfig', async () => {
    await ctrl.deleteAcronisConfig('ac1');
    expect(mockSvc.deleteAcronisConfig).toHaveBeenCalledWith('ac1');
  });
});
