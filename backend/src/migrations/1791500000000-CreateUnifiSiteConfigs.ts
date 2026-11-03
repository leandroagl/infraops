import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUnifiSiteConfigs1791500000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE unifi_site_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL,
        client_name VARCHAR NOT NULL DEFAULT '',
        site_id VARCHAR NOT NULL,
        site_name VARCHAR NOT NULL,
        is_enabled BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS unifi_site_configs');
  }
}
