import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('unifi_site_configs')
export class UnifiSiteConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'client_id', type: 'uuid' })
  clientId: string;

  @Column({ name: 'client_name', type: 'varchar', default: '' })
  clientName: string;

  @Column({ name: 'site_id', type: 'varchar' })
  siteId: string;

  @Column({ name: 'site_name', type: 'varchar' })
  siteName: string;

  @Column({ name: 'is_enabled', type: 'boolean', default: true })
  isEnabled: boolean;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
