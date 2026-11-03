import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnifiAlertsService } from './unifi-alerts.service';
import { UnifiAutoConfigService } from './unifi-auto-config.service';
import { UnifiTicket } from './entities/unifi-ticket.entity';
import { OdooService } from '../integrations/odoo/odoo.service';

@Injectable()
export class UnifiCronService {
  private readonly logger = new Logger(UnifiCronService.name);

  constructor(
    private readonly alertsSvc: UnifiAlertsService,
    private readonly autoConfigSvc: UnifiAutoConfigService,
    private readonly odooSvc: OdooService,
    @InjectRepository(UnifiTicket)
    private readonly ticketRepo: Repository<UnifiTicket>,
  ) {}

  @Cron('0 8 * * *')
  async createPendingAlertTickets(): Promise<void> {
    try {
      const cfg = await this.autoConfigSvc.get();
      if (!cfg.enabled || !cfg.helpdeskTeamId) {
        this.logger.log('createPendingAlertTickets: auto-config deshabilitado o sin equipo, omitiendo');
        return;
      }

      const alerts = await this.alertsSvc.getAlerts();
      const pending = alerts.filter(
        a => a.odooTicketId === null && cfg.severities.includes(a.severity),
      );

      let created = 0;
      let errors = 0;

      for (const alert of pending) {
        try {
          const odooTicketId = await this.odooSvc.createDeviationTicket(
            alert.clientId,
            cfg.helpdeskTeamId!,
            cfg.tagIds,
            `[UniFi] ${alert.type} — ${alert.clientName}`,
            `Cliente: ${alert.clientName}\nSite: ${alert.siteName}\nMensaje: ${alert.message}\nAlerta ID: ${alert.alertId}`,
          );
          await this.ticketRepo.save({
            alertId: alert.alertId,
            siteId: alert.siteId,
            clientId: alert.clientId,
            odooTicketId,
            createdAt: new Date(),
          });
          created++;
        } catch (err) {
          this.logger.error(`Error creando ticket para alerta ${alert.alertId}: ${(err as Error).message}`);
          errors++;
        }
      }

      this.logger.log(`createPendingAlertTickets: ${created} creados, ${errors} errores`);
    } catch (err) {
      this.logger.error(`createPendingAlertTickets falló: ${(err as Error).message}`);
    }
  }
}
