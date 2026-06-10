import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { AxiosHeaders, AxiosResponse } from 'axios';
import { of } from 'rxjs';
import { OdooRpcService } from './odoo-rpc.service';

describe('OdooRpcService', () => {
  let service: OdooRpcService;
  let httpService: { post: jest.Mock };
  let configService: { getOrThrow: jest.Mock };

  const axiosRes = (data: object): AxiosResponse => ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

  beforeEach(async () => {
    httpService = { post: jest.fn() };
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
        { provide: HttpService, useValue: httpService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<OdooRpcService>(OdooRpcService);
  });

  describe('authenticate', () => {
    it('POST al endpoint de autenticación con credenciales y devuelve uid', async () => {
      httpService.post.mockReturnValue(of(axiosRes({ result: 7 })));

      const uid = await service.authenticate();

      expect(uid).toBe(7);
      expect(httpService.post).toHaveBeenCalledWith(
        'http://odoo.test/web/dataset/call_kw',
        expect.objectContaining({
          jsonrpc: '2.0',
          method: 'call',
          params: expect.objectContaining({
            model: 'res.users',
            method: 'authenticate',
            args: ['testdb', 'admin', 'test-key', {}],
            kwargs: {},
          }),
        }),
      );
    });

    it('lanza ServiceUnavailableException cuando la respuesta devuelve result false', async () => {
      httpService.post.mockReturnValue(of(axiosRes({ result: false })));

      await expect(service.authenticate()).rejects.toThrow(ServiceUnavailableException);
    });

    it('lanza ServiceUnavailableException cuando la respuesta tiene error', async () => {
      httpService.post.mockReturnValue(
        of(axiosRes({ error: { message: 'Access Denied' } })),
      );

      await expect(service.authenticate()).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('callKw', () => {
    it('autentica antes de la primera llamada y devuelve result', async () => {
      httpService.post
        .mockReturnValueOnce(of(axiosRes({ result: 7 })))
        .mockReturnValueOnce(of(axiosRes({ result: [{ id: 1, name: 'ACME' }] })));

      const result = await service.callKw<{ id: number; name: string }[]>(
        'res.partner',
        'search_read',
        [[['is_company', '=', true]]],
        { fields: ['id', 'name'] },
      );

      expect(httpService.post).toHaveBeenCalledTimes(2);
      expect(result).toEqual([{ id: 1, name: 'ACME' }]);
    });

    it('reutiliza el uid cacheado sin re-autenticar en llamadas subsiguientes', async () => {
      httpService.post
        .mockReturnValueOnce(of(axiosRes({ result: 7 })))
        .mockReturnValue(of(axiosRes({ result: [] })));

      await service.callKw('res.partner', 'search_read', [[]], {});
      await service.callKw('res.partner', 'search_read', [[]], {});

      // 1 auth + 2 data calls
      expect(httpService.post).toHaveBeenCalledTimes(3);
    });

    it('lanza ServiceUnavailableException cuando la respuesta tiene campo error', async () => {
      httpService.post
        .mockReturnValueOnce(of(axiosRes({ result: 7 })))
        .mockReturnValueOnce(of(axiosRes({ error: { message: 'Model not found' } })));

      await expect(
        service.callKw('res.partner', 'search_read', [[]], {}),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('POST al endpoint con model, method, args, kwargs y uid en el body', async () => {
      httpService.post
        .mockReturnValueOnce(of(axiosRes({ result: 7 })))
        .mockReturnValueOnce(of(axiosRes({ result: [] })));

      await service.callKw(
        'res.partner',
        'search_read',
        [[['is_company', '=', true]]],
        { fields: ['id', 'vat'] },
      );

      const dataCall = httpService.post.mock.calls[1];
      expect(dataCall[0]).toBe('http://odoo.test/web/dataset/call_kw');
      expect(dataCall[1].params.model).toBe('res.partner');
      expect(dataCall[1].params.method).toBe('search_read');
      expect(dataCall[1].params.kwargs.uid).toBe(7);
      expect(dataCall[1].params.kwargs.password).toBe('test-key');
      expect(dataCall[1].params.kwargs.db).toBe('testdb');
    });
  });
});
