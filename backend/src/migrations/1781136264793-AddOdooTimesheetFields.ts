import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOdooTimesheetFields1781136264793 implements MigrationInterface {
  name = 'AddOdooTimesheetFields1781136264793';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "odoo_employee_id" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "clients" ADD "odoo_sale_line_id" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "clients" DROP COLUMN "odoo_sale_line_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "odoo_employee_id"`,
    );
  }
}
