jest.mock('xmlrpc');
import * as xmlrpc from 'xmlrpc';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { OdooSystemRpcService } from './odoo-system-rpc.service';

describe('OdooSystemRpcService', () => {
  let service: OdooSystemRpcService;
  let mockMethodCall: jest.Mock;

  const cfg: Record<string, string> = {
    ODOO_URL: 'http://odoo.test', ODOO_DB: 'testdb',
    ODOO_USERNAME: 'admin', ODOO_API_KEY: 'sys-key',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockMethodCall = jest.fn();
    const mockClient = { methodCall: mockMethodCall };
    (xmlrpc.createClient as jest.Mock).mockReturnValue(mockClient);
    (xmlrpc.createSecureClient as jest.Mock).mockReturnValue(mockClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OdooSystemRpcService,
        { provide: ConfigService, useValue: { getOrThrow: (k: string) => cfg[k] } },
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

  it('reutiliza uid cacheado sin re-autenticar', async () => {
    mockMethodCall
      .mockImplementationOnce((_m, _p, cb) => cb(null, 7))
      .mockImplementation((_m, _p, cb) => cb(null, []));
    await service.callKw('res.partner', 'search_read', [[]], {});
    await service.callKw('res.partner', 'search_read', [[]], {});
    expect(mockMethodCall).toHaveBeenCalledTimes(3); // 1 auth + 2 data
  });

  it('lanza ServiceUnavailableException en error de red', async () => {
    mockMethodCall
      .mockImplementationOnce((_m, _p, cb) => cb(null, 7))
      .mockImplementationOnce((_m, _p, cb) => cb(new Error('net'), null));
    await expect(service.callKw('m', 'search_read', [[]], {})).rejects.toThrow(ServiceUnavailableException);
  });
});
