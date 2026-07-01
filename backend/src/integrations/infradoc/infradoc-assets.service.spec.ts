import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ServiceUnavailableException } from '@nestjs/common';
import { AxiosHeaders, AxiosResponse } from 'axios';
import { of } from 'rxjs';
import { InfradocAssetsService } from './infradoc-assets.service';

describe('InfradocAssetsService', () => {
  let service: InfradocAssetsService;
  let httpService: { get: jest.Mock };
  let savedUrl: string | undefined;
  let savedKey: string | undefined;

  const makeRawAsset = (override: Record<string, unknown> = {}) => ({
    asset_id: '101',
    asset_name: 'SRV-DC01',
    asset_type: 'Server',
    asset_ip: '10.0.1.5',
    asset_os: 'Windows Server 2019',
    asset_model: 'Dell PowerEdge R640',
    ...override,
  });

  const axiosRes = (data: object): AxiosResponse => ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

  beforeEach(async () => {
    savedUrl = process.env.INFRADOC_URL;
    savedKey = process.env.INFRADOC_API_KEY;
    process.env.INFRADOC_URL = 'http://infradoc.test';
    process.env.INFRADOC_API_KEY = 'test-api-key';

    httpService = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InfradocAssetsService,
        { provide: HttpService, useValue: httpService },
      ],
    }).compile();

    service = module.get<InfradocAssetsService>(InfradocAssetsService);
  });

  afterEach(() => {
    process.env.INFRADOC_URL = savedUrl;
    process.env.INFRADOC_API_KEY = savedKey;
  });

  it('devuelve los assets crudos de ITFlow para el cliente', async () => {
    httpService.get.mockReturnValue(
      of(axiosRes({ success: 'True', count: 1, data: [makeRawAsset()] })),
    );

    const result = await service.getAssets(42);

    expect(result).toHaveLength(1);
    expect(result[0].asset_id).toBe('101');
    expect(result[0].asset_name).toBe('SRV-DC01');
    expect(result[0].asset_type).toBe('Server');
  });

  it('llama al endpoint correcto con client_id y api_key', async () => {
    httpService.get.mockReturnValue(
      of(axiosRes({ success: 'True', count: 0, data: [] })),
    );

    await service.getAssets(42);

    expect(httpService.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/assets/read.php'),
      expect.objectContaining({
        params: expect.objectContaining({ client_id: 42 }),
      }),
    );
  });

  it('lanza ServiceUnavailableException cuando InfraDoc devuelve success False', async () => {
    httpService.get.mockReturnValue(
      of(axiosRes({ success: 'False', message: 'Auth failed' })),
    );

    await expect(service.getAssets(42)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('devuelve array vacío cuando el cliente no tiene assets', async () => {
    httpService.get.mockReturnValue(
      of(axiosRes({ success: 'True', count: 0, data: [] })),
    );

    const result = await service.getAssets(42);

    expect(result).toEqual([]);
  });

  it('lanza Error con mensaje descriptivo cuando INFRADOC_URL no está configurado', async () => {
    delete process.env.INFRADOC_URL;

    await expect(service.getAssets(42)).rejects.toThrow(
      'INFRADOC_URL and INFRADOC_API_KEY deben estar configurados',
    );
    expect(httpService.get).not.toHaveBeenCalled();
  });

  it('lanza Error con mensaje descriptivo cuando INFRADOC_API_KEY no está configurado', async () => {
    delete process.env.INFRADOC_API_KEY;

    await expect(service.getAssets(42)).rejects.toThrow(
      'INFRADOC_URL and INFRADOC_API_KEY deben estar configurados',
    );
    expect(httpService.get).not.toHaveBeenCalled();
  });

  it('devuelve array vacío cuando la respuesta devuelve data no-array', async () => {
    httpService.get.mockReturnValue(
      of(axiosRes({ success: 'True', count: 0, data: null })),
    );

    const result = await service.getAssets(42);

    expect(result).toEqual([]);
  });

  it('propaga uri1 y uri2 desde la respuesta de InfraDoc', async () => {
    httpService.get.mockReturnValue(
      of(axiosRes({
        success: 'True', count: 1,
        data: [makeRawAsset({ uri1: 'esxi.cliente.com:344', uri2: null })],
      })),
    );
    const result = await service.getAssets(42);
    expect(result[0].uri1).toBe('esxi.cliente.com:344');
    expect(result[0].uri2).toBeNull();
  });

  describe('getAssetInterfaces', () => {
    it('llama al endpoint con asset_id y devuelve array de interfaces', async () => {
      const iface = {
        ...makeRawAsset(),
        interface_name: 'iLO',
        interface_ip: '10.0.1.200',
      };
      httpService.get.mockReturnValue(
        of(axiosRes({ success: 'True', count: 1, data: [iface] })),
      );

      const result = await service.getAssetInterfaces(101);

      expect(result).toHaveLength(1);
      expect(result[0].interface_ip).toBe('10.0.1.200');
      expect(httpService.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/assets/read.php'),
        expect.objectContaining({
          params: expect.objectContaining({ asset_id: 101 }),
        }),
      );
    });

    it('devuelve array vacío cuando data no es array', async () => {
      httpService.get.mockReturnValue(
        of(axiosRes({ success: 'True', count: 0, data: null })),
      );

      const result = await service.getAssetInterfaces(101);

      expect(result).toEqual([]);
    });

    it('lanza ServiceUnavailableException cuando InfraDoc devuelve success False', async () => {
      httpService.get.mockReturnValue(
        of(axiosRes({ success: 'False', message: 'Not found' })),
      );

      await expect(service.getAssetInterfaces(101)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
