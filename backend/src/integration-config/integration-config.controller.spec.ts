import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationConfigController } from './integration-config.controller';
import { IntegrationConfigService } from './integration-config.service';
import { MASK } from './crypto.util';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

const mockUser = { sub: 'uid-1', email: 'admin@ondra.com.ar', role: 'ADMIN', mustChangePassword: false };
const mockOdooResp = { url: 'u', db: 'd', username: 'u', apiKey: MASK, helpdeskTeamId: 7, updatedAt: null, updatedBy: null };

const mockService = {
  getOdoo: jest.fn(), patchOdoo: jest.fn(), testOdoo: jest.fn(),
  getInfraDoc: jest.fn(), patchInfraDoc: jest.fn(), testInfraDoc: jest.fn(),
  getVmware: jest.fn(), patchVmware: jest.fn(), testVmware: jest.fn(),
};

describe('IntegrationConfigController', () => {
  let controller: IntegrationConfigController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IntegrationConfigController],
      providers: [{ provide: IntegrationConfigService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();
    controller = module.get<IntegrationConfigController>(IntegrationConfigController);
  });

  it('GET /odoo delega en service.getOdoo', async () => {
    mockService.getOdoo.mockResolvedValue(mockOdooResp);
    expect(await controller.getOdoo()).toEqual(mockOdooResp);
  });

  it('PATCH /odoo pasa email del JWT como updatedBy', async () => {
    mockService.patchOdoo.mockResolvedValue(mockOdooResp);
    await controller.patchOdoo({ url: 'u' }, mockUser as any);
    expect(mockService.patchOdoo).toHaveBeenCalledWith({ url: 'u' }, 'admin@ondra.com.ar');
  });

  it('POST /odoo/test delega en service.testOdoo', async () => {
    mockService.testOdoo.mockResolvedValue({ ok: true, message: 'OK' });
    expect(await controller.testOdoo()).toEqual({ ok: true, message: 'OK' });
  });
});
