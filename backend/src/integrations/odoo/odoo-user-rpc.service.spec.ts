jest.mock('xmlrpc');
import * as xmlrpc from 'xmlrpc';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { OdooUserRpcService } from './odoo-user-rpc.service';

const CREDS = { email: 'tech@ondra.com.ar', apiKey: 'user-key-123' };

describe('OdooUserRpcService', () => {
  let service: OdooUserRpcService;
  let mockMethodCall: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockMethodCall = jest.fn();
    const mockClient = { methodCall: mockMethodCall };
    (xmlrpc.createClient as jest.Mock).mockReturnValue(mockClient);
    (xmlrpc.createSecureClient as jest.Mock).mockReturnValue(mockClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OdooUserRpcService,
        { provide: ConfigService, useValue: { getOrThrow: (k: string) => ({ ODOO_URL: 'http://odoo.test', ODOO_DB: 'testdb' }[k]) } },
      ],
    }).compile();
    service = module.get<OdooUserRpcService>(OdooUserRpcService);
  });

  describe('validateCredentials', () => {
    it('resuelve sin error cuando uid es válido', async () => {
      mockMethodCall.mockImplementation((_m, _p, cb) => cb(null, 5));
      await expect(service.validateCredentials(CREDS.email, CREDS.apiKey)).resolves.toBeUndefined();
    });

    it('lanza BadRequestException cuando uid es 0 (credenciales incorrectas)', async () => {
      mockMethodCall.mockImplementation((_m, _p, cb) => cb(null, 0));
      await expect(service.validateCredentials(CREDS.email, CREDS.apiKey)).rejects.toThrow(BadRequestException);
    });

    it('lanza ServiceUnavailableException cuando Odoo no está disponible', async () => {
      mockMethodCall.mockImplementation((_m, _p, cb) => cb(new Error('ECONNREFUSED'), null));
      await expect(service.validateCredentials(CREDS.email, CREDS.apiKey)).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('callKw', () => {
    it('autentica con las credenciales del usuario (no con service account) y ejecuta la llamada', async () => {
      mockMethodCall
        .mockImplementationOnce((_m, _p, cb) => cb(null, 5))
        .mockImplementationOnce((_m, _p, cb) => cb(null, true));

      await service.callKw<boolean>(CREDS, 'helpdesk.ticket', 'write', [[1], { stage_id: 3 }], {});

      const authCall = mockMethodCall.mock.calls[0];
      expect(authCall[1]).toEqual(['testdb', CREDS.email, CREDS.apiKey, {}]);
      const dataCall = mockMethodCall.mock.calls[1];
      expect(dataCall[1][2]).toBe(CREDS.apiKey); // apiKey del usuario, no la del .env
    });

    it('autentica de nuevo en cada llamada (sin caché de uid)', async () => {
      mockMethodCall
        .mockImplementationOnce((_m, _p, cb) => cb(null, 5))
        .mockImplementationOnce((_m, _p, cb) => cb(null, true))
        .mockImplementationOnce((_m, _p, cb) => cb(null, 5))
        .mockImplementationOnce((_m, _p, cb) => cb(null, true));

      await service.callKw<boolean>(CREDS, 'helpdesk.ticket', 'write', [[1], {}], {});
      await service.callKw<boolean>(CREDS, 'helpdesk.ticket', 'write', [[2], {}], {});

      expect(mockMethodCall).toHaveBeenCalledTimes(4); // 2 auth + 2 data (sin caché)
    });
  });
});
