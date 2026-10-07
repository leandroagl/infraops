import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVeeamClientConfigs1790000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE veeam_client_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL,
        client_name VARCHAR NOT NULL DEFAULT '',
        host VARCHAR NOT NULL,
        port INTEGER NOT NULL DEFAULT 9419,
        username VARCHAR NOT NULL,
        encrypted_password VARCHAR NOT NULL,
        is_enabled BOOLEAN NOT NULL DEFAULT true,
        last_connected_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE veeam_client_configs');
  }
}
