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
import { MASK, decrypt } from './crypto.util';

const KEY = '8b2202fa0aa8498ca124415c67472e7b479e1eb31a24d948eedeccecc2a5a5c2';

describe('IntegrationConfigService', () => {
  let service: IntegrationConfigService;
  let odooRepo: { findOne: jest.Mock; save: jest.Mock };
  let infradocRepo: { findOne: jest.Mock; save: jest.Mock };
  let vmwareRepo: { findOne: jest.Mock; save: jest.Mock };
  let httpGet: jest.Mock;

  beforeEach(async () => {
    odooRepo     = { findOne: jest.fn(), save: jest.fn() };
    infradocRepo = { findOne: jest.fn(), save: jest.fn() };
    vmwareRepo   = { findOne: jest.fn(), save: jest.fn() };
    httpGet      = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationConfigService,
        { provide: getRepositoryToken(OdooConfig),     useValue: odooRepo     },
        { provide: getRepositoryToken(InfraDocConfig), useValue: infradocRepo },
        { provide: getRepositoryToken(VmwareConfig),   useValue: vmwareRepo   },
        { provide: ConfigService, useValue: {
            get: (key: string, def = '') =>
              ({
                INTEGRATIONS_ENCRYPT_KEY: KEY,
                ODOO_API_KEY:    'env-odoo-key',
                INFRADOC_API_KEY: 'env-infradoc-key',
                VMWARE_PASS:     'env-vmware-pass',
              } as Record<string, string>)[key] ?? def,
          },
        },
        { provide: HttpService, useValue: { get: httpGet } },
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

    it('incrementa versión de config al guardar', async () => {
      odooRepo.findOne.mockResolvedValue(null);
      odooRepo.save.mockImplementation(async (e: OdooConfig) => e);
      const vBefore = service.getOdooVersion();
      await service.patchOdoo({ url: 'https://x.com' }, 'admin@test.com');
      expect(service.getOdooVersion()).toBe(vBefore + 1);
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
});
