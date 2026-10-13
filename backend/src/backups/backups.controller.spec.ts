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
});
