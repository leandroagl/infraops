import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnifiCronService } from './unifi-cron.service';
import { UnifiAlertsService } from './unifi-alerts.service';
import { UnifiAutoConfigService } from './unifi-auto-config.service';
import { UnifiTicket } from './entities/unifi-ticket.entity';
import { OdooService } from '../integrations/odoo/odoo.service';

describe('UnifiCronService', () => {
  let service: UnifiCronService;
  let alertsSvc: { getAlerts: jest.Mock };
  let autoConfigSvc: { get: jest.Mock };
  let odooSvc: { createDeviationTicket: jest.Mock };
  let ticketRepo: { find: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    alertsSvc = { getAlerts: jest.fn() };
    autoConfigSvc = { get: jest.fn() };
    odooSvc = { createDeviationTicket: jest.fn() };
    ticketRepo = { find: jest.fn().mockResolvedValue([]), save: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        UnifiCronService,
        { provide: UnifiAlertsService, useValue: alertsSvc },
        { provide: UnifiAutoConfigService, useValue: autoConfigSvc },
        { provide: OdooService, useValue: odooSvc },
        { provide: getRepositoryToken(UnifiTicket), useValue: ticketRepo },
      ],
    }).compile();
    service = module.get(UnifiCronService);
  });

  it('does nothing when auto-config is disabled', async () => {
    autoConfigSvc.get.mockResolvedValue({ enabled: false, severities: ['critical'], helpdeskTeamId: 1, tagIds: [] });
    await service.createPendingAlertTickets();
    expect(alertsSvc.getAlerts).not.toHaveBeenCalled();
    expect(odooSvc.createDeviationTicket).not.toHaveBeenCalled();
  });

  it('does nothing when helpdeskTeamId is null', async () => {
    autoConfigSvc.get.mockResolvedValue({ enabled: true, severities: ['critical'], helpdeskTeamId: null, tagIds: [] });
    await service.createPendingAlertTickets();
    expect(alertsSvc.getAlerts).not.toHaveBeenCalled();
  });

  it('skips alerts that already have a ticket', async () => {
    autoConfigSvc.get.mockResolvedValue({ enabled: true, severities: ['critical'], helpdeskTeamId: 5, tagIds: [] });
    alertsSvc.getAlerts.mockResolvedValue([{
      alertId: 'a1',
      severity: 'critical',
      siteId: 's1',
      clientId: 'c1',
      siteName: 'Site',
      clientName: 'ACME',
      type: 'gw_wan',
      message: 'WAN down',
      createdAt: '2024-01-01T00:00:00Z',
      odooTicketId: 42,
    }]);
    await service.createPendingAlertTickets();
    expect(odooSvc.createDeviationTicket).not.toHaveBeenCalled();
  });

  it('creates ticket for new critical alert without ticket', async () => {
    autoConfigSvc.get.mockResolvedValue({ enabled: true, severities: ['critical'], helpdeskTeamId: 5, tagIds: [1] });
    alertsSvc.getAlerts.mockResolvedValue([{
      alertId: 'a2',
      severity: 'critical',
      siteId: 's1',
      clientId: 'c1',
      siteName: 'Site',
      clientName: 'ACME',
      type: 'gw_wan',
      message: 'WAN down',
      createdAt: '2024-01-01T00:00:00Z',
      odooTicketId: null,
    }]);
    odooSvc.createDeviationTicket.mockResolvedValue(99);
    await service.createPendingAlertTickets();
    expect(odooSvc.createDeviationTicket).toHaveBeenCalledTimes(1);
    expect(ticketRepo.save).toHaveBeenCalledWith(expect.objectContaining({ alertId: 'a2', odooTicketId: 99 }));
  });
});
