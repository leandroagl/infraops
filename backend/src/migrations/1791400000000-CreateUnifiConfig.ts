import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUnifiConfig1791400000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE unifi_config (
        id INT PRIMARY KEY DEFAULT 1,
        api_key VARCHAR,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_by VARCHAR
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS unifi_config`);
  }
}
