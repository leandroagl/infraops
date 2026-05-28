import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ServiceUnavailableException } from '@nestjs/common';
import { AxiosHeaders, AxiosResponse } from 'axios';
import { of } from 'rxjs';
import { InfradocAssetsService } from './infradoc-assets.service';

describe('InfradocAssetsService', () => {
  let service: InfradocAssetsService;
  let httpService: { get: jest.Mock };

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
    httpService = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InfradocAssetsService,
        { provide: HttpService, useValue: httpService },
      ],
    }).compile();

    service = module.get<InfradocAssetsService>(InfradocAssetsService);
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

    await expect(service.getAssets(42)).rejects.toThrow(ServiceUnavailableException);
  });

  it('devuelve array vacío cuando el cliente no tiene assets', async () => {
    httpService.get.mockReturnValue(
      of(axiosRes({ success: 'True', count: 0, data: [] })),
    );

    const result = await service.getAssets(42);

    expect(result).toEqual([]);
  });
});
