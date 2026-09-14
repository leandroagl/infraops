import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from './notifications.service';
import { ExpirationTicket } from './expiration-ticket.entity';
import { ExpirationItemDto } from './dto/expiration-item.dto';

@Injectable()
export class ExpirationTicketsService {
  constructor(
    private readonly notificationsService: NotificationsService,
    @InjectRepository(ExpirationTicket)
    private readonly ticketRepo: Repository<ExpirationTicket>,
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

  private key(type: string, sourceId: string, expireDate: string): string {
    return `${type}|${sourceId}|${expireDate}`;
  }
}
