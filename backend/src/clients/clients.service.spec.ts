import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Client } from './client.entity';
import { ClientsService } from './clients.service';
import { InfradocClient, InfradocLocation, InfradocService } from './infradoc/infradoc.service';

describe('ClientsService', () => {
  let service: ClientsService;
  let clientRepository: {
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let infradocService: { getClients: jest.Mock; getLocations: jest.Mock };

  const makeLocal = (override: Partial<Client> = {}): Client => ({
    id: 'uuid-1',
    infradocId: 1,
    name: 'ACME Corp',
    abbreviation: 'ACME',
    type: 'Empresa',
    website: 'acme.com',
    referral: null,
    rate: null,
    currencyCode: null,
    netTerms: null,
    taxIdNumber: null,
    isLead: false,
    primaryAddress: null,
    notes: null,
    isActive: true,
    lastSyncedAt: null,
    createdAt: new Date('2026-01-01'),
    ...override,
  });

  const makeRemote = (override: Partial<InfradocClient> = {}): InfradocClient => ({
    infradocId: 1,
    name: 'ACME Corp',
    abbreviation: 'ACME',
    type: 'Empresa',
    website: 'acme.com',
    referral: null,
    rate: null,
    currencyCode: null,
    netTerms: null,
    taxIdNumber: null,
    isLead: false,
    notes: null,
    isActive: true,
    ...override,
  });

  beforeEach(async () => {
    clientRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ ...data, id: 'new-uuid' })),
      update: jest.fn().mockResolvedValue(undefined),
    };

    infradocService = {
      getClients: jest.fn(),
      getLocations: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: getRepositoryToken(Client), useValue: clientRepository },
        { provide: InfradocService, useValue: infradocService },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
  });

  describe('findAll', () => {
    it('devuelve clientes ordenados por nombre sin campos internos', async () => {
      clientRepository.find.mockResolvedValue([makeLocal()]);

      const result = await service.findAll();

      expect(clientRepository.find).toHaveBeenCalledWith({ order: { name: 'ASC' } });
      expect(result[0]).not.toHaveProperty('infradocId');
      expect(result[0]).not.toHaveProperty('lastSyncedAt');
      expect(result[0].name).toBe('ACME Corp');
    });
  });

  describe('syncWithInfradoc', () => {
    it('crea un cliente nuevo cuando infradocId no existe en DB', async () => {
      infradocService.getClients.mockResolvedValue([makeRemote()]);
      clientRepository.find.mockResolvedValue([]);

      const result = await service.syncWithInfradoc();

      expect(clientRepository.save).toHaveBeenCalledTimes(1);
      expect(result.created).toBe(1);
      expect(result.updated).toBe(0);
      expect(result.unchanged).toBe(0);
      expect(result.archived).toBe(0);
    });

    it('actualiza un cliente cuando algún campo cambió', async () => {
      clientRepository.find.mockResolvedValue([makeLocal({ name: 'Nombre Viejo' })]);
      infradocService.getClients.mockResolvedValue([makeRemote({ name: 'Nombre Nuevo' })]);

      const result = await service.syncWithInfradoc();

      expect(clientRepository.update).toHaveBeenCalledTimes(1);
      expect(result.updated).toBe(1);
      expect(result.created).toBe(0);
      expect(result.unchanged).toBe(0);
    });

    it('no toca la DB cuando el cliente no cambió', async () => {
      clientRepository.find.mockResolvedValue([makeLocal()]);
      infradocService.getClients.mockResolvedValue([makeRemote()]);

      const result = await service.syncWithInfradoc();

      expect(clientRepository.save).not.toHaveBeenCalled();
      expect(clientRepository.update).not.toHaveBeenCalled();
      expect(result.unchanged).toBe(1);
      expect(result.created).toBe(0);
      expect(result.updated).toBe(0);
    });

    it('marca como inactivo un cliente local ausente en InfraDoc', async () => {
      clientRepository.find.mockResolvedValue([makeLocal({ infradocId: 99, isActive: true })]);
      infradocService.getClients.mockResolvedValue([]);

      const result = await service.syncWithInfradoc();

      expect(clientRepository.update).toHaveBeenCalledWith(
        'uuid-1',
        expect.objectContaining({ isActive: false }),
      );
      expect(result.archived).toBe(1);
    });

    it('lanza TooManyRequestsException cuando el cooldown está activo', async () => {
      infradocService.getClients.mockResolvedValue([]);
      clientRepository.find.mockResolvedValue([]);

      await service.syncWithInfradoc();

      await expect(service.syncWithInfradoc()).rejects.toThrow(
        new HttpException(
          'Sync ejecutado recientemente. Intentá de nuevo en unos segundos.',
          HttpStatus.TOO_MANY_REQUESTS,
        ),
      );
    });

    it('omite el cooldown cuando skipCooldown es true', async () => {
      infradocService.getClients.mockResolvedValue([]);
      clientRepository.find.mockResolvedValue([]);

      await service.syncWithInfradoc();

      await expect(service.syncWithInfradoc(true)).resolves.toBeDefined();
    });

    it('guarda primaryAddress cuando existe primary location para el cliente', async () => {
      const location: InfradocLocation = {
        infradocClientId: 1,
        address: 'Av. Corrientes 1234',
        city: 'Buenos Aires',
        isPrimary: true,
      };
      infradocService.getClients.mockResolvedValue([makeRemote()]);
      infradocService.getLocations.mockResolvedValue([location]);
      clientRepository.find.mockResolvedValue([]);

      await service.syncWithInfradoc();

      expect(clientRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ primaryAddress: 'Av. Corrientes 1234, Buenos Aires' }),
      );
    });

    it('guarda primaryAddress null cuando no hay primary location para el cliente', async () => {
      const location: InfradocLocation = {
        infradocClientId: 99, // otro cliente
        address: 'Otra calle',
        city: 'Rosario',
        isPrimary: true,
      };
      infradocService.getClients.mockResolvedValue([makeRemote()]);
      infradocService.getLocations.mockResolvedValue([location]);
      clientRepository.find.mockResolvedValue([]);

      await service.syncWithInfradoc();

      expect(clientRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ primaryAddress: null }),
      );
    });

    it('detecta cambio de primaryAddress y actualiza el cliente', async () => {
      const location: InfradocLocation = {
        infradocClientId: 1,
        address: 'Av. Nueva 999',
        city: 'Córdoba',
        isPrimary: true,
      };
      // Cliente local sin dirección
      clientRepository.find.mockResolvedValue([makeLocal({ primaryAddress: null })]);
      infradocService.getClients.mockResolvedValue([makeRemote()]);
      infradocService.getLocations.mockResolvedValue([location]);

      const result = await service.syncWithInfradoc();

      expect(clientRepository.update).toHaveBeenCalledWith(
        'uuid-1',
        expect.objectContaining({ primaryAddress: 'Av. Nueva 999, Córdoba' }),
      );
      expect(result.updated).toBe(1);
    });
  });

  describe('findInfradocId', () => {
    it('devuelve infradocId para un cliente existente', async () => {
      clientRepository.findOne.mockResolvedValue({ id: 'uuid-1', infradocId: 42 });

      const result = await service.findInfradocId('uuid-1');

      expect(result).toBe(42);
      expect(clientRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'uuid-1' },
        select: ['infradocId'],
      });
    });

    it('devuelve null si el cliente no existe', async () => {
      clientRepository.findOne.mockResolvedValue(null);

      const result = await service.findInfradocId('uuid-no-existe');

      expect(result).toBeNull();
    });
  });
});