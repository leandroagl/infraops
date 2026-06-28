import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ExpirationItemDto } from './dto/expiration-item.dto';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: { getExpirations: jest.Mock };

  const makeItem = (): ExpirationItemDto => ({
    type: 'domain', clientId: 1, clientName: 'Acme',
    itemName: 'acme.com', expireDate: '2026-07-15', daysUntil: 17,
  });

  beforeEach(async () => {
    service = { getExpirations: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: service },
        { provide: JwtAuthGuard, useValue: { canActivate: () => true } },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  it('devuelve el array del servicio', async () => {
    service.getExpirations.mockResolvedValue([makeItem()]);
    const result = await controller.getExpirations(undefined);
    expect(result).toHaveLength(1);
  });

  it('parsea query param days a número y lo pasa al servicio', async () => {
    service.getExpirations.mockResolvedValue([]);
    await controller.getExpirations('30');
    expect(service.getExpirations).toHaveBeenCalledWith(30);
  });

  it('pasa undefined al servicio cuando days no se provee', async () => {
    service.getExpirations.mockResolvedValue([]);
    await controller.getExpirations(undefined);
    expect(service.getExpirations).toHaveBeenCalledWith(undefined);
  });

  it('tiene JwtAuthGuard aplicado', () => {
    const guards = Reflect.getMetadata('__guards__', NotificationsController);
    expect(guards).toContain(JwtAuthGuard);
  });
});
