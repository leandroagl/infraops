import { ConflictException, Injectable } from '@nestjs/common';
import { resolveUnifiModelName } from '../integrations/unifi/unifi-model-names';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnifiSitesService } from './unifi-sites.service';
import { UnifiService } from '../integrations/unifi/unifi.service';
import { UnifiLocalService } from '../integrations/unifi/unifi-local.service';
import { extractWanIssues } from '../integrations/unifi/unifi-wan-issues';
import { IntegrationConfigService } from '../integration-config/integration-config.service';
import { OdooService } from '../integrations/odoo/odoo.service';
import { UnifiTicket } from './entities/unifi-ticket.entity';
import { AlertWithTicketDto } from './dto/unifi-alert-response.dto';

@Injectable()
export class UnifiAlertsService {
  constructor(
    private readonly sitesSvc: UnifiSitesService,
    private readonly unifiSvc: UnifiService,
    private readonly unifiLocalSvc: UnifiLocalService,
    private readonly integrationCfg: IntegrationConfigService,
    private readonly odooSvc: OdooService,
    @InjectRepository(UnifiTicket)
    private readonly ticketRepo: Repository<UnifiTicket>,
  ) {}

  async getAlerts(): Promise<AlertWithTicketDto[]> {
    const sites = await this.sitesSvc.findEnabled();
    if (sites.length === 0) return [];

    const { apiKey } = await this.integrationCfg.getUnifiDecrypted();
    const [siteHostMap, allDevices, internetIssues] = await Promise.all([
      this.unifiSvc.getSiteHostMap(apiKey),
      this.unifiSvc.getAllDevices(apiKey),
      this.unifiSvc.getSiteInternetIssues(apiKey),
    ]);

    // contar todos los sites cloud por host (no solo los configurados) — si un host tiene
    // más de un site en la cloud, no podemos atribuir devices a sites específicos vía cloud API
    const hostSiteCount = new Map<string, number>();
    for (const hostId of siteHostMap.values()) {
      hostSiteCount.set(hostId, (hostSiteCount.get(hostId) ?? 0) + 1);
    }

    const localCfg = await this.integrationCfg.getUnifiLocalDecrypted();

    const alerts: AlertWithTicketDto[] = [];

    for (const site of sites) {
      const hostId = siteHostMap.get(site.siteId);
      if (!hostId) continue;

      // statistics.internetIssues viene por site, así que aplica también a hosts compartidos
      for (const issue of extractWanIssues(internetIssues.get(site.siteId), Date.now())) {
        const isDown = issue.type === 'wan_down';
        alerts.push({
          alertId: `${hostId}:${site.siteId}:${issue.type}:${issue.startIndex}`,
          siteId: site.siteId,
          siteName: site.siteName,
          clientId: site.clientId,
          clientName: site.clientName,
          severity: isDown ? 'critical' : 'high',
          type: issue.type,
          message: isDown
            ? 'Se detectó una caída de la conexión WAN'
            : 'Failover activo: el site está operando por el enlace WAN secundario',
          deviceName: isDown ? 'WAN caída' : 'WAN en failover',
          deviceModel: '',
          hostId,
          lastSeen: issue.lastSeen,
          odooTicketId: null,
        });
      }

      const sharedSites = hostSiteCount.get(hostId) ?? 0;

      if (sharedSites > 1) {
        // host compartido: usar API local si está configurada
        if (!localCfg.url) continue;
        try {
          const localSiteId = await this.unifiLocalSvc.findLocalSiteByName(localCfg.url, localCfg.apiKey, site.siteName);
          if (!localSiteId) continue;
          const offlineDevices = await this.unifiLocalSvc.getSiteDevices(localCfg.url, localCfg.apiKey, localSiteId);
          for (const device of offlineDevices) {
            alerts.push({
              alertId: `${hostId}:${device._id}:offline`,
              siteId: site.siteId,
              siteName: site.siteName,
              clientId: site.clientId,
              clientName: site.clientName,
              severity: 'high',
              type: 'device_offline',
              message: `El dispositivo "${device.name}" está offline`,
              deviceName: device.name,
              deviceModel: resolveUnifiModelName(device.model),
              hostId,
              lastSeen: new Date().toISOString(),
              odooTicketId: null,
            });
          }
        } catch {
          // si la API local falla para este site, lo saltamos silenciosamente
        }
        continue;
      }

      const hostData = allDevices.get(hostId);
      if (!hostData) continue;

      for (const device of hostData.devices) {
        if (device.status !== 'offline') continue;

        alerts.push({
          alertId: `${hostId}:${device.id}:offline`,
          siteId: site.siteId,
          siteName: site.siteName,
          clientId: site.clientId,
          clientName: site.clientName,
          severity: device.isConsole ? 'critical' : 'high',
          type: device.isConsole ? 'console_offline' : 'device_offline',
          message: device.isConsole
            ? `El controller "${device.name}" está offline`
            : `El dispositivo "${device.name}" está offline`,
          deviceName: device.name,
          deviceModel: device.model,
          hostId,
          lastSeen: hostData.updatedAt,
          odooTicketId: null,
        });
      }
    }

    const tickets = await this.ticketRepo.find();
    const ticketByAlertId = new Map(tickets.map(t => [t.alertId, t.odooTicketId]));

    return alerts.map(a => ({
      ...a,
      odooTicketId: ticketByAlertId.get(a.alertId) ?? null,
    }));
  }

  async debugAlertResolution(): Promise<unknown> {
    const sites = await this.sitesSvc.findEnabled();
    if (sites.length === 0) return { sites: [] };
    const { apiKey } = await this.integrationCfg.getUnifiDecrypted();
    const [siteHostMap, allDevices] = await Promise.all([
      this.unifiSvc.getSiteHostMap(apiKey),
      this.unifiSvc.getAllDevices(apiKey),
    ]);
    const hostSiteCount = new Map<string, number>();
    for (const hostId of siteHostMap.values()) {
      hostSiteCount.set(hostId, (hostSiteCount.get(hostId) ?? 0) + 1);
    }
    return sites.map(site => {
      const hostId = siteHostMap.get(site.siteId);
      const hostData = hostId ? allDevices.get(hostId) : undefined;
      const sharedSites = hostId ? (hostSiteCount.get(hostId) ?? 0) : 0;
      const offlineDevices = hostData?.devices.filter(d => d.status === 'offline').map(d => ({ id: d.id, name: d.name, model: d.model, isConsole: d.isConsole })) ?? [];
      return {
        clientName: site.clientName,
        siteName: site.siteName,
        siteId: site.siteId,
        hostId: hostId ?? 'NOT FOUND IN /ea/sites',
        hostFoundInDevices: !!hostData,
        sharedSites,
        skippedReason: !hostId ? 'no hostId' : sharedSites > 1 ? `host compartido con ${sharedSites} sites` : null,
        offlineDevices,
      };
    });
  }

  async debugLocalResolution(): Promise<unknown> {
    const localCfg = await this.integrationCfg.getUnifiLocalDecrypted();
    if (!localCfg.url) return { error: 'Local server URL not configured' };

    // mostrar todos los sites del servidor local para diagnóstico de nombre
    let localSites: unknown[] = [];
    try {
      localSites = await this.unifiLocalSvc.getLocalSites(localCfg.url, localCfg.apiKey);
    } catch (e) {
      return { error: `Error al obtener sites del servidor local: ${(e as Error).message}` };
    }

    const sites = await this.sitesSvc.findEnabled();
    const { apiKey } = await this.integrationCfg.getUnifiDecrypted();
    const siteHostMap = await this.unifiSvc.getSiteHostMap(apiKey);

    const hostSiteCount = new Map<string, number>();
    for (const hostId of siteHostMap.values()) {
      hostSiteCount.set(hostId, (hostSiteCount.get(hostId) ?? 0) + 1);
    }

    const results: unknown[] = [];
    for (const site of sites) {
      const hostId = siteHostMap.get(site.siteId);
      if (!hostId || (hostSiteCount.get(hostId) ?? 0) <= 1) continue;

      let localSiteId: string | null = null;
      let offlineDevices: unknown[] = [];
      let rawDevices: unknown[] = [];
      let error: string | null = null;

      try {
        localSiteId = await this.unifiLocalSvc.findLocalSiteByName(localCfg.url, localCfg.apiKey, site.siteName);
        if (localSiteId) {
          const devs = await this.unifiLocalSvc.getSiteDevices(localCfg.url, localCfg.apiKey, localSiteId);
          offlineDevices = devs.map(d => ({ _id: d._id, name: d.name, model: d.model, state: d.state }));
          rawDevices = devs;
        }
      } catch (e) {
        error = (e as Error).message;
      }

      results.push({
        clientName: site.clientName,
        siteName: site.siteName,
        searchedName: site.siteName,
        localSiteId,
        offlineDeviceCount: offlineDevices.length,
        offlineDevices,
        error,
      });
    }
    return { localSites, results };
  }

  async getRawPath(path: string, params?: Record<string, string>): Promise<unknown> {
    const { apiKey } = await this.integrationCfg.getUnifiDecrypted();
    return this.unifiSvc.getRawPath(apiKey, path, params);
  }

  async getRawLocalPath(path: string): Promise<unknown> {
    const { url, apiKey } = await this.integrationCfg.getUnifiLocalDecrypted();
    if (!url) return { error: 'Local server URL not configured' };
    return this.unifiLocalSvc.getRawPath(url, apiKey, path);
  }

  async createManualTicket(
    alertId: string,
    siteId: string,
    clientId: string,
    helpdeskTeamId: number,
    tagIds: number[],
  ): Promise<{ odooTicketId: number }> {
    const existing = await this.ticketRepo.findOne({ where: { alertId } });
    if (existing) throw new ConflictException('Esta alerta ya tiene un ticket de Odoo asociado');

    const odooTicketId = await this.odooSvc.createDeviationTicket(
      clientId,
      helpdeskTeamId,
      tagIds,
      `[UniFi] Dispositivo offline — ${alertId}`,
      `Alerta UniFi ID: ${alertId}\nSite: ${siteId}`,
    );

    await this.ticketRepo.save({ alertId, siteId, clientId, odooTicketId, createdAt: new Date() });
    return { odooTicketId };
  }
}
