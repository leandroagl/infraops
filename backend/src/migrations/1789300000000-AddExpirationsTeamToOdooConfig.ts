import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExpirationsTeamToOdooConfig1789300000000 implements MigrationInterface {
  name = 'AddExpirationsTeamToOdooConfig1789300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "odoo_config" ADD COLUMN "expirations_helpdesk_team_id" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "odoo_config" DROP COLUMN "expirations_helpdesk_team_id"`);
  }
}
