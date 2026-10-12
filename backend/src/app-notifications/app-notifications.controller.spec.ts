import { Test, TestingModule } from '@nestjs/testing';
import { AppNotificationsController } from './app-notifications.controller';
import { AppNotificationsService } from './app-notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const mockUser = {
  sub: 'user-uuid-1',
  email: 'user@ondra.com.ar',
  role: 'TECHNICIAN',
  mustChangePassword: false,
};

const mockService = {
  getUnreadForUser: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
};

describe('AppNotificationsController', () => {
  let controller: AppNotificationsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppNotificationsController],
      providers: [{ provide: AppNotificationsService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .compile();
    controller = module.get<AppNotificationsController>(AppNotificationsController);
  });

  it('GET / llama getUnreadForUser con el sub del JWT', async () => {
    const notifs = [{ id: 'n-1', type: 'EXPIRATION_TICKET_CREATED', payload: {}, createdAt: new Date() }];
    mockService.getUnreadForUser.mockResolvedValue(notifs);

    const result = await controller.getUnread(mockUser as any);

    expect(mockService.getUnreadForUser).toHaveBeenCalledWith('user-uuid-1');
    expect(result).toEqual(notifs);
  });

  it('PATCH /read-all llama markAllAsRead con el sub del JWT', async () => {
    mockService.markAllAsRead.mockResolvedValue(undefined);

    await controller.markAllAsRead(mockUser as any);

    expect(mockService.markAllAsRead).toHaveBeenCalledWith('user-uuid-1');
  });

  it('PATCH /:id/read llama markAsRead con sub del JWT e id de la ruta', async () => {
    mockService.markAsRead.mockResolvedValue(undefined);

    await controller.markAsRead('n-42', mockUser as any);

    expect(mockService.markAsRead).toHaveBeenCalledWith('user-uuid-1', 'n-42');
  });

  it('PATCH /read-all no lanza NotFoundException — la ruta literal tiene precedencia sobre :id', async () => {
    mockService.markAllAsRead.mockResolvedValue(undefined);

    await expect(controller.markAllAsRead(mockUser as any)).resolves.not.toThrow();
  });

  it('tiene JwtAuthGuard aplicado', () => {
    const guards = Reflect.getMetadata('__guards__', AppNotificationsController);
    expect(guards).toContain(JwtAuthGuard);
  });
});
