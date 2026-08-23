import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTicketDescriptionToTaskTypeConfig1787300000000 implements MigrationInterface {
  name = 'AddTicketDescriptionToTaskTypeConfig1787300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "task_type_config"
      ADD COLUMN "ticket_description" text DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "task_type_config"
      DROP COLUMN "ticket_description"
    `);
  }
}
