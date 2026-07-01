import { Test, TestingModule } from '@nestjs/testing';
import { BadGatewayException } from '@nestjs/common';
import { VmwareController } from './vmware.controller';
import { VmwareService } from './vmware.service';
import { VmwareHealthResult } from './dto/vmware-health-result.dto';

const MOCK_RESULT: VmwareHealthResult = {
  host: {
    name: 'esxi01', esxiVersion: 'VMware ESXi 7.0.3', uptimeHours: 100,
    cpuUsagePct: 20, memUsagePct: 50, memOvercommitRatio: 1.2,
    overallStatus: 'green', hardwareAlerts: [],
  },
  datastores: [],
  vms: { poweredOn: 3, poweredOff: 1, suspended: 0, snapshots: [], toolsNotOk: 0 },
  network: { vswitchErrors: [], nicsFailed: [] },
  collectedAt: '2026-06-29T00:00:00.000Z',
};

describe('VmwareController', () => {
  let controller: VmwareController;
  let vmwareService: { runHealthCheck: jest.Mock };

  beforeEach(async () => {
    vmwareService = { runHealthCheck: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VmwareController],
      providers: [{ provide: VmwareService, useValue: vmwareService }],
    }).compile();
    controller = module.get<VmwareController>(VmwareController);
  });

  it('llama a runHealthCheck con hostUri del body y retorna el resultado', async () => {
    vmwareService.runHealthCheck.mockResolvedValue(MOCK_RESULT);
    const result = await controller.healthCheck({ hostUri: '192.168.1.10:344' });
    expect(vmwareService.runHealthCheck).toHaveBeenCalledWith('192.168.1.10:344');
    expect(result).toEqual(MOCK_RESULT);
  });

  it('propaga BadGatewayException del service', async () => {
    vmwareService.runHealthCheck.mockRejectedValue(new BadGatewayException('Error'));
    await expect(controller.healthCheck({ hostUri: '192.168.1.10:344' }))
      .rejects.toThrow(BadGatewayException);
  });
});
