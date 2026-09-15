import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import type { ExpirationType } from './dto/expiration-item.dto';

@Entity('expiration_tickets')
@Unique(['type', 'sourceId', 'expireDate'])
export class ExpirationTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  type: ExpirationType;

  @Column({ type: 'varchar' })
  sourceId: string;

  @Column({ type: 'date' })
  expireDate: string;

  @Column({ type: 'uuid' })
  clientId: string;

  @Column({ type: 'int', nullable: true })
  odooTicketId: number | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
