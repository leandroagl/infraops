import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsController } from './notifications.controller';
import { ExpirationTicketsService } from './expiration-tickets.service';
import { ExpirationItemDto } from './dto/expiration-item.dto';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: { getExpirationsWithTickets: jest.Mock };

  const makeItem = (): ExpirationItemDto => ({
    sourceId: 'd1', type: 'domain', clientId: 1, clientName: 'Acme',
    itemName: 'acme.com', expireDate: '2026-07-15', daysUntil: 17,
  });

  beforeEach(async () => {
    service = { getExpirationsWithTickets: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: ExpirationTicketsService, useValue: service },
        { provide: JwtAuthGuard, useValue: { canActivate: () => true } },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  it('devuelve el array del servicio', async () => {
    service.getExpirationsWithTickets.mockResolvedValue([makeItem()]);
    const result = await controller.getExpirations(undefined);
    expect(result).toHaveLength(1);
  });

  it('parsea query param days a número y lo pasa al servicio', async () => {
    service.getExpirationsWithTickets.mockResolvedValue([]);
    await controller.getExpirations('30');
    expect(service.getExpirationsWithTickets).toHaveBeenCalledWith(30);
  });

  it('pasa undefined al servicio cuando days no se provee', async () => {
    service.getExpirationsWithTickets.mockResolvedValue([]);
    await controller.getExpirations(undefined);
    expect(service.getExpirationsWithTickets).toHaveBeenCalledWith(undefined);
  });

  it('tiene JwtAuthGuard aplicado', () => {
    const guards = Reflect.getMetadata('__guards__', NotificationsController);
    expect(guards).toContain(JwtAuthGuard);
  });
});
