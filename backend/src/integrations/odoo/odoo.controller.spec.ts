import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { OdooController } from './odoo.controller';
import { OdooService } from './odoo.service';
import { OdooSyncResult } from './dto/odoo-sync-result.dto';
import { OdooSyncStatusDto } from './dto/odoo-sync-status.dto';

describe('OdooController', () => {
  let controller: OdooController;
  let odooService: {
    syncPartners: jest.Mock;
    syncUsers: jest.Mock;
    getSyncStatus: jest.Mock;
    getHelpdeskTeams: jest.Mock;
    getHelpdeskTags: jest.Mock;
  };

  const mockSyncResult: OdooSyncResult = {
    matched: 10,
    unmatched: ['Sin CUIT'],
    total: 11,
  };
  const mockStatus: OdooSyncStatusDto = {
    clientsWithoutOdooId: 3,
    techniciansWithoutOdooId: 1,
  };

  beforeEach(async () => {
    odooService = {
      syncPartners: jest.fn().mockResolvedValue(mockSyncResult),
      syncUsers: jest.fn().mockResolvedValue(mockSyncResult),
      getSyncStatus: jest.fn().mockResolvedValue(mockStatus),
      getHelpdeskTeams: jest.fn().mockResolvedValue([{ id: 7, name: 'Mantenimientos' }]),
      getHelpdeskTags: jest.fn().mockResolvedValue([{ id: 3, name: 'Urgente' }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OdooController],
      providers: [{ provide: OdooService, useValue: odooService }, Reflector],
    }).compile();

    controller = module.get<OdooController>(OdooController);
  });

  describe('syncPartners', () => {
    it('llama a odooService.syncPartners y devuelve el resultado', async () => {
      const result = await controller.syncPartners();

      expect(odooService.syncPartners).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockSyncResult);
    });
  });

  describe('syncUsers', () => {
    it('llama a odooService.syncUsers y devuelve el resultado', async () => {
      const result = await controller.syncUsers();

      expect(odooService.syncUsers).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockSyncResult);
    });
  });

  describe('getSyncStatus', () => {
    it('llama a odooService.getSyncStatus y devuelve conteos', async () => {
      const result = await controller.getSyncStatus();

      expect(odooService.getSyncStatus).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockStatus);
    });
  });

  describe('guards', () => {
    it('tiene @UseGuards aplicado a nivel de clase', () => {
      const guards = Reflect.getMetadata('__guards__', OdooController);
      expect(guards).toBeDefined();
      expect(guards.length).toBeGreaterThan(0);
    });

    it('requiere rol ADMIN a nivel de clase — cubre todos los endpoints', () => {
      const roles = Reflect.getMetadata('roles', OdooController);
      expect(roles).toContain('ADMIN');
    });
  });

  describe('getHelpdeskTeams', () => {
    it('delega en odooService.getHelpdeskTeams y retorna los equipos', async () => {
      const result = await controller.getHelpdeskTeams();
      expect(odooService.getHelpdeskTeams).toHaveBeenCalledTimes(1);
      expect(result).toEqual([{ id: 7, name: 'Mantenimientos' }]);
    });
  });

  describe('getHelpdeskTags', () => {
    it('delega en odooService.getHelpdeskTags y retorna los tags', async () => {
      const result = await controller.getHelpdeskTags();
      expect(odooService.getHelpdeskTags).toHaveBeenCalledTimes(1);
      expect(result).toEqual([{ id: 3, name: 'Urgente' }]);
    });
  });
});
