import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { AxiosHeaders, AxiosResponse } from 'axios';
import { of } from 'rxjs';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let httpService: { get: jest.Mock };

  const axiosRes = (data: object): AxiosResponse => ({
    data, status: 200, statusText: 'OK', headers: {},
    config: { headers: new AxiosHeaders() },
  });

  const CLIENTS_OK = {
    success: 'True',
    data: [{ client_id: '1', client_name: 'Acme SA' }],
  };

  const setupMock = (
    assetsData: object[] = [],
    certsData: object[] = [],
    domainsData: object[] = [],
    softwareData: object[] = [],
  ) => {
    httpService.get.mockImplementation((url: string) => {
      if (url.includes('/clients/'))      return of(axiosRes(CLIENTS_OK));
      if (url.includes('/assets/'))       return of(axiosRes({ success: 'True', data: assetsData }));
      if (url.includes('/certificates/')) return of(axiosRes({ success: 'True', data: certsData }));
      if (url.includes('/domains/'))      return of(axiosRes({ success: 'True', data: domainsData }));
      if (url.includes('/software/'))     return of(axiosRes({ success: 'True', data: softwareData }));
      return of(axiosRes({ success: 'True', data: [] }));
    });
  };

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-28'));
    process.env.INFRADOC_URL = 'http://infradoc.test';
    process.env.INFRADOC_API_KEY = 'test-key';

    httpService = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: HttpService, useValue: httpService },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.useRealTimers();
    delete process.env.INFRADOC_URL;
    delete process.env.INFRADOC_API_KEY;
  });

  it('normaliza un asset con warranty_expire a ExpirationItemDto', async () => {
    setupMock([{
      asset_id: '101', asset_name: 'Server Dell R640',
      asset_warranty_expire: '2026-07-05', asset_client_id: '1',
    }]);

    const result = await service.getExpirations(90);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'asset_warranty',
      clientId: 1,
      clientName: 'Acme SA',
      itemName: 'Server Dell R640',
      expireDate: '2026-07-05',
      daysUntil: 7,
    });
  });

  it('omite assets sin asset_warranty_expire', async () => {
    setupMock([{ asset_id: '1', asset_name: 'Sin garantía', asset_warranty_expire: null, asset_client_id: '1' }]);

    const result = await service.getExpirations(90);
    expect(result).toHaveLength(0);
  });

  it('incluye expirados y dentro del horizonte, excluye más allá', async () => {
    setupMock([
      { asset_id: '1', asset_name: 'Expirado', asset_warranty_expire: '2026-06-27', asset_client_id: '1' },
      { asset_id: '2', asset_name: 'En 90d',   asset_warranty_expire: '2026-09-26', asset_client_id: '1' },
      { asset_id: '3', asset_name: 'En 91d',   asset_warranty_expire: '2026-09-27', asset_client_id: '1' },
    ]);

    const result = await service.getExpirations(90);
    expect(result).toHaveLength(2);
    expect(result.map(i => i.itemName)).toContain('Expirado');
    expect(result.map(i => i.itemName)).toContain('En 90d');
  });

  it('sin days devuelve todos los items incluyendo futuros lejanos', async () => {
    setupMock([
      { asset_id: '1', asset_name: 'Lejano',   asset_warranty_expire: '2027-01-01', asset_client_id: '1' },
      { asset_id: '2', asset_name: 'Expirado', asset_warranty_expire: '2026-05-01', asset_client_id: '1' },
    ]);

    const result = await service.getExpirations(undefined);
    expect(result).toHaveLength(2);
  });

  it('ordena por expireDate ASC — expirados primero', async () => {
    setupMock([
      { asset_id: '1', asset_name: 'Futuro',   asset_warranty_expire: '2026-07-10', asset_client_id: '1' },
      { asset_id: '2', asset_name: 'Expirado', asset_warranty_expire: '2026-06-20', asset_client_id: '1' },
    ]);

    const result = await service.getExpirations(90);
    expect(result[0].itemName).toBe('Expirado');
    expect(result[1].itemName).toBe('Futuro');
  });

  it('usa fallback clientName cuando el client_id no está en el mapa', async () => {
    setupMock([{
      asset_id: '1', asset_name: 'Servidor', asset_warranty_expire: '2026-07-01', asset_client_id: '99',
    }]);

    const result = await service.getExpirations(90);
    expect(result[0].clientName).toBe('Cliente 99');
  });

  it('normaliza un software con software_expire y software_client_id', async () => {
    setupMock([], [], [], [{
      software_id: '1', software_name: 'Kaspersky',
      software_expire: '2026-07-15', software_client_id: '1',
    }]);

    const result = await service.getExpirations(90);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'software',
      clientId: 1,
      clientName: 'Acme SA',
      itemName: 'Kaspersky',
      expireDate: '2026-07-15',
      daysUntil: 17,
    });
  });

  it('normaliza un dominio con domain_expire', async () => {
    setupMock([], [], [{
      domain_id: '1', domain_name: 'acme.com.ar',
      domain_expire: '2026-07-05', domain_client_id: '1',
    }]);

    const result = await service.getExpirations(90);
    expect(result[0].type).toBe('domain');
    expect(result[0].itemName).toBe('acme.com.ar');
  });

  it('ignora un tipo cuya respuesta InfraDoc tiene success False — no lanza', async () => {
    httpService.get.mockImplementation((url: string) => {
      if (url.includes('/clients/'))      return of(axiosRes(CLIENTS_OK));
      if (url.includes('/assets/'))       return of(axiosRes({ success: 'False', message: 'Error' }));
      if (url.includes('/certificates/')) return of(axiosRes({ success: 'True', data: [{
        certificate_id: '1', certificate_name: 'cert.pem',
        certificate_expire: '2026-07-05', certificate_client_id: '1',
      }] }));
      return of(axiosRes({ success: 'True', data: [] }));
    });

    const result = await service.getExpirations(90);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('certificate');
  });

  it('omite items cuyo client_id es null — no genera "Cliente NaN"', async () => {
    setupMock([], [], [{
      domain_id: '1', domain_name: 'sincliente.com',
      domain_expire: '2026-07-05', domain_client_id: null,
    }]);

    const result = await service.getExpirations(90);
    expect(result).toHaveLength(0);
  });

  it('lanza Error cuando INFRADOC_URL no está configurado', async () => {
    delete process.env.INFRADOC_URL;
    await expect(service.getExpirations(90)).rejects.toThrow(
      'INFRADOC_URL and INFRADOC_API_KEY deben estar configurados',
    );
    expect(httpService.get).not.toHaveBeenCalled();
  });
});
