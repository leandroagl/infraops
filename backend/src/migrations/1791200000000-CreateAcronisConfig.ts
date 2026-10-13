import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAcronisConfig1791200000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE acronis_config (
        id INT PRIMARY KEY DEFAULT 1,
        base_url VARCHAR,
        client_id VARCHAR,
        client_secret VARCHAR,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_by VARCHAR
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS acronis_config`);
  }
}
