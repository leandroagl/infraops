import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ClientsService } from '../../clients/clients.service';
import { InfradocAssetsService, RawInfradocAsset } from './infradoc-assets.service';
import { InfrastructureService } from './infrastructure.service';

describe('InfrastructureService', () => {
  let service: InfrastructureService;
  let clientsService: { findInfradocId: jest.Mock };
  let infradocAssetsService: { getAssets: jest.Mock };

  const makeAsset = (override: Partial<RawInfradocAsset> = {}): RawInfradocAsset => ({
    asset_id: '1',
    asset_name: 'SRV-DC01',
    asset_type: 'Server',
    asset_ip: '10.0.1.5',
    asset_os: 'Windows Server 2019',
    asset_model: 'Dell PowerEdge R640',
    ...override,
  });

  beforeEach(async () => {
    clientsService = { findInfradocId: jest.fn().mockResolvedValue(42) };
    infradocAssetsService = { getAssets: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InfrastructureService,
        { provide: ClientsService, useValue: clientsService },
        { provide: InfradocAssetsService, useValue: infradocAssetsService },
      ],
    }).compile();

    service = module.get<InfrastructureService>(InfrastructureService);
  });

  it('lanza NotFoundException si el cliente no existe en InfraOps', async () => {
    clientsService.findInfradocId.mockResolvedValue(null);

    await expect(
      service.getClientInfrastructure('uuid-no-existe'),
    ).rejects.toThrow(NotFoundException);
  });

  it('pasa el infradocId correcto a getAssets', async () => {
    clientsService.findInfradocId.mockResolvedValue(99);
    infradocAssetsService.getAssets.mockResolvedValue([]);

    await service.getClientInfrastructure('uuid-1');

    expect(infradocAssetsService.getAssets).toHaveBeenCalledWith(99);
  });

  it('agrupa assets de tipo Server en servers', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([
      makeAsset({ asset_id: '1', asset_name: 'SRV-DC01', asset_type: 'Server' }),
    ]);

    const result = await service.getClientInfrastructure('uuid-1');

    expect(result.servers).toHaveLength(1);
    expect(result.servers[0]).toEqual({
      assetId: 1,
      name: 'SRV-DC01',
      ip: '10.0.1.5',
      os: 'Windows Server 2019',
      model: 'Dell PowerEdge R640',
    });
    expect(result.vms).toHaveLength(0);
    expect(result.nas).toHaveLength(0);
    expect(result.routers).toHaveLength(0);
  });

  it('agrupa assets de tipo Virtual Machine en vms', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([
      makeAsset({ asset_id: '2', asset_name: 'VM-DC01', asset_type: 'Virtual Machine', asset_os: null, asset_model: null }),
    ]);

    const result = await service.getClientInfrastructure('uuid-1');

    expect(result.vms).toHaveLength(1);
    expect(result.vms[0].name).toBe('VM-DC01');
    expect(result.servers).toHaveLength(0);
  });

  it('agrupa assets de tipo NAS y QNAP en nas', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([
      makeAsset({ asset_id: '3', asset_name: 'NAS-01', asset_type: 'NAS' }),
      makeAsset({ asset_id: '4', asset_name: 'QNAP-01', asset_type: 'QNAP' }),
    ]);

    const result = await service.getClientInfrastructure('uuid-1');

    expect(result.nas).toHaveLength(2);
    expect(result.nas[0].name).toBe('NAS-01');
    expect(result.nas[1].name).toBe('QNAP-01');
  });

  it('agrupa assets de tipo Router y Firewall en routers', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([
      makeAsset({ asset_id: '5', asset_name: 'MikroTik-01', asset_type: 'Router' }),
      makeAsset({ asset_id: '6', asset_name: 'Fortinet-01', asset_type: 'Firewall' }),
    ]);

    const result = await service.getClientInfrastructure('uuid-1');

    expect(result.routers).toHaveLength(2);
    expect(result.routers[0].name).toBe('MikroTik-01');
    expect(result.routers[1].name).toBe('Fortinet-01');
  });

  it('devuelve arrays vacíos para categorías sin assets', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([]);

    const result = await service.getClientInfrastructure('uuid-1');

    expect(result.servers).toEqual([]);
    expect(result.vms).toEqual([]);
    expect(result.nas).toEqual([]);
    expect(result.routers).toEqual([]);
  });

  it('ignora assets de tipo desconocido sin lanzar error', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([
      makeAsset({ asset_type: 'Printer' }),
    ]);

    const result = await service.getClientInfrastructure('uuid-1');

    expect(result.servers).toHaveLength(0);
    expect(result.vms).toHaveLength(0);
    expect(result.nas).toHaveLength(0);
    expect(result.routers).toHaveLength(0);
  });

  it('mapea ip, os y model como null cuando ITFlow devuelve null', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([
      makeAsset({ asset_ip: null, asset_os: null, asset_model: null }),
    ]);

    const result = await service.getClientInfrastructure('uuid-1');

    expect(result.servers[0].ip).toBeNull();
    expect(result.servers[0].os).toBeNull();
    expect(result.servers[0].model).toBeNull();
  });
});
