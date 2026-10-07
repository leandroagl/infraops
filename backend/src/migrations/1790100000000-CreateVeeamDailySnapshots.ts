import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVeeamDailySnapshots1790100000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE veeam_daily_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL,
        job_id VARCHAR NOT NULL,
        job_name VARCHAR NOT NULL,
        job_type VARCHAR NOT NULL,
        result VARCHAR,
        message TEXT,
        last_run_at TIMESTAMPTZ,
        hours_ago FLOAT,
        snapshot_date DATE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_veeam_snapshot UNIQUE (client_id, job_id, snapshot_date)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE veeam_daily_snapshots');
  }
}
