import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefactorVeeamCredentialsToIntegrationConfig1790700000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Quitar FK y columna credential_vault_entry_id de veeam_client_configs
    await queryRunner.query(`
      ALTER TABLE veeam_client_configs
        DROP COLUMN IF EXISTS credential_vault_entry_id
    `);
    // 2. Quitar username y encrypted_password (ahora son globales en veeam_config)
    await queryRunner.query(`
      ALTER TABLE veeam_client_configs
        DROP COLUMN IF EXISTS username,
        DROP COLUMN IF EXISTS encrypted_password
    `);
    // 3. Eliminar la tabla de vault
    await queryRunner.query(`DROP TABLE IF EXISTS credential_vault_entries`);
    // 4. Crear tabla singleton veeam_config
    await queryRunner.query(`
      CREATE TABLE veeam_config (
        id INT PRIMARY KEY DEFAULT 1,
        username VARCHAR,
        password VARCHAR,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_by VARCHAR
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS veeam_config`);
    await queryRunner.query(`
      CREATE TABLE credential_vault_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        encrypted_password VARCHAR NOT NULL,
        username VARCHAR,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      ALTER TABLE veeam_client_configs
        ADD COLUMN username VARCHAR NOT NULL DEFAULT '',
        ADD COLUMN encrypted_password VARCHAR NOT NULL DEFAULT '',
        ADD COLUMN credential_vault_entry_id UUID
    `);
  }
}
