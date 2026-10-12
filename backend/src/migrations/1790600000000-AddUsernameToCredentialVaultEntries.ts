import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUsernameToCredentialVaultEntries1790600000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE credential_vault_entries
      ADD COLUMN username VARCHAR NOT NULL DEFAULT ''
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE credential_vault_entries
      DROP COLUMN username
    `);
  }
}
