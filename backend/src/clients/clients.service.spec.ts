import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Client } from './client.entity';
import { ClientsService } from './clients.service';
import { InfradocClient, InfradocService } from './infradoc/infradoc.service';

describe('ClientsService', () => {
  let service: ClientsService;
  let clientRepository: {
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let infradocService: { getClients: jest.Mock };

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
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ ...data, id: 'new-uuid' })),
      update: jest.fn().mockResolvedValue(undefined),
    };

    infradocService = { getClients: jest.fn() };

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
  });
});