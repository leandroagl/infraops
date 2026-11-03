import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { UnifiAlertsService } from './unifi-alerts.service';
import { UnifiSitesService } from './unifi-sites.service';
import { UnifiTicket } from './entities/unifi-ticket.entity';
import { UnifiService } from '../integrations/unifi/unifi.service';
import { UnifiLocalService } from '../integrations/unifi/unifi-local.service';
import { IntegrationConfigService } from '../integration-config/integration-config.service';
import { OdooService } from '../integrations/odoo/odoo.service';

const SITE = { id: 'sc1', siteId: 'site-1', siteName: 'Oficina', clientId: 'c1', clientName: 'ACME', isEnabled: true };
const ONLINE_DEVICE = { id: 'DEV1', mac: 'DEV1', name: 'AP Sala', model: 'U7 Pro', ip: '10.0.0.2', status: 'online', version: '8.0', firmwareStatus: 'upToDate', isConsole: false, isManaged: true };
const OFFLINE_AP = { ...ONLINE_DEVICE, id: 'DEV2', mac: 'DEV2', name: 'AP Sala', status: 'offline', isConsole: false };
const OFFLINE_CONSOLE = { id: 'CON1', mac: 'CON1', name: 'UDM Pro', model: 'UDM', ip: '10.0.0.1', status: 'offline', version: '3.0', firmwareStatus: 'upToDate', isConsole: true, isManaged: true };

describe('UnifiAlertsService', () => {
  let service: UnifiAlertsService;
  let sitesSvc: { findEnabled: jest.Mock };
  let unifiSvc: { getSiteHostMap: jest.Mock; getAllDevices: jest.Mock; getSiteInternetIssues: jest.Mock };
  let unifiLocalSvc: { findLocalSiteByName: jest.Mock; getSiteDevices: jest.Mock };
  let integrationCfg: { getUnifiDecrypted: jest.Mock; getUnifiLocalDecrypted: jest.Mock };
  let odooSvc: { createDeviationTicket: jest.Mock };
  let ticketRepo: { find: jest.Mock; findOne: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    sitesSvc = { findEnabled: jest.fn() };
    unifiSvc = {
      getSiteHostMap: jest.fn(),
      getAllDevices: jest.fn(),
      getSiteInternetIssues: jest.fn().mockResolvedValue(new Map()),
    };
    unifiLocalSvc = { findLocalSiteByName: jest.fn(), getSiteDevices: jest.fn() };
    integrationCfg = {
      getUnifiDecrypted: jest.fn().mockResolvedValue({ apiKey: 'key' }),
      getUnifiLocalDecrypted: jest.fn().mockResolvedValue({ url: '', apiKey: '' }),
    };
    odooSvc = { createDeviationTicket: jest.fn() };
    ticketRepo = { find: jest.fn().mockResolvedValue([]), findOne: jest.fn(), save: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        UnifiAlertsService,
        { provide: UnifiSitesService, useValue: sitesSvc },
        { provide: UnifiService, useValue: unifiSvc },
        { provide: UnifiLocalService, useValue: unifiLocalSvc },
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
    expect(unifiSvc.getSiteHostMap).not.toHaveBeenCalled();
    expect(unifiSvc.getAllDevices).not.toHaveBeenCalled();
  });

  it('getAlerts returns empty array when all devices are online', async () => {
    sitesSvc.findEnabled.mockResolvedValue([SITE]);
    unifiSvc.getSiteHostMap.mockResolvedValue(new Map([['site-1', 'host-A']]));
    unifiSvc.getAllDevices.mockResolvedValue(new Map([['host-A', { devices: [ONLINE_DEVICE], updatedAt: '2026-10-21T10:00:00Z' }]]));
    const result = await service.getAlerts();
    expect(result).toEqual([]);
  });

  it('getAlerts generates device_offline alert for offline non-console device', async () => {
    sitesSvc.findEnabled.mockResolvedValue([SITE]);
    unifiSvc.getSiteHostMap.mockResolvedValue(new Map([['site-1', 'host-A']]));
    unifiSvc.getAllDevices.mockResolvedValue(new Map([['host-A', { devices: [OFFLINE_AP], updatedAt: '2026-10-21T10:00:00Z' }]]));
    const result = await service.getAlerts();
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('device_offline');
    expect(result[0].severity).toBe('high');
    expect(result[0].clientName).toBe('ACME');
    expect(result[0].deviceName).toBe('AP Sala');
    expect(result[0].alertId).toBe('host-A:DEV2:offline');
  });

  it('getAlerts generates console_offline alert with critical severity', async () => {
    sitesSvc.findEnabled.mockResolvedValue([SITE]);
    unifiSvc.getSiteHostMap.mockResolvedValue(new Map([['site-1', 'host-A']]));
    unifiSvc.getAllDevices.mockResolvedValue(new Map([['host-A', { devices: [OFFLINE_CONSOLE], updatedAt: '2026-10-21T10:00:00Z' }]]));
    const result = await service.getAlerts();
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('console_offline');
    expect(result[0].severity).toBe('critical');
    expect(result[0].alertId).toBe('host-A:CON1:offline');
  });

  it('getAlerts skips site when hostId not found in site-host map', async () => {
    sitesSvc.findEnabled.mockResolvedValue([SITE]);
    unifiSvc.getSiteHostMap.mockResolvedValue(new Map());
    unifiSvc.getAllDevices.mockResolvedValue(new Map());
    const result = await service.getAlerts();
    expect(result).toEqual([]);
  });

  it('getAlerts skips cloud devices when the host has multiple sites in the cloud (even if only one is configured)', async () => {
    // solo SITE está configurado, pero el host tiene 2 sites en la cloud
    sitesSvc.findEnabled.mockResolvedValue([SITE]);
    // siteHostMap incluye también el site no configurado ('site-2')
    unifiSvc.getSiteHostMap.mockResolvedValue(new Map([['site-1', 'host-shared'], ['site-2', 'host-shared']]));
    unifiSvc.getAllDevices.mockResolvedValue(new Map([['host-shared', { devices: [OFFLINE_AP], updatedAt: '2026-10-21T10:00:00Z' }]]));
    // sin local config → salta el site silenciosamente
    integrationCfg.getUnifiLocalDecrypted.mockResolvedValue({ url: '', apiKey: '' });
    const result = await service.getAlerts();
    expect(result).toEqual([]);
  });

  it('getAlerts enriches alerts with existing ticket info', async () => {
    sitesSvc.findEnabled.mockResolvedValue([SITE]);
    unifiSvc.getSiteHostMap.mockResolvedValue(new Map([['site-1', 'host-A']]));
    unifiSvc.getAllDevices.mockResolvedValue(new Map([['host-A', { devices: [OFFLINE_AP], updatedAt: '2026-10-21T10:00:00Z' }]]));
    ticketRepo.find.mockResolvedValue([{ alertId: 'host-A:DEV2:offline', odooTicketId: 42 }]);
    const result = await service.getAlerts();
    expect(result[0].odooTicketId).toBe(42);
  });

  describe('WAN alerts', () => {
    const nowIndex = () => Math.floor(Date.now() / (5 * 60 * 1000));

    beforeEach(() => {
      sitesSvc.findEnabled.mockResolvedValue([SITE]);
      unifiSvc.getSiteHostMap.mockResolvedValue(new Map([['site-1', 'host-A']]));
      unifiSvc.getAllDevices.mockResolvedValue(new Map([['host-A', { devices: [ONLINE_DEVICE], updatedAt: '2026-10-21T10:00:00Z' }]]));
    });

    it('generates a critical wan_down alert for a recent wanDowntime run', async () => {
      const start = nowIndex() - 6;
      unifiSvc.getSiteInternetIssues.mockResolvedValue(new Map([['site-1', [{ index: start, count: 3, wanDowntime: true }]]]));
      const result = await service.getAlerts();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: 'wan_down',
        severity: 'critical',
        clientName: 'ACME',
        siteId: 'site-1',
        hostId: 'host-A',
        alertId: `host-A:site-1:wan_down:${start}`,
        odooTicketId: null,
      });
    });

    it('generates a high wan_failover alert for a failover-only run', async () => {
      const start = nowIndex() - 2;
      unifiSvc.getSiteInternetIssues.mockResolvedValue(new Map([['site-1', [{ index: start, wan2FailoverActive: true }]]]));
      const result = await service.getAlerts();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ type: 'wan_failover', severity: 'high', alertId: `host-A:site-1:wan_failover:${start}` });
    });

    it('ignores runs older than 24 hours', async () => {
      const start = nowIndex() - 24 * 12 - 5;
      unifiSvc.getSiteInternetIssues.mockResolvedValue(new Map([['site-1', [{ index: start, wanDowntime: true }]]]));
      expect(await service.getAlerts()).toEqual([]);
    });

    it('generates WAN alerts for sites on a shared host without needing the local API', async () => {
      const start = nowIndex() - 2;
      unifiSvc.getSiteHostMap.mockResolvedValue(new Map([['site-1', 'host-shared'], ['site-2', 'host-shared']]));
      unifiSvc.getSiteInternetIssues.mockResolvedValue(new Map([['site-1', [{ index: start, wanDowntime: true }]]]));
      const result = await service.getAlerts();
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('wan_down');
    });

    it('combines WAN alerts with device alerts', async () => {
      unifiSvc.getAllDevices.mockResolvedValue(new Map([['host-A', { devices: [OFFLINE_AP], updatedAt: '2026-10-21T10:00:00Z' }]]));
      unifiSvc.getSiteInternetIssues.mockResolvedValue(new Map([['site-1', [{ index: nowIndex() - 2, wanDowntime: true }]]]));
      const result = await service.getAlerts();
      expect(result.map(a => a.type).sort()).toEqual(['device_offline', 'wan_down']);
    });

    it('enriches WAN alerts with existing ticket info', async () => {
      const start = nowIndex() - 2;
      unifiSvc.getSiteInternetIssues.mockResolvedValue(new Map([['site-1', [{ index: start, wanDowntime: true }]]]));
      ticketRepo.find.mockResolvedValue([{ alertId: `host-A:site-1:wan_down:${start}`, odooTicketId: 77 }]);
      const result = await service.getAlerts();
      expect(result[0].odooTicketId).toBe(77);
    });

    it('skips WAN alerts for sites without a known host', async () => {
      unifiSvc.getSiteHostMap.mockResolvedValue(new Map());
      unifiSvc.getSiteInternetIssues.mockResolvedValue(new Map([['site-1', [{ index: nowIndex() - 2, wanDowntime: true }]]]));
      expect(await service.getAlerts()).toEqual([]);
    });
  });

  it('createManualTicket throws ConflictException when ticket already exists', async () => {
    ticketRepo.findOne.mockResolvedValue({ alertId: 'a1', odooTicketId: 99 });
    await expect(service.createManualTicket('a1', 'site-1', 'c1', 1, [])).rejects.toThrow(ConflictException);
  });

  it('getAlerts uses local API for shared-host site when local config is set', async () => {
    // solo SITE está configurado, pero el host tiene 2 sites en la cloud (site-2 no configurado)
    sitesSvc.findEnabled.mockResolvedValue([SITE]);
    unifiSvc.getSiteHostMap.mockResolvedValue(new Map([['site-1', 'host-shared'], ['site-2', 'host-shared']]));
    unifiSvc.getAllDevices.mockResolvedValue(new Map([['host-shared', { devices: [OFFLINE_AP], updatedAt: '2026-10-21T10:00:00Z' }]]));
    integrationCfg.getUnifiLocalDecrypted.mockResolvedValue({ url: 'https://local.server', apiKey: 'local-key' });
    unifiLocalSvc.findLocalSiteByName.mockResolvedValueOnce('local-shortname');
    unifiLocalSvc.getSiteDevices.mockResolvedValueOnce([
      { _id: 'LOC1', mac: 'aa:bb:cc', name: 'AP Local', model: 'U6', ip: '10.0.0.5', state: 0 },
    ]);
    const result = await service.getAlerts();
    expect(result).toHaveLength(1);
    expect(result[0].deviceName).toBe('AP Local');
    expect(result[0].siteId).toBe('site-1');
    expect(result[0].severity).toBe('high');
    expect(result[0].type).toBe('device_offline');
  });

  it('getAlerts resuelve SKU codes conocidos de la API local a nombres legibles', async () => {
    sitesSvc.findEnabled.mockResolvedValue([SITE]);
    unifiSvc.getSiteHostMap.mockResolvedValue(new Map([['site-1', 'host-shared'], ['site-2', 'host-shared']]));
    unifiSvc.getAllDevices.mockResolvedValue(new Map([['host-shared', { devices: [], updatedAt: '2026-10-21T10:00:00Z' }]]));
    integrationCfg.getUnifiLocalDecrypted.mockResolvedValue({ url: 'https://local.server', apiKey: 'local-key' });
    unifiLocalSvc.findLocalSiteByName.mockResolvedValueOnce('local-shortname');
    unifiLocalSvc.getSiteDevices.mockResolvedValueOnce([
      { _id: 'LOC1', mac: 'aa:bb:cc:00:11:22', name: 'AP Pasillo', model: 'UAL6', ip: '10.0.0.5', state: 0 },
    ]);
    const result = await service.getAlerts();
    expect(result[0].deviceModel).toBe('U6 Lite');
  });

  it('getAlerts muestra el SKU code tal cual cuando no está en la tabla de nombres', async () => {
    sitesSvc.findEnabled.mockResolvedValue([SITE]);
    unifiSvc.getSiteHostMap.mockResolvedValue(new Map([['site-1', 'host-shared'], ['site-2', 'host-shared']]));
    unifiSvc.getAllDevices.mockResolvedValue(new Map([['host-shared', { devices: [], updatedAt: '2026-10-21T10:00:00Z' }]]));
    integrationCfg.getUnifiLocalDecrypted.mockResolvedValue({ url: 'https://local.server', apiKey: 'local-key' });
    unifiLocalSvc.findLocalSiteByName.mockResolvedValueOnce('local-shortname');
    unifiLocalSvc.getSiteDevices.mockResolvedValueOnce([
      { _id: 'LOC2', mac: 'ff:ff:ff:00:00:01', name: 'AP Sala', model: 'UNKNOWN_XYZ', ip: '10.0.0.6', state: 0 },
    ]);
    const result = await service.getAlerts();
    expect(result[0].deviceModel).toBe('UNKNOWN_XYZ');
  });

  it('getAlerts skips shared-host site when local server URL is not configured', async () => {
    sitesSvc.findEnabled.mockResolvedValue([SITE]);
    // site-2 no configurado pero en el mismo host → sharedSites = 2
    unifiSvc.getSiteHostMap.mockResolvedValue(new Map([['site-1', 'host-shared'], ['site-2', 'host-shared']]));
    unifiSvc.getAllDevices.mockResolvedValue(new Map());
    // local config has no URL
    integrationCfg.getUnifiLocalDecrypted.mockResolvedValue({ url: '', apiKey: '' });
    const result = await service.getAlerts();
    expect(result).toEqual([]);
    expect(unifiLocalSvc.findLocalSiteByName).not.toHaveBeenCalled();
  });
});
