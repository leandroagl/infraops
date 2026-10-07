import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('veeam_client_configs')
export class VeeamClientConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'client_id' })
  clientId: string;

  @Column({ type: 'varchar', name: 'client_name', default: '' })
  clientName: string;

  @Column({ type: 'varchar' })
  host: string;

  @Column({ type: 'int', default: 9419 })
  port: number;

  @Column({ type: 'varchar' })
  username: string;

  @Column({ type: 'varchar', name: 'encrypted_password' })
  encryptedPassword: string;

  @Column({ type: 'boolean', name: 'is_enabled', default: true })
  isEnabled: boolean;

  @Column({ type: 'timestamptz', name: 'last_connected_at', nullable: true })
  lastConnectedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'now()' })
  updatedAt: Date;
}
