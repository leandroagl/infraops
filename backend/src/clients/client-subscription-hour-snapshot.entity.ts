import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

const numericTransformer = {
  to: (v: number) => v,
  from: (v: string) => parseFloat(v),
};

@Entity('client_subscription_hour_snapshots')
@Unique(['clientId', 'year', 'month'])
export class ClientSubscriptionHourSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  clientId: string;

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'int' })
  month: number;

  @Column({ type: 'numeric', default: 0, transformer: numericTransformer })
  contracted: number;

  @Column({ type: 'numeric', default: 0, transformer: numericTransformer })
  delivered: number;

  @Column({ type: 'numeric', default: 0, transformer: numericTransformer })
  available: number;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  snapshotAt: Date;
}
