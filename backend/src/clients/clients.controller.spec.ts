import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ClientsController } from './clients.controller';
import { ClientsService, SyncResult } from './clients.service';

describe('ClientsController', () => {
  let controller: ClientsController;
  let clientsService: {
    findAll: jest.Mock;
    syncWithInfradoc: jest.Mock;
  };

  beforeEach(async () => {
    clientsService = {
      findAll: jest.fn(),
      syncWithInfradoc: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClientsController],
      providers: [{ provide: ClientsService, useValue: clientsService }],
    }).compile();

    controller = module.get<ClientsController>(ClientsController);
  });

  describe('findAll', () => {
    it('llama a clientsService.findAll y devuelve la lista', async () => {
      const mockList = [{ id: 'uuid-1', name: 'ACME Corp' }];
      clientsService.findAll.mockResolvedValue(mockList);

      const result = await controller.findAll();

      expect(clientsService.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockList);
    });
  });

  describe('sync', () => {
    it('llama a clientsService.syncWithInfradoc y devuelve el resultado', async () => {
      const syncResult: SyncResult = {
        created: 2,
        updated: 1,
        archived: 0,
        unchanged: 32,
        syncedAt: new Date('2026-05-25T14:00:00Z'),
      };
      clientsService.syncWithInfradoc.mockResolvedValue(syncResult);

      const result = await controller.sync();

      expect(clientsService.syncWithInfradoc).toHaveBeenCalled();
      expect(result).toEqual(syncResult);
    });

    it('propaga TooManyRequestsException cuando el cooldown está activo', async () => {
      clientsService.syncWithInfradoc.mockRejectedValue(
        new HttpException(
          'Sync ejecutado recientemente. Intentá de nuevo en unos segundos.',
          HttpStatus.TOO_MANY_REQUESTS,
        ),
      );

      await expect(controller.sync()).rejects.toThrow(HttpException);
    });
  });
});