import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskIdToExpirationTickets1789800000000 implements MigrationInterface {
  name = 'AddTaskIdToExpirationTickets1789800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "expiration_tickets" ADD COLUMN IF NOT EXISTS "task_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "expiration_tickets" ADD CONSTRAINT "FK_expiration_tickets_task_id" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "expiration_tickets" DROP CONSTRAINT "FK_expiration_tickets_task_id"`);
    await queryRunner.query(`ALTER TABLE "expiration_tickets" DROP COLUMN "task_id"`);
  }
}
