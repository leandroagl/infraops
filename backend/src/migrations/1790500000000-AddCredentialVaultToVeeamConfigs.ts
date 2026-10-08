import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCredentialVaultToVeeamConfigs1790500000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE veeam_client_configs
        ADD COLUMN credential_vault_entry_id UUID REFERENCES credential_vault_entries(id) ON DELETE SET NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE veeam_client_configs DROP COLUMN credential_vault_entry_id
    `);
  }
}
