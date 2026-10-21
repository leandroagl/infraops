import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('unifi_tickets')
export class UnifiTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'alert_id', type: 'varchar' })
  alertId: string;

  @Column({ name: 'site_id', type: 'varchar' })
  siteId: string;

  @Column({ name: 'client_id', type: 'uuid' })
  clientId: string;

  @Column({ name: 'odoo_ticket_id', type: 'int' })
  odooTicketId: number;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
