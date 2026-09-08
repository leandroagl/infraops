import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionHoursController } from './subscription-hours.controller';
import { OdooService } from './odoo.service';
import { ClientSubscriptionHoursDto } from './dto/client-subscription-hours.dto';

describe('SubscriptionHoursController', () => {
  let controller: SubscriptionHoursController;
  let odooService: { getClientSubscriptionHours: jest.Mock };

  beforeEach(async () => {
    odooService = { getClientSubscriptionHours: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionHoursController],
      providers: [{ provide: OdooService, useValue: odooService }],
    }).compile();

    controller = module.get<SubscriptionHoursController>(SubscriptionHoursController);
  });

  it('llama a odooService.getClientSubscriptionHours y devuelve el resultado', async () => {
    const mockData: ClientSubscriptionHoursDto[] = [
      { clientId: 'c1', contracted: 20, delivered: 8, available: 12 },
    ];
    odooService.getClientSubscriptionHours.mockResolvedValue(mockData);

    const result = await controller.getAll({});

    expect(odooService.getClientSubscriptionHours).toHaveBeenCalled();
    expect(result).toEqual(mockData);
  });

  it('llama getClientSubscriptionHours sin params cuando no se pasan query params', async () => {
    odooService.getClientSubscriptionHours.mockResolvedValue([]);
    await controller.getAll({});
    expect(odooService.getClientSubscriptionHours).toHaveBeenCalledWith(undefined, undefined);
  });

  it('llama getClientSubscriptionHours con month y year cuando se pasan query params', async () => {
    odooService.getClientSubscriptionHours.mockResolvedValue([]);
    await controller.getAll({ month: 9, year: 2026 });
    expect(odooService.getClientSubscriptionHours).toHaveBeenCalledWith(9, 2026);
  });
});
