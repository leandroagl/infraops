import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropOdooCredentialsFromUser1786470000000 implements MigrationInterface {
  name = 'DropOdooCredentialsFromUser1786470000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "odoo_api_email",
        DROP COLUMN IF EXISTS "odoo_api_key_enc",
        DROP COLUMN IF EXISTS "odoo_key_valid",
        DROP COLUMN IF EXISTS "odoo_key_validated_at",
        DROP COLUMN IF EXISTS "odoo_exempt"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "odoo_api_email"        VARCHAR,
        ADD COLUMN IF NOT EXISTS "odoo_api_key_enc"      VARCHAR,
        ADD COLUMN IF NOT EXISTS "odoo_key_valid"        BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS "odoo_key_validated_at" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "odoo_exempt"           BOOLEAN NOT NULL DEFAULT FALSE
    `);
  }
}
