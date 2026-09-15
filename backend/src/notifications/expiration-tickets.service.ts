import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from './notifications.service';
import { ExpirationTicket } from './expiration-ticket.entity';
import { ExpirationItemDto } from './dto/expiration-item.dto';
import { OdooService } from '../integrations/odoo/odoo.service';
import { IntegrationConfigService } from '../integration-config/integration-config.service';
import { Client } from '../clients/client.entity';

@Injectable()
export class ExpirationTicketsService {
  private readonly logger = new Logger(ExpirationTicketsService.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly odooService: OdooService,
    private readonly integrationConfigService: IntegrationConfigService,
    @InjectRepository(ExpirationTicket)
    private readonly ticketRepo: Repository<ExpirationTicket>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  async getExpirationsWithTickets(days?: number): Promise<ExpirationItemDto[]> {
    const items = await this.notificationsService.getExpirations(days);
    if (items.length === 0) return items;

    const rows = await this.ticketRepo.find();
    const byKey = new Map(
      rows.map((r) => [this.key(r.type, r.sourceId, r.expireDate), r]),
    );

    return items.map((item) => {
      const row = byKey.get(this.key(item.type, item.sourceId, item.expireDate));
      return row?.odooTicketId != null
        ? { ...item, odooTicketId: row.odooTicketId }
        : item;
    });
  }

  @Cron('0 8 * * *')
  async createPendingExpirationTickets(): Promise<void> {
    const config = await this.integrationConfigService.getOdooConfigDecrypted();

    if (!config.expirationsHelpdeskTeamId) {
      this.logger.warn('createPendingExpirationTickets: expirationsHelpdeskTeamId no configurado, omitiendo');
      return;
    }

    const daysAhead = config.expirationsTicketDaysAhead ?? 30;
    const items = await this.notificationsService.getExpirations(daysAhead);

    const existingRows = await this.ticketRepo.find();
    const existingKeys = new Set(
      existingRows.map((r) => this.key(r.type, r.sourceId, r.expireDate)),
    );

    let created = 0;
    let errors = 0;

    for (const item of items) {
      if (existingKeys.has(this.key(item.type, item.sourceId, item.expireDate))) continue;

      const client = await this.clientRepo.findOne({ where: { infradocId: item.clientId } });
      if (!client) {
        this.logger.warn(`Cliente InfraDoc ${item.clientId} no encontrado en InfraOps — omitiendo`);
        errors++;
        continue;
      }

      try {
        const odooTicketId = await this.odooService.createExpirationTicket(item, client.id);
        await this.ticketRepo.save({
          type: item.type,
          sourceId: item.sourceId,
          expireDate: item.expireDate,
          clientId: client.id,
          odooTicketId,
        });
        created++;
      } catch (err: unknown) {
        this.logger.error(
          `Error creando ticket para ${item.type} ${item.sourceId}: ${(err as Error).message}`,
        );
        errors++;
      }
    }

    this.logger.log(`createPendingExpirationTickets: ${created} creados, ${errors} errores`);
  }

  private key(type: string, sourceId: string, expireDate: string): string {
    return `${type}|${sourceId}|${expireDate}`;
  }
}
