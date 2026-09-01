import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStageNamesToOdooConfig1788700000000 implements MigrationInterface {
  name = 'AddStageNamesToOdooConfig1788700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "odoo_config" ADD COLUMN "stage_in_progress_name" varchar`);
    await queryRunner.query(`ALTER TABLE "odoo_config" ADD COLUMN "stage_not_done_name"    varchar`);
    await queryRunner.query(`ALTER TABLE "odoo_config" ADD COLUMN "stage_done_name"        varchar`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "odoo_config" DROP COLUMN "stage_done_name"`);
    await queryRunner.query(`ALTER TABLE "odoo_config" DROP COLUMN "stage_not_done_name"`);
    await queryRunner.query(`ALTER TABLE "odoo_config" DROP COLUMN "stage_in_progress_name"`);
  }
}
