jest.mock('xmlrpc');
import * as xmlrpc from 'xmlrpc';
import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { OdooSystemRpcService } from './odoo-system-rpc.service';
import { IntegrationConfigService } from '../../integration-config/integration-config.service';

const mockCfg = { url: 'http://odoo.test', db: 'testdb', username: 'admin', apiKey: 'sys-key', helpdeskTeamId: 7 };
let mockVersion = 0;

const mockIntegrationConfigService = {
  getOdooConfigDecrypted: jest.fn().mockResolvedValue(mockCfg),
  getOdooVersion: jest.fn().mockImplementation(() => mockVersion),
};

describe('OdooSystemRpcService', () => {
  let service: OdooSystemRpcService;
  let mockMethodCall: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockVersion = 0;
    mockIntegrationConfigService.getOdooConfigDecrypted.mockResolvedValue(mockCfg);
    mockIntegrationConfigService.getOdooVersion.mockImplementation(() => mockVersion);
    mockMethodCall = jest.fn();
    const mockClient = { methodCall: mockMethodCall };
    (xmlrpc.createClient as jest.Mock).mockReturnValue(mockClient);
    (xmlrpc.createSecureClient as jest.Mock).mockReturnValue(mockClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OdooSystemRpcService,
        { provide: IntegrationConfigService, useValue: mockIntegrationConfigService },
      ],
    }).compile();
    service = module.get<OdooSystemRpcService>(OdooSystemRpcService);
  });

  it('autentica y devuelve uid', async () => {
    mockMethodCall.mockImplementation((_m, _p, cb) => cb(null, 7));
    expect(await service.authenticate()).toBe(7);
  });

  it('lanza ServiceUnavailableException cuando uid es falsy', async () => {
    mockMethodCall.mockImplementation((_m, _p, cb) => cb(null, 0));
    await expect(service.authenticate()).rejects.toThrow(ServiceUnavailableException);
  });

  it('reutiliza uid cacheado sin re-autenticar cuando la versión no cambia', async () => {
    mockMethodCall
      .mockImplementationOnce((_m, _p, cb) => cb(null, 7))
      .mockImplementation((_m, _p, cb) => cb(null, []));
    await service.callKw('res.partner', 'search_read', [[]], {});
    await service.callKw('res.partner', 'search_read', [[]], {});
    expect(mockMethodCall).toHaveBeenCalledTimes(3); // 1 auth + 2 data
  });

  it('re-autentica cuando la versión de config cambia', async () => {
    mockMethodCall
      .mockImplementationOnce((_m, _p, cb) => cb(null, 7))
      .mockImplementationOnce((_m, _p, cb) => cb(null, []))
      .mockImplementationOnce((_m, _p, cb) => cb(null, 8))
      .mockImplementationOnce((_m, _p, cb) => cb(null, []));

    await service.callKw('res.partner', 'search_read', [[]], {});
    mockVersion = 1; // simular cambio de config
    await service.callKw('res.partner', 'search_read', [[]], {});

    expect(mockMethodCall).toHaveBeenCalledTimes(4); // 2 auth + 2 data
  });

  it('lanza ServiceUnavailableException en error de red', async () => {
    mockMethodCall
      .mockImplementationOnce((_m, _p, cb) => cb(null, 7))
      .mockImplementationOnce((_m, _p, cb) => cb(new Error('net'), null));
    await expect(service.callKw('m', 'search_read', [[]], {})).rejects.toThrow(ServiceUnavailableException);
  });
});
