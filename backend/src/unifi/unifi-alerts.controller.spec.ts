import { Test } from '@nestjs/testing';
import { UnifiAlertsController } from './unifi-alerts.controller';
import { UnifiAlertsService } from './unifi-alerts.service';

describe('UnifiAlertsController', () => {
  let controller: UnifiAlertsController;
  const svc = { getAlerts: jest.fn(), createManualTicket: jest.fn() };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [UnifiAlertsController],
      providers: [{ provide: UnifiAlertsService, useValue: svc }],
    }).compile();
    controller = module.get(UnifiAlertsController);
  });

  it('getAlerts returns service result', async () => {
    svc.getAlerts.mockResolvedValue([]);
    expect(await controller.getAlerts()).toEqual([]);
  });

  it('createTicket delegates to service with correct params', async () => {
    svc.createManualTicket.mockResolvedValue({ odooTicketId: 5 });
    const result = await controller.createTicket('alert-1', { helpdeskTeamId: 1, tagIds: [], clientId: 'c1', siteId: 's1' });
    expect(result.odooTicketId).toBe(5);
    expect(svc.createManualTicket).toHaveBeenCalledWith('alert-1', 's1', 'c1', 1, []);
  });
});
