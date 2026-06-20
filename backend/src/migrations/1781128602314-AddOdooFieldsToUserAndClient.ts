import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOdooFieldsToUserAndClient1781128602314 implements MigrationInterface {
  name = 'AddOdooFieldsToUserAndClient1781128602314';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "odoo_user_id" integer`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "odoo_synced_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "clients" ADD "odooPartnerId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "clients" ADD "odooSyncedAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN "odooSyncedAt"`);
    await queryRunner.query(
      `ALTER TABLE "clients" DROP COLUMN "odooPartnerId"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "odoo_synced_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "odoo_user_id"`);
  }
}
