import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { InfrastructureController } from './infrastructure.controller';
import { InfrastructureService } from './infrastructure.service';
import { ClientInfrastructureDto } from './dto/client-infrastructure.dto';

describe('InfrastructureController', () => {
  let controller: InfrastructureController;
  let infrastructureService: { getClientInfrastructure: jest.Mock };

  const makeInfrastructure = (): ClientInfrastructureDto => ({
    servers: [
      {
        assetId: 1,
        name: 'SRV-DC01',
        ip: '10.0.1.5',
        os: 'Windows Server 2019',
        model: 'Dell R640',
      },
    ],
    vms: [{ assetId: 2, name: 'VM-DC01', ip: null, os: null, model: null }],
    nas: [],
    routers: [
      {
        assetId: 3,
        name: 'MikroTik-01',
        ip: '10.0.1.1',
        os: null,
        model: 'CCR1009',
      },
    ],
  });

  beforeEach(async () => {
    infrastructureService = { getClientInfrastructure: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InfrastructureController],
      providers: [
        { provide: InfrastructureService, useValue: infrastructureService },
        { provide: JwtAuthGuard, useValue: { canActivate: () => true } },
      ],
    }).compile();

    controller = module.get<InfrastructureController>(InfrastructureController);
  });

  it('devuelve la infraestructura del cliente', async () => {
    const expected = makeInfrastructure();
    infrastructureService.getClientInfrastructure.mockResolvedValue(expected);

    const result = await controller.getClientInfrastructure('uuid-1');

    expect(result).toEqual(expected);
    expect(infrastructureService.getClientInfrastructure).toHaveBeenCalledWith(
      'uuid-1',
    );
  });

  it('propaga NotFoundException cuando el servicio la lanza', async () => {
    infrastructureService.getClientInfrastructure.mockRejectedValue(
      new NotFoundException('Cliente no encontrado'),
    );

    await expect(
      controller.getClientInfrastructure('uuid-no-existe'),
    ).rejects.toThrow(NotFoundException);
  });
});
