import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { UnifiAlertsService } from './unifi-alerts.service';
import { UnifiSitesService } from './unifi-sites.service';
import { UnifiTicket } from './entities/unifi-ticket.entity';
import { UnifiService } from '../integrations/unifi/unifi.service';
import { IntegrationConfigService } from '../integration-config/integration-config.service';
import { OdooService } from '../integrations/odoo/odoo.service';

describe('UnifiAlertsService', () => {
  let service: UnifiAlertsService;
  let sitesSvc: { findEnabled: jest.Mock };
  let unifiSvc: { getSiteAlerts: jest.Mock };
  let integrationCfg: { getUnifiDecrypted: jest.Mock };
  let odooSvc: { createDeviationTicket: jest.Mock };
  let ticketRepo: { find: jest.Mock; findOne: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    sitesSvc = { findEnabled: jest.fn() };
    unifiSvc = { getSiteAlerts: jest.fn() };
    integrationCfg = { getUnifiDecrypted: jest.fn().mockResolvedValue({ apiKey: 'key' }) };
    odooSvc = { createDeviationTicket: jest.fn() };
    ticketRepo = { find: jest.fn().mockResolvedValue([]), findOne: jest.fn(), save: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        UnifiAlertsService,
        { provide: UnifiSitesService, useValue: sitesSvc },
        { provide: UnifiService, useValue: unifiSvc },
        { provide: IntegrationConfigService, useValue: integrationCfg },
        { provide: OdooService, useValue: odooSvc },
        { provide: getRepositoryToken(UnifiTicket), useValue: ticketRepo },
      ],
    }).compile();
    service = module.get(UnifiAlertsService);
  });

  it('getAlerts returns empty array when no enabled sites', async () => {
    sitesSvc.findEnabled.mockResolvedValue([]);
    const result = await service.getAlerts();
    expect(result).toEqual([]);
    expect(unifiSvc.getSiteAlerts).not.toHaveBeenCalled();
  });

  it('getAlerts enriches alerts with ticket info', async () => {
    sitesSvc.findEnabled.mockResolvedValue([{ id: 'sc1', siteId: 'site-1', siteName: 'Oficina', clientId: 'c1', clientName: 'ACME', isEnabled: true }]);
    unifiSvc.getSiteAlerts.mockResolvedValue([{ alertId: 'a1', siteId: 'site-1', type: 'gw_wan', severity: 'critical', message: 'WAN down', createdAt: '2024-01-01T00:00:00Z' }]);
    ticketRepo.find.mockResolvedValue([{ alertId: 'a1', odooTicketId: 42 }]);
    const result = await service.getAlerts();
    expect(result).toHaveLength(1);
    expect(result[0].odooTicketId).toBe(42);
    expect(result[0].clientName).toBe('ACME');
  });

  it('createManualTicket throws ConflictException when ticket already exists', async () => {
    ticketRepo.findOne.mockResolvedValue({ alertId: 'a1', odooTicketId: 99 });
    await expect(service.createManualTicket('a1', 'site-1', 'c1', 1, [])).rejects.toThrow(ConflictException);
  });
});
