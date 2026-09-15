import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExpirationsTicketFieldsToOdooConfig1789400000000 implements MigrationInterface {
  name = 'AddExpirationsTicketFieldsToOdooConfig1789400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "odoo_config" ADD COLUMN IF NOT EXISTS "expirations_ticket_days_ahead" integer DEFAULT 30`);
    await queryRunner.query(`ALTER TABLE "odoo_config" ADD COLUMN IF NOT EXISTS "expirations_tag_ids" text DEFAULT '[]'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "odoo_config" DROP COLUMN IF EXISTS "expirations_ticket_days_ahead"`);
    await queryRunner.query(`ALTER TABLE "odoo_config" DROP COLUMN IF EXISTS "expirations_tag_ids"`);
  }
}
