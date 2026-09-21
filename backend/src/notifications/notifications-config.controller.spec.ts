import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsConfigController } from './notifications-config.controller';
import { ExpirationTicketsService } from './expiration-tickets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

const mockUser = { sub: 'uid-1', email: 'admin@ondra.com.ar', role: 'ADMIN', mustChangePassword: false };

const mockService = {
  saveTypeConfigs: jest.fn(),
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

  it('PATCH / pasa expirationsTypeConfigs y el email del JWT como updatedBy', async () => {
    const configs = { domain: { enabled: true, helpdeskTeamId: 9, daysAhead: 30, tagIds: [] } };
    mockService.saveTypeConfigs.mockResolvedValue({ expirationsTypeConfigs: configs });

    const result = await controller.patch({ expirationsTypeConfigs: configs }, mockUser as any);

    expect(mockService.saveTypeConfigs).toHaveBeenCalledWith(configs, 'admin@ondra.com.ar');
    expect(result).toEqual({ expirationsTypeConfigs: configs });
  });

  it('tiene JwtAuthGuard y RolesGuard aplicados', () => {
    const guards = Reflect.getMetadata('__guards__', NotificationsConfigController);
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);
  });
});
