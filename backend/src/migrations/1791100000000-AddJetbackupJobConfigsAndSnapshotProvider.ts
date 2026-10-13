import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddJetbackupJobConfigsAndSnapshotProvider1791100000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE jetbackup_job_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL,
        client_name VARCHAR NOT NULL DEFAULT '',
        job_id VARCHAR NOT NULL UNIQUE,
        job_name VARCHAR NOT NULL,
        is_enabled BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_jetbackup_job_configs_client ON jetbackup_job_configs (client_id)`);

    // Los snapshots pasan a ser de ambos proveedores: el job_id de JetBackup no puede chocar con el de Veeam.
    await queryRunner.query(`ALTER TABLE veeam_daily_snapshots ADD COLUMN provider VARCHAR NOT NULL DEFAULT 'VEEAM'`);
    await queryRunner.query(`ALTER TABLE veeam_daily_snapshots DROP CONSTRAINT uq_veeam_snapshot`);
    await queryRunner.query(`
      ALTER TABLE veeam_daily_snapshots
        ADD CONSTRAINT uq_veeam_snapshot UNIQUE (client_id, provider, job_id, snapshot_date)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM veeam_daily_snapshots WHERE provider <> 'VEEAM'`);
    await queryRunner.query(`ALTER TABLE veeam_daily_snapshots DROP CONSTRAINT uq_veeam_snapshot`);
    await queryRunner.query(`
      ALTER TABLE veeam_daily_snapshots
        ADD CONSTRAINT uq_veeam_snapshot UNIQUE (client_id, job_id, snapshot_date)
    `);
    await queryRunner.query(`ALTER TABLE veeam_daily_snapshots DROP COLUMN provider`);
    await queryRunner.query(`DROP TABLE IF EXISTS jetbackup_job_configs`);
  }
}
