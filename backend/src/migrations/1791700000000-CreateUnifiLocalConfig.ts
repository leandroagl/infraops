import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUnifiLocalConfig1791700000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE unifi_local_config (
        id INT PRIMARY KEY DEFAULT 1,
        url VARCHAR,
        api_key VARCHAR,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_by VARCHAR
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS unifi_local_config`);
  }
}
