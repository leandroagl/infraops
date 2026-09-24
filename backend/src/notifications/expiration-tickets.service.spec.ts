import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ExpirationTicketsService } from './expiration-tickets.service';
import { NotificationsService } from './notifications.service';
import { ExpirationTicket } from './expiration-ticket.entity';
import { ExpirationItemDto } from './dto/expiration-item.dto';
import { OdooService } from '../integrations/odoo/odoo.service';
import { IntegrationConfigService } from '../integration-config/integration-config.service';
import { Client } from '../clients/client.entity';
import { TasksService } from '../tasks/tasks.service';
import { TaskType } from '../tasks/task-type.enum';

describe('ExpirationTicketsService', () => {
  let service: ExpirationTicketsService;
  let notificationsService: { getExpirations: jest.Mock };
  let ticketRepo: { find: jest.Mock; findOne: jest.Mock; save: jest.Mock; insert: jest.Mock; update: jest.Mock };
  let odooService: { createExpirationTicket: jest.Mock; getHelpdeskSlas: jest.Mock };
  let integrationConfigService: { getOdooConfigDecrypted: jest.Mock; getOdoo: jest.Mock; patchOdoo: jest.Mock };
  let clientRepo: { findOne: jest.Mock; find: jest.Mock };
  let tasksService: { createFromExistingTicket: jest.Mock };

  const makeItem = (overrides: Partial<ExpirationItemDto> = {}): ExpirationItemDto => ({
    sourceId: 'd1', type: 'domain', clientId: 1, clientName: 'Acme',
    itemName: 'acme.com', expireDate: '2026-07-15', daysUntil: 17,
    ...overrides,
  });

  const defaultConfig = {
    url: 'u', db: 'd', username: 'u', apiKey: 'k',
    helpdeskTeamId: 7, expirationsHelpdeskTeamId: 9,
    expirationsTicketDaysAhead: 30, expirationsTagIds: [],
    expirationsTypeConfigs: {
      domain: { enabled: true, helpdeskTeamId: 9, daysAhead: 30, tagIds: [] },
    },
    stageInProgressName: 'En curso', stageNotDoneName: 'No realizadas', stageDoneName: 'Hecho',
  };

  beforeEach(async () => {
    notificationsService = { getExpirations: jest.fn() };
    ticketRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue({ id: 'ticket-row-1' }),
      insert: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    };
    odooService = { createExpirationTicket: jest.fn(), getHelpdeskSlas: jest.fn().mockResolvedValue([]) };
    integrationConfigService = {
      getOdooConfigDecrypted: jest.fn().mockResolvedValue(defaultConfig),
      getOdoo: jest.fn().mockResolvedValue(defaultConfig),
      patchOdoo: jest.fn(),
    };
    clientRepo = { findOne: jest.fn(), find: jest.fn().mockResolvedValue([]) };
    tasksService = { createFromExistingTicket: jest.fn().mockResolvedValue({ id: 'task-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpirationTicketsService,
        { provide: NotificationsService,      useValue: notificationsService },
        { provide: getRepositoryToken(ExpirationTicket), useValue: ticketRepo },
        { provide: OdooService,               useValue: odooService },
        { provide: IntegrationConfigService,  useValue: integrationConfigService },
        { provide: getRepositoryToken(Client), useValue: clientRepo },
        { provide: TasksService,              useValue: tasksService },
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

  describe('getExpirationByTaskId', () => {
    it('devuelve null si no hay fila con ese taskId', async () => {
      ticketRepo.findOne.mockResolvedValue(null);

      const result = await service.getExpirationByTaskId('task-1');

      expect(result).toBeNull();
      expect(ticketRepo.findOne).toHaveBeenCalledWith({ where: { taskId: 'task-1' } });
    });

    it('devuelve el detalle enriquecido con el ítem vivo de InfraDoc cuando existe', async () => {
      ticketRepo.findOne.mockResolvedValue({
        type: 'domain', sourceId: 'd1', expireDate: '2026-07-15',
        clientId: 'client-uuid-1', odooTicketId: 500, taskId: 'task-1',
      });
      notificationsService.getExpirations.mockResolvedValue([makeItem()]);

      const result = await service.getExpirationByTaskId('task-1');

      expect(notificationsService.getExpirations).toHaveBeenCalledWith();
      expect(result).toEqual(expect.objectContaining({
        type: 'domain', sourceId: 'd1', expireDate: '2026-07-15',
        clientId: 'client-uuid-1', clientName: 'Acme', itemName: 'acme.com',
        daysUntil: 17, odooTicketId: 500,
      }));
    });

    it('devuelve un detalle parcial (sin itemName) si el ítem ya no aparece en InfraDoc', async () => {
      ticketRepo.findOne.mockResolvedValue({
        type: 'domain', sourceId: 'd1', expireDate: '2026-07-15',
        clientId: 'client-uuid-1', odooTicketId: 500, taskId: 'task-1',
      });
      notificationsService.getExpirations.mockResolvedValue([]);

      const result = await service.getExpirationByTaskId('task-1');

      expect(result).toEqual(expect.objectContaining({
        type: 'domain', sourceId: 'd1', expireDate: '2026-07-15',
        clientId: 'client-uuid-1', itemName: null, daysUntil: null, odooTicketId: 500,
      }));
    });

    it('incluye defaultTimeMinutes resuelto desde expirationsTypeConfigs para el tipo de la fila', async () => {
      ticketRepo.findOne.mockResolvedValue({
        type: 'domain', sourceId: 'd1', expireDate: '2026-07-15',
        clientId: 'client-uuid-1', odooTicketId: 500, taskId: 'task-1',
      });
      notificationsService.getExpirations.mockResolvedValue([makeItem()]);
      integrationConfigService.getOdoo.mockResolvedValue({
        ...defaultConfig,
        expirationsTypeConfigs: {
          domain: { enabled: true, helpdeskTeamId: 9, daysAhead: 30, tagIds: [], defaultTimeMinutes: 20 },
        },
      });

      const result = await service.getExpirationByTaskId('task-1');

      expect(result?.defaultTimeMinutes).toBe(20);
    });

    it('defaultTimeMinutes es null si no hay config para ese tipo', async () => {
      ticketRepo.findOne.mockResolvedValue({
        type: 'certificate', sourceId: 'c1', expireDate: '2026-07-15',
        clientId: 'client-uuid-1', odooTicketId: 500, taskId: 'task-1',
      });
      notificationsService.getExpirations.mockResolvedValue([]);
      integrationConfigService.getOdoo.mockResolvedValue(defaultConfig);

      const result = await service.getExpirationByTaskId('task-1');

      expect(result?.defaultTimeMinutes).toBeNull();
    });

    it('incluye teamSlas con los SLAs del equipo configurado para el tipo', async () => {
      ticketRepo.findOne.mockResolvedValue({
        type: 'domain', sourceId: 'd1', expireDate: '2026-07-15',
        clientId: 'client-uuid-1', odooTicketId: 500, taskId: 'task-1',
      });
      notificationsService.getExpirations.mockResolvedValue([makeItem()]);
      odooService.getHelpdeskSlas.mockResolvedValue([{ id: 5, name: 'SLA Normal', time_days: 18 }]);

      const result = await service.getExpirationByTaskId('task-1');

      expect(odooService.getHelpdeskSlas).toHaveBeenCalledWith(9);
      expect(result?.teamSlas).toEqual([{ id: 5, name: 'SLA Normal', time_days: 18 }]);
    });

    it('teamSlas es null si el tipo no tiene helpdeskTeamId configurado', async () => {
      ticketRepo.findOne.mockResolvedValue({
        type: 'certificate', sourceId: 'c1', expireDate: '2026-07-15',
        clientId: 'client-uuid-1', odooTicketId: 500, taskId: 'task-1',
      });
      notificationsService.getExpirations.mockResolvedValue([]);
      integrationConfigService.getOdoo.mockResolvedValue({
        ...defaultConfig,
        expirationsTypeConfigs: {
          certificate: { enabled: false, helpdeskTeamId: null, daysAhead: 30, tagIds: [] },
        },
      });

      const result = await service.getExpirationByTaskId('task-1');

      expect(odooService.getHelpdeskSlas).not.toHaveBeenCalled();
      expect(result?.teamSlas).toBeNull();
    });

    it('teamSlas es null si la consulta de SLAs falla (degradación graceful)', async () => {
      ticketRepo.findOne.mockResolvedValue({
        type: 'domain', sourceId: 'd1', expireDate: '2026-07-15',
        clientId: 'client-uuid-1', odooTicketId: 500, taskId: 'task-1',
      });
      notificationsService.getExpirations.mockResolvedValue([makeItem()]);
      odooService.getHelpdeskSlas.mockRejectedValue(new Error('Odoo no disponible'));

      const result = await service.getExpirationByTaskId('task-1');

      expect(result?.teamSlas).toBeNull();
    });
  });

  describe('createPendingExpirationTickets', () => {
    it('retorna sin hacer nada si ningún tipo está habilitado con equipo configurado', async () => {
      integrationConfigService.getOdooConfigDecrypted.mockResolvedValue({
        ...defaultConfig, expirationsTypeConfigs: {},
      });
      await service.createPendingExpirationTickets();
      expect(notificationsService.getExpirations).not.toHaveBeenCalled();
      expect(odooService.createExpirationTicket).not.toHaveBeenCalled();
    });

    it('retorna sin hacer nada si el único tipo configurado está deshabilitado', async () => {
      integrationConfigService.getOdooConfigDecrypted.mockResolvedValue({
        ...defaultConfig,
        expirationsTypeConfigs: { domain: { enabled: false, helpdeskTeamId: 9, daysAhead: 30, tagIds: [] } },
      });
      await service.createPendingExpirationTickets();
      expect(notificationsService.getExpirations).not.toHaveBeenCalled();
    });

    it('retorna sin hacer nada si el tipo habilitado no tiene helpdeskTeamId', async () => {
      integrationConfigService.getOdooConfigDecrypted.mockResolvedValue({
        ...defaultConfig,
        expirationsTypeConfigs: { domain: { enabled: true, helpdeskTeamId: null, daysAhead: 30, tagIds: [] } },
      });
      await service.createPendingExpirationTickets();
      expect(notificationsService.getExpirations).not.toHaveBeenCalled();
    });

    it('pide vencimientos usando el mayor daysAhead entre los tipos habilitados', async () => {
      integrationConfigService.getOdooConfigDecrypted.mockResolvedValue({
        ...defaultConfig,
        expirationsTypeConfigs: {
          domain:   { enabled: true, helpdeskTeamId: 9,  daysAhead: 15, tagIds: [] },
          software: { enabled: true, helpdeskTeamId: 11, daysAhead: 45, tagIds: [] },
        },
      });
      notificationsService.getExpirations.mockResolvedValue([]);
      await service.createPendingExpirationTickets();
      expect(notificationsService.getExpirations).toHaveBeenCalledWith(45);
    });

    it('no crea ticket para un item cuyo daysUntil supera el daysAhead propio de su tipo', async () => {
      notificationsService.getExpirations.mockResolvedValue([makeItem({ daysUntil: 31 })]);
      await service.createPendingExpirationTickets();
      expect(odooService.createExpirationTicket).not.toHaveBeenCalled();
    });

    it('no crea ticket para un tipo deshabilitado aunque otro tipo sí esté habilitado', async () => {
      integrationConfigService.getOdooConfigDecrypted.mockResolvedValue({
        ...defaultConfig,
        expirationsTypeConfigs: {
          domain:   { enabled: false, helpdeskTeamId: 9,  daysAhead: 30, tagIds: [] },
          software: { enabled: true,  helpdeskTeamId: 11, daysAhead: 30, tagIds: [] },
        },
      });
      notificationsService.getExpirations.mockResolvedValue([makeItem({ type: 'domain' })]);
      clientRepo.findOne.mockResolvedValue({ id: 'client-uuid-1' });

      await service.createPendingExpirationTickets();

      expect(odooService.createExpirationTicket).not.toHaveBeenCalled();
    });

    it('crea ticket y persiste para item dentro del umbral sin ticket existente', async () => {
      notificationsService.getExpirations.mockResolvedValue([makeItem()]);
      ticketRepo.find.mockResolvedValue([]);
      clientRepo.findOne.mockResolvedValue({ id: 'client-uuid-1' });
      odooService.createExpirationTicket.mockResolvedValue(500);

      await service.createPendingExpirationTickets();

      expect(odooService.createExpirationTicket).toHaveBeenCalledWith(
        expect.objectContaining({ sourceId: 'd1', type: 'domain' }),
        'client-uuid-1', 9, [], undefined, undefined,
      );
      expect(ticketRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'domain', sourceId: 'd1',
          expireDate: '2026-07-15', odooTicketId: 500,
          clientId: 'client-uuid-1',
        }),
      );
    });

    it('pasa taskName y ticketDescription del tipo configurado a createExpirationTicket', async () => {
      integrationConfigService.getOdooConfigDecrypted.mockResolvedValue({
        ...defaultConfig,
        expirationsTypeConfigs: {
          domain: {
            enabled: true, helpdeskTeamId: 9, daysAhead: 30, tagIds: [],
            taskName: 'Dominio', ticketDescription: 'Verificar renovación',
          },
        },
      });
      notificationsService.getExpirations.mockResolvedValue([makeItem()]);
      ticketRepo.find.mockResolvedValue([]);
      clientRepo.findOne.mockResolvedValue({ id: 'client-uuid-1' });
      odooService.createExpirationTicket.mockResolvedValue(500);

      await service.createPendingExpirationTickets();

      expect(odooService.createExpirationTicket).toHaveBeenCalledWith(
        expect.objectContaining({ sourceId: 'd1', type: 'domain' }),
        'client-uuid-1', 9, [], 'Dominio', 'Verificar renovación',
      );
    });

    it('crea la Task asociada al ticket y guarda taskId en la fila de expiration_tickets', async () => {
      notificationsService.getExpirations.mockResolvedValue([makeItem()]);
      ticketRepo.find.mockResolvedValue([]);
      ticketRepo.save.mockResolvedValue({ id: 'ticket-row-1' });
      clientRepo.findOne.mockResolvedValue({ id: 'client-uuid-1' });
      odooService.createExpirationTicket.mockResolvedValue(500);
      tasksService.createFromExistingTicket.mockResolvedValue({ id: 'task-1' });

      await service.createPendingExpirationTickets();

      expect(tasksService.createFromExistingTicket).toHaveBeenCalledWith({
        clientId: 'client-uuid-1',
        type: TaskType.EXPIRATION_CONTROL,
        odooTicketId: 500,
        scheduledDate: expect.any(String),
        expirationType: 'domain',
      });
      expect(ticketRepo.update).toHaveBeenCalledWith('ticket-row-1', { taskId: 'task-1' });
    });

    it('si falla crear la Task, loguea y no aborta el batch — la fila de expiration_tickets ya quedó guardada', async () => {
      notificationsService.getExpirations.mockResolvedValue([
        makeItem({ sourceId: 'd1' }),
        makeItem({ sourceId: 'd2', itemName: 'otro.com' }),
      ]);
      ticketRepo.find.mockResolvedValue([]);
      ticketRepo.save.mockResolvedValue({ id: 'ticket-row-1' });
      clientRepo.findOne.mockResolvedValue({ id: 'client-uuid-1' });
      odooService.createExpirationTicket.mockResolvedValue(500);
      tasksService.createFromExistingTicket
        .mockRejectedValueOnce(new Error('DB caída'))
        .mockResolvedValueOnce({ id: 'task-2' });

      await expect(service.createPendingExpirationTickets()).resolves.toBeUndefined();

      expect(odooService.createExpirationTicket).toHaveBeenCalledTimes(2);
      expect(ticketRepo.save).toHaveBeenCalledTimes(2);
      expect(ticketRepo.update).toHaveBeenCalledTimes(1);
    });

    it('usa el helpdeskTeamId y tagIds propios del tipo, no un valor global', async () => {
      integrationConfigService.getOdooConfigDecrypted.mockResolvedValue({
        ...defaultConfig,
        expirationsHelpdeskTeamId: 999, expirationsTagIds: [999],
        expirationsTypeConfigs: {
          domain: { enabled: true, helpdeskTeamId: 42, daysAhead: 30, tagIds: [3, 4] },
        },
      });
      notificationsService.getExpirations.mockResolvedValue([makeItem()]);
      clientRepo.findOne.mockResolvedValue({ id: 'client-uuid-1' });
      odooService.createExpirationTicket.mockResolvedValue(500);

      await service.createPendingExpirationTickets();

      expect(odooService.createExpirationTicket).toHaveBeenCalledWith(
        expect.anything(), 'client-uuid-1', 42, [3, 4], undefined, undefined,
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

    it('busca el cliente filtrando por isActive:true', async () => {
      notificationsService.getExpirations.mockResolvedValue([makeItem()]);
      clientRepo.findOne.mockResolvedValue({ id: 'client-uuid-1' });
      odooService.createExpirationTicket.mockResolvedValue(500);

      await service.createPendingExpirationTickets();

      expect(clientRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
      );
    });

    it('no relanza si getOdooConfigDecrypted falla — loguea y retorna', async () => {
      integrationConfigService.getOdooConfigDecrypted.mockRejectedValue(new Error('DB caída'));
      await expect(service.createPendingExpirationTickets()).resolves.toBeUndefined();
    });

    it('no relanza si getExpirations falla — loguea y retorna', async () => {
      notificationsService.getExpirations.mockRejectedValue(new Error('InfraDoc caído'));
      await expect(service.createPendingExpirationTickets()).resolves.toBeUndefined();
    });
  });

  describe('saveTypeConfig', () => {
    const entry = { enabled: true, helpdeskTeamId: 9, daysAhead: 30, tagIds: [] };

    it('persiste la config vía IntegrationConfigService.patchOdoo, mergeada con los otros tipos', async () => {
      integrationConfigService.getOdoo.mockResolvedValue({
        expirationsTypeConfigs: { certificate: { enabled: true, helpdeskTeamId: 3, daysAhead: 15, tagIds: [] } },
      });
      integrationConfigService.patchOdoo.mockResolvedValue({ expirationsTypeConfigs: {} });
      notificationsService.getExpirations.mockResolvedValue([]);

      await service.saveTypeConfig('domain', entry, 'admin@test.com');

      expect(integrationConfigService.patchOdoo).toHaveBeenCalledWith(
        {
          expirationsTypeConfigs: {
            certificate: { enabled: true, helpdeskTeamId: 3, daysAhead: 15, tagIds: [] },
            domain: entry,
          },
        },
        'admin@test.com',
      );
    });

    it('pre-siembra el backlog del tipo que pasa de deshabilitado a habilitado', async () => {
      integrationConfigService.getOdoo.mockResolvedValue({
        expirationsTypeConfigs: { domain: { enabled: false, helpdeskTeamId: 9, daysAhead: 30, tagIds: [] } },
      });
      integrationConfigService.patchOdoo.mockResolvedValue({ expirationsTypeConfigs: { domain: entry } });
      notificationsService.getExpirations.mockResolvedValue([makeItem()]);
      clientRepo.find.mockResolvedValue([{ id: 'client-uuid-1', infradocId: 1 }]);

      await service.saveTypeConfig('domain', entry, 'admin@test.com');

      expect(ticketRepo.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'domain', sourceId: 'd1', expireDate: '2026-07-15',
          clientId: 'client-uuid-1', odooTicketId: null,
        }),
      ]);
      expect(odooService.createExpirationTicket).not.toHaveBeenCalled();
    });

    it('no pre-siembra el tipo que ya estaba habilitado (sin transición)', async () => {
      integrationConfigService.getOdoo.mockResolvedValue({
        expirationsTypeConfigs: { domain: { enabled: true, helpdeskTeamId: 9, daysAhead: 30, tagIds: [] } },
      });
      integrationConfigService.patchOdoo.mockResolvedValue({ expirationsTypeConfigs: { domain: entry } });

      await service.saveTypeConfig('domain', entry, 'admin@test.com');

      expect(notificationsService.getExpirations).not.toHaveBeenCalled();
      expect(ticketRepo.insert).not.toHaveBeenCalled();
    });

    it('trata la primera config guardada para ese tipo (sin fila previa) como transición a habilitado', async () => {
      integrationConfigService.getOdoo.mockResolvedValue({ expirationsTypeConfigs: null });
      integrationConfigService.patchOdoo.mockResolvedValue({ expirationsTypeConfigs: { domain: entry } });
      notificationsService.getExpirations.mockResolvedValue([]);

      await service.saveTypeConfig('domain', entry, 'admin@test.com');

      expect(notificationsService.getExpirations).toHaveBeenCalledWith(30);
    });

    it('no pre-siembra items que ya tienen fila de tracking', async () => {
      integrationConfigService.getOdoo.mockResolvedValue({ expirationsTypeConfigs: {} });
      integrationConfigService.patchOdoo.mockResolvedValue({ expirationsTypeConfigs: { domain: entry } });
      notificationsService.getExpirations.mockResolvedValue([makeItem()]);
      ticketRepo.find.mockResolvedValue([
        { type: 'domain', sourceId: 'd1', expireDate: '2026-07-15', odooTicketId: 500 },
      ]);

      await service.saveTypeConfig('domain', entry, 'admin@test.com');

      expect(ticketRepo.insert).not.toHaveBeenCalled();
    });

    it('omite items cuyo cliente InfraDoc no existe (o está inactivo) al pre-sembrar', async () => {
      integrationConfigService.getOdoo.mockResolvedValue({ expirationsTypeConfigs: {} });
      integrationConfigService.patchOdoo.mockResolvedValue({ expirationsTypeConfigs: { domain: entry } });
      notificationsService.getExpirations.mockResolvedValue([makeItem()]);
      clientRepo.find.mockResolvedValue([]);

      await service.saveTypeConfig('domain', entry, 'admin@test.com');

      expect(ticketRepo.insert).not.toHaveBeenCalled();
    });
  });
});
