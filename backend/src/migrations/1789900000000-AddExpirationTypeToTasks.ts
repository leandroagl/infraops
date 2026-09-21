import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExpirationTypeToTasks1789900000000 implements MigrationInterface {
  name = 'AddExpirationTypeToTasks1789900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "expiration_type" varchar`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "expiration_type"`);
  }
}
