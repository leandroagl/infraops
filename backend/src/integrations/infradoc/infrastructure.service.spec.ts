import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ClientsService } from '../../clients/clients.service';
import { InfradocAssetsService, RawInfradocAsset } from './infradoc-assets.service';
import { InfrastructureService } from './infrastructure.service';

describe('InfrastructureService', () => {
  let service: InfrastructureService;
  let clientsService: { findInfradocId: jest.Mock };
  let infradocAssetsService: { getAssets: jest.Mock; getAssetInterfaces: jest.Mock };

  const makeAsset = (override: Partial<RawInfradocAsset> = {}): RawInfradocAsset => ({
    asset_id:          '1',
    asset_name:        'host1.kemini',
    asset_type:        'Server',
    asset_make:        'HPE',
    asset_description: null,
    interface_ip:      '192.168.0.104',
    interface_name:    null,
    asset_os:          'VMware ESXi 7.0.0',
    asset_model:       'ProLiant DL380 Gen10',
    ...override,
  } as RawInfradocAsset);

  beforeEach(async () => {
    clientsService        = { findInfradocId: jest.fn().mockResolvedValue(42) };
    infradocAssetsService = {
      getAssets:          jest.fn().mockResolvedValue([]),
      getAssetInterfaces: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InfrastructureService,
        { provide: ClientsService,        useValue: clientsService },
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

    expect(clientsService.findInfradocId).toHaveBeenCalledWith('uuid-1');
    expect(infradocAssetsService.getAssets).toHaveBeenCalledWith(99);
  });

  it('agrupa hosts ESXi (asset_type=Server) en esxiHosts', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([
      makeAsset({ asset_id: '2', asset_name: 'host1.kemini', asset_type: 'Server', asset_os: 'VMware ESXi 7.0.0' }),
    ]);

    const result = await service.getClientInfrastructure('uuid-1');

    expect(result.esxiHosts).toHaveLength(1);
    expect(result.esxiHosts[0]).toEqual({
      assetId: 2,
      name:    'host1.kemini',
      ip:      '192.168.0.104',
      bmcIp:   null,
      bmcType: null,
      os:      'VMware ESXi 7.0.0',
      model:   'ProLiant DL380 Gen10',
    });
    expect(result.windowsVMs).toHaveLength(0);
    expect(result.nas).toHaveLength(0);
    expect(result.routers).toHaveLength(0);
  });

  it('agrupa Virtual Machine con Windows Server SIN description DC en windowsVMs', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([
      makeAsset({ asset_id: '3', asset_name: 'SRV-FILE', asset_type: 'Virtual Machine', asset_os: 'Windows Server 2019', asset_make: null, asset_description: null }),
      makeAsset({ asset_id: '4', asset_name: 'SRV-APP',  asset_type: 'Virtual Machine', asset_os: 'Windows Server 2022', asset_make: null, asset_description: '' }),
    ]);

    const result = await service.getClientInfrastructure('uuid-1');

    expect(result.windowsVMs).toHaveLength(2);
    expect(result.windowsVMs[0].name).toBe('SRV-FILE');
    expect(result.windowsVMs[1].name).toBe('SRV-APP');
    expect(result.domainControllers).toHaveLength(0);
  });

  it('ignora Virtual Machine con Windows 10 (no es Windows Server)', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([
      makeAsset({ asset_id: '5', asset_name: 'SOPORTE NEO', asset_type: 'Virtual Machine', asset_os: 'Windows 10 Pro', asset_make: null }),
    ]);

    const result = await service.getClientInfrastructure('uuid-1');

    expect(result.windowsVMs).toHaveLength(0);
    expect(result.esxiHosts).toHaveLength(0);
  });

  it('agrupa QNAP (asset_type=Other, asset_make=QNAP) en nas', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([
      makeAsset({ asset_id: '10', asset_name: 'QNAP', asset_type: 'Other', asset_make: 'QNAP', asset_os: null }),
    ]);

    const result = await service.getClientInfrastructure('uuid-1');

    expect(result.nas).toHaveLength(1);
    expect(result.nas[0].name).toBe('QNAP');
    expect(result.windowsVMs).toHaveLength(0);
  });

  it('agrupa Firewall/Router en routers', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([
      makeAsset({ asset_id: '1', asset_name: 'MikroTik MASTER', asset_type: 'Firewall/Router', asset_os: null }),
      makeAsset({ asset_id: '2', asset_name: 'MikroTik BACKUP', asset_type: 'Firewall/Router', asset_os: null }),
    ]);

    const result = await service.getClientInfrastructure('uuid-1');

    expect(result.routers).toHaveLength(2);
    expect(result.routers[0].name).toBe('MikroTik MASTER');
    expect(result.routers[1].name).toBe('MikroTik BACKUP');
  });

  it('devuelve arrays vacíos para categorías sin assets', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([]);

    const result = await service.getClientInfrastructure('uuid-1');

    expect(result.esxiHosts).toEqual([]);
    expect(result.windowsVMs).toEqual([]);
    expect(result.nas).toEqual([]);
    expect(result.routers).toEqual([]);
  });

  it('ignora assets de tipo desconocido sin lanzar error', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([
      makeAsset({ asset_type: 'Access Point' }),
      makeAsset({ asset_type: 'Printer' }),
    ]);

    const result = await service.getClientInfrastructure('uuid-1');

    expect(result.esxiHosts).toHaveLength(0);
    expect(result.windowsVMs).toHaveLength(0);
    expect(result.nas).toHaveLength(0);
    expect(result.routers).toHaveLength(0);
  });

  it('mapea ip, os y model como null cuando InfraDoc devuelve null', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([
      makeAsset({ interface_ip: null, asset_os: null, asset_model: null }),
    ]);

    const result = await service.getClientInfrastructure('uuid-1');

    expect(result.esxiHosts[0].ip).toBeNull();
    expect(result.esxiHosts[0].bmcIp).toBeNull();
    expect(result.esxiHosts[0].bmcType).toBeNull();
    expect(result.esxiHosts[0].os).toBeNull();
    expect(result.esxiHosts[0].model).toBeNull();
  });

  it('normaliza ip, os y model a null cuando InfraDoc devuelve string vacío', async () => {
    infradocAssetsService.getAssets.mockResolvedValue([
      makeAsset({ interface_ip: '', asset_os: '', asset_model: '' }),
    ]);

    const result = await service.getClientInfrastructure('uuid-1');

    expect(result.esxiHosts[0].ip).toBeNull();
    expect(result.esxiHosts[0].bmcIp).toBeNull();
    expect(result.esxiHosts[0].bmcType).toBeNull();
    expect(result.esxiHosts[0].os).toBeNull();
    expect(result.esxiHosts[0].model).toBeNull();
  });

  describe('BMC resolution', () => {
    it('llama a getAssetInterfaces para cada servidor físico', async () => {
      infradocAssetsService.getAssets.mockResolvedValue([
        makeAsset({ asset_id: '2', asset_type: 'Server' }),
        makeAsset({ asset_id: '3', asset_type: 'Server' }),
      ]);

      await service.getClientInfrastructure('uuid-1');

      expect(infradocAssetsService.getAssetInterfaces).toHaveBeenCalledTimes(2);
      expect(infradocAssetsService.getAssetInterfaces).toHaveBeenCalledWith(2);
      expect(infradocAssetsService.getAssetInterfaces).toHaveBeenCalledWith(3);
    });

    it('NO llama a getAssetInterfaces para Virtual Machines ni NAS ni Routers', async () => {
      infradocAssetsService.getAssets.mockResolvedValue([
        makeAsset({ asset_id: '3', asset_type: 'Virtual Machine', asset_os: 'Windows Server 2019', asset_make: null }),
        makeAsset({ asset_id: '10', asset_type: 'Other', asset_make: 'QNAP', asset_os: null }),
        makeAsset({ asset_id: '1', asset_type: 'Firewall/Router', asset_os: null }),
      ]);

      await service.getClientInfrastructure('uuid-1');

      expect(infradocAssetsService.getAssetInterfaces).not.toHaveBeenCalled();
    });

    it('popula bmcIp y bmcType cuando existe interfaz iLO', async () => {
      infradocAssetsService.getAssets.mockResolvedValue([
        makeAsset({ asset_id: '2', asset_type: 'Server' }),
      ]);
      infradocAssetsService.getAssetInterfaces.mockResolvedValue([
        makeAsset({ interface_name: 'VMware',  interface_ip: '192.168.0.104' }),
        makeAsset({ interface_name: 'iLO',     interface_ip: '192.168.0.200' }),
      ]);

      const result = await service.getClientInfrastructure('uuid-1');

      expect(result.esxiHosts[0].bmcIp).toBe('192.168.0.200');
      expect(result.esxiHosts[0].bmcType).toBe('iLO');
    });

    it('popula bmcIp y bmcType cuando existe interfaz iDRAC', async () => {
      infradocAssetsService.getAssets.mockResolvedValue([
        makeAsset({ asset_id: '5', asset_type: 'Server' }),
      ]);
      infradocAssetsService.getAssetInterfaces.mockResolvedValue([
        makeAsset({ interface_name: 'iDRAC', interface_ip: '10.0.0.50' }),
      ]);

      const result = await service.getClientInfrastructure('uuid-1');

      expect(result.esxiHosts[0].bmcIp).toBe('10.0.0.50');
      expect(result.esxiHosts[0].bmcType).toBe('iDRAC');
    });

    it('popula bmcIp y bmcType cuando existe interfaz xClarity (case-insensitive)', async () => {
      infradocAssetsService.getAssets.mockResolvedValue([
        makeAsset({ asset_id: '6', asset_type: 'Server' }),
      ]);
      infradocAssetsService.getAssetInterfaces.mockResolvedValue([
        makeAsset({ interface_name: 'XClarity', interface_ip: '10.0.1.99' }),
      ]);

      const result = await service.getClientInfrastructure('uuid-1');

      expect(result.esxiHosts[0].bmcIp).toBe('10.0.1.99');
      expect(result.esxiHosts[0].bmcType).toBe('XClarity');
    });

    it('devuelve bmcIp null y bmcType null cuando no hay interfaz BMC', async () => {
      infradocAssetsService.getAssets.mockResolvedValue([
        makeAsset({ asset_id: '7', asset_type: 'Server' }),
      ]);
      infradocAssetsService.getAssetInterfaces.mockResolvedValue([
        makeAsset({ interface_name: 'VMware', interface_ip: '192.168.0.104' }),
      ]);

      const result = await service.getClientInfrastructure('uuid-1');

      expect(result.esxiHosts[0].bmcIp).toBeNull();
      expect(result.esxiHosts[0].bmcType).toBeNull();
    });

    it('devuelve bmcIp null cuando la interfaz BMC existe pero no tiene IP', async () => {
      infradocAssetsService.getAssets.mockResolvedValue([
        makeAsset({ asset_id: '8', asset_type: 'Server' }),
      ]);
      infradocAssetsService.getAssetInterfaces.mockResolvedValue([
        makeAsset({ interface_name: 'iLO', interface_ip: null }),
      ]);

      const result = await service.getClientInfrastructure('uuid-1');

      expect(result.esxiHosts[0].bmcIp).toBeNull();
      expect(result.esxiHosts[0].bmcType).toBe('iLO'); // type preserved even without IP
    });

    it('devuelve bmcIp null cuando getAssetInterfaces falla (degradación graceful)', async () => {
      infradocAssetsService.getAssets.mockResolvedValue([
        makeAsset({ asset_id: '10', asset_type: 'Server' }),
      ]);
      infradocAssetsService.getAssetInterfaces.mockRejectedValue(
        new Error('InfraDoc timeout'),
      );

      const result = await service.getClientInfrastructure('uuid-1');

      expect(result.esxiHosts).toHaveLength(1);
      expect(result.esxiHosts[0].bmcIp).toBeNull();
      expect(result.esxiHosts[0].bmcType).toBeNull();
    });

    it('toma la primera interfaz BMC cuando hay múltiples coincidencias', async () => {
      infradocAssetsService.getAssets.mockResolvedValue([
        makeAsset({ asset_id: '9', asset_type: 'Server' }),
      ]);
      infradocAssetsService.getAssetInterfaces.mockResolvedValue([
        makeAsset({ interface_name: 'iLO', interface_ip: '10.0.0.1' }),
        makeAsset({ interface_name: 'iLO-2', interface_ip: '10.0.0.2' }),
      ]);

      const result = await service.getClientInfrastructure('uuid-1');

      expect(result.esxiHosts[0].bmcIp).toBe('10.0.0.1');
    });
  });

  describe('domain controller detection', () => {
    it('mueve VM con description "Domain Controller" a domainControllers', async () => {
      infradocAssetsService.getAssets.mockResolvedValue([
        makeAsset({
          asset_id: '5', asset_name: 'DC01',
          asset_type: 'Virtual Machine', asset_os: 'Windows Server 2022',
          asset_make: null, asset_description: 'Domain Controller',
        }),
      ]);

      const result = await service.getClientInfrastructure('uuid-1');

      expect(result.domainControllers).toHaveLength(1);
      expect(result.domainControllers[0].name).toBe('DC01');
      expect(result.windowsVMs).toHaveLength(0);
    });

    it('detecta DC con description en minúsculas', async () => {
      infradocAssetsService.getAssets.mockResolvedValue([
        makeAsset({
          asset_id: '6', asset_name: 'DC02',
          asset_type: 'Virtual Machine', asset_os: 'Windows Server 2019',
          asset_make: null, asset_description: 'domain controller - Primary',
        }),
      ]);

      const result = await service.getClientInfrastructure('uuid-1');

      expect(result.domainControllers).toHaveLength(1);
      expect(result.domainControllers[0].name).toBe('DC02');
      expect(result.windowsVMs).toHaveLength(0);
    });

    it('separa correctamente DCs y VMs no-DC cuando ambos están presentes', async () => {
      infradocAssetsService.getAssets.mockResolvedValue([
        makeAsset({ asset_id: '3', asset_name: 'SRV-FILE', asset_type: 'Virtual Machine', asset_os: 'Windows Server 2019', asset_make: null, asset_description: null }),
        makeAsset({ asset_id: '5', asset_name: 'DC01',     asset_type: 'Virtual Machine', asset_os: 'Windows Server 2022', asset_make: null, asset_description: 'Domain Controller' }),
      ]);

      const result = await service.getClientInfrastructure('uuid-1');

      expect(result.windowsVMs).toHaveLength(1);
      expect(result.windowsVMs[0].name).toBe('SRV-FILE');
      expect(result.domainControllers).toHaveLength(1);
      expect(result.domainControllers[0].name).toBe('DC01');
    });

    it('domainControllers es array vacío cuando no hay DCs', async () => {
      infradocAssetsService.getAssets.mockResolvedValue([]);

      const result = await service.getClientInfrastructure('uuid-1');

      expect(result.domainControllers).toEqual([]);
    });
  });
});
