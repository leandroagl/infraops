import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Client } from '../../clients/client.entity';
import { User } from '../../users/user.entity';
import { Technician } from '../../technicians/technician.entity';
import { OdooRpcService } from './odoo-rpc.service';
import { OdooService } from './odoo.service';
import { OdooPartner } from './dto/odoo-partner.dto';
import { OdooUser } from './dto/odoo-user.dto';

describe('OdooService', () => {
  let service: OdooService;
  let odooRpc: { callKw: jest.Mock };
  let clientRepo: { find: jest.Mock; findOne: jest.Mock; update: jest.Mock; count: jest.Mock };
  let userRepo: { find: jest.Mock; findOne: jest.Mock; update: jest.Mock; count: jest.Mock };
  let technicianRepo: { findOne: jest.Mock };
  let configService: { getOrThrow: jest.Mock };

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

  const makeOdooPartner = (override: Partial<OdooPartner> = {}): OdooPartner => ({
    id: 101,
    name: 'ACME Corp',
    vat: '20-12345678-0',
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

  const makeTechnician = (userId = 'user-uuid-1'): Technician =>
    ({
      id: 'tech-uuid-1',
      user: makeUser({ id: userId, odooUserId: 201 }),
      createdAt: new Date('2026-01-01'),
    }) as unknown as Technician;

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
    configService = {
      getOrThrow: jest.fn().mockReturnValue('5'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OdooService,
        { provide: OdooRpcService, useValue: odooRpc },
        { provide: getRepositoryToken(Client), useValue: clientRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: ConfigService, useValue: configService },
        { provide: getRepositoryToken(Technician), useValue: technicianRepo },
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
        expect.objectContaining({ odooPartnerId: 101, odooSyncedAt: expect.any(Date) }),
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

    it('consulta Odoo con filtros is_company=true, vat!=false y email!=false', async () => {
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
            ['email', '!=', false],
          ]),
        ]),
        expect.objectContaining({ fields: expect.arrayContaining(['id', 'name', 'vat']) }),
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

      await expect(service.syncPartners()).rejects.toThrow('Connection refused');
    });
  });

  describe('syncUsers', () => {
    it('actualiza odooUserId del usuario cuando email coincide', async () => {
      userRepo.find.mockResolvedValue([makeUser()]);
      odooRpc.callKw
        .mockResolvedValueOnce([makeOdooUser()])  // res.users call
        .mockResolvedValueOnce([]);               // hr.employee call → no employees

      const result = await service.syncUsers();

      expect(userRepo.update).toHaveBeenCalledWith(
        'user-uuid-1',
        expect.objectContaining({ odooUserId: 201, odooSyncedAt: expect.any(Date) }),
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
        expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
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
      const users = [makeUser({ id: 'user-1', email: 'a@ondra.com', odooUserId: null })];
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

      expect(result).toEqual({ clientsWithoutOdooId: 5, usersWithoutOdooId: 2 });
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
      clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: null, taxIdNumber: '20-12345678-0' }));
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
      clientRepo.findOne.mockResolvedValue(makeClient({ taxIdNumber: '20-12345678-0' }));
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
      odooRpc.callKw.mockResolvedValue([{ id: 201, login: 'tecnico@ondra.com' }]);

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
    it('crea un ticket en Odoo y retorna el ticket ID', async () => {
      clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: 101, odooSaleLineId: null }));
      technicianRepo.findOne.mockResolvedValue(makeTechnician());
      userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
      odooRpc.callKw
        .mockResolvedValueOnce([])  // sale.order.line search → sin resultado
        .mockResolvedValueOnce(42); // helpdesk.ticket create

      const ticketId = await service.createTicket('client-uuid-1', 'tech-uuid-1');

      expect(ticketId).toBe(42);
      expect(odooRpc.callKw).toHaveBeenCalledWith(
        'helpdesk.ticket',
        'create',
        [
          {
            team_id: 5,
            partner_id: 101,
            user_id: 201,
            name: 'Mantenimiento de infraestructura',
            description: 'Mantenimiento mensual!',
          },
        ],
        {},
      );
    });

    it('lanza BadRequestException cuando el cliente no tiene ID de Odoo', async () => {
      clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: null, taxIdNumber: null }));

      await expect(service.createTicket('client-uuid-1', 'tech-uuid-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(odooRpc.callKw).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException cuando el técnico no tiene ID de Odoo', async () => {
      clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: 101 }));
      technicianRepo.findOne.mockResolvedValue(makeTechnician());
      userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: null }));
      odooRpc.callKw.mockResolvedValue([]);

      await expect(service.createTicket('client-uuid-1', 'tech-uuid-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('propaga ServiceUnavailableException cuando Odoo falla al crear el ticket', async () => {
      clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: 101 }));
      technicianRepo.findOne.mockResolvedValue(makeTechnician());
      userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
      odooRpc.callKw.mockRejectedValue(new ServiceUnavailableException('Odoo caído'));

      await expect(service.createTicket('client-uuid-1', 'tech-uuid-1')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('lanza ServiceUnavailableException cuando Odoo devuelve false al crear el ticket', async () => {
      clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: 101, odooSaleLineId: null }));
      technicianRepo.findOne.mockResolvedValue(makeTechnician());
      userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
      odooRpc.callKw
        .mockResolvedValueOnce([])     // sale.order.line search → sin resultado
        .mockResolvedValueOnce(false); // helpdesk.ticket create → false (Odoo constraint failure)

      await expect(service.createTicket('client-uuid-1', 'tech-uuid-1')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('lanza error cuando ODOO_HELPDESK_TEAM_ID no es un entero válido', async () => {
      configService.getOrThrow.mockReturnValue('not-a-number');
      clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: 101 }));
      technicianRepo.findOne.mockResolvedValue(makeTechnician());
      userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));

      await expect(service.createTicket('client-uuid-1', 'tech-uuid-1')).rejects.toThrow(
        'ODOO_HELPDESK_TEAM_ID must be a valid integer',
      );
      expect(odooRpc.callKw).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException cuando el técnico no tiene usuario asociado', async () => {
      clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: 101 }));
      technicianRepo.findOne.mockResolvedValue({
        id: 'tech-uuid-1',
        user: null,
        createdAt: new Date('2026-01-01'),
      });

      await expect(service.createTicket('client-uuid-1', 'tech-uuid-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(odooRpc.callKw).not.toHaveBeenCalled();
    });

    it('incluye sale_line_id en el payload cuando resolveSaleLineId retorna un id', async () => {
      const technician = makeTechnician();
      clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: 101, odooSaleLineId: 55 }));
      technicianRepo.findOne.mockResolvedValue(technician);
      userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
      odooRpc.callKw.mockResolvedValue(99);

      await service.createTicket('client-uuid-1', 'tech-uuid-1');

      expect(odooRpc.callKw).toHaveBeenCalledWith(
        'helpdesk.ticket',
        'create',
        [expect.objectContaining({ sale_line_id: 55 })],
        {},
      );
    });

    it('crea el ticket sin sale_line_id cuando resolveSaleLineId retorna null', async () => {
      const technician = makeTechnician();
      clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: 101, odooSaleLineId: null }));
      technicianRepo.findOne.mockResolvedValue(technician);
      userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 201 }));
      odooRpc.callKw
        .mockResolvedValueOnce([])   // sale.order.line search → sin resultado
        .mockResolvedValueOnce(99);  // helpdesk.ticket create

      await service.createTicket('client-uuid-1', 'tech-uuid-1');

      const createCall = odooRpc.callKw.mock.calls.find(
        (args: unknown[]) => args[0] === 'helpdesk.ticket',
      );
      expect(createCall![2][0]).not.toHaveProperty('sale_line_id');
    });
  });

  describe('closeTicket', () => {
    it('llama logTimesheet y luego escribe stage_id en el ticket', async () => {
      odooRpc.callKw
        .mockResolvedValueOnce([{ id: 99 }]) // helpdesk.stage search_read
        .mockResolvedValueOnce(88)            // account.analytic.line create
        .mockResolvedValueOnce(true);         // helpdesk.ticket write

      await service.closeTicket(42, 22, 1.5);

      const calls = odooRpc.callKw.mock.calls;
      expect(calls[1][0]).toBe('account.analytic.line');
      expect(calls[1][1]).toBe('create');
      expect(calls[2][0]).toBe('helpdesk.ticket');
      expect(calls[2][1]).toBe('write');
      expect(calls[2][2]).toEqual([[42], { stage_id: 99 }]);
    });

    it('reutiliza el stage cacheado en llamadas subsiguientes sin volver a consultar Odoo', async () => {
      odooRpc.callKw
        .mockResolvedValueOnce([{ id: 99 }]) // primera llamada: resuelve stage
        .mockResolvedValue(true);

      await service.closeTicket(42, 22, 1.5);
      await service.closeTicket(43, 22, 0.5);

      const stageCalls = odooRpc.callKw.mock.calls.filter(
        (args: unknown[]) => args[0] === 'helpdesk.stage',
      );
      expect(stageCalls).toHaveLength(1);
    });

    it('lanza ServiceUnavailableException cuando Odoo no devuelve ningún stage de cierre', async () => {
      odooRpc.callKw.mockResolvedValueOnce([]);

      await expect(service.closeTicket(42, 22, 1.5)).rejects.toThrow(ServiceUnavailableException);
    });

    it('no escribe stage_id si logTimesheet falla', async () => {
      odooRpc.callKw
        .mockResolvedValueOnce([{ id: 99 }])
        .mockRejectedValueOnce(new ServiceUnavailableException('Odoo caído'));

      await expect(service.closeTicket(42, 22, 1.5)).rejects.toThrow(ServiceUnavailableException);

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

      await expect(service.closeTicket(42, 22, 1.5)).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('resolveEmployeeId', () => {
    it('busca en hr.employee por user_id, guarda odooEmployeeId y lo retorna', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 7, odooEmployeeId: null }));
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
        expect.objectContaining({ odooEmployeeId: 22, odooSyncedAt: expect.any(Date) }),
      );
      expect(result).toBe(22);
    });

    it('retorna odooEmployeeId cacheado sin consultar Odoo', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ odooUserId: 7, odooEmployeeId: 22 }));

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

  describe('logTimesheet', () => {
    it('crea entrada en account.analytic.line con los campos correctos', async () => {
      odooRpc.callKw.mockResolvedValue(88);

      await service.logTimesheet(42, 22, 1.5);

      expect(odooRpc.callKw).toHaveBeenCalledWith(
        'account.analytic.line',
        'create',
        [expect.objectContaining({
          helpdesk_ticket_id: 42,
          employee_id: 22,
          name: 'Mantenimiento realizado',
          unit_amount: 1.5,
          date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        })],
        {},
      );
    });

    it('propaga ServiceUnavailableException cuando Odoo falla al crear el timesheet', async () => {
      odooRpc.callKw.mockRejectedValue(new ServiceUnavailableException('Odoo caído'));

      await expect(service.logTimesheet(42, 22, 1.5)).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('markTicketInProgress', () => {
    it('resuelve stage "En Curso" por nombre y escribe stage_id en el ticket', async () => {
      odooRpc.callKw
        .mockResolvedValueOnce([{ id: 77 }]) // helpdesk.stage search_read → "En Curso"
        .mockResolvedValueOnce(true);         // helpdesk.ticket write

      await service.markTicketInProgress(42);

      const calls = odooRpc.callKw.mock.calls;
      expect(calls[0]).toEqual([
        'helpdesk.stage',
        'search_read',
        [[['team_ids', 'in', [5]], ['name', '=', 'En Curso']]],
        { fields: ['id'], limit: 1 },
      ]);
      expect(calls[1]).toEqual([
        'helpdesk.ticket',
        'write',
        [[42], { stage_id: 77 }],
        {},
      ]);
    });

    it('reutiliza el stage cacheado en llamadas subsiguientes sin volver a consultar Odoo', async () => {
      odooRpc.callKw
        .mockResolvedValueOnce([{ id: 77 }]) // primera llamada: resuelve stage
        .mockResolvedValue(true);             // subsiguientes: write

      await service.markTicketInProgress(42);
      await service.markTicketInProgress(43);

      const stageCalls = odooRpc.callKw.mock.calls.filter(
        (args: unknown[]) => args[0] === 'helpdesk.stage',
      );
      expect(stageCalls).toHaveLength(1);
    });

    it('lanza ServiceUnavailableException cuando Odoo no devuelve ningún stage "En Curso"', async () => {
      odooRpc.callKw.mockResolvedValueOnce([]);

      await expect(service.markTicketInProgress(42)).rejects.toThrow(ServiceUnavailableException);
    });

    it('propaga ServiceUnavailableException cuando Odoo falla al ejecutar write', async () => {
      odooRpc.callKw
        .mockResolvedValueOnce([{ id: 77 }])
        .mockRejectedValueOnce(new ServiceUnavailableException('Odoo caído'));

      await expect(service.markTicketInProgress(42)).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('resolveSaleLineId', () => {
    it('busca sale.order.line por partner_id y producto Hora Única, cachea y retorna', async () => {
      clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: 101, odooSaleLineId: null }));
      odooRpc.callKw.mockResolvedValue([{ id: 55 }]);

      const result = await service.resolveSaleLineId('client-uuid-1');

      expect(odooRpc.callKw).toHaveBeenCalledWith(
        'sale.order.line',
        'search_read',
        [[
          ['order_id.partner_id', '=', 101],
          ['product_id.name', '=', 'Hora Única'],
          ['order_id.state', 'in', ['sale', 'done']],
        ]],
        expect.objectContaining({ fields: ['id'], limit: 1 }),
      );
      expect(clientRepo.update).toHaveBeenCalledWith(
        'client-uuid-1',
        expect.objectContaining({ odooSaleLineId: 55, odooSyncedAt: expect.any(Date) }),
      );
      expect(result).toBe(55);
    });

    it('retorna odooSaleLineId cacheado sin consultar Odoo', async () => {
      clientRepo.findOne.mockResolvedValue(makeClient({ odooPartnerId: 101, odooSaleLineId: 55 }));

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
});
