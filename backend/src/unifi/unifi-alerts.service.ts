import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnifiSitesService } from './unifi-sites.service';
import { UnifiService } from '../integrations/unifi/unifi.service';
import { IntegrationConfigService } from '../integration-config/integration-config.service';
import { OdooService } from '../integrations/odoo/odoo.service';
import { UnifiTicket } from './entities/unifi-ticket.entity';
import { AlertWithTicketDto } from './dto/unifi-alert-response.dto';

@Injectable()
export class UnifiAlertsService {
  constructor(
    private readonly sitesSvc: UnifiSitesService,
    private readonly unifiSvc: UnifiService,
    private readonly integrationCfg: IntegrationConfigService,
    private readonly odooSvc: OdooService,
    @InjectRepository(UnifiTicket)
    private readonly ticketRepo: Repository<UnifiTicket>,
  ) {}

  async getAlerts(): Promise<AlertWithTicketDto[]> {
    const sites = await this.sitesSvc.findEnabled();
    if (sites.length === 0) return [];
    const { apiKey } = await this.integrationCfg.getUnifiDecrypted();

    const alerts = (
      await Promise.all(
        sites.map(async site => {
          const raw = await this.unifiSvc.getSiteAlerts(site.siteId, apiKey);
          return raw.map(a => ({ ...a, siteName: site.siteName, clientId: site.clientId, clientName: site.clientName }));
        }),
      )
    ).flat();

    const tickets = await this.ticketRepo.find();
    const ticketByAlertId = new Map(tickets.map(t => [t.alertId, t.odooTicketId]));

    return alerts.map(a => ({
      ...a,
      odooTicketId: ticketByAlertId.get(a.alertId) ?? null,
    }));
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
      `[UniFi] Alerta de red — ${alertId}`,
      `Alerta UniFi ID: ${alertId}\nSite: ${siteId}`,
    );

    await this.ticketRepo.save({ alertId, siteId, clientId, odooTicketId, createdAt: new Date() });
    return { odooTicketId };
  }
}
