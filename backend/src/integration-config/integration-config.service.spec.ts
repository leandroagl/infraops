import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { BadRequestException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { IntegrationConfigService } from './integration-config.service';
import { OdooConfig } from './entities/odoo-config.entity';
import { InfraDocConfig } from './entities/infradoc-config.entity';
import { VmwareConfig } from './entities/vmware-config.entity';
import { VeeamConfig } from './entities/veeam-config.entity';
import { JetbackupConfig } from './entities/jetbackup-config.entity';
import { AcronisConfig } from './entities/acronis-config.entity';
import { UnifiConfig } from './entities/unifi-config.entity';
import { UnifiLocalConfig } from './entities/unifi-local-config.entity';
import { MASK, decrypt, encrypt } from './crypto.util';

const KEY = '8b2202fa0aa8498ca124415c67472e7b479e1eb31a24d948eedeccecc2a5a5c2';

describe('IntegrationConfigService', () => {
  let service: IntegrationConfigService;
  let odooRepo: { findOne: jest.Mock; save: jest.Mock };
  let infradocRepo: { findOne: jest.Mock; save: jest.Mock };
  let vmwareRepo: { findOne: jest.Mock; save: jest.Mock };
  let veeamRepo: { findOne: jest.Mock; save: jest.Mock };
  let jetbackupRepo: { findOne: jest.Mock; save: jest.Mock };
  let acronisRepo: { findOne: jest.Mock; save: jest.Mock };
  let unifiRepo: { findOne: jest.Mock; save: jest.Mock };
  let unifiLocalRepo: { findOne: jest.Mock; save: jest.Mock };
  let httpGet: jest.Mock;
  let httpPost: jest.Mock;

  beforeEach(async () => {
    odooRepo      = { findOne: jest.fn(), save: jest.fn() };
    infradocRepo  = { findOne: jest.fn(), save: jest.fn() };
    vmwareRepo    = { findOne: jest.fn(), save: jest.fn() };
    veeamRepo     = { findOne: jest.fn(), save: jest.fn() };
    jetbackupRepo = { findOne: jest.fn(), save: jest.fn() };
    acronisRepo   = { findOne: jest.fn(), save: jest.fn() };
    unifiRepo     = { findOne: jest.fn(), save: jest.fn() };
    unifiLocalRepo = { findOne: jest.fn(), save: jest.fn() };
    httpGet      = jest.fn();
    httpPost      = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationConfigService,
        { provide: getRepositoryToken(OdooConfig),      useValue: odooRepo      },
        { provide: getRepositoryToken(InfraDocConfig),  useValue: infradocRepo  },
        { provide: getRepositoryToken(VmwareConfig),    useValue: vmwareRepo    },
        { provide: getRepositoryToken(VeeamConfig),     useValue: veeamRepo     },
        { provide: getRepositoryToken(JetbackupConfig), useValue: jetbackupRepo }, { provide: getRepositoryToken(AcronisConfig), useValue: acronisRepo },
        { provide: getRepositoryToken(UnifiConfig),      useValue: unifiRepo      },
        { provide: getRepositoryToken(UnifiLocalConfig), useValue: unifiLocalRepo },
        { provide: ConfigService, useValue: {
            get: (key: string, def = '') =>
              ({
                INTEGRATIONS_ENCRYPT_KEY: KEY,
                ODOO_API_KEY:    'env-odoo-key',
                ODOO_EXPIRATIONS_HELPDESK_TEAM_ID: '12',
                INFRADOC_API_KEY: 'env-infradoc-key',
                VMWARE_PASS:     'env-vmware-pass',
                VEEAM_USER:      'env-veeam-user',
              } as Record<string, string>)[key] ?? def,
          },
        },
        { provide: HttpService, useValue: { get: httpGet, post: httpPost } },
      ],
    }).compile();

    service = module.get<IntegrationConfigService>(IntegrationConfigService);
  });

  describe('getOdoo', () => {
    it('devuelve fallback del .env cuando no hay fila en DB', async () => {
      odooRepo.findOne.mockResolvedValue(null);
      const result = await service.getOdoo();
      expect(result.apiKey).toBe(MASK);
      expect(result.updatedAt).toBeNull();
    });

    it('devuelve expirationsHelpdeskTeamId desde la fila', async () => {
      odooRepo.findOne.mockResolvedValue({
        url: 'https://odoo.test', db: 'testdb', username: 'u', apiKey: 'enc',
        helpdeskTeamId: 7, expirationsHelpdeskTeamId: 9,
        updatedAt: new Date(), updatedBy: 'admin',
      });
      const result = await service.getOdoo();
      expect(result.expirationsHelpdeskTeamId).toBe(9);
    });

    it('cae al env ODOO_EXPIRATIONS_HELPDESK_TEAM_ID cuando no hay fila en DB', async () => {
      odooRepo.findOne.mockResolvedValue(null);
      const result = await service.getOdoo();
      expect(result.expirationsHelpdeskTeamId).toBe(12);
    });

    it('devuelve config de DB con apiKey enmascarada', async () => {
      odooRepo.findOne.mockResolvedValue({
        url: 'https://odoo.test', db: 'testdb', username: 'bot@test.com',
        apiKey: 'encrypted-value', helpdeskTeamId: 7,
        updatedAt: new Date('2026-09-01'), updatedBy: 'admin@ondra.com.ar',
      });
      const result = await service.getOdoo();
      expect(result.url).toBe('https://odoo.test');
      expect(result.apiKey).toBe(MASK);
      expect(result.updatedBy).toBe('admin@ondra.com.ar');
    });

    it('devuelve nombres de stage configurados desde DB', async () => {
      odooRepo.findOne.mockResolvedValue({
        url: 'https://odoo.test', db: 'testdb', username: 'u', apiKey: 'enc', helpdeskTeamId: 7,
        stageInProgressName: 'En curso', stageNotDoneName: 'No realizadas', stageDoneName: 'Hecho',
        updatedAt: new Date(), updatedBy: 'admin',
      });
      const result = await service.getOdoo();
      expect(result.stageInProgressName).toBe('En curso');
      expect(result.stageNotDoneName).toBe('No realizadas');
      expect(result.stageDoneName).toBe('Hecho');
    });

    it('devuelve strings vacíos para stage names cuando no están configurados', async () => {
      odooRepo.findOne.mockResolvedValue({
        url: 'https://odoo.test', db: 'testdb', username: 'u', apiKey: 'enc', helpdeskTeamId: 7,
        stageInProgressName: null, stageNotDoneName: null, stageDoneName: null,
        updatedAt: new Date(), updatedBy: 'admin',
      });
      const result = await service.getOdoo();
      expect(result.stageInProgressName).toBe('');
      expect(result.stageNotDoneName).toBe('');
      expect(result.stageDoneName).toBe('');
    });

    it('devuelve expirationsTicketDaysAhead desde la fila', async () => {
      odooRepo.findOne.mockResolvedValue({
        id: 1, url: 'u', db: 'd', username: 'u', apiKey: null,
        helpdeskTeamId: 7, expirationsHelpdeskTeamId: 9,
        expirationsTicketDaysAhead: 14, expirationsTagIds: [3, 5],
        stageInProgressName: 'En curso', stageNotDoneName: 'No realizadas', stageDoneName: 'Hecho',
        updatedAt: new Date(), updatedBy: null,
      });
      const result = await service.getOdoo();
      expect(result.expirationsTicketDaysAhead).toBe(14);
      expect(result.expirationsTagIds).toEqual([3, 5]);
    });

    it('devuelve defaults cuando los nuevos campos son null en la fila', async () => {
      odooRepo.findOne.mockResolvedValue({
        id: 1, url: 'u', db: 'd', username: 'u', apiKey: null,
        helpdeskTeamId: 7, expirationsHelpdeskTeamId: 9,
        expirationsTicketDaysAhead: null, expirationsTagIds: null,
        stageInProgressName: '', stageNotDoneName: '', stageDoneName: '',
        updatedAt: null, updatedBy: null,
      });
      const result = await service.getOdoo();
      expect(result.expirationsTicketDaysAhead).toBe(30);
      expect(result.expirationsTagIds).toEqual([]);
    });

    it('retorna expirationsTypeConfigs desde la fila cuando está configurado', async () => {
      const typeConfigs = {
        domain: { enabled: true, helpdeskTeamId: 9, daysAhead: 14, tagIds: [3] },
      };
      odooRepo.findOne.mockResolvedValue({
        id: 1, url: 'u', db: 'd', username: 'u', apiKey: null,
        helpdeskTeamId: 7, expirationsHelpdeskTeamId: 9,
        expirationsTicketDaysAhead: 30, expirationsTagIds: [],
        expirationsTypeConfigs: typeConfigs,
        stageInProgressName: '', stageNotDoneName: '', stageDoneName: '',
        updatedAt: null, updatedBy: null,
      });
      const result = await service.getOdoo();
      expect(result.expirationsTypeConfigs).toEqual(typeConfigs);
    });

    it('incluye taskName/defaultTimeMinutes/descripciones en expirationsTypeConfigs cuando están configurados', async () => {
      const typeConfigs = {
        domain: {
          enabled: true, helpdeskTeamId: 9, daysAhead: 14, tagIds: [3],
          taskName: 'Dominio', defaultTimeMinutes: 20,
          ticketDescription: 'Verificar renovación', timesheetDescription: 'Renovación de dominio',
        },
      };
      odooRepo.findOne.mockResolvedValue({
        id: 1, url: 'u', db: 'd', username: 'u', apiKey: null,
        helpdeskTeamId: 7, expirationsHelpdeskTeamId: 9,
        expirationsTicketDaysAhead: 30, expirationsTagIds: [],
        expirationsTypeConfigs: typeConfigs,
        stageInProgressName: '', stageNotDoneName: '', stageDoneName: '',
        updatedAt: null, updatedBy: null,
      });
      const result = await service.getOdoo();
      expect(result.expirationsTypeConfigs).toEqual(typeConfigs);
    });

    it('retorna null para expirationsTypeConfigs cuando la fila no tiene datos', async () => {
      odooRepo.findOne.mockResolvedValue({
        id: 1, url: 'u', db: 'd', username: 'u', apiKey: null,
        helpdeskTeamId: 7, expirationsHelpdeskTeamId: 9,
        expirationsTicketDaysAhead: 30, expirationsTagIds: [],
        expirationsTypeConfigs: null,
        stageInProgressName: '', stageNotDoneName: '', stageDoneName: '',
        updatedAt: null, updatedBy: null,
      });
      const result = await service.getOdoo();
      expect(result.expirationsTypeConfigs).toBeNull();
    });

    it('retorna null para expirationsTypeConfigs cuando no hay fila en DB', async () => {
      odooRepo.findOne.mockResolvedValue(null);
      const result = await service.getOdoo();
      expect(result.expirationsTypeConfigs).toBeNull();
    });
  });

  describe('patchOdoo', () => {
    it('no modifica apiKey cuando viene masked', async () => {
      const existing = { id: 1, url: 'https://old.com', db: 'db', username: 'u',
        apiKey: 'enc', helpdeskTeamId: 7, updatedAt: new Date(), updatedBy: 'x' };
      odooRepo.findOne.mockResolvedValue(existing);
      odooRepo.save.mockImplementation(async (e: OdooConfig) => e);

      await service.patchOdoo({ url: 'https://new.com', apiKey: MASK }, 'admin@test.com');

      const saved = odooRepo.save.mock.calls[0][0];
      expect(saved.apiKey).toBe('enc');
      expect(saved.url).toBe('https://new.com');
    });

    it('encripta nueva apiKey cuando no viene masked', async () => {
      odooRepo.findOne.mockResolvedValue(null);
      odooRepo.save.mockImplementation(async (e: OdooConfig) => e);

      await service.patchOdoo({ apiKey: 'nueva-api-key' }, 'admin@test.com');

      const saved = odooRepo.save.mock.calls[0][0];
      expect(saved.apiKey).not.toBe('nueva-api-key');
      expect(saved.apiKey).toContain(':'); // formato iv:authTag:ciphertext
    });

    it('guarda stage names cuando se proveen en el DTO', async () => {
      odooRepo.findOne.mockResolvedValue(null);
      odooRepo.save.mockImplementation(async (e: OdooConfig) => e);

      await service.patchOdoo(
        { stageInProgressName: 'En curso', stageNotDoneName: 'Sin hacer', stageDoneName: 'Hecho' },
        'admin@test.com',
      );

      const saved = odooRepo.save.mock.calls[0][0];
      expect(saved.stageInProgressName).toBe('En curso');
      expect(saved.stageNotDoneName).toBe('Sin hacer');
      expect(saved.stageDoneName).toBe('Hecho');
    });

    it('persiste expirationsHelpdeskTeamId cuando se provee en el DTO', async () => {
      odooRepo.findOne.mockResolvedValue(null);
      odooRepo.save.mockImplementation(async (e: OdooConfig) => e);

      await service.patchOdoo({ expirationsHelpdeskTeamId: 9 }, 'admin@test.com');

      const saved = odooRepo.save.mock.calls[0][0];
      expect(saved.expirationsHelpdeskTeamId).toBe(9);
    });

    it('no pisa expirationsHelpdeskTeamId existente cuando el DTO no lo incluye', async () => {
      odooRepo.findOne.mockResolvedValue({
        id: 1, url: 'https://old.com', db: 'db', username: 'u',
        apiKey: 'enc', helpdeskTeamId: 7, expirationsHelpdeskTeamId: 9,
        updatedAt: new Date(), updatedBy: 'x',
      });
      odooRepo.save.mockImplementation(async (e: OdooConfig) => e);

      await service.patchOdoo({ url: 'https://new.com' }, 'admin@test.com');

      const saved = odooRepo.save.mock.calls[0][0];
      expect(saved.expirationsHelpdeskTeamId).toBe(9);
    });

    it('actualiza expirationsTicketDaysAhead y expirationsTagIds', async () => {
      odooRepo.findOne.mockResolvedValue(null);
      odooRepo.save.mockImplementation(async (e) => e);
      await service.patchOdoo({ expirationsTicketDaysAhead: 14, expirationsTagIds: [3, 5] }, 'admin');
      expect(odooRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ expirationsTicketDaysAhead: 14, expirationsTagIds: [3, 5] }),
      );
    });

    it('incrementa versión de config al guardar', async () => {
      odooRepo.findOne.mockResolvedValue(null);
      odooRepo.save.mockImplementation(async (e: OdooConfig) => e);
      const vBefore = service.getOdooVersion();
      await service.patchOdoo({ url: 'https://x.com' }, 'admin@test.com');
      expect(service.getOdooVersion()).toBe(vBefore + 1);
    });

    it('persiste expirationsTypeConfigs cuando se provee en el DTO', async () => {
      odooRepo.findOne.mockResolvedValue(null);
      odooRepo.save.mockImplementation(async (e: OdooConfig) => e);
      const configs = {
        domain:   { enabled: true,  helpdeskTeamId: 9, daysAhead: 14, tagIds: [3] },
        software: { enabled: false, helpdeskTeamId: null, daysAhead: 30, tagIds: [] },
      };
      await service.patchOdoo({ expirationsTypeConfigs: configs }, 'admin@test.com');
      const saved = odooRepo.save.mock.calls[0][0];
      expect(saved.expirationsTypeConfigs).toEqual(configs);
    });

    it('persiste taskName/defaultTimeMinutes/descripciones cuando se proveen en una entrada', async () => {
      odooRepo.findOne.mockResolvedValue(null);
      odooRepo.save.mockImplementation(async (e: OdooConfig) => e);
      const configs = {
        domain: {
          enabled: true, helpdeskTeamId: 9, daysAhead: 14, tagIds: [3],
          taskName: 'Dominio', defaultTimeMinutes: 20,
          ticketDescription: 'Verificar renovación', timesheetDescription: 'Renovación de dominio',
        },
      };
      await service.patchOdoo({ expirationsTypeConfigs: configs }, 'admin@test.com');
      const saved = odooRepo.save.mock.calls[0][0];
      expect(saved.expirationsTypeConfigs).toEqual(configs);
    });

    it('lanza BadRequestException si defaultTimeMinutes no es null ni un entero >= 1', async () => {
      odooRepo.findOne.mockResolvedValue(null);
      await expect(service.patchOdoo(
        { expirationsTypeConfigs: { domain: { enabled: true, helpdeskTeamId: null, daysAhead: 30, tagIds: [], defaultTimeMinutes: 0 } } },
        'admin@test.com',
      )).rejects.toThrow(BadRequestException);
      expect(odooRepo.save).not.toHaveBeenCalled();
    });

    it('acepta defaultTimeMinutes null en una entrada de expirationsTypeConfigs', async () => {
      odooRepo.findOne.mockResolvedValue(null);
      odooRepo.save.mockImplementation(async (e: OdooConfig) => e);
      await service.patchOdoo(
        { expirationsTypeConfigs: { domain: { enabled: true, helpdeskTeamId: null, daysAhead: 30, tagIds: [], defaultTimeMinutes: null } } },
        'admin@test.com',
      );
      expect(odooRepo.save).toHaveBeenCalled();
    });

    it('no pisa expirationsTypeConfigs existente cuando el DTO no lo incluye', async () => {
      const existing = {
        id: 1, url: 'u', db: 'd', username: 'u', apiKey: 'enc',
        helpdeskTeamId: 7, expirationsHelpdeskTeamId: 9,
        expirationsTicketDaysAhead: 30, expirationsTagIds: [],
        expirationsTypeConfigs: { domain: { enabled: true, helpdeskTeamId: 9, daysAhead: 14, tagIds: [] } },
        stageInProgressName: '', stageNotDoneName: '', stageDoneName: '',
        updatedAt: new Date(), updatedBy: 'x',
      };
      odooRepo.findOne.mockResolvedValue(existing);
      odooRepo.save.mockImplementation(async (e: OdooConfig) => e);
      await service.patchOdoo({ url: 'https://new.com' }, 'admin@test.com');
      const saved = odooRepo.save.mock.calls[0][0];
      expect(saved.expirationsTypeConfigs).toEqual(existing.expirationsTypeConfigs);
    });

    it('lanza BadRequestException si una entrada de expirationsTypeConfigs tiene enabled no booleano', async () => {
      odooRepo.findOne.mockResolvedValue(null);
      await expect(service.patchOdoo(
        { expirationsTypeConfigs: { domain: { enabled: 'si' as unknown as boolean, helpdeskTeamId: null, daysAhead: 30, tagIds: [] } } },
        'admin@test.com',
      )).rejects.toThrow(BadRequestException);
      expect(odooRepo.save).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException si daysAhead no es un entero >= 1', async () => {
      odooRepo.findOne.mockResolvedValue(null);
      await expect(service.patchOdoo(
        { expirationsTypeConfigs: { domain: { enabled: true, helpdeskTeamId: null, daysAhead: 0, tagIds: [] } } },
        'admin@test.com',
      )).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si helpdeskTeamId no es null ni un entero >= 1', async () => {
      odooRepo.findOne.mockResolvedValue(null);
      await expect(service.patchOdoo(
        { expirationsTypeConfigs: { domain: { enabled: true, helpdeskTeamId: 0, daysAhead: 30, tagIds: [] } } },
        'admin@test.com',
      )).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si tagIds no es un array de enteros', async () => {
      odooRepo.findOne.mockResolvedValue(null);
      await expect(service.patchOdoo(
        { expirationsTypeConfigs: { domain: { enabled: true, helpdeskTeamId: null, daysAhead: 30, tagIds: ['x'] as unknown as number[] } } },
        'admin@test.com',
      )).rejects.toThrow(BadRequestException);
    });

    it('acepta helpdeskTeamId null en una entrada de expirationsTypeConfigs', async () => {
      odooRepo.findOne.mockResolvedValue(null);
      odooRepo.save.mockImplementation(async (e: OdooConfig) => e);
      await service.patchOdoo(
        { expirationsTypeConfigs: { domain: { enabled: true, helpdeskTeamId: null, daysAhead: 30, tagIds: [] } } },
        'admin@test.com',
      );
      expect(odooRepo.save).toHaveBeenCalled();
    });

    it('siembra apiKey desde .env al crear primera fila con masked apiKey', async () => {
      odooRepo.findOne.mockResolvedValue(null);
      odooRepo.save.mockImplementation(async (e: OdooConfig) => e);

      await service.patchOdoo({ url: 'https://odoo.test', apiKey: MASK }, 'admin@test.com');

      const saved = odooRepo.save.mock.calls[0][0];
      expect(saved.apiKey).toBeTruthy();
      expect(saved.apiKey).not.toBe(MASK);
      expect(decrypt(saved.apiKey, KEY)).toBe('env-odoo-key');
    });

    it('recorta espacios en blanco de url, db, username y apiKey antes de guardar', async () => {
      odooRepo.findOne.mockResolvedValue(null);
      odooRepo.save.mockImplementation(async (e: OdooConfig) => e);

      await service.patchOdoo(
        { url: '  https://odoo.test  ', db: '  midb  ', username: '  bot@test.com \n', apiKey: '  clave-con-espacios \n' },
        'admin@test.com',
      );

      const saved = odooRepo.save.mock.calls[0][0];
      expect(saved.url).toBe('https://odoo.test');
      expect(saved.db).toBe('midb');
      expect(saved.username).toBe('bot@test.com');
      expect(decrypt(saved.apiKey, KEY)).toBe('clave-con-espacios');
    });
  });

  describe('getOdooConfigDecrypted', () => {
    it('incluye stage names en el resultado', async () => {
      odooRepo.findOne.mockResolvedValue({
        url: 'https://odoo.test', db: 'testdb', username: 'u',
        apiKey: null, helpdeskTeamId: 7,
        stageInProgressName: 'En curso', stageNotDoneName: 'No realizadas', stageDoneName: 'Hecho',
        updatedAt: new Date(), updatedBy: 'admin',
      });
      const cfg = await service.getOdooConfigDecrypted();
      expect(cfg.stageInProgressName).toBe('En curso');
      expect(cfg.stageNotDoneName).toBe('No realizadas');
      expect(cfg.stageDoneName).toBe('Hecho');
    });

    it('usa defaults cuando stage names son null en DB', async () => {
      odooRepo.findOne.mockResolvedValue({
        url: 'u', db: 'd', username: 'u', apiKey: null, helpdeskTeamId: 7,
        stageInProgressName: null, stageNotDoneName: null, stageDoneName: null,
        updatedAt: new Date(), updatedBy: 'admin',
      });
      const cfg = await service.getOdooConfigDecrypted();
      expect(cfg.stageInProgressName).toBe('En curso');
      expect(cfg.stageNotDoneName).toBe('No realizadas');
      expect(cfg.stageDoneName).toBe('Hecho');
    });

    it('incluye expirationsHelpdeskTeamId en el resultado', async () => {
      odooRepo.findOne.mockResolvedValue({
        url: 'https://odoo.test', db: 'testdb', username: 'u',
        apiKey: null, helpdeskTeamId: 7, expirationsHelpdeskTeamId: 9,
        updatedAt: new Date(), updatedBy: 'admin',
      });
      const cfg = await service.getOdooConfigDecrypted();
      expect(cfg.expirationsHelpdeskTeamId).toBe(9);
    });

    it('retorna expirationsTicketDaysAhead y expirationsTagIds', async () => {
      odooRepo.findOne.mockResolvedValue({
        id: 1, url: 'u', db: 'd', username: 'u', apiKey: null,
        helpdeskTeamId: 7, expirationsHelpdeskTeamId: 9,
        expirationsTicketDaysAhead: 20, expirationsTagIds: [1, 2],
        stageInProgressName: 'En curso', stageNotDoneName: 'No realizadas', stageDoneName: 'Hecho',
        updatedAt: null, updatedBy: null,
      });
      const result = await service.getOdooConfigDecrypted();
      expect(result.expirationsTicketDaysAhead).toBe(20);
      expect(result.expirationsTagIds).toEqual([1, 2]);
    });
  });

  describe('patchInfraDoc', () => {
    it('siembra apiKey desde .env al crear primera fila con masked apiKey', async () => {
      infradocRepo.findOne.mockResolvedValue(null);
      infradocRepo.save.mockImplementation(async (e: InfraDocConfig) => e);

      await service.patchInfraDoc({ url: 'https://infradoc.test', apiKey: MASK }, 'admin@test.com');

      const saved = infradocRepo.save.mock.calls[0][0];
      expect(saved.apiKey).toBeTruthy();
      expect(saved.apiKey).not.toBe(MASK);
      expect(decrypt(saved.apiKey, KEY)).toBe('env-infradoc-key');
    });

    it('recorta espacios en blanco de url y apiKey antes de guardar', async () => {
      infradocRepo.findOne.mockResolvedValue(null);
      infradocRepo.save.mockImplementation(async (e: InfraDocConfig) => e);

      await service.patchInfraDoc({ url: '  https://infradoc.test  ', apiKey: '  clave-con-espacios \n' }, 'admin@test.com');

      const saved = infradocRepo.save.mock.calls[0][0];
      expect(saved.url).toBe('https://infradoc.test');
      expect(decrypt(saved.apiKey, KEY)).toBe('clave-con-espacios');
    });
  });

  describe('patchVmware', () => {
    it('siembra password desde .env al crear primera fila con masked password', async () => {
      vmwareRepo.findOne.mockResolvedValue(null);
      vmwareRepo.save.mockImplementation(async (e: VmwareConfig) => e);

      await service.patchVmware({ username: 'root', password: MASK }, 'admin@test.com');

      const saved = vmwareRepo.save.mock.calls[0][0];
      expect(saved.password).toBeTruthy();
      expect(saved.password).not.toBe(MASK);
      expect(decrypt(saved.password, KEY)).toBe('env-vmware-pass');
    });

    it('recorta espacios en blanco de username y password antes de guardar', async () => {
      vmwareRepo.findOne.mockResolvedValue(null);
      vmwareRepo.save.mockImplementation(async (e: VmwareConfig) => e);

      await service.patchVmware({ username: '  ondra-read  ', password: '  clave-con-espacios \n' }, 'admin@test.com');

      const saved = vmwareRepo.save.mock.calls[0][0];
      expect(saved.username).toBe('ondra-read');
      expect(decrypt(saved.password, KEY)).toBe('clave-con-espacios');
    });
  });

  describe('errores de clave de encriptación', () => {
    let brokenService: IntegrationConfigService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          IntegrationConfigService,
          { provide: getRepositoryToken(OdooConfig),     useValue: odooRepo     },
          { provide: getRepositoryToken(InfraDocConfig), useValue: infradocRepo },
          { provide: getRepositoryToken(VmwareConfig),   useValue: vmwareRepo   },
          { provide: getRepositoryToken(VeeamConfig),    useValue: veeamRepo    },
          { provide: getRepositoryToken(JetbackupConfig), useValue: jetbackupRepo }, { provide: getRepositoryToken(AcronisConfig), useValue: acronisRepo },
          { provide: getRepositoryToken(UnifiConfig),      useValue: unifiRepo      },
          { provide: getRepositoryToken(UnifiLocalConfig), useValue: unifiLocalRepo },
          { provide: ConfigService, useValue: { get: (_key: string, def = '') => def } }, // INTEGRATIONS_ENCRYPT_KEY vacía
          { provide: HttpService, useValue: { get: httpGet } },
        ],
      }).compile();
      brokenService = module.get<IntegrationConfigService>(IntegrationConfigService);
    });

    it('patchOdoo lanza BadRequestException con mensaje claro cuando la clave falta', async () => {
      odooRepo.findOne.mockResolvedValue(null);
      await expect(brokenService.patchOdoo({ apiKey: 'nueva-api-key' }, 'admin@test.com'))
        .rejects.toThrow(BadRequestException);
      await expect(brokenService.patchOdoo({ apiKey: 'nueva-api-key' }, 'admin@test.com'))
        .rejects.toThrow(/INTEGRATIONS_ENCRYPT_KEY/);
    });

    it('patchInfraDoc lanza BadRequestException con mensaje claro cuando la clave falta', async () => {
      infradocRepo.findOne.mockResolvedValue(null);
      await expect(brokenService.patchInfraDoc({ apiKey: 'nueva-api-key' }, 'admin@test.com'))
        .rejects.toThrow(/INTEGRATIONS_ENCRYPT_KEY/);
    });

    it('patchVmware lanza BadRequestException con mensaje claro cuando la clave falta', async () => {
      vmwareRepo.findOne.mockResolvedValue(null);
      await expect(brokenService.patchVmware({ password: 'nueva-pass' }, 'admin@test.com'))
        .rejects.toThrow(/INTEGRATIONS_ENCRYPT_KEY/);
    });

    it('testOdoo devuelve mensaje claro de config cuando la clave falta y hay apiKey guardada', async () => {
      odooRepo.findOne.mockResolvedValue({
        url: 'https://odoo.test', db: 'd', username: 'u', apiKey: 'iv:tag:cipher', helpdeskTeamId: 7,
        updatedAt: new Date(), updatedBy: 'admin',
      });
      const result = await brokenService.testOdoo();
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/INTEGRATIONS_ENCRYPT_KEY/);
    });
  });

  describe('testOdoo', () => {
    it('devuelve ok: false cuando falla la conexión (URL inválida en test)', async () => {
      odooRepo.findOne.mockResolvedValue(null);
      const result = await service.testOdoo();
      expect(result.ok).toBe(false);
      expect(result.message).toBeTruthy();
    });
  });

  describe('testInfraDoc', () => {
    it('devuelve ok: true cuando el servidor responde (aunque sea con error de recurso)', async () => {
      infradocRepo.findOne.mockResolvedValue(null);
      httpGet.mockReturnValue(of({ data: { success: 'False', message: 'No resource' } }));
      const result = await service.testInfraDoc();
      expect(result.ok).toBe(true);
    });

    it('devuelve ok: false cuando falla la conexión de red', async () => {
      infradocRepo.findOne.mockResolvedValue(null);
      httpGet.mockReturnValue(throwError(() => new Error('ECONNREFUSED')));
      const result = await service.testInfraDoc();
      expect(result.ok).toBe(false);
    });
  });

  describe('testVmware', () => {
    it('siempre devuelve ok: true', async () => {
      const result = await service.testVmware();
      expect(result.ok).toBe(true);
    });
  });

  describe('getVmwareConfigDecrypted', () => {
    it('devuelve credenciales del .env cuando no hay fila en DB', async () => {
      vmwareRepo.findOne.mockResolvedValue(null);
      const cfg = await service.getVmwareConfigDecrypted();
      expect(cfg).toHaveProperty('username');
      expect(cfg).toHaveProperty('password');
    });
  });

  describe('getVeeam', () => {
    it('retorna password enmascarado cuando hay fila en DB', async () => {
      veeamRepo.findOne.mockResolvedValue({
        id: 1, username: 'admin', password: 'encrypted-value',
        updatedAt: new Date('2026-10-01'), updatedBy: 'pepe@ondra.com.ar',
      });
      const result = await service.getVeeam();
      expect(result.username).toBe('admin');
      expect(result.password).toBe(MASK);
      expect(result.updatedBy).toBe('pepe@ondra.com.ar');
    });

    it('retorna fallback del env cuando no hay fila en DB', async () => {
      veeamRepo.findOne.mockResolvedValue(null);
      const result = await service.getVeeam();
      expect(result.username).toBe('env-veeam-user');
      expect(result.password).toBe(MASK);
      expect(result.updatedAt).toBeNull();
    });
  });

  describe('patchVeeam', () => {
    it('encripta el password nuevo al guardar', async () => {
      veeamRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 1, username: 'admin', password: 'encrypted', updatedAt: new Date(), updatedBy: 'u' });
      veeamRepo.save.mockImplementation((e: VeeamConfig) => Promise.resolve({ ...e, updatedAt: new Date() }));
      await service.patchVeeam({ username: 'admin', password: 'plaintext' }, 'u@test.com');
      const saved = veeamRepo.save.mock.calls[0][0] as VeeamConfig;
      expect(saved.password).not.toBe('plaintext');
      expect(saved.password).toBeDefined();
    });

    it('no modifica el password si se envía el MASK', async () => {
      veeamRepo.findOne
        .mockResolvedValueOnce({ id: 1, username: 'admin', password: 'existing-encrypted', updatedAt: new Date(), updatedBy: 'u' })
        .mockResolvedValueOnce({ id: 1, username: 'admin', password: 'existing-encrypted', updatedAt: new Date(), updatedBy: 'u' });
      veeamRepo.save.mockImplementation((e: VeeamConfig) => Promise.resolve({ ...e, updatedAt: new Date() }));
      await service.patchVeeam({ password: MASK }, 'u@test.com');
      const saved = veeamRepo.save.mock.calls[0][0] as VeeamConfig;
      expect(saved.password).toBe('existing-encrypted');
    });
  });

  describe('getVeeamConfigDecrypted', () => {
    it('retorna username y password desencriptado desde DB', async () => {
      const encryptedPassword = encrypt('real-password', KEY);
      veeamRepo.findOne.mockResolvedValue({
        id: 1, username: 'admin', password: encryptedPassword,
        updatedAt: new Date(), updatedBy: null,
      });
      const result = await service.getVeeamConfigDecrypted();
      expect(result.username).toBe('admin');
      expect(result.password).toBe('real-password');
    });

    it('devuelve credenciales del .env cuando no hay fila en DB', async () => {
      veeamRepo.findOne.mockResolvedValue(null);
      const cfg = await service.getVeeamConfigDecrypted();
      expect(cfg.username).toBe('env-veeam-user');
      expect(cfg).toHaveProperty('password');
    });
  });

  describe('getJetbackup', () => {
    it('retorna apiKey enmascarada cuando hay fila en DB', async () => {
      jetbackupRepo.findOne.mockResolvedValue({
        id: 1, url: 'https://whm.ondra.test:2087', username: 'root', apiKey: 'encrypted-value',
        updatedAt: new Date('2026-10-01'), updatedBy: 'pepe@ondra.com.ar',
      });
      const result = await service.getJetbackup();
      expect(result.url).toBe('https://whm.ondra.test:2087');
      expect(result.username).toBe('root');
      expect(result.apiKey).toBe(MASK);
      expect(result.updatedBy).toBe('pepe@ondra.com.ar');
    });

    it('retorna username "root" por defecto y url vacía cuando no hay fila en DB', async () => {
      jetbackupRepo.findOne.mockResolvedValue(null);
      const result = await service.getJetbackup();
      expect(result.url).toBe('');
      expect(result.username).toBe('root');
      expect(result.apiKey).toBe(MASK);
      expect(result.updatedAt).toBeNull();
    });
  });

  describe('patchJetbackup', () => {
    it('encripta la apiKey nueva al guardar y usa "root" si no se envía username', async () => {
      jetbackupRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 1, url: 'https://whm', username: 'root', apiKey: 'encrypted', updatedAt: new Date(), updatedBy: 'u' });
      jetbackupRepo.save.mockImplementation((e: JetbackupConfig) => Promise.resolve({ ...e, updatedAt: new Date() }));
      await service.patchJetbackup({ url: ' https://whm ', apiKey: 'plaintext-token' }, 'u@test.com');
      const saved = jetbackupRepo.save.mock.calls[0][0] as JetbackupConfig;
      expect(saved.url).toBe('https://whm');
      expect(saved.username).toBe('root');
      expect(saved.apiKey).not.toBe('plaintext-token');
      expect(decrypt(saved.apiKey as string, KEY)).toBe('plaintext-token');
      expect(saved.updatedBy).toBe('u@test.com');
    });

    it('no modifica la apiKey si se envía el MASK', async () => {
      const row = { id: 1, url: 'https://whm', username: 'root', apiKey: 'existing-encrypted', updatedAt: new Date(), updatedBy: 'u' };
      jetbackupRepo.findOne.mockResolvedValueOnce({ ...row }).mockResolvedValueOnce({ ...row });
      jetbackupRepo.save.mockImplementation((e: JetbackupConfig) => Promise.resolve({ ...e, updatedAt: new Date() }));
      await service.patchJetbackup({ apiKey: MASK }, 'u@test.com');
      const saved = jetbackupRepo.save.mock.calls[0][0] as JetbackupConfig;
      expect(saved.apiKey).toBe('existing-encrypted');
    });

    it('lanza BadRequestException con mensaje claro cuando falta INTEGRATIONS_ENCRYPT_KEY', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          IntegrationConfigService,
          { provide: getRepositoryToken(OdooConfig),      useValue: odooRepo      },
          { provide: getRepositoryToken(InfraDocConfig),  useValue: infradocRepo  },
          { provide: getRepositoryToken(VmwareConfig),    useValue: vmwareRepo    },
          { provide: getRepositoryToken(VeeamConfig),     useValue: veeamRepo     },
          { provide: getRepositoryToken(JetbackupConfig), useValue: jetbackupRepo }, { provide: getRepositoryToken(AcronisConfig), useValue: acronisRepo },
          { provide: getRepositoryToken(UnifiConfig),      useValue: unifiRepo      },
          { provide: getRepositoryToken(UnifiLocalConfig), useValue: unifiLocalRepo },
          { provide: ConfigService, useValue: { get: (_key: string, def = '') => def } },
          { provide: HttpService, useValue: { get: httpGet, post: httpPost } },
        ],
      }).compile();
      const brokenService = module.get<IntegrationConfigService>(IntegrationConfigService);
      jetbackupRepo.findOne.mockResolvedValue(null);
      await expect(brokenService.patchJetbackup({ apiKey: 'token' }, 'u@test.com'))
        .rejects.toThrow(/INTEGRATIONS_ENCRYPT_KEY/);
    });
  });

  describe('getJetbackupConfigDecrypted', () => {
    it('retorna url, username y apiKey desencriptada desde DB', async () => {
      jetbackupRepo.findOne.mockResolvedValue({
        id: 1, url: 'https://whm', username: 'admin', apiKey: encrypt('real-token', KEY),
        updatedAt: new Date(), updatedBy: null,
      });
      const result = await service.getJetbackupConfigDecrypted();
      expect(result).toEqual({ url: 'https://whm', username: 'admin', apiKey: 'real-token' });
    });

    it('devuelve valores vacíos y username "root" cuando no hay fila en DB', async () => {
      jetbackupRepo.findOne.mockResolvedValue(null);
      const result = await service.getJetbackupConfigDecrypted();
      expect(result).toEqual({ url: '', username: 'root', apiKey: '' });
    });
  });

  describe('testJetbackup', () => {
    beforeEach(() => {
      jetbackupRepo.findOne.mockResolvedValue({
        id: 1, url: 'https://whm.test:2087', username: 'root', apiKey: encrypt('tok', KEY),
        updatedAt: new Date(), updatedBy: null,
      });
    });

    it('llama a listBackupJobs con el header "whm usuario:token" y devuelve ok cuando success = 1', async () => {
      httpPost.mockReturnValue(of({ data: { success: 1, message: '', data: { jobs: [] } } }));
      const result = await service.testJetbackup();
      expect(result.ok).toBe(true);
      const [url, body, opts] = httpPost.mock.calls[0];
      expect(url).toBe('https://whm.test:2087/cgi/addons/jetbackup5/api.cgi');
      expect(body).toEqual({ function: 'listBackupJobs' });
      expect(opts.headers.Authorization).toBe('whm root:tok');
    });

    it('devuelve ok: false con el mensaje de JetBackup cuando success = 0', async () => {
      httpPost.mockReturnValue(of({ data: { success: 0, message: 'Invalid token' } }));
      const result = await service.testJetbackup();
      expect(result).toEqual({ ok: false, message: 'Invalid token' });
    });

    it('devuelve ok: false cuando falla la conexión de red', async () => {
      httpPost.mockReturnValue(throwError(() => new Error('ECONNREFUSED')));
      const result = await service.testJetbackup();
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/ECONNREFUSED/);
    });

    it('devuelve ok: false sin llamar a la API cuando falta la url', async () => {
      jetbackupRepo.findOne.mockResolvedValue(null);
      const result = await service.testJetbackup();
      expect(result.ok).toBe(false);
      expect(httpPost).not.toHaveBeenCalled();
    });
  });

  describe('getAcronis', () => {
    it('retorna clientId y clientSecret enmascarados cuando hay fila en DB', async () => {
      acronisRepo.findOne.mockResolvedValue({
        id: 1, baseUrl: 'https://eu2-cloud.acronis.com', clientId: 'enc-id', clientSecret: 'enc-secret',
        updatedAt: new Date('2026-10-01'), updatedBy: 'pepe@ondra.com.ar',
      });
      const result = await service.getAcronis();
      expect(result.baseUrl).toBe('https://eu2-cloud.acronis.com');
      expect(result.clientId).toBe(MASK);
      expect(result.clientSecret).toBe(MASK);
      expect(result.updatedBy).toBe('pepe@ondra.com.ar');
    });

    it('retorna baseUrl vacía y secretos enmascarados cuando no hay fila en DB', async () => {
      acronisRepo.findOne.mockResolvedValue(null);
      const result = await service.getAcronis();
      expect(result.baseUrl).toBe('');
      expect(result.clientId).toBe(MASK);
      expect(result.clientSecret).toBe(MASK);
      expect(result.updatedAt).toBeNull();
    });
  });

  describe('patchAcronis', () => {
    it('encripta clientId y clientSecret nuevos y normaliza la baseUrl', async () => {
      acronisRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 1, baseUrl: 'https://x', clientId: 'e', clientSecret: 'e', updatedAt: new Date(), updatedBy: 'u' });
      acronisRepo.save.mockImplementation((e: AcronisConfig) => Promise.resolve({ ...e, updatedAt: new Date() }));
      await service.patchAcronis(
        { baseUrl: ' https://eu2-cloud.acronis.com/ ', clientId: 'my-id', clientSecret: 'my-secret' }, 'u@test.com',
      );
      const saved = acronisRepo.save.mock.calls[0][0] as AcronisConfig;
      expect(saved.baseUrl).toBe('https://eu2-cloud.acronis.com');
      expect(decrypt(saved.clientId as string, KEY)).toBe('my-id');
      expect(decrypt(saved.clientSecret as string, KEY)).toBe('my-secret');
      expect(saved.updatedBy).toBe('u@test.com');
    });

    it('no modifica los secretos si se envía el MASK', async () => {
      const row = { id: 1, baseUrl: 'https://x', clientId: 'existing-id', clientSecret: 'existing-secret', updatedAt: new Date(), updatedBy: 'u' };
      acronisRepo.findOne.mockResolvedValueOnce({ ...row }).mockResolvedValueOnce({ ...row });
      acronisRepo.save.mockImplementation((e: AcronisConfig) => Promise.resolve({ ...e, updatedAt: new Date() }));
      await service.patchAcronis({ clientId: MASK, clientSecret: MASK }, 'u@test.com');
      const saved = acronisRepo.save.mock.calls[0][0] as AcronisConfig;
      expect(saved.clientId).toBe('existing-id');
      expect(saved.clientSecret).toBe('existing-secret');
    });

    it('lanza BadRequestException con mensaje claro cuando falta INTEGRATIONS_ENCRYPT_KEY', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          IntegrationConfigService,
          { provide: getRepositoryToken(OdooConfig),      useValue: odooRepo      },
          { provide: getRepositoryToken(InfraDocConfig),  useValue: infradocRepo  },
          { provide: getRepositoryToken(VmwareConfig),    useValue: vmwareRepo    },
          { provide: getRepositoryToken(VeeamConfig),     useValue: veeamRepo     },
          { provide: getRepositoryToken(JetbackupConfig),  useValue: jetbackupRepo  },
          { provide: getRepositoryToken(AcronisConfig),   useValue: acronisRepo    },
          { provide: getRepositoryToken(UnifiConfig),     useValue: unifiRepo      },
          { provide: getRepositoryToken(UnifiLocalConfig), useValue: unifiLocalRepo },
          { provide: ConfigService, useValue: { get: (_key: string, def = '') => def } },
          { provide: HttpService, useValue: { get: httpGet, post: httpPost } },
        ],
      }).compile();
      const brokenService = module.get<IntegrationConfigService>(IntegrationConfigService);
      acronisRepo.findOne.mockResolvedValue(null);
      await expect(brokenService.patchAcronis({ clientSecret: 'secret' }, 'u@test.com'))
        .rejects.toThrow(/INTEGRATIONS_ENCRYPT_KEY/);
    });
  });

  describe('getAcronisConfigDecrypted', () => {
    it('retorna baseUrl, clientId y clientSecret desencriptados desde DB', async () => {
      acronisRepo.findOne.mockResolvedValue({
        id: 1, baseUrl: 'https://eu2-cloud.acronis.com',
        clientId: encrypt('real-id', KEY), clientSecret: encrypt('real-secret', KEY),
        updatedAt: new Date(), updatedBy: null,
      });
      const result = await service.getAcronisConfigDecrypted();
      expect(result).toEqual({ baseUrl: 'https://eu2-cloud.acronis.com', clientId: 'real-id', clientSecret: 'real-secret' });
    });

    it('devuelve valores vacíos cuando no hay fila en DB', async () => {
      acronisRepo.findOne.mockResolvedValue(null);
      const result = await service.getAcronisConfigDecrypted();
      expect(result).toEqual({ baseUrl: '', clientId: '', clientSecret: '' });
    });
  });

  describe('UniFi', () => {
    it('getUnifi returns masked apiKey when row exists', async () => {
      unifiRepo.findOne.mockResolvedValue({ id: 1, apiKey: encrypt('real-key', KEY), updatedAt: new Date(), updatedBy: 'test@test.com' });
      const result = await service.getUnifi();
      expect(result.apiKey).toBe(MASK);
      expect(result.updatedBy).toBe('test@test.com');
    });

    it('getUnifi returns empty defaults when no row', async () => {
      unifiRepo.findOne.mockResolvedValue(null);
      const result = await service.getUnifi();
      expect(result.apiKey).toBe(MASK);
      expect(result.updatedAt).toBeNull();
    });

    it('patchUnifi encrypts apiKey and saves', async () => {
      unifiRepo.findOne.mockResolvedValue(null);
      unifiRepo.save.mockImplementation(async (e) => e);
      await service.patchUnifi({ apiKey: 'new-key' }, 'admin@test.com');
      const saved = unifiRepo.save.mock.calls[0][0];
      expect(saved.apiKey).not.toBe('new-key');
      expect(saved.updatedBy).toBe('admin@test.com');
    });

    it('getUnifiDecrypted decrypts stored key', async () => {
      unifiRepo.findOne.mockResolvedValue({ id: 1, apiKey: encrypt('secret', KEY) });
      const result = await service.getUnifiDecrypted();
      expect(result.apiKey).toBe('secret');
    });
  });

  describe('testAcronis', () => {
    beforeEach(() => {
      acronisRepo.findOne.mockResolvedValue({
        id: 1, baseUrl: 'https://eu2-cloud.acronis.com',
        clientId: encrypt('cid', KEY), clientSecret: encrypt('csecret', KEY),
        updatedAt: new Date(), updatedBy: null,
      });
    });

    it('pide token con Basic auth y consulta /tasks con el Bearer; ok cuando ambos responden', async () => {
      httpPost.mockReturnValue(of({ data: { access_token: 'tok', expires_on: 9999999999 } }));
      httpGet.mockReturnValue(of({ data: { items: [] } }));
      const result = await service.testAcronis();
      expect(result.ok).toBe(true);
      const [tokenUrl, tokenBody, tokenOpts] = httpPost.mock.calls[0];
      expect(tokenUrl).toBe('https://eu2-cloud.acronis.com/api/2/idp/token');
      expect(String(tokenBody)).toBe('grant_type=client_credentials');
      expect(tokenOpts.headers.Authorization).toBe(`Basic ${Buffer.from('cid:csecret').toString('base64')}`);
      const [tasksUrl, tasksOpts] = httpGet.mock.calls[0];
      expect(tasksUrl).toBe('https://eu2-cloud.acronis.com/api/task_manager/v2/tasks');
      expect(tasksOpts.params).toEqual({ limit: 1, state: 'completed' });
      expect(tasksOpts.headers.Authorization).toBe('Bearer tok');
    });

    it('devuelve ok: false con el status cuando la autenticación falla', async () => {
      httpPost.mockReturnValue(throwError(() => ({ message: 'Request failed', response: { status: 401 } })));
      const result = await service.testAcronis();
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/401/);
      expect(httpGet).not.toHaveBeenCalled();
    });

    it('devuelve ok: false cuando el token no trae access_token', async () => {
      httpPost.mockReturnValue(of({ data: {} }));
      const result = await service.testAcronis();
      expect(result.ok).toBe(false);
      expect(httpGet).not.toHaveBeenCalled();
    });

    it('devuelve ok: false cuando /tasks rechaza el token (alcance insuficiente)', async () => {
      httpPost.mockReturnValue(of({ data: { access_token: 'tok' } }));
      httpGet.mockReturnValue(throwError(() => ({ message: 'Forbidden', response: { status: 403 } })));
      const result = await service.testAcronis();
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/403/);
    });

    it('devuelve ok: false sin llamar a la API cuando faltan credenciales', async () => {
      acronisRepo.findOne.mockResolvedValue(null);
      const result = await service.testAcronis();
      expect(result.ok).toBe(false);
      expect(httpPost).not.toHaveBeenCalled();
    });
  });
});
