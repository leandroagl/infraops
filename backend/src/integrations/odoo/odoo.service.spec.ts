import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IntegrationConfigService } from '../../integration-config/integration-config.service';
import { Client } from '../../clients/client.entity';
import { ClientSubscriptionHourSnapshot } from '../../clients/client-subscription-hour-snapshot.entity';
import { User } from '../../users/user.entity';
import { Technician } from '../../technicians/technician.entity';
import { OdooSystemRpcService } from './odoo-system-rpc.service';
import { OdooService } from './odoo.service';
import { OdooPartner } from './dto/odoo-partner.dto';
import { OdooUser } from './dto/odoo-user.dto';
import { TaskType } from '../../tasks/task-type.enum';
import { TaskConfigService } from '../../task-config/task-config.service';
import { ExpirationItemDto } from '../../notifications/dto/expiration-item.dto';

describe('OdooService', () => {
  let service: OdooService;
  let odooRpc: { callKw: jest.Mock };
  let clientRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
  let userRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
  let technicianRepo: { findOne: jest.Mock };
  let snapshotRepo: { find: jest.Mock; upsert: jest.Mock };
  let integrationConfigServiceMock: { getOdooConfigDecrypted: jest.Mock; getOdoo: jest.Mock };
  let taskConfigServiceMock: { findOne: jest.Mock };

  const makeClient = (override: Partial<Client> = {}): Client =>
    ({
      id: 'client-uuid-1',
      infradocId: 1,
      name: 'ACME Corp',
      taxIdNumber: '20-12345678-0',
      odooPartnerId: null,
      odooSyncedAt: null,
      odooSaleLineId: null,
      isActive: true,
      ...override,
    }) as Client;

  const makeOdooPartner = (
    override: Partial<OdooPartner> = {},
  ): OdooPartner => ({
    id: 101,
    name: 'ACME Corp',
    vat: '20123456780',
    ...override,
  });

  const makeUser = (override: Partial<User> = {}): User =>
    ({
      id: 'user-uuid-1',
      email: 'tecnico@ondra.com',
      technicianId: 'tech-uuid-1',
      isActive: true,
      odooUserId: null,
      odooSyncedAt: null,
      odooEmployeeId: null,
      ...override,
    }) as User;

  const makeOdooUser = (override: Partial<OdooUser> = {}): OdooUser => ({
    id: 201,
    login: 'tecnico@ondra.com',
    name: 'Técnico Demo',
    ...override,
  });

  const makeTechnician = (userId = 'user-uuid-1'): Technician => ({
    id: 'tech-uuid-1',
    user: makeUser({ id: userId, odooUserId: 201 }),
    createdAt: new Date('2026-01-01'),
  });

  beforeEach(async () => {
    odooRpc = { callKw: jest.fn() };
    clientRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      count: jest.fn(),
    };
    userRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      count: jest.fn(),
    };
    technicianRepo = { findOne: jest.fn() };
    snapshotRepo = { find: jest.fn().mockResolvedValue([]), upsert: jest.fn().mockResolvedValue(undefined) };
    integrationConfigServiceMock = {
      getOdooConfigDecrypted: jest.fn().mockResolvedValue({
        url: 'u', db: 'd', username: 'u', apiKey: 'k', helpdeskTeamId: 7,
        expirationsHelpdeskTeamId: 9, expirationsTicketDaysAhead: 30, expirationsTagIds: [],
        stageInProgressName: 'En curso', stageNotDoneName: 'No realizadas', stageDoneName: 'Hecho',
      }),
      getOdoo: jest.fn().mockResolvedValue({
        url: 'u', db: 'd', username: 'u', apiKey: 'k', helpdeskTeamId: 7,
        expirationsHelpdeskTeamId: 9, expirationsTicketDaysAhead: 30, expirationsTagIds: [],
        expirationsTypeConfigs: null,
        stageInProgressName: 'En curso', stageNotDoneName: 'No realizadas', stageDoneName: 'Hecho',
      }),
    };
    taskConfigServiceMock = { findOne: jest.fn().mockResolvedValue(null) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OdooService,
        { provide: OdooSystemRpcService, useValue: odooRpc },
        { provide: getRepositoryToken(Client), useValue: clientRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: IntegrationConfigService, useValue: integrationConfigServiceMock },
        { provide: getRepositoryToken(Technician), useValue: technicianRepo },
        { provide: TaskConfigService, useValue: taskConfigServiceMock },
        { provide: getRepositoryToken(ClientSubscriptionHourSnapshot), useValue: snapshotRepo },
      ],
    }).compile();

    service = module.get<OdooService>(OdooService);
  });

  describe('syncPartners', () => {
    it('actualiza odooPartnerId cuando CUIT coincide con un cliente de InfraOps', async () => {
      clientRepo.find.mockResolvedValue([makeClient()]);
      odooRpc.callKw.mockResolvedValue([makeOdooPartner()]);

      const result = await service.syncPartners();

      expect(clientRepo.update).toHaveBeenCalledWith(
        'client-uuid-1',
        expect.objectContaining({
          odooPartnerId: 101,
          odooSyncedAt: expect.any(Date),
        }),
      );
      expect(result.matched).toBe(1);
      expect(result.unmatched).toEqual([]);
      expect(result.total).toBe(1);
    });

    it('registra en unmatched el nombre del partner que no matchea ningún cliente', async () => {
      clientRepo.find.mockResolvedValue([]);
      odooRpc.callKw.mockResolvedValue([makeOdooPartner()]);

      const result = await service.syncPartners();

      expect(clientRepo.update).not.toHaveBeenCalled();
      expect(result.matched).toBe(0);
      expect(result.unmatched).toEqual(['ACME Corp']);
      expect(result.total).toBe(1);
    });

    it('consulta Odoo con filtros is_company=true y vat!=false', async () => {
      clientRepo.find.mockResolvedValue([]);
      odooRpc.callKw.mockResolvedValue([]);

      await service.syncPartners();

      expect(odooRpc.callKw).toHaveBeenCalledWith(
        'res.partner',
        'search_read',
        expect.arrayContaining([
          expect.arrayContaining([
            ['is_company', '=', true],
            ['vat', '!=', false],
          ]),
        ]),
        expect.objectContaining({
          fields: expect.arrayContaining(['id', 'name', 'vat']),
        }),
      );
    });

    it('maneja correctamente vat false de Odoo sin crashear', async () => {
      clientRepo.find.mockResolvedValue([makeClient()]);
      odooRpc.callKw.mockResolvedValue([makeOdooPartner({ vat: false })]);

      const result = await service.syncPartners();

      expect(clientRepo.update).not.toHaveBeenCalled();
      expect(result.matched).toBe(0);
      expect(result.total).toBe(1);
    });

    it('no falla cuando Odoo no responde — propaga error descriptivo', async () => {
      clientRepo.find.mockResolvedValue([]);
      odooRpc.callKw.mockRejectedValue(new Error('Connection refused'));

      await expect(service.syncPartners()).rejects.toThrow(
        'Connection refused',
      );
    });
  });

  describe('syncUsers', () => {
    it('actualiza odooUserId del usuario cuando email coincide', async () => {
      userRepo.find.mockResolvedValue([makeUser()]);
      odooRpc.callKw
        .mockResolvedValueOnce([makeOdooUser()]) // res.users call
        .mockResolvedValueOnce([]); // hr.employee call → no employees

      const result = await service.syncUsers();

      expect(userRepo.update).toHaveBeenCalledWith(
        'user-uuid-1',
        expect.objectContaining({
          odooUserId: 201,
          odooSyncedAt: expect.any(Date),
        }),
      );
      expect(result.matched).toBe(1);
      expect(result.unmatched).toEqual([]);
      expect(result.total).toBe(1);
    });

    it('registra en unmatched el login del usuario de Odoo que no matchea ningún usuario local', async () => {
      userRepo.find.mockResolvedValue([]);
      odooRpc.callKw.mockResolvedValue([makeOdooUser()]);

      const result = await service.syncUsers();

      expect(userRepo.update).not.toHaveBeenCalled();
      expect(result.matched).toBe(0);
      expect(result.unmatched).toEqual(['tecnico@ondra.com']);
      expect(result.total).toBe(1);
    });

    it('consulta todos los usuarios activos para construir el mapa de email', async () => {
      userRepo.find.mockResolvedValue([makeUser()]);
      odooRpc.callKw.mockResolvedValue([]);

      await service.syncUsers();

      expect(userRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
    });

    it('ignora usuarios de Odoo con login false', async () => {
      userRepo.find.mockResolvedValue([makeUser()]);
      odooRpc.callKw.mockResolvedValue([makeOdooUser({ login: false })]);

      const result = await service.syncUsers();

      expect(userRepo.update).not.toHaveBeenCalled();
      expect(result.matched).toBe(0);
    });

    it('resuelve odooEmployeeId en hr.employee para los usuarios matcheados', async () => {
      const users = [
        makeUser({ id: 'user-1', email: 'a@ondra.com', odooUserId: null }),
      ];
      const odooUsers = [{ id: 7, login: 'a@ondra.com', name: 'A' }];
      const employees = [{ id: 22, user_id: [7, 'A'] }];

      userRepo.find.mockResolvedValue(users);
      odooRpc.callKw
        .mockResolvedValueOnce(odooUsers)
        .mockResolvedValueOnce(employees);

      await service.syncUsers();

      expect(odooRpc.callKw).toHaveBeenNthCalledWith(
        2,
        'hr.employee',
        'search_read',
        [[['user_id', 'in', [7]]]],
        expect.objectContaining({ fields: ['id', 'user_id'] }),
      );
      const updateCalls = userRepo.update.mock.calls;
      expect(updateCalls[1]).toEqual(['user-1', { odooEmployeeId: 22 }]);
    });

    it('no consulta hr.employee si no hubo matches', async () => {
      userRepo.find.mockResolvedValue([]);
      odooRpc.callKw.mockResolvedValue([]);

      await service.syncUsers();

      expect(odooRpc.callKw).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSyncStatus', () => {
    it('devuelve conteo de clientes y usuarios sin odoo id', async () => {
      clientRepo.count.mockResolvedValue(5);
      userRepo.count.mockResolvedValue(2);

      const result = await service.getSyncStatus();

      expect(result).toEqual({
        clientsWithoutOdooId: 5,
        usersWithoutOdooId: 2,
      });
    });
  });

  describe('resolvePartnerId', () => {
    it('devuelve odooPartnerId existente sin llamar a Odoo', async () => {
      clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: 101 }));

      const result = await service.resolvePartnerId('client-uuid-1');

      expect(result).toBe(101);
      expect(odooRpc.callKw).not.toHaveBeenCalled();
    });

    it('intenta sync puntual cuando odooPartnerId es null y retorna el id encontrado', async () => {
      clientRepo.findOne.mockResolvedValue(
        makeClient({ odooPartnerId: null, taxIdNumber: '20-12345678-0' }),
      );
      odooRpc.callKw.mockResolvedValue([{ id: 101, vat: '20-12345678-0' }]);

      const result = await service.resolvePartnerId('client-uuid-1');

      expect(result).toBe(101);
      expect(clientRepo.update).toHaveBeenCalledWith(
        'client-uuid-1',
        expect.objectContaining({ odooPartnerId: 101 }),
      );
    });

    it('devuelve null cuando el cliente no existe', async () => {
      clientRepo.findOne.mockResolvedValue(null);

      const result = await service.resolvePartnerId('uuid-no-existe');

      expect(result).toBeNull();
    });

    it('devuelve null cuando el cliente no tiene CUIT', async () => {
      clientRepo.findOne.mockResolvedValue(makeClient({ taxIdNumber: null }));

      const result = await service.resolvePartnerId('client-uuid-1');

      expect(result).toBeNull();
      expect(odooRpc.callKw).not.toHaveBeenCalled();
    });

    it('devuelve null cuando Odoo no encuentra el partner por CUIT', async () => {
      clientRepo.findOne.mockResolvedValue(
        makeClient({ taxIdNumber: '20-12345678-0' }),
      );
      odooRpc.callKw.mockResolvedValue([]);

      const result = await service.resolvePartnerId('client-uuid-1');

      expect(result).toBeNull();
      expect(clientRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('resolveUserId', () => {
    it('devuelve odooUserId existente sin llamar a Odoo', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));

      const result = await service.resolveUserId('user-uuid-1');

      expect(result).toBe(201);
      expect(odooRpc.callKw).not.toHaveBeenCalled();
    });

    it('intenta sync puntual por email cuando odooUserId es null y retorna el id encontrado', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: null }));
      odooRpc.callKw.mockResolvedValue([
        { id: 201, login: 'tecnico@ondra.com' },
      ]);

      const result = await service.resolveUserId('user-uuid-1');

      expect(result).toBe(201);
      expect(userRepo.update).toHaveBeenCalledWith(
        'user-uuid-1',
        expect.objectContaining({ odooUserId: 201 }),
      );
    });

    it('devuelve null cuando el usuario no existe', async () => {
      userRepo.findOne.mockResolvedValue(null);

      const result = await service.resolveUserId('uuid-no-existe');

      expect(result).toBeNull();
    });

    it('devuelve null cuando Odoo no encuentra usuario por email', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: null }));
      odooRpc.callKw.mockResolvedValue([]);

      const result = await service.resolveUserId('user-uuid-1');

      expect(result).toBeNull();
      expect(userRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('createTicket', () => {
    it('crea un ticket WINDOWS_DOMAIN_MAINTENANCE con título correcto', async () => {
      clientRepo.findOne.mockResolvedValue(
        makeClient({ odooPartnerId: 101, odooSaleLineId: null }),
      );
      technicianRepo.findOne.mockResolvedValue(makeTechnician());
      userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
      taskConfigServiceMock.findOne.mockResolvedValue(null);
      odooRpc.callKw
        .mockResolvedValueOnce([])           // sale.order.line search → sin resultado
        .mockResolvedValueOnce([{ id: 99 }]) // helpdesk.stage search_read → En Curso
        .mockResolvedValueOnce(42);          // helpdesk.ticket create

      const ticketId = await service.createTicket(
        'client-uuid-1',
        'tech-uuid-1',
        TaskType.WINDOWS_DOMAIN_MAINTENANCE,
      );

      expect(ticketId).toBe(42);
      expect(odooRpc.callKw).toHaveBeenCalledWith(
        'helpdesk.ticket',
        'create',
        [
          expect.objectContaining({
            name: 'Mantenimiento de servidores y dominio Windows',
          }),
        ],
        {},
      );
    });

    it('crea un ticket QNAP_MAINTENANCE con título y descripción correctos', async () => {
      clientRepo.findOne.mockResolvedValue(
        makeClient({ odooPartnerId: 101, odooSaleLineId: null }),
      );
      technicianRepo.findOne.mockResolvedValue(makeTechnician());
      userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
      taskConfigServiceMock.findOne.mockResolvedValue(null);
      odooRpc.callKw
        .mockResolvedValueOnce([])           // sale.order.line
        .mockResolvedValueOnce([{ id: 99 }]) // helpdesk.stage
        .mockResolvedValueOnce(55);          // helpdesk.ticket create

      const ticketId = await service.createTicket(
        'client-uuid-1',
        'tech-uuid-1',
        TaskType.QNAP_MAINTENANCE,
      );

      expect(ticketId).toBe(55);
      expect(odooRpc.callKw).toHaveBeenCalledWith(
        'helpdesk.ticket',
        'create',
        [
          expect.objectContaining({
            name: 'Mantenimiento repositorio de backups QNAP/NAS',
            description: expect.stringContaining('Estado del volumen RAID'),
          }),
        ],
        {},
      );
    });

    it('crea un ticket VEEAM_BACKUP con título y descripción correctos', async () => {
      clientRepo.findOne.mockResolvedValue(
        makeClient({ odooPartnerId: 101, odooSaleLineId: null }),
      );
      technicianRepo.findOne.mockResolvedValue(makeTechnician());
      userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
      taskConfigServiceMock.findOne.mockResolvedValue(null);
      odooRpc.callKw
        .mockResolvedValueOnce([])           // sale.order.line
        .mockResolvedValueOnce([{ id: 99 }]) // helpdesk.stage
        .mockResolvedValueOnce(77);          // helpdesk.ticket create

      const ticketId = await service.createTicket(
        'client-uuid-1',
        'tech-uuid-1',
        TaskType.VEEAM_BACKUP,
      );

      expect(ticketId).toBe(77);
      expect(odooRpc.callKw).toHaveBeenCalledWith(
        'helpdesk.ticket',
        'create',
        [expect.objectContaining({
          name: 'Mantenimiento de backups Veeam',
          description: expect.stringContaining('Cobertura de backup por máquina virtual'),
        })],
        {},
      );
    });

    it('crea un ticket SERVER_HOST_MAINTENANCE con descripción de controles ESXi', async () => {
      clientRepo.findOne.mockResolvedValue(
        makeClient({ odooPartnerId: 101, odooSaleLineId: null }),
      );
      technicianRepo.findOne.mockResolvedValue(makeTechnician());
      userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
      taskConfigServiceMock.findOne.mockResolvedValue(null);
      odooRpc.callKw
        .mockResolvedValueOnce([])           // sale.order.line
        .mockResolvedValueOnce([{ id: 99 }]) // helpdesk.stage
        .mockResolvedValueOnce(88);          // helpdesk.ticket create

      const ticketId = await service.createTicket(
        'client-uuid-1',
        'tech-uuid-1',
        TaskType.SERVER_HOST_MAINTENANCE,
      );

      expect(ticketId).toBe(88);
      expect(odooRpc.callKw).toHaveBeenCalledWith(
        'helpdesk.ticket',
        'create',
        [expect.objectContaining({
          name: 'Mantenimiento de hosts VMware/BMC',
          description: expect.stringContaining('Estado de datastores'),
        })],
        {},
      );
    });

    it('crea un ticket ROUTER_MAINTENANCE con descripción de controles de router', async () => {
      clientRepo.findOne.mockResolvedValue(
        makeClient({ odooPartnerId: 101, odooSaleLineId: null }),
      );
      technicianRepo.findOne.mockResolvedValue(makeTechnician());
      userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
      taskConfigServiceMock.findOne.mockResolvedValue(null);
      odooRpc.callKw
        .mockResolvedValueOnce([])           // sale.order.line
        .mockResolvedValueOnce([{ id: 99 }]) // helpdesk.stage
        .mockResolvedValueOnce(66);          // helpdesk.ticket create

      const ticketId = await service.createTicket(
        'client-uuid-1',
        'tech-uuid-1',
        TaskType.ROUTER_MAINTENANCE,
      );

      expect(ticketId).toBe(66);
      expect(odooRpc.callKw).toHaveBeenCalledWith(
        'helpdesk.ticket',
        'create',
        [expect.objectContaining({
          name: 'Mantenimiento de router y firewall',
          description: expect.stringContaining('backup de configuración'),
        })],
        {},
      );
    });

    it('incluye sale_line_id en el payload cuando el cliente tiene odooSaleLineId', async () => {
      clientRepo.findOne.mockResolvedValue(
        makeClient({ odooPartnerId: 101, odooSaleLineId: 77 }),
      );
      technicianRepo.findOne.mockResolvedValue(makeTechnician());
      userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
      taskConfigServiceMock.findOne.mockResolvedValue(null);
      odooRpc.callKw
        .mockResolvedValueOnce([{ id: 99 }]) // helpdesk.stage
        .mockResolvedValueOnce(99);           // helpdesk.ticket create

      await service.createTicket('client-uuid-1', 'tech-uuid-1', TaskType.WINDOWS_DOMAIN_MAINTENANCE);

      expect(odooRpc.callKw).toHaveBeenCalledWith(
        'helpdesk.ticket',
        'create',
        [expect.objectContaining({ sale_line_id: 77 })],
        {},
      );
    });

    it('NO incluye sale_line_id cuando el cliente no tiene odooSaleLineId', async () => {
      clientRepo.findOne.mockResolvedValue(
        makeClient({ odooPartnerId: 101, odooSaleLineId: null }),
      );
      technicianRepo.findOne.mockResolvedValue(makeTechnician());
      userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
      taskConfigServiceMock.findOne.mockResolvedValue(null);
      odooRpc.callKw
        .mockResolvedValueOnce([])           // sale.order.line
        .mockResolvedValueOnce([{ id: 99 }]) // helpdesk.stage
        .mockResolvedValueOnce(99);          // helpdesk.ticket create

      await service.createTicket('client-uuid-1', 'tech-uuid-1', TaskType.WINDOWS_DOMAIN_MAINTENANCE);

      const createCall = odooRpc.callKw.mock.calls.find(
        (args: unknown[]) => args[0] === 'helpdesk.ticket',
      );
      expect(createCall![2][0]).not.toHaveProperty('sale_line_id');
    });

    it('lanza BadRequestException cuando el cliente no tiene ID de Odoo', async () => {
      clientRepo.findOne.mockResolvedValue(
        makeClient({ odooPartnerId: null, taxIdNumber: null }),
      );

      await expect(
        service.createTicket('client-uuid-1', 'tech-uuid-1', TaskType.WINDOWS_DOMAIN_MAINTENANCE),
      ).rejects.toThrow(BadRequestException);
      expect(odooRpc.callKw).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException cuando el técnico no tiene ID de Odoo', async () => {
      clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: 101 }));
      technicianRepo.findOne.mockResolvedValue(makeTechnician());
      userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: null }));
      odooRpc.callKw.mockResolvedValue([]);

      await expect(
        service.createTicket('client-uuid-1', 'tech-uuid-1', TaskType.WINDOWS_DOMAIN_MAINTENANCE),
      ).rejects.toThrow(BadRequestException);
    });

    it('propaga ServiceUnavailableException cuando Odoo falla al crear el ticket', async () => {
      clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: 101 }));
      technicianRepo.findOne.mockResolvedValue(makeTechnician());
      userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
      taskConfigServiceMock.findOne.mockResolvedValue(null);
      odooRpc.callKw.mockRejectedValue(
        new ServiceUnavailableException('Odoo caído'),
      );

      await expect(
        service.createTicket('client-uuid-1', 'tech-uuid-1', TaskType.WINDOWS_DOMAIN_MAINTENANCE),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('lanza ServiceUnavailableException cuando Odoo devuelve false al crear el ticket', async () => {
      clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: 101 }));
      technicianRepo.findOne.mockResolvedValue(makeTechnician());
      userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
      taskConfigServiceMock.findOne.mockResolvedValue(null);
      odooRpc.callKw
        .mockResolvedValueOnce([])           // sale.order.line
        .mockResolvedValueOnce([{ id: 99 }]) // helpdesk.stage
        .mockResolvedValueOnce(false);       // helpdesk.ticket create → false

      await expect(
        service.createTicket('client-uuid-1', 'tech-uuid-1', TaskType.WINDOWS_DOMAIN_MAINTENANCE),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('lanza BadRequestException cuando el técnico no tiene usuario asociado', async () => {
      clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: 101 }));
      const technicianSinUsuario: Technician = {
        id: 'tech-uuid-1',
        user: undefined as unknown as User,
        createdAt: new Date('2026-01-01'),
      };
      technicianRepo.findOne.mockResolvedValue(technicianSinUsuario);

      await expect(
        service.createTicket('client-uuid-1', 'tech-uuid-1', TaskType.WINDOWS_DOMAIN_MAINTENANCE),
      ).rejects.toThrow(BadRequestException);
      expect(odooRpc.callKw).not.toHaveBeenCalled();
    });

    it('incluye stage_id "En Curso" en el payload al crear el ticket', async () => {
      clientRepo.findOne.mockResolvedValue(
        makeClient({ odooPartnerId: 101, odooSaleLineId: null }),
      );
      technicianRepo.findOne.mockResolvedValue(makeTechnician());
      userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
      taskConfigServiceMock.findOne.mockResolvedValue(null);
      odooRpc.callKw
        .mockResolvedValueOnce([])           // sale.order.line
        .mockResolvedValueOnce([{ id: 55 }]) // helpdesk.stage → stageId = 55
        .mockResolvedValueOnce(100);         // helpdesk.ticket create

      await service.createTicket('client-uuid-1', 'tech-uuid-1', TaskType.WINDOWS_DOMAIN_MAINTENANCE);

      expect(odooRpc.callKw).toHaveBeenCalledWith(
        'helpdesk.ticket',
        'create',
        [expect.objectContaining({ stage_id: 55 })],
        {},
      );
    });
  });

  describe('createTicket - tags desde DB', () => {
    it('asigna tag_ids desde la config de DB cuando están configurados', async () => {
      clientRepo.findOne.mockResolvedValue(
        makeClient({ odooPartnerId: 101, odooSaleLineId: null }),
      );
      technicianRepo.findOne.mockResolvedValue(makeTechnician());
      userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
      taskConfigServiceMock.findOne.mockResolvedValue({
        odooTagIds: [42, 43],
        odooTagNames: ['Tag A', 'Tag B'],
      });
      odooRpc.callKw
        .mockResolvedValueOnce([])           // sale.order.line
        .mockResolvedValueOnce([{ id: 99 }]) // helpdesk.stage
        .mockResolvedValueOnce(99);          // helpdesk.ticket create

      await service.createTicket('client-uuid-1', 'tech-uuid-1', TaskType.QNAP_MAINTENANCE);

      expect(odooRpc.callKw).toHaveBeenCalledWith(
        'helpdesk.ticket',
        'create',
        [expect.objectContaining({ tag_ids: [[6, 0, [42, 43]]] })],
        {},
      );
    });

    it('no agrega tag_ids si la config no tiene tags', async () => {
      clientRepo.findOne.mockResolvedValue(
        makeClient({ odooPartnerId: 101, odooSaleLineId: null }),
      );
      technicianRepo.findOne.mockResolvedValue(makeTechnician());
      userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
      taskConfigServiceMock.findOne.mockResolvedValue({
        odooTagIds: [],
        odooTagNames: [],
      });
      odooRpc.callKw
        .mockResolvedValueOnce([])           // sale.order.line
        .mockResolvedValueOnce([{ id: 99 }]) // helpdesk.stage
        .mockResolvedValueOnce(99);          // helpdesk.ticket create

      await service.createTicket('client-uuid-1', 'tech-uuid-1', TaskType.QNAP_MAINTENANCE);

      const createCall = odooRpc.callKw.mock.calls.find(
        (args: unknown[]) => args[0] === 'helpdesk.ticket' && args[1] === 'create',
      );
      expect(createCall![2][0]).not.toHaveProperty('tag_ids');
    });

    it('no agrega tag_ids si no hay config para el tipo', async () => {
      clientRepo.findOne.mockResolvedValue(
        makeClient({ odooPartnerId: 101, odooSaleLineId: null }),
      );
      technicianRepo.findOne.mockResolvedValue(makeTechnician());
      userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
      taskConfigServiceMock.findOne.mockResolvedValue(null);
      odooRpc.callKw
        .mockResolvedValueOnce([])           // sale.order.line
        .mockResolvedValueOnce([{ id: 99 }]) // helpdesk.stage
        .mockResolvedValueOnce(99);          // helpdesk.ticket create

      await service.createTicket('client-uuid-1', 'tech-uuid-1', TaskType.ROUTER_MAINTENANCE);

      const createCall = odooRpc.callKw.mock.calls.find(
        (args: unknown[]) => args[0] === 'helpdesk.ticket' && args[1] === 'create',
      );
      expect(createCall![2][0]).not.toHaveProperty('tag_ids');
    });
  });

  describe('createTicket - conversión de descripción a HTML', () => {
    it('convierte la descripción default (texto plano) a HTML antes de enviarla a Odoo', async () => {
      clientRepo.findOne.mockResolvedValue(
        makeClient({ odooPartnerId: 101, odooSaleLineId: null }),
      );
      technicianRepo.findOne.mockResolvedValue(makeTechnician());
      userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
      taskConfigServiceMock.findOne.mockResolvedValue(null);
      odooRpc.callKw
        .mockResolvedValueOnce([])           // sale.order.line
        .mockResolvedValueOnce([{ id: 99 }]) // helpdesk.stage
        .mockResolvedValueOnce(55);          // helpdesk.ticket create

      await service.createTicket('client-uuid-1', 'tech-uuid-1', TaskType.QNAP_MAINTENANCE);

      const createCall = odooRpc.callKw.mock.calls.find(
        (args: unknown[]) => args[0] === 'helpdesk.ticket' && args[1] === 'create',
      );
      const description = (createCall![2][0] as { description: string }).description;
      expect(description).toContain('<ul><li>Estado de los discos físicos');
      expect(description).not.toContain('\n');
    });

    it('convierte el ticketDescription override (texto plano) a HTML antes de enviarla a Odoo', async () => {
      clientRepo.findOne.mockResolvedValue(
        makeClient({ odooPartnerId: 101, odooSaleLineId: null }),
      );
      technicianRepo.findOne.mockResolvedValue(makeTechnician());
      userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
      taskConfigServiceMock.findOne.mockResolvedValue({
        odooTagIds: [],
        odooTagNames: [],
        ticketDescription: 'Línea uno.\n\n- Punto A\n- Punto B',
      });
      odooRpc.callKw
        .mockResolvedValueOnce([])           // sale.order.line
        .mockResolvedValueOnce([{ id: 99 }]) // helpdesk.stage
        .mockResolvedValueOnce(55);          // helpdesk.ticket create

      await service.createTicket('client-uuid-1', 'tech-uuid-1', TaskType.QNAP_MAINTENANCE);

      expect(odooRpc.callKw).toHaveBeenCalledWith(
        'helpdesk.ticket',
        'create',
        [
          expect.objectContaining({
            description: '<p>Línea uno.</p><ul><li>Punto A</li><li>Punto B</li></ul>',
          }),
        ],
        {},
      );
    });
  });

  describe('getHelpdeskTags', () => {
    it('devuelve lista de tags desde Odoo ordenada por nombre', async () => {
      odooRpc.callKw.mockResolvedValue([
        { id: 2, name: 'Backups (NAS)' },
        { id: 1, name: 'Gestión de servidores' },
      ]);

      const result = await service.getHelpdeskTags();

      expect(result).toEqual([
        { id: 2, name: 'Backups (NAS)' },
        { id: 1, name: 'Gestión de servidores' },
      ]);
    });
  });

  describe('getHelpdeskTeams', () => {
    it('devuelve lista de equipos de helpdesk desde Odoo ordenada por nombre', async () => {
      odooRpc.callKw.mockResolvedValue([
        { id: 7, name: 'Mantenimientos y controles mensuales' },
        { id: 2, name: 'Soporte técnico' },
        { id: 4, name: 'Laboratorio' },
      ]);

      const result = await service.getHelpdeskTeams();

      expect(result).toEqual([
        { id: 4, name: 'Laboratorio' },
        { id: 7, name: 'Mantenimientos y controles mensuales' },
        { id: 2, name: 'Soporte técnico' },
      ]);
    });

    it('consulta helpdesk.team con search_read y campos id y name', async () => {
      odooRpc.callKw.mockResolvedValue([]);

      await service.getHelpdeskTeams();

      expect(odooRpc.callKw).toHaveBeenCalledWith(
        'helpdesk.team',
        'search_read',
        [[]],
        { fields: ['id', 'name'] },
      );
    });

    it('devuelve lista vacía cuando Odoo no tiene equipos configurados', async () => {
      odooRpc.callKw.mockResolvedValue([]);

      const result = await service.getHelpdeskTeams();

      expect(result).toEqual([]);
    });
  });

  describe('closeTicket', () => {
    beforeEach(() => {
      taskConfigServiceMock.findOne.mockResolvedValue(null);
    });

    it('llama logTimesheet y luego escribe stage_id en el ticket', async () => {
      odooRpc.callKw
        .mockResolvedValueOnce([{ id: 99 }]) // helpdesk.stage search_read
        .mockResolvedValueOnce(88)            // account.analytic.line create
        .mockResolvedValueOnce(true);         // helpdesk.ticket write

      await service.closeTicket(42, 22, 1.5, TaskType.QNAP_MAINTENANCE);

      const calls = odooRpc.callKw.mock.calls;
      expect(calls[1][0]).toBe('account.analytic.line');
      expect(calls[1][1]).toBe('create');
      expect(calls[2][0]).toBe('helpdesk.ticket');
      expect(calls[2][1]).toBe('write');
      expect(calls[2][2]).toEqual([[42], { stage_id: 99 }]);
    });

    it('lanza ServiceUnavailableException cuando Odoo no devuelve ningún stage de cierre', async () => {
      odooRpc.callKw.mockResolvedValueOnce([]);

      await expect(
        service.closeTicket(42, 22, 1.5, TaskType.QNAP_MAINTENANCE),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('no escribe stage_id si logTimesheet falla', async () => {
      odooRpc.callKw
        .mockResolvedValueOnce([{ id: 99 }])
        .mockRejectedValueOnce(new ServiceUnavailableException('Odoo caído'));

      await expect(
        service.closeTicket(42, 22, 1.5, TaskType.QNAP_MAINTENANCE),
      ).rejects.toThrow(ServiceUnavailableException);

      const writeCalls = odooRpc.callKw.mock.calls.filter(
        (args: unknown[]) => args[0] === 'helpdesk.ticket' && args[1] === 'write',
      );
      expect(writeCalls).toHaveLength(0);
    });

    it('propaga ServiceUnavailableException cuando Odoo falla al ejecutar write', async () => {
      odooRpc.callKw
        .mockResolvedValueOnce([{ id: 99 }])
        .mockResolvedValueOnce(88)
        .mockRejectedValueOnce(new ServiceUnavailableException('Odoo caído'));

      await expect(
        service.closeTicket(42, 22, 1.5, TaskType.QNAP_MAINTENANCE),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('para EXPIRATION_CONTROL con expirationType, usa timesheetDescription de expirationsTypeConfigs', async () => {
      integrationConfigServiceMock.getOdoo.mockResolvedValue({
        expirationsTypeConfigs: {
          domain: { enabled: true, helpdeskTeamId: 9, daysAhead: 30, tagIds: [], timesheetDescription: 'Renovación de dominio' },
        },
      });
      odooRpc.callKw
        .mockResolvedValueOnce([{ id: 99 }])
        .mockResolvedValueOnce(88)
        .mockResolvedValueOnce(true);

      await service.closeTicket(42, 22, 1.5, TaskType.EXPIRATION_CONTROL, 'domain');

      expect(taskConfigServiceMock.findOne).not.toHaveBeenCalled();
      const timesheetCall = odooRpc.callKw.mock.calls.find(c => c[0] === 'account.analytic.line');
      expect(timesheetCall![2][0].name).toBe('Renovación de dominio');
    });

    it('para EXPIRATION_CONTROL sin timesheetDescription configurado, cae al default', async () => {
      integrationConfigServiceMock.getOdoo.mockResolvedValue({
        expirationsTypeConfigs: {
          domain: { enabled: true, helpdeskTeamId: 9, daysAhead: 30, tagIds: [] },
        },
      });
      odooRpc.callKw
        .mockResolvedValueOnce([{ id: 99 }])
        .mockResolvedValueOnce(88)
        .mockResolvedValueOnce(true);

      await service.closeTicket(42, 22, 1.5, TaskType.EXPIRATION_CONTROL, 'domain');

      const timesheetCall = odooRpc.callKw.mock.calls.find(c => c[0] === 'account.analytic.line');
      expect(timesheetCall![2][0].name).toBe('Mantenimiento realizado');
    });

    it('para EXPIRATION_CONTROL sin expirationType provisto, cae al default sin lanzar', async () => {
      odooRpc.callKw
        .mockResolvedValueOnce([{ id: 99 }])
        .mockResolvedValueOnce(88)
        .mockResolvedValueOnce(true);

      await expect(
        service.closeTicket(42, 22, 1.5, TaskType.EXPIRATION_CONTROL),
      ).resolves.toBeUndefined();
      const timesheetCall = odooRpc.callKw.mock.calls.find(c => c[0] === 'account.analytic.line');
      expect(timesheetCall![2][0].name).toBe('Mantenimiento realizado');
    });

    it('para tipos que no son EXPIRATION_CONTROL, sigue usando taskConfigService (no cambia el comportamiento existente)', async () => {
      taskConfigServiceMock.findOne.mockResolvedValue({ timesheetDescription: 'Mantenimiento QNAP' });
      odooRpc.callKw
        .mockResolvedValueOnce([{ id: 99 }])
        .mockResolvedValueOnce(88)
        .mockResolvedValueOnce(true);

      await service.closeTicket(42, 22, 1.5, TaskType.QNAP_MAINTENANCE);

      expect(integrationConfigServiceMock.getOdoo).not.toHaveBeenCalled();
      const timesheetCall = odooRpc.callKw.mock.calls.find(c => c[0] === 'account.analytic.line');
      expect(timesheetCall![2][0].name).toBe('Mantenimiento QNAP');
    });
  });

  describe('resolveEmployeeId', () => {
    it('busca en hr.employee por user_id, guarda odooEmployeeId y lo retorna', async () => {
      userRepo.findOne.mockResolvedValue(
        makeUser({ odooUserId: 7, odooEmployeeId: null }),
      );
      odooRpc.callKw.mockResolvedValue([{ id: 22 }]);

      const result = await service.resolveEmployeeId('user-uuid-1');

      expect(odooRpc.callKw).toHaveBeenCalledWith(
        'hr.employee',
        'search_read',
        [[['user_id', '=', 7]]],
        expect.objectContaining({ fields: ['id'], limit: 1 }),
      );
      expect(userRepo.update).toHaveBeenCalledWith(
        'user-uuid-1',
        expect.objectContaining({
          odooEmployeeId: 22,
          odooSyncedAt: expect.any(Date),
        }),
      );
      expect(result).toBe(22);
    });

    it('retorna odooEmployeeId cacheado sin consultar Odoo', async () => {
      userRepo.findOne.mockResolvedValue(
        makeUser({ odooUserId: 7, odooEmployeeId: 22 }),
      );

      const result = await service.resolveEmployeeId('user-uuid-1');

      expect(odooRpc.callKw).not.toHaveBeenCalled();
      expect(result).toBe(22);
    });

    it('retorna null si el usuario no tiene odooUserId', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: null }));

      const result = await service.resolveEmployeeId('user-uuid-1');

      expect(result).toBeNull();
      expect(odooRpc.callKw).not.toHaveBeenCalled();
    });

    it('retorna null si no se encuentra empleado en Odoo', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 7 }));
      odooRpc.callKw.mockResolvedValue([]);

      const result = await service.resolveEmployeeId('user-uuid-1');

      expect(result).toBeNull();
      expect(userRepo.update).not.toHaveBeenCalled();
    });

    it('retorna null si el usuario no existe en InfraOps', async () => {
      userRepo.findOne.mockResolvedValue(null);

      const result = await service.resolveEmployeeId('user-uuid-1');

      expect(result).toBeNull();
    });
  });

  describe('logTimesheet (via closeTicket)', () => {
    beforeEach(() => {
      taskConfigServiceMock.findOne.mockResolvedValue(null);
    });

    it('crea entrada en account.analytic.line con el default "Mantenimiento realizado" cuando no hay override', async () => {
      odooRpc.callKw
        .mockResolvedValueOnce([{ id: 99 }]) // helpdesk.stage
        .mockResolvedValueOnce(88)            // account.analytic.line create
        .mockResolvedValueOnce(true);         // helpdesk.ticket write

      await service.closeTicket(42, 22, 1.5, TaskType.QNAP_MAINTENANCE);

      expect(odooRpc.callKw).toHaveBeenCalledWith(
        'account.analytic.line',
        'create',
        [
          expect.objectContaining({
            helpdesk_ticket_id: 42,
            employee_id: 22,
            name: 'Mantenimiento realizado',
            unit_amount: 1.5,
            date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          }),
        ],
        {},
      );
    });

    it('usa timesheetDescription de la config de DB cuando está definida', async () => {
      taskConfigServiceMock.findOne.mockResolvedValue({
        timesheetDescription: 'Mantenimiento QNAP realizado',
      });
      odooRpc.callKw
        .mockResolvedValueOnce([{ id: 99 }])
        .mockResolvedValueOnce(88)
        .mockResolvedValueOnce(true);

      await service.closeTicket(42, 22, 1.5, TaskType.QNAP_MAINTENANCE);

      expect(odooRpc.callKw).toHaveBeenCalledWith(
        'account.analytic.line',
        'create',
        [expect.objectContaining({ name: 'Mantenimiento QNAP realizado' })],
        {},
      );
    });

    it('propaga ServiceUnavailableException cuando Odoo falla al crear el timesheet', async () => {
      odooRpc.callKw
        .mockResolvedValueOnce([{ id: 99 }]) // helpdesk.stage
        .mockRejectedValueOnce(new ServiceUnavailableException('Odoo caído'));

      await expect(
        service.closeTicket(42, 22, 1.5, TaskType.QNAP_MAINTENANCE),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('markTicketNotDone', () => {
    it('resuelve stage "No realizadas", imputa 0 hs con motivo y mueve ticket al stage', async () => {
      odooRpc.callKw
        .mockResolvedValueOnce([{ id: 88 }]) // helpdesk.stage search_read
        .mockResolvedValueOnce(55)            // account.analytic.line create (0 hs)
        .mockResolvedValueOnce(true);         // helpdesk.ticket write

      await service.markTicketNotDone(42, 22, 'Cliente canceló');

      expect(odooRpc.callKw.mock.calls[0]).toEqual([
        'helpdesk.stage',
        'search_read',
        [
          [
            ['team_ids', 'in', [7]],
            ['name', '=', 'No realizadas'],
          ],
        ],
        { fields: ['id'], limit: 1 },
      ]);
      expect(odooRpc.callKw).toHaveBeenCalledWith(
        'account.analytic.line',
        'create',
        [
          expect.objectContaining({
            helpdesk_ticket_id: 42,
            employee_id: 22,
            name: 'Cliente canceló',
            unit_amount: 0,
          }),
        ],
        {},
      );
      expect(odooRpc.callKw.mock.calls[2]).toEqual([
        'helpdesk.ticket',
        'write',
        [[42], { stage_id: 88 }],
        {},
      ]);
    });

    it('lanza ServiceUnavailableException cuando Odoo no devuelve ningún stage "No realizadas"', async () => {
      odooRpc.callKw.mockResolvedValueOnce([]);

      await expect(
        service.markTicketNotDone(42, 22, 'Motivo'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('propaga excepción cuando Odoo falla al ejecutar write', async () => {
      odooRpc.callKw
        .mockResolvedValueOnce([{ id: 88 }])
        .mockResolvedValueOnce(55) // logTimesheet ok
        .mockRejectedValueOnce(new ServiceUnavailableException('Odoo caído'));

      await expect(
        service.markTicketNotDone(42, 22, 'Motivo'),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('getSubscriptionHours', () => {
    it('retorna lista vacía sin llamar a Odoo cuando partnerIds está vacío', async () => {
      const result = await service.getSubscriptionHours([]);
      expect(result).toEqual([]);
      expect(odooRpc.callKw).not.toHaveBeenCalled();
    });

    it('suma horas de dos productos (Hora Única + Hora Única Garantia) para el mismo partner', async () => {
      odooRpc.callKw
        .mockResolvedValueOnce([
          { id: 1, product_uom_qty: 20, qty_delivered: 8,  order_id: [101, 'SO001'] },
          { id: 2, product_uom_qty: 5,  qty_delivered: 2,  order_id: [101, 'SO001'] },
        ])
        .mockResolvedValueOnce([
          { id: 101, partner_id: [201, 'ACME Corp'] },
        ]);

      const result = await service.getSubscriptionHours([201]);

      expect(result).toEqual([{ partnerId: 201, contracted: 25, delivered: 10 }]);
    });

    it('maneja múltiples partners en una sola llamada a Odoo', async () => {
      odooRpc.callKw
        .mockResolvedValueOnce([
          { id: 1, product_uom_qty: 20, qty_delivered: 5, order_id: [101, 'SO001'] },
          { id: 2, product_uom_qty: 10, qty_delivered: 8, order_id: [102, 'SO002'] },
        ])
        .mockResolvedValueOnce([
          { id: 101, partner_id: [201, 'ACME Corp'] },
          { id: 102, partner_id: [202, 'Beta SRL'] },
        ]);

      const result = await service.getSubscriptionHours([201, 202]);

      expect(result).toHaveLength(2);
      expect(result).toContainEqual({ partnerId: 201, contracted: 20, delivered: 5 });
      expect(result).toContainEqual({ partnerId: 202, contracted: 10, delivered: 8 });
    });

    it('retorna lista vacía y hace solo una llamada cuando Odoo no devuelve líneas', async () => {
      odooRpc.callKw.mockResolvedValueOnce([]);

      const result = await service.getSubscriptionHours([201]);

      expect(result).toEqual([]);
      expect(odooRpc.callKw).toHaveBeenCalledTimes(1);
    });
  });

  describe('getClientSubscriptionHours', () => {
    it('devuelve horas mapeadas por clientId con available calculado', async () => {
      clientRepo.find.mockResolvedValue([
        makeClient({ id: 'client-1', odooPartnerId: 201 }),
      ]);
      jest.spyOn(service, 'getSubscriptionHours').mockResolvedValue([
        { partnerId: 201, contracted: 20, delivered: 8 },
      ]);

      const result = await service.getClientSubscriptionHours();

      expect(result).toEqual([
        { clientId: 'client-1', contracted: 20, delivered: 8, available: 12 },
      ]);
    });

    it('available es 0 cuando delivered supera contracted', async () => {
      clientRepo.find.mockResolvedValue([
        makeClient({ id: 'client-1', odooPartnerId: 201 }),
      ]);
      jest.spyOn(service, 'getSubscriptionHours').mockResolvedValue([
        { partnerId: 201, contracted: 10, delivered: 15 },
      ]);

      const result = await service.getClientSubscriptionHours();

      expect(result[0].available).toBe(0);
    });

    it('retorna lista vacía y no llama a getSubscriptionHours cuando no hay clientes con odooPartnerId', async () => {
      clientRepo.find.mockResolvedValue([]);
      const spy = jest.spyOn(service, 'getSubscriptionHours');

      const result = await service.getClientSubscriptionHours();

      expect(result).toEqual([]);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('getClientSubscriptionHours con month y year', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('cuando se pide un mes ya cerrado con snapshot guardado, devuelve esos valores sin consultar Odoo', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-15T12:00:00Z'));
      clientRepo.find.mockResolvedValue([
        makeClient({ id: 'c1', odooPartnerId: 101 }),
      ]);
      snapshotRepo.find.mockResolvedValue([
        { clientId: 'c1', year: 2026, month: 8, contracted: 20, delivered: 8, available: 12 },
      ]);

      // Agosto 2026 ya cerró (estamos en septiembre)
      const result = await service.getClientSubscriptionHours(8, 2026);

      expect(odooRpc.callKw).not.toHaveBeenCalled();
      expect(snapshotRepo.find).toHaveBeenCalledWith({
        where: { clientId: expect.anything(), year: 2026, month: 8 },
      });
      expect(result).toEqual([
        { clientId: 'c1', contracted: 20, delivered: 8, available: 12 },
      ]);
    });

    it('cuando se pide un mes ya cerrado sin snapshot guardado, devuelve ceros para ese cliente', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-15T12:00:00Z'));
      clientRepo.find.mockResolvedValue([
        makeClient({ id: 'c1', odooPartnerId: 101 }),
      ]);
      snapshotRepo.find.mockResolvedValue([]);

      // Julio 2026 cerró antes de que existiera este feature — no hay snapshot
      const result = await service.getClientSubscriptionHours(7, 2026);

      expect(odooRpc.callKw).not.toHaveBeenCalled();
      expect(result).toEqual([
        { clientId: 'c1', contracted: 0, delivered: 0, available: 0 },
      ]);
    });

    it('cuando month/year corresponden al mes actual (en curso), usa qty_delivered en vivo en vez de account.analytic.line', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-15T12:00:00Z'));
      clientRepo.find.mockResolvedValue([
        makeClient({ id: 'c1', odooPartnerId: 101 }),
      ]);
      odooRpc.callKw
        .mockResolvedValueOnce([
          { product_uom_qty: 20, qty_delivered: 8, order_id: [1, 'SO001'] },
        ])
        .mockResolvedValueOnce([{ id: 1, partner_id: [101, 'ACME'] }]);

      // Septiembre 2026 es el mes en curso (fecha del sistema congelada arriba)
      const result = await service.getClientSubscriptionHours(9, 2026);

      // Solo 2 llamadas: no debe consultar account.analytic.line para el mes abierto
      expect(odooRpc.callKw).toHaveBeenCalledTimes(2);
      expect(result).toEqual([
        { clientId: 'c1', contracted: 20, delivered: 8, available: 12 },
      ]);
    });

    it('cuando no se pasan params, usa qty_delivered de sale.order.line (comportamiento actual)', async () => {
      clientRepo.find.mockResolvedValue([
        makeClient({ id: 'c1', odooPartnerId: 101 }),
      ]);
      odooRpc.callKw
        .mockResolvedValueOnce([
          { product_uom_qty: 20, qty_delivered: 8, order_id: [1, 'SO001'] },
        ])
        .mockResolvedValueOnce([{ id: 1, partner_id: [101, 'ACME'] }]);

      const result = await service.getClientSubscriptionHours();

      // Solo 2 llamadas a callKw (no hay tercera para account.analytic.line)
      expect(odooRpc.callKw).toHaveBeenCalledTimes(2);
      expect(result).toEqual([
        { clientId: 'c1', contracted: 20, delivered: 8, available: 12 },
      ]);
    });
  });

  describe('snapshotCurrentMonthHours', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('guarda (upsert) las horas en vivo de todos los clientes para el mes/año en curso', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-15T12:00:00Z'));
      clientRepo.find.mockResolvedValue([
        makeClient({ id: 'c1', odooPartnerId: 101 }),
      ]);
      odooRpc.callKw
        .mockResolvedValueOnce([
          { product_uom_qty: 20, qty_delivered: 8, order_id: [1, 'SO001'] },
        ])
        .mockResolvedValueOnce([{ id: 1, partner_id: [101, 'ACME'] }]);

      await service.snapshotCurrentMonthHours();

      expect(snapshotRepo.upsert).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            clientId: 'c1',
            year: 2026,
            month: 9,
            contracted: 20,
            delivered: 8,
            available: 12,
          }),
        ],
        ['clientId', 'year', 'month'],
      );
    });

    it('no llama a upsert cuando no hay clientes con horas', async () => {
      clientRepo.find.mockResolvedValue([]);

      await service.snapshotCurrentMonthHours();

      expect(snapshotRepo.upsert).not.toHaveBeenCalled();
    });

    it('loguea el error y no propaga la excepción si falla la consulta a Odoo', async () => {
      clientRepo.find.mockResolvedValue([
        makeClient({ id: 'c1', odooPartnerId: 101 }),
      ]);
      odooRpc.callKw.mockRejectedValue(new Error('Odoo no disponible'));

      await expect(service.snapshotCurrentMonthHours()).resolves.toBeUndefined();
      expect(snapshotRepo.upsert).not.toHaveBeenCalled();
    });
  });

  describe('resolveSaleLineId', () => {
    it('busca sale.order.line por partner_id y producto Hora Única, cachea y retorna', async () => {
      clientRepo.findOne.mockResolvedValue(
        makeClient({ odooPartnerId: 101, odooSaleLineId: null }),
      );
      odooRpc.callKw.mockResolvedValue([{ id: 55 }]);

      const result = await service.resolveSaleLineId('client-uuid-1');

      expect(odooRpc.callKw).toHaveBeenCalledWith(
        'sale.order.line',
        'search_read',
        [
          [
            ['order_id.partner_id', '=', 101],
            ['product_id.name', '=', 'Hora Única'],
            ['order_id.state', 'in', ['sale', 'done']],
          ],
        ],
        expect.objectContaining({ fields: ['id'], limit: 1 }),
      );
      expect(clientRepo.update).toHaveBeenCalledWith(
        'client-uuid-1',
        expect.objectContaining({
          odooSaleLineId: 55,
          odooSyncedAt: expect.any(Date),
        }),
      );
      expect(result).toBe(55);
    });

    it('retorna odooSaleLineId cacheado sin consultar Odoo', async () => {
      clientRepo.findOne.mockResolvedValue(
        makeClient({ odooPartnerId: 101, odooSaleLineId: 55 }),
      );

      const result = await service.resolveSaleLineId('client-uuid-1');

      expect(odooRpc.callKw).not.toHaveBeenCalled();
      expect(result).toBe(55);
    });

    it('retorna null si el cliente no tiene odooPartnerId', async () => {
      clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: null }));

      const result = await service.resolveSaleLineId('client-uuid-1');

      expect(result).toBeNull();
      expect(odooRpc.callKw).not.toHaveBeenCalled();
    });

    it('retorna null si no se encuentra línea en Odoo', async () => {
      clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: 101 }));
      odooRpc.callKw.mockResolvedValue([]);

      const result = await service.resolveSaleLineId('client-uuid-1');

      expect(result).toBeNull();
      expect(clientRepo.update).not.toHaveBeenCalled();
    });

    it('retorna null si el cliente no existe', async () => {
      clientRepo.findOne.mockResolvedValue(null);

      const result = await service.resolveSaleLineId('client-uuid-1');

      expect(result).toBeNull();
    });
  });

  describe('getActiveServices', () => {
    it('retorna [] cuando partnerIds está vacío', async () => {
      const result = await service.getActiveServices([]);
      expect(odooRpc.callKw).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('retorna [] cuando Odoo no devuelve líneas', async () => {
      odooRpc.callKw.mockResolvedValue([]);
      const result = await service.getActiveServices([101]);
      expect(result).toEqual([]);
    });

    it('hace 2 llamadas a Odoo: líneas de suscripción y luego órdenes', async () => {
      odooRpc.callKw
        .mockResolvedValueOnce([
          { id: 1, product_id: [55, 'Hosting'], order_id: [10, 'S001'] },
        ])
        .mockResolvedValueOnce([
          { id: 10, partner_id: [101, 'ACME'], subscription_state: '3_progress' },
        ]);

      await service.getActiveServices([101]);

      expect(odooRpc.callKw).toHaveBeenCalledTimes(2);
      expect(odooRpc.callKw).toHaveBeenNthCalledWith(
        1,
        'sale.order.line',
        'search_read',
        expect.arrayContaining([
          expect.arrayContaining([
            ['order_id.partner_id', 'in', [101]],
            ['order_id.is_subscription', '=', true],
          ]),
        ]),
        expect.objectContaining({ fields: expect.arrayContaining(['product_id', 'order_id']) }),
      );
      expect(odooRpc.callKw).toHaveBeenNthCalledWith(
        2,
        'sale.order',
        'read',
        [[10]],
        expect.objectContaining({ fields: expect.arrayContaining(['partner_id', 'subscription_state']) }),
      );
    });

    it('marca active=true cuando subscription_state es 3_progress', async () => {
      odooRpc.callKw
        .mockResolvedValueOnce([
          { id: 1, product_id: [55, 'Hosting'], order_id: [10, 'S001'] },
        ])
        .mockResolvedValueOnce([
          { id: 10, partner_id: [101, 'ACME'], subscription_state: '3_progress' },
        ]);

      const result = await service.getActiveServices([101]);

      expect(result).toEqual([
        { partnerId: 101, productId: 55, productName: 'Hosting', active: true },
      ]);
    });

    it('marca active=false cuando subscription_state es 4_paused o 6_churn', async () => {
      odooRpc.callKw
        .mockResolvedValueOnce([
          { id: 1, product_id: [55, 'Hosting'], order_id: [10, 'S001'] },
          { id: 2, product_id: [56, 'Kaspersky'], order_id: [11, 'S002'] },
        ])
        .mockResolvedValueOnce([
          { id: 10, partner_id: [101, 'ACME'], subscription_state: '4_paused' },
          { id: 11, partner_id: [101, 'ACME'], subscription_state: '6_churn' },
        ]);

      const result = await service.getActiveServices([101]);

      expect(result).toEqual(
        expect.arrayContaining([
          { partnerId: 101, productId: 55, productName: 'Hosting', active: false },
          { partnerId: 101, productId: 56, productName: 'Kaspersky', active: false },
        ]),
      );
    });

    it('excluye del dominio cualquier producto de horas (Única/Advance/Standard, con o sin Garantía)', async () => {
      odooRpc.callKw
        .mockResolvedValueOnce([
          { id: 1, product_id: [55, 'Hosting'], order_id: [10, 'S001'] },
        ])
        .mockResolvedValueOnce([
          { id: 10, partner_id: [101, 'ACME'], subscription_state: '3_progress' },
        ]);

      await service.getActiveServices([101]);

      expect(odooRpc.callKw).toHaveBeenNthCalledWith(
        1,
        'sale.order.line',
        'search_read',
        expect.arrayContaining([
          expect.arrayContaining([
            ['order_id.partner_id', 'in', [101]],
            ['order_id.is_subscription', '=', true],
            ['product_id.name', 'not ilike', 'Hora '],
          ]),
        ]),
        expect.objectContaining({ fields: expect.arrayContaining(['product_id', 'order_id']) }),
      );
    });

    it('agrupa líneas de múltiples partners correctamente', async () => {
      odooRpc.callKw
        .mockResolvedValueOnce([
          { id: 1, product_id: [55, 'Hosting'], order_id: [10, 'S001'] },
          { id: 2, product_id: [55, 'Hosting'], order_id: [11, 'S002'] },
        ])
        .mockResolvedValueOnce([
          { id: 10, partner_id: [101, 'ACME'], subscription_state: '3_progress' },
          { id: 11, partner_id: [102, 'BETA'], subscription_state: '4_paused' },
        ]);

      const result = await service.getActiveServices([101, 102]);

      expect(result).toEqual(
        expect.arrayContaining([
          { partnerId: 101, productId: 55, productName: 'Hosting', active: true },
          { partnerId: 102, productId: 55, productName: 'Hosting', active: false },
        ]),
      );
    });
  });

  describe('createExpirationTicket', () => {
    const makeExpItem = (overrides = {}): ExpirationItemDto => ({
      sourceId: 'd1', type: 'domain', clientId: 1, clientName: 'Acme',
      itemName: 'acme.com', expireDate: '2026-10-15', daysUntil: 20,
      ...overrides,
    });

    beforeEach(() => {
      clientRepo.findOne.mockResolvedValue(
        makeClient({ id: 'client-uuid-1', odooPartnerId: 101, taxIdNumber: '20-12345678-0' })
      );
      odooRpc.callKw.mockResolvedValue(999); // Odoo ticket ID
    });

    it('construye payload con team_id, partner_id, name con typeLabel, sin user_id', async () => {
      await service.createExpirationTicket(makeExpItem({ type: 'domain', itemName: 'acme.com', clientName: 'Acme' }), 'client-uuid-1', 9, []);
      expect(odooRpc.callKw).toHaveBeenCalledWith(
        'helpdesk.ticket', 'create',
        [expect.objectContaining({
          team_id: 9,
          partner_id: 101,
          name: 'Vencimiento: Dominio – Acme – acme.com',
        })],
        {},
      );
      expect(odooRpc.callKw).toHaveBeenCalledWith(
        'helpdesk.ticket', 'create',
        [expect.not.objectContaining({ user_id: expect.anything() })],
        {},
      );
    });

    it('usa el team_id pasado por parámetro, no un valor global', async () => {
      await service.createExpirationTicket(makeExpItem(), 'client-uuid-1', 42, []);
      expect(odooRpc.callKw).toHaveBeenCalledWith(
        'helpdesk.ticket', 'create',
        [expect.objectContaining({ team_id: 42 })],
        {},
      );
    });

    it('incluye sale_line_id si el cliente tiene mapeo', async () => {
      clientRepo.findOne
        .mockResolvedValueOnce(makeClient({ id: 'client-uuid-1', odooPartnerId: 101 }))
        .mockResolvedValueOnce(makeClient({ id: 'client-uuid-1', odooPartnerId: 101, odooSaleLineId: 55 }));
      await service.createExpirationTicket(makeExpItem(), 'client-uuid-1', 9, []);
      expect(odooRpc.callKw).toHaveBeenCalledWith(
        'helpdesk.ticket', 'create',
        [expect.objectContaining({ sale_line_id: 55 })],
        {},
      );
    });

    it('omite sale_line_id si el cliente no tiene mapeo', async () => {
      clientRepo.findOne
        .mockResolvedValueOnce(makeClient({ id: 'client-uuid-1', odooPartnerId: 101 }))
        .mockResolvedValueOnce(makeClient({ id: 'client-uuid-1', odooPartnerId: 101, odooSaleLineId: null }));
      odooRpc.callKw.mockResolvedValue(null);
      odooRpc.callKw.mockResolvedValue(999);
      await service.createExpirationTicket(makeExpItem(), 'client-uuid-1', 9, []);
      const callArg = odooRpc.callKw.mock.calls[0][2][0] as Record<string, unknown>;
      expect(callArg['sale_line_id']).toBeUndefined();
    });

    it('incluye tag_ids si se pasan tags', async () => {
      await service.createExpirationTicket(makeExpItem(), 'client-uuid-1', 9, [3, 5]);
      expect(odooRpc.callKw).toHaveBeenCalledWith(
        'helpdesk.ticket', 'create',
        [expect.objectContaining({ tag_ids: [[6, 0, [3, 5]]] })],
        {},
      );
    });

    it('omite tag_ids si el array de tags está vacío', async () => {
      await service.createExpirationTicket(makeExpItem(), 'client-uuid-1', 9, []);
      const callArg = odooRpc.callKw.mock.calls[0][2][0] as Record<string, unknown>;
      expect(callArg['tag_ids']).toBeUndefined();
    });

    it('lanza BadRequestException si helpdeskTeamId es 0 (sin equipo configurado)', async () => {
      await expect(service.createExpirationTicket(makeExpItem(), 'client-uuid-1', 0, []))
        .rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si partnerId no resuelto', async () => {
      clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: null, taxIdNumber: null }));
      await expect(service.createExpirationTicket(makeExpItem(), 'client-uuid-1', 9, []))
        .rejects.toThrow(BadRequestException);
    });

    it('lanza ServiceUnavailableException si Odoo devuelve false', async () => {
      odooRpc.callKw.mockResolvedValue(false);
      await expect(service.createExpirationTicket(makeExpItem(), 'client-uuid-1', 9, []))
        .rejects.toThrow(ServiceUnavailableException);
    });

    it('usa typeLabel correcto para cada ExpirationType', async () => {
      const cases: Array<[string, string]> = [
        ['domain', 'Dominio'],
        ['certificate', 'Certificado'],
        ['software', 'Licencia'],
        ['asset_warranty', 'Garantía'],
      ];
      for (const [type, label] of cases) {
        odooRpc.callKw.mockResolvedValue(999);
        clientRepo.findOne.mockResolvedValue(makeClient({ id: 'client-uuid-1', odooPartnerId: 101 }));
        await service.createExpirationTicket(makeExpItem({ type }), 'client-uuid-1', 9, []);
        const callArg = odooRpc.callKw.mock.calls[odooRpc.callKw.mock.calls.length - 1][2][0] as Record<string, unknown>;
        expect(callArg['name']).toContain(label);
      }
    });

    it('usa taskName recibido en el nombre en vez del label default', async () => {
      await service.createExpirationTicket(
        makeExpItem({ type: 'domain', clientName: 'Acme', itemName: 'acme.com' }),
        'client-uuid-1', 9, [], 'Renovación de dominio',
      );
      const callArg = odooRpc.callKw.mock.calls[odooRpc.callKw.mock.calls.length - 1][2][0] as Record<string, unknown>;
      expect(callArg['name']).toBe('Vencimiento: Renovación de dominio – Acme – acme.com');
    });

    it('cae al label default si taskName es undefined, vacío o solo espacios', async () => {
      for (const taskName of [undefined, '', '   ']) {
        odooRpc.callKw.mockResolvedValue(999);
        await service.createExpirationTicket(
          makeExpItem({ type: 'domain', clientName: 'Acme', itemName: 'acme.com' }),
          'client-uuid-1', 9, [], taskName,
        );
        const callArg = odooRpc.callKw.mock.calls[odooRpc.callKw.mock.calls.length - 1][2][0] as Record<string, unknown>;
        expect(callArg['name']).toBe('Vencimiento: Dominio – Acme – acme.com');
      }
    });

    it('antepone ticketDescription convertido a HTML a la fecha/días restantes', async () => {
      await service.createExpirationTicket(
        makeExpItem({ expireDate: '2026-10-15', daysUntil: 20 }),
        'client-uuid-1', 9, [], undefined, 'Verificar con el proveedor antes de renovar',
      );
      const callArg = odooRpc.callKw.mock.calls[odooRpc.callKw.mock.calls.length - 1][2][0] as Record<string, unknown>;
      const description = callArg['description'] as string;
      expect(description).toContain('Verificar con el proveedor antes de renovar');
      expect(description).toContain('2026-10-15');
      expect(description).toContain('20');
    });

    it('la descripción incluye fecha y días restantes aunque no haya ticketDescription configurado', async () => {
      await service.createExpirationTicket(
        makeExpItem({ expireDate: '2026-10-15', daysUntil: 20 }),
        'client-uuid-1', 9, [],
      );
      const callArg = odooRpc.callKw.mock.calls[odooRpc.callKw.mock.calls.length - 1][2][0] as Record<string, unknown>;
      const description = callArg['description'] as string;
      expect(description).toContain('2026-10-15');
      expect(description).toContain('20');
    });
  });

  describe('getClientActiveServices', () => {
    it('retorna [] cuando no hay clientes activos con odooPartnerId', async () => {
      clientRepo.find.mockResolvedValue([]);
      const result = await service.getClientActiveServices();
      expect(result).toEqual([]);
    });

    it('retorna services:[] para clientes sin suscripciones en Odoo', async () => {
      clientRepo.find.mockResolvedValue([
        makeClient({ id: 'c1', odooPartnerId: 101 }),
      ]);
      odooRpc.callKw.mockResolvedValue([]);

      const result = await service.getClientActiveServices();

      expect(result).toEqual([{ clientId: 'c1', services: [] }]);
    });

    it('mapea partnerId → clientId y devuelve los servicios', async () => {
      clientRepo.find.mockResolvedValue([
        makeClient({ id: 'c1', odooPartnerId: 101 }),
      ]);
      odooRpc.callKw
        .mockResolvedValueOnce([
          { id: 1, product_id: [55, 'Hosting'], order_id: [10, 'S001'] },
        ])
        .mockResolvedValueOnce([
          { id: 10, partner_id: [101, 'ACME'], subscription_state: '3_progress' },
        ]);

      const result = await service.getClientActiveServices();

      expect(result).toEqual([
        { clientId: 'c1', services: [{ name: 'Hosting', active: true }] },
      ]);
    });

    it('deduplica por productId: si el mismo producto aparece en 2 líneas, active=OR', async () => {
      clientRepo.find.mockResolvedValue([
        makeClient({ id: 'c1', odooPartnerId: 101 }),
      ]);
      odooRpc.callKw
        .mockResolvedValueOnce([
          { id: 1, product_id: [55, 'Hosting'], order_id: [10, 'S001'] },
          { id: 2, product_id: [55, 'Hosting'], order_id: [11, 'S002'] },
        ])
        .mockResolvedValueOnce([
          { id: 10, partner_id: [101, 'ACME'], subscription_state: '4_paused' },
          { id: 11, partner_id: [101, 'ACME'], subscription_state: '3_progress' },
        ]);

      const result = await service.getClientActiveServices();

      expect(result[0].services).toHaveLength(1);
      expect(result[0].services[0]).toEqual({ name: 'Hosting', active: true });
    });

    it('usa el nombre del producto de Odoo cuando no hay override definido', async () => {
      clientRepo.find.mockResolvedValue([
        makeClient({ id: 'c1', odooPartnerId: 101 }),
      ]);
      odooRpc.callKw
        .mockResolvedValueOnce([
          { id: 1, product_id: [55, 'Hosting Web'], order_id: [10, 'S001'] },
        ])
        .mockResolvedValueOnce([
          { id: 10, partner_id: [101, 'ACME'], subscription_state: '3_progress' },
        ]);

      const result = await service.getClientActiveServices();

      expect(result[0].services[0].name).toBe('Hosting Web');
    });

    it('no incluye clientes sin odooPartnerId', async () => {
      clientRepo.find.mockResolvedValue([
        makeClient({ id: 'c1', odooPartnerId: 101 }),
      ]);
      odooRpc.callKw.mockResolvedValue([]);

      await service.getClientActiveServices();

      const callArg = clientRepo.find.mock.calls[0][0];
      expect(callArg.where).toMatchObject({ isActive: true });
    });
  });
});
