import { Test, TestingModule } from '@nestjs/testing';
import { ClientServicesController } from './client-services.controller';
import { OdooService } from './odoo.service';
import { ClientActiveServicesDto } from './dto/client-active-services.dto';

describe('ClientServicesController', () => {
  let controller: ClientServicesController;
  let odooService: { getClientActiveServices: jest.Mock };

  beforeEach(async () => {
    odooService = { getClientActiveServices: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClientServicesController],
      providers: [{ provide: OdooService, useValue: odooService }],
    }).compile();

    controller = module.get<ClientServicesController>(ClientServicesController);
  });

  it('llama a odooService.getClientActiveServices y devuelve el resultado', async () => {
    const mockData: ClientActiveServicesDto[] = [
      { clientId: 'c1', services: [{ name: 'Hosting', active: true }] },
    ];
    odooService.getClientActiveServices.mockResolvedValue(mockData);

    const result = await controller.getAll();

    expect(odooService.getClientActiveServices).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockData);
  });

  it('retorna [] cuando no hay clientes con servicios', async () => {
    odooService.getClientActiveServices.mockResolvedValue([]);

    const result = await controller.getAll();

    expect(result).toEqual([]);
  });
});
