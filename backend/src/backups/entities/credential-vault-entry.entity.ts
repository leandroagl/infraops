import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('credential_vault_entries')
export class CredentialVaultEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', name: 'encrypted_password' })
  encryptedPassword: string;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;
}
