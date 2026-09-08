import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { InfrastructureService } from './infrastructure.service';
import { ClientsService } from '../../clients/clients.service';
import { InfradocAssetsService } from './infradoc-assets.service';
import { TaskConfigService } from '../../task-config/task-config.service';
import { TaskType } from '../../tasks/task-type.enum';

const mockRawServer = (name: string) => ({
  asset_id: '1',
  asset_name: name,
  asset_type: 'server',
  asset_make: 'Dell',
  asset_model: 'R740',
  asset_os: 'VMware ESXi',
  asset_description: null,
  interface_ip: '10.0.0.1',
  interface_name: null,
  asset_uri: null,
  asset_uri_2: null,
});

describe('InfrastructureService', () => {
  let service: InfrastructureService;
  let clientsService: jest.Mocked<Partial<ClientsService>>;
  let assetsService: jest.Mocked<Partial<InfradocAssetsService>>;
  let taskConfigService: jest.Mocked<Partial<TaskConfigService>>;

  beforeEach(async () => {
    clientsService = { findClientMeta: jest.fn() };
    assetsService = { getAssets: jest.fn(), getAssetInterfaces: jest.fn() };
    taskConfigService = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InfrastructureService,
        { provide: ClientsService, useValue: clientsService },
        { provide: InfradocAssetsService, useValue: assetsService },
        { provide: TaskConfigService, useValue: taskConfigService },
      ],
    }).compile();

    service = module.get<InfrastructureService>(InfrastructureService);
  });

  it('throws NotFoundException when client not found', async () => {
    clientsService.findClientMeta!.mockResolvedValue(null);
    await expect(service.getClientInfrastructure('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('filters ondra-owned hosts from regular client esxiHosts', async () => {
    clientsService.findClientMeta!.mockResolvedValue({ isInternal: false, infradocId: 5 });
    taskConfigService.findOne!.mockResolvedValue({
      ondraOwnedHosts: ['srv1-cloud.ondravirtual.com.ar'],
    } as any);
    assetsService.getAssets!.mockResolvedValue([
      mockRawServer('srv1-cloud.ondravirtual.com.ar'),
      mockRawServer('srv-client.cliente.com'),
    ]);
    assetsService.getAssetInterfaces!.mockResolvedValue([]);

    const result = await service.getClientInfrastructure('client-id');

    expect(result.esxiHosts.map((h) => h.name)).toEqual(['srv-client.cliente.com']);
  });

  it('returns stub esxiHosts for ONDRA internal client without calling InfraDoc', async () => {
    clientsService.findClientMeta!.mockResolvedValue({ isInternal: true, infradocId: null });
    taskConfigService.findOne!.mockResolvedValue({
      ondraOwnedHosts: ['srv1-cloud.ondravirtual.com.ar'],
    } as any);

    const result = await service.getClientInfrastructure('ondra-id');

    expect(result.esxiHosts).toHaveLength(1);
    expect(result.esxiHosts[0].name).toBe('srv1-cloud.ondravirtual.com.ar');
    expect(result.windowsVMs).toEqual([]);
    expect(assetsService.getAssets).not.toHaveBeenCalled();
  });

  it('returns empty esxiHosts for ONDRA when ondraOwnedHosts not configured', async () => {
    clientsService.findClientMeta!.mockResolvedValue({ isInternal: true, infradocId: null });
    taskConfigService.findOne!.mockResolvedValue(null);

    const result = await service.getClientInfrastructure('ondra-id');

    expect(result.esxiHosts).toEqual([]);
  });
});
