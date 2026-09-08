import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOndraOwnedHostsToTaskConfig1788900000000 implements MigrationInterface {
  name = 'AddOndraOwnedHostsToTaskConfig1788900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task_type_config" ADD COLUMN "ondra_owned_hosts" text[] NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task_type_config" DROP COLUMN "ondra_owned_hosts"`,
    );
  }
}
