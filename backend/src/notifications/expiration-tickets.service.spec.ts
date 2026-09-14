import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ExpirationTicketsService } from './expiration-tickets.service';
import { NotificationsService } from './notifications.service';
import { ExpirationTicket } from './expiration-ticket.entity';
import { ExpirationItemDto } from './dto/expiration-item.dto';

describe('ExpirationTicketsService', () => {
  let service: ExpirationTicketsService;
  let notificationsService: { getExpirations: jest.Mock };
  let ticketRepo: { find: jest.Mock };

  const makeItem = (overrides: Partial<ExpirationItemDto> = {}): ExpirationItemDto => ({
    sourceId: 'd1', type: 'domain', clientId: 1, clientName: 'Acme',
    itemName: 'acme.com', expireDate: '2026-07-15', daysUntil: 17,
    ...overrides,
  });

  beforeEach(async () => {
    notificationsService = { getExpirations: jest.fn() };
    ticketRepo = { find: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpirationTicketsService,
        { provide: NotificationsService, useValue: notificationsService },
        { provide: getRepositoryToken(ExpirationTicket), useValue: ticketRepo },
      ],
    }).compile();

    service = module.get<ExpirationTicketsService>(ExpirationTicketsService);
  });

  describe('getExpirationsWithTickets', () => {
    it('delega en NotificationsService con el parámetro days', async () => {
      notificationsService.getExpirations.mockResolvedValue([]);
      await service.getExpirationsWithTickets(30);
      expect(notificationsService.getExpirations).toHaveBeenCalledWith(30);
    });

    it('no consulta el repositorio cuando InfraDoc no devuelve items', async () => {
      notificationsService.getExpirations.mockResolvedValue([]);
      await service.getExpirationsWithTickets();
      expect(ticketRepo.find).not.toHaveBeenCalled();
    });

    it('agrega odooTicketId cuando existe fila con odooTicketId no nulo', async () => {
      notificationsService.getExpirations.mockResolvedValue([makeItem()]);
      ticketRepo.find.mockResolvedValue([
        { type: 'domain', sourceId: 'd1', expireDate: '2026-07-15', odooTicketId: 142 },
      ]);

      const result = await service.getExpirationsWithTickets();
      expect(result[0].odooTicketId).toBe(142);
    });

    it('deja odooTicketId ausente cuando la fila tiene odooTicketId null (backlog pre-sembrado)', async () => {
      notificationsService.getExpirations.mockResolvedValue([makeItem()]);
      ticketRepo.find.mockResolvedValue([
        { type: 'domain', sourceId: 'd1', expireDate: '2026-07-15', odooTicketId: null },
      ]);

      const result = await service.getExpirationsWithTickets();
      expect(result[0].odooTicketId).toBeUndefined();
    });

    it('deja odooTicketId ausente cuando no hay fila para ese item', async () => {
      notificationsService.getExpirations.mockResolvedValue([makeItem()]);
      ticketRepo.find.mockResolvedValue([]);

      const result = await service.getExpirationsWithTickets();
      expect(result[0].odooTicketId).toBeUndefined();
    });

    it('no matchea si el expireDate difiere — una renovación cuenta como vencimiento nuevo', async () => {
      notificationsService.getExpirations.mockResolvedValue([makeItem({ expireDate: '2027-07-15' })]);
      ticketRepo.find.mockResolvedValue([
        { type: 'domain', sourceId: 'd1', expireDate: '2026-07-15', odooTicketId: 142 },
      ]);

      const result = await service.getExpirationsWithTickets();
      expect(result[0].odooTicketId).toBeUndefined();
    });

    it('no matchea si el type difiere con el mismo sourceId', async () => {
      notificationsService.getExpirations.mockResolvedValue([makeItem({ type: 'certificate' })]);
      ticketRepo.find.mockResolvedValue([
        { type: 'domain', sourceId: 'd1', expireDate: '2026-07-15', odooTicketId: 142 },
      ]);

      const result = await service.getExpirationsWithTickets();
      expect(result[0].odooTicketId).toBeUndefined();
    });
  });
});
