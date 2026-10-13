import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateJetbackupConfig1791000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE jetbackup_config (
        id INT PRIMARY KEY DEFAULT 1,
        url VARCHAR,
        username VARCHAR NOT NULL DEFAULT 'root',
        api_key VARCHAR,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_by VARCHAR
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS jetbackup_config`);
  }
}
