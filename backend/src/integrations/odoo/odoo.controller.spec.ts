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
  };

  const mockSyncResult: OdooSyncResult = { matched: 10, unmatched: ['Sin CUIT'], total: 11 };
  const mockStatus: OdooSyncStatusDto = { clientsWithoutOdooId: 3, techniciansWithoutOdooId: 1 };

  beforeEach(async () => {
    odooService = {
      syncPartners: jest.fn().mockResolvedValue(mockSyncResult),
      syncUsers: jest.fn().mockResolvedValue(mockSyncResult),
      getSyncStatus: jest.fn().mockResolvedValue(mockStatus),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OdooController],
      providers: [
        { provide: OdooService, useValue: odooService },
        Reflector,
      ],
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

    it('POST /sync/partners requiere rol ADMIN', () => {
      const roles = Reflect.getMetadata('roles', controller.syncPartners);
      expect(roles).toContain('ADMIN');
    });

    it('POST /sync/users requiere rol ADMIN', () => {
      const roles = Reflect.getMetadata('roles', controller.syncUsers);
      expect(roles).toContain('ADMIN');
    });

    it('GET /sync/status requiere rol ADMIN', () => {
      const roles = Reflect.getMetadata('roles', controller.getSyncStatus);
      expect(roles).toContain('ADMIN');
    });
  });
});
