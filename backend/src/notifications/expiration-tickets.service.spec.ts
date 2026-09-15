import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ExpirationTicketsService } from './expiration-tickets.service';
import { NotificationsService } from './notifications.service';
import { ExpirationTicket } from './expiration-ticket.entity';
import { ExpirationItemDto } from './dto/expiration-item.dto';
import { OdooService } from '../integrations/odoo/odoo.service';
import { IntegrationConfigService } from '../integration-config/integration-config.service';
import { Client } from '../clients/client.entity';

describe('ExpirationTicketsService', () => {
  let service: ExpirationTicketsService;
  let notificationsService: { getExpirations: jest.Mock };
  let ticketRepo: { find: jest.Mock; save: jest.Mock };
  let odooService: { createExpirationTicket: jest.Mock };
  let integrationConfigService: { getOdooConfigDecrypted: jest.Mock };
  let clientRepo: { findOne: jest.Mock };

  const makeItem = (overrides: Partial<ExpirationItemDto> = {}): ExpirationItemDto => ({
    sourceId: 'd1', type: 'domain', clientId: 1, clientName: 'Acme',
    itemName: 'acme.com', expireDate: '2026-07-15', daysUntil: 17,
    ...overrides,
  });

  const defaultConfig = {
    url: 'u', db: 'd', username: 'u', apiKey: 'k',
    helpdeskTeamId: 7, expirationsHelpdeskTeamId: 9,
    expirationsTicketDaysAhead: 30, expirationsTagIds: [],
    stageInProgressName: 'En curso', stageNotDoneName: 'No realizadas', stageDoneName: 'Hecho',
  };

  beforeEach(async () => {
    notificationsService = { getExpirations: jest.fn() };
    ticketRepo = { find: jest.fn().mockResolvedValue([]), save: jest.fn().mockResolvedValue(undefined) };
    odooService = { createExpirationTicket: jest.fn() };
    integrationConfigService = { getOdooConfigDecrypted: jest.fn().mockResolvedValue(defaultConfig) };
    clientRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpirationTicketsService,
        { provide: NotificationsService,      useValue: notificationsService },
        { provide: getRepositoryToken(ExpirationTicket), useValue: ticketRepo },
        { provide: OdooService,               useValue: odooService },
        { provide: IntegrationConfigService,  useValue: integrationConfigService },
        { provide: getRepositoryToken(Client), useValue: clientRepo },
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

  describe('createPendingExpirationTickets', () => {
    it('retorna sin hacer nada si expirationsHelpdeskTeamId no está configurado', async () => {
      integrationConfigService.getOdooConfigDecrypted.mockResolvedValue({
        ...defaultConfig, expirationsHelpdeskTeamId: null,
      });
      await service.createPendingExpirationTickets();
      expect(notificationsService.getExpirations).not.toHaveBeenCalled();
      expect(odooService.createExpirationTicket).not.toHaveBeenCalled();
    });

    it('no procesa items con daysUntil > daysAhead', async () => {
      notificationsService.getExpirations.mockResolvedValue([makeItem({ daysUntil: 31 })]);
      // getExpirations ya filtra por daysAhead al ser llamado con el parámetro
      // Este test verifica que getExpirations se llama con el valor correcto
      await service.createPendingExpirationTickets();
      expect(notificationsService.getExpirations).toHaveBeenCalledWith(30);
    });

    it('crea ticket y persiste para item dentro del umbral sin ticket existente', async () => {
      notificationsService.getExpirations.mockResolvedValue([makeItem()]);
      ticketRepo.find.mockResolvedValue([]);
      clientRepo.findOne.mockResolvedValue({ id: 'client-uuid-1' });
      odooService.createExpirationTicket.mockResolvedValue(500);

      await service.createPendingExpirationTickets();

      expect(odooService.createExpirationTicket).toHaveBeenCalledWith(
        expect.objectContaining({ sourceId: 'd1', type: 'domain' }),
        'client-uuid-1',
      );
      expect(ticketRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'domain', sourceId: 'd1',
          expireDate: '2026-07-15', odooTicketId: 500,
          clientId: 'client-uuid-1',
        }),
      );
    });

    it('skippea item que ya tiene registro en expiration_tickets', async () => {
      notificationsService.getExpirations.mockResolvedValue([makeItem()]);
      ticketRepo.find.mockResolvedValue([
        { type: 'domain', sourceId: 'd1', expireDate: '2026-07-15', odooTicketId: 100 },
      ]);

      await service.createPendingExpirationTickets();

      expect(odooService.createExpirationTicket).not.toHaveBeenCalled();
    });

    it('error en un item no aborta el batch — continúa con el siguiente', async () => {
      notificationsService.getExpirations.mockResolvedValue([
        makeItem({ sourceId: 'd1' }),
        makeItem({ sourceId: 'd2', itemName: 'otro.com' }),
      ]);
      ticketRepo.find.mockResolvedValue([]);
      clientRepo.findOne.mockResolvedValue({ id: 'client-uuid-1' });
      odooService.createExpirationTicket
        .mockRejectedValueOnce(new Error('Odoo error'))
        .mockResolvedValueOnce(501);

      await service.createPendingExpirationTickets();

      expect(odooService.createExpirationTicket).toHaveBeenCalledTimes(2);
      expect(ticketRepo.save).toHaveBeenCalledTimes(1);
    });

    it('skippea item cuando el cliente InfraDoc no existe en InfraOps', async () => {
      notificationsService.getExpirations.mockResolvedValue([makeItem({ clientId: 999 })]);
      ticketRepo.find.mockResolvedValue([]);
      clientRepo.findOne.mockResolvedValue(null);

      await service.createPendingExpirationTickets();

      expect(odooService.createExpirationTicket).not.toHaveBeenCalled();
    });
  });
});
