import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationConfigController } from './integration-config.controller';
import { IntegrationConfigService } from './integration-config.service';
import { MASK } from './crypto.util';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

const mockUser = { sub: 'uid-1', email: 'admin@ondra.com.ar', role: 'ADMIN', mustChangePassword: false };
const mockOdooResp = { url: 'u', db: 'd', username: 'u', apiKey: MASK, helpdeskTeamId: 7, updatedAt: null, updatedBy: null };

const mockService = {
  getOdooPublic: jest.fn(), getOdoo: jest.fn(), patchOdoo: jest.fn(), testOdoo: jest.fn(),
  getInfraDoc: jest.fn(), patchInfraDoc: jest.fn(), testInfraDoc: jest.fn(),
  getVmware: jest.fn(), patchVmware: jest.fn(), testVmware: jest.fn(),
  getJetbackup: jest.fn(), patchJetbackup: jest.fn(), testJetbackup: jest.fn(),
  getAcronis: jest.fn(), patchAcronis: jest.fn(), testAcronis: jest.fn(),
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

  it('GET /odoo/public delega en service.getOdooPublic', async () => {
    const pub = { ticketsBaseUrl: 'https://ondra.odoo.com/odoo/helpdesk/7/tickets' };
    mockService.getOdooPublic.mockResolvedValue(pub);
    expect(await controller.getOdooPublic()).toEqual(pub);
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

  it('GET /jetbackup delega en service.getJetbackup', async () => {
    const resp = { url: 'https://whm:2087', username: 'root', apiKey: MASK, updatedAt: null, updatedBy: null };
    mockService.getJetbackup.mockResolvedValue(resp);
    expect(await controller.getJetbackup()).toEqual(resp);
  });

  it('PATCH /jetbackup pasa email del JWT como updatedBy', async () => {
    mockService.patchJetbackup.mockResolvedValue({});
    await controller.patchJetbackup({ url: 'https://whm:2087' }, mockUser as any);
    expect(mockService.patchJetbackup).toHaveBeenCalledWith({ url: 'https://whm:2087' }, 'admin@ondra.com.ar');
  });

  it('POST /jetbackup/test delega en service.testJetbackup', async () => {
    mockService.testJetbackup.mockResolvedValue({ ok: true, message: 'Conexión exitosa' });
    expect(await controller.testJetbackup()).toEqual({ ok: true, message: 'Conexión exitosa' });
  });

  it('GET /acronis delega en service.getAcronis', async () => {
    const resp = { baseUrl: 'https://eu2-cloud.acronis.com', clientId: MASK, clientSecret: MASK, updatedAt: null, updatedBy: null };
    mockService.getAcronis.mockResolvedValue(resp);
    expect(await controller.getAcronis()).toEqual(resp);
  });

  it('PATCH /acronis pasa email del JWT como updatedBy', async () => {
    mockService.patchAcronis.mockResolvedValue({});
    await controller.patchAcronis({ baseUrl: 'https://eu2-cloud.acronis.com' }, mockUser as any);
    expect(mockService.patchAcronis).toHaveBeenCalledWith({ baseUrl: 'https://eu2-cloud.acronis.com' }, 'admin@ondra.com.ar');
  });

  it('POST /acronis/test delega en service.testAcronis', async () => {
    mockService.testAcronis.mockResolvedValue({ ok: true, message: 'Conexión exitosa' });
    expect(await controller.testAcronis()).toEqual({ ok: true, message: 'Conexión exitosa' });
  });
});
