import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterTasksTechnicianIdNullable1789700000000 implements MigrationInterface {
  name = 'AlterTasksTechnicianIdNullable1789700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" ALTER COLUMN "technician_id" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" ALTER COLUMN "technician_id" SET NOT NULL`);
  }
}
