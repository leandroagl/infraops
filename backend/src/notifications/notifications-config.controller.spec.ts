import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsConfigController } from './notifications-config.controller';
import { ExpirationTicketsService } from './expiration-tickets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

const mockUser = { sub: 'uid-1', email: 'admin@ondra.com.ar', role: 'ADMIN', mustChangePassword: false };

const mockService = {
  saveTypeConfig: jest.fn(),
  getUrgentBacklogPreview: jest.fn(),
  createUrgentBacklogTickets: jest.fn(),
};

describe('NotificationsConfigController', () => {
  let controller: NotificationsConfigController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsConfigController],
      providers: [{ provide: ExpirationTicketsService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();
    controller = module.get<NotificationsConfigController>(NotificationsConfigController);
  });

  it('PATCH /:type pasa el type de la URL, el body y el email del JWT como updatedBy', async () => {
    const entry = { enabled: true, helpdeskTeamId: 9, daysAhead: 30, tagIds: [] };
    mockService.saveTypeConfig.mockResolvedValue({ expirationsTypeConfigs: { domain: entry } });

    const result = await controller.patch('domain', entry, mockUser as any);

    expect(mockService.saveTypeConfig).toHaveBeenCalledWith('domain', entry, 'admin@ondra.com.ar');
    expect(result).toEqual({ expirationsTypeConfigs: { domain: entry } });
  });

  it('GET /urgent-preview llama getUrgentBacklogPreview con minDays y maxDays parseados', async () => {
    mockService.getUrgentBacklogPreview.mockResolvedValue({ count: 2, items: [] });
    const result = await controller.urgentPreview('6', '17');
    expect(mockService.getUrgentBacklogPreview).toHaveBeenCalledWith(6, 17);
    expect(result).toEqual({ count: 2, items: [] });
  });

  it('GET /urgent-preview usa defaults (0, 17) si no se pasan los días', async () => {
    mockService.getUrgentBacklogPreview.mockResolvedValue({ count: 0, items: [] });
    await controller.urgentPreview(undefined, undefined);
    expect(mockService.getUrgentBacklogPreview).toHaveBeenCalledWith(0, 17);
  });

  it('POST /urgent-tickets llama createUrgentBacklogTickets con minDays y maxDays parseados', async () => {
    mockService.createUrgentBacklogTickets.mockResolvedValue({ created: 3, errors: 0 });
    const result = await controller.createUrgentTickets('6', '17');
    expect(mockService.createUrgentBacklogTickets).toHaveBeenCalledWith(6, 17);
    expect(result).toEqual({ created: 3, errors: 0 });
  });

  it('POST /urgent-tickets usa defaults (0, 17) si no se pasan los días', async () => {
    mockService.createUrgentBacklogTickets.mockResolvedValue({ created: 0, errors: 0 });
    await controller.createUrgentTickets(undefined, undefined);
    expect(mockService.createUrgentBacklogTickets).toHaveBeenCalledWith(0, 17);
  });

  it('tiene JwtAuthGuard y RolesGuard aplicados', () => {
    const guards = Reflect.getMetadata('__guards__', NotificationsConfigController);
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);
  });
});
