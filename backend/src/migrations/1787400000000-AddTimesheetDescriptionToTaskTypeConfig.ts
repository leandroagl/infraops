import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTimesheetDescriptionToTaskTypeConfig1787400000000 implements MigrationInterface {
  name = 'AddTimesheetDescriptionToTaskTypeConfig1787400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "task_type_config"
      ADD COLUMN "timesheet_description" text DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "task_type_config"
      DROP COLUMN "timesheet_description"
    `);
  }
}
