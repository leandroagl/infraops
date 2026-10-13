import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTicketTitleDescriptionToDeviationRules1790900000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE deviation_rules
        ADD COLUMN IF NOT EXISTS ticket_title TEXT DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS ticket_description TEXT DEFAULT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE maintenance_deviations
        ADD COLUMN IF NOT EXISTS ticket_title TEXT DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS ticket_description TEXT DEFAULT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE deviation_rules
        DROP COLUMN IF EXISTS ticket_title,
        DROP COLUMN IF EXISTS ticket_description
    `);
    await queryRunner.query(`
      ALTER TABLE maintenance_deviations
        DROP COLUMN IF EXISTS ticket_title,
        DROP COLUMN IF EXISTS ticket_description
    `);
  }
}
