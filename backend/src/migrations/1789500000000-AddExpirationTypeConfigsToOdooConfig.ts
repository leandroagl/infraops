import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExpirationTypeConfigsToOdooConfig1789500000000 implements MigrationInterface {
  name = 'AddExpirationTypeConfigsToOdooConfig1789500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "odoo_config" ADD COLUMN IF NOT EXISTS "expiration_type_configs" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "odoo_config" DROP COLUMN IF EXISTS "expiration_type_configs"`,
    );
  }
}
