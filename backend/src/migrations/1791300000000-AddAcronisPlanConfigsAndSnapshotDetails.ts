import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAcronisPlanConfigsAndSnapshotDetails1791300000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE acronis_plan_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL,
        client_name VARCHAR NOT NULL DEFAULT '',
        policy_id VARCHAR NOT NULL UNIQUE,
        policy_name VARCHAR NOT NULL,
        tenant_name VARCHAR NOT NULL DEFAULT '',
        is_enabled BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_acronis_plan_configs_client ON acronis_plan_configs (client_id)`);
    // Desglose por recurso ({ items, aggregate }) para que el fallback por snapshot no lo pierda.
    await queryRunner.query(`ALTER TABLE veeam_daily_snapshots ADD COLUMN details JSONB`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM veeam_daily_snapshots WHERE provider = 'ACRONIS'`);
    await queryRunner.query(`ALTER TABLE veeam_daily_snapshots DROP COLUMN details`);
    await queryRunner.query(`DROP TABLE IF EXISTS acronis_plan_configs`);
  }
}
