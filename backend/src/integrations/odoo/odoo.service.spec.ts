import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
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
  let userRepo: { find: jest.Mock; findOne: jest.Mock };
  let technicianRepo: { update: jest.Mock; findOne: jest.Mock; count: jest.Mock };

  const makeClient = (override: Partial<Client> = {}): Client =>
    ({
      id: 'client-uuid-1',
      infradocId: 1,
      name: 'ACME Corp',
      taxIdNumber: '20-12345678-0',
      odooPartnerId: null,
      odooSyncedAt: null,
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
      ...override,
    }) as User;

  const makeOdooUser = (override: Partial<OdooUser> = {}): OdooUser => ({
    id: 201,
    login: 'tecnico@ondra.com',
    name: 'Técnico Demo',
    ...override,
  });

  beforeEach(async () => {
    odooRpc = { callKw: jest.fn() };
    clientRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      count: jest.fn(),
    };
    userRepo = { find: jest.fn(), findOne: jest.fn() };
    technicianRepo = {
      update: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
      count: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OdooService,
        { provide: OdooRpcService, useValue: odooRpc },
        { provide: getRepositoryToken(Client), useValue: clientRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
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
    it('actualiza odooUserId del técnico cuando email coincide', async () => {
      userRepo.find.mockResolvedValue([makeUser()]);
      odooRpc.callKw.mockResolvedValue([makeOdooUser()]);

      const result = await service.syncUsers();

      expect(technicianRepo.update).toHaveBeenCalledWith(
        'tech-uuid-1',
        expect.objectContaining({ odooUserId: 201, odooSyncedAt: expect.any(Date) }),
      );
      expect(result.matched).toBe(1);
      expect(result.unmatched).toEqual([]);
      expect(result.total).toBe(1);
    });

    it('registra en unmatched el login del usuario de Odoo que no matchea ningún técnico', async () => {
      userRepo.find.mockResolvedValue([]);
      odooRpc.callKw.mockResolvedValue([makeOdooUser()]);

      const result = await service.syncUsers();

      expect(technicianRepo.update).not.toHaveBeenCalled();
      expect(result.matched).toBe(0);
      expect(result.unmatched).toEqual(['tecnico@ondra.com']);
      expect(result.total).toBe(1);
    });

    it('consulta solo usuarios con technicianId para construir el mapa de email', async () => {
      userRepo.find.mockResolvedValue([makeUser()]);
      odooRpc.callKw.mockResolvedValue([]);

      await service.syncUsers();

      expect(userRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ technicianId: expect.anything() }),
        }),
      );
    });

    it('ignora usuarios de Odoo con login false', async () => {
      userRepo.find.mockResolvedValue([makeUser()]);
      odooRpc.callKw.mockResolvedValue([makeOdooUser({ login: false })]);

      const result = await service.syncUsers();

      expect(technicianRepo.update).not.toHaveBeenCalled();
      expect(result.matched).toBe(0);
    });
  });

  describe('getSyncStatus', () => {
    it('devuelve conteo de clientes y técnicos sin odoo id', async () => {
      clientRepo.count.mockResolvedValue(5);
      technicianRepo.count.mockResolvedValue(2);

      const result = await service.getSyncStatus();

      expect(result).toEqual({ clientsWithoutOdooId: 5, techniciansWithoutOdooId: 2 });
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
      technicianRepo.findOne.mockResolvedValue({ id: 'tech-uuid-1', odooUserId: 201, odooSyncedAt: new Date() });

      const result = await service.resolveUserId('tech-uuid-1');

      expect(result).toBe(201);
      expect(odooRpc.callKw).not.toHaveBeenCalled();
    });

    it('intenta sync puntual por email cuando odooUserId es null y retorna el id encontrado', async () => {
      technicianRepo.findOne.mockResolvedValue({ id: 'tech-uuid-1', odooUserId: null });
      userRepo.findOne = jest.fn().mockResolvedValue(makeUser());
      odooRpc.callKw.mockResolvedValue([{ id: 201, login: 'tecnico@ondra.com' }]);

      const result = await service.resolveUserId('tech-uuid-1');

      expect(result).toBe(201);
      expect(technicianRepo.update).toHaveBeenCalledWith(
        'tech-uuid-1',
        expect.objectContaining({ odooUserId: 201 }),
      );
    });

    it('devuelve null cuando el técnico no existe', async () => {
      technicianRepo.findOne.mockResolvedValue(null);

      const result = await service.resolveUserId('uuid-no-existe');

      expect(result).toBeNull();
    });

    it('devuelve null cuando Odoo no encuentra usuario por email', async () => {
      technicianRepo.findOne.mockResolvedValue({ id: 'tech-uuid-1', odooUserId: null });
      userRepo.findOne = jest.fn().mockResolvedValue(makeUser());
      odooRpc.callKw.mockResolvedValue([]);

      const result = await service.resolveUserId('tech-uuid-1');

      expect(result).toBeNull();
      expect(technicianRepo.update).not.toHaveBeenCalled();
    });
  });
});
