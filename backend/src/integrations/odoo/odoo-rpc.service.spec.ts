jest.mock('xmlrpc');
import * as xmlrpc from 'xmlrpc';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { OdooRpcService } from './odoo-rpc.service';

describe('OdooRpcService', () => {
  let service: OdooRpcService;
  let configService: { getOrThrow: jest.Mock };
  let mockMethodCall: jest.Mock;
  let mockClient: { methodCall: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockMethodCall = jest.fn();
    mockClient = { methodCall: mockMethodCall };
    (xmlrpc.createClient as jest.Mock).mockReturnValue(mockClient);
    (xmlrpc.createSecureClient as jest.Mock).mockReturnValue(mockClient);

    configService = {
      getOrThrow: jest.fn((key: string) => {
        const cfg: Record<string, string> = {
          ODOO_URL: 'http://odoo.test',
          ODOO_DB: 'testdb',
          ODOO_USERNAME: 'admin',
          ODOO_API_KEY: 'test-key',
        };
        if (!(key in cfg)) throw new Error(`Missing config: ${key}`);
        return cfg[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OdooRpcService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<OdooRpcService>(OdooRpcService);
  });

  describe('authenticate', () => {
    it('llama a /xmlrpc/2/common con authenticate y devuelve uid', async () => {
      mockMethodCall.mockImplementation((_method, _params, cb) => cb(null, 7));

      const uid = await service.authenticate();

      expect(uid).toBe(7);
      expect(xmlrpc.createClient).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/xmlrpc/2/common' }),
      );
      expect(mockMethodCall).toHaveBeenCalledWith(
        'authenticate',
        ['testdb', 'admin', 'test-key', {}],
        expect.any(Function),
      );
    });

    it('usa createSecureClient cuando la URL es HTTPS', async () => {
      configService.getOrThrow.mockImplementation((key: string) => {
        if (key === 'ODOO_URL') return 'https://odoo.test';
        const cfg: Record<string, string> = {
          ODOO_DB: 'testdb',
          ODOO_USERNAME: 'admin',
          ODOO_API_KEY: 'test-key',
        };
        return cfg[key];
      });
      mockMethodCall.mockImplementation((_method, _params, cb) => cb(null, 5));

      await service.authenticate();

      expect(xmlrpc.createSecureClient).toHaveBeenCalled();
      expect(xmlrpc.createClient).not.toHaveBeenCalled();
    });

    it('lanza ServiceUnavailableException cuando uid es falsy', async () => {
      mockMethodCall.mockImplementation((_method, _params, cb) =>
        cb(null, false),
      );

      await expect(service.authenticate()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('lanza ServiceUnavailableException cuando xmlrpc devuelve error', async () => {
      mockMethodCall.mockImplementation((_method, _params, cb) =>
        cb(new Error('Access Denied'), null),
      );

      await expect(service.authenticate()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('callKw', () => {
    it('autentica antes de la primera llamada y devuelve el resultado', async () => {
      mockMethodCall
        .mockImplementationOnce((_m, _p, cb) => cb(null, 7))
        .mockImplementationOnce((_m, _p, cb) =>
          cb(null, [{ id: 1, name: 'ACME' }]),
        );

      const result = await service.callKw<{ id: number; name: string }[]>(
        'res.partner',
        'search_read',
        [[['is_company', '=', true]]],
        { fields: ['id', 'name'] },
      );

      expect(mockMethodCall).toHaveBeenCalledTimes(2);
      expect(result).toEqual([{ id: 1, name: 'ACME' }]);
    });

    it('reutiliza el uid cacheado sin re-autenticar en llamadas subsiguientes', async () => {
      mockMethodCall
        .mockImplementationOnce((_m, _p, cb) => cb(null, 7))
        .mockImplementation((_m, _p, cb) => cb(null, []));

      await service.callKw('res.partner', 'search_read', [[]], {});
      await service.callKw('res.partner', 'search_read', [[]], {});

      expect(mockMethodCall).toHaveBeenCalledTimes(3); // 1 auth + 2 data
    });

    it('llama a /xmlrpc/2/object con execute_kw y parámetros correctos', async () => {
      mockMethodCall
        .mockImplementationOnce((_m, _p, cb) => cb(null, 7))
        .mockImplementationOnce((_m, _p, cb) => cb(null, []));

      await service.callKw(
        'res.partner',
        'search_read',
        [[['is_company', '=', true]]],
        { fields: ['id', 'vat'] },
      );

      expect(xmlrpc.createClient).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/xmlrpc/2/object' }),
      );
      const dataCall = mockMethodCall.mock.calls[1];
      expect(dataCall[0]).toBe('execute_kw');
      expect(dataCall[1]).toEqual([
        'testdb',
        7,
        'test-key',
        'res.partner',
        'search_read',
        [[['is_company', '=', true]]],
        { fields: ['id', 'vat'] },
      ]);
    });

    it('lanza ServiceUnavailableException cuando xmlrpc devuelve error', async () => {
      mockMethodCall
        .mockImplementationOnce((_m, _p, cb) => cb(null, 7))
        .mockImplementationOnce((_m, _p, cb) =>
          cb(new Error('Model not found'), null),
        );

      await expect(
        service.callKw('res.partner', 'search_read', [[]], {}),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
