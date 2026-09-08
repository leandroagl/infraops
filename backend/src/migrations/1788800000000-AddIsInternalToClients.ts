import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsInternalToClients1788800000000 implements MigrationInterface {
  name = 'AddIsInternalToClients1788800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "clients" ADD COLUMN "isInternal" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "clients" ALTER COLUMN "infradocId" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // NOTE: This rollback will fail if any client with is_internal=true exists
    // (their infradoc_id is NULL). Delete internal clients manually before
    // running this down migration, or handle the NOT NULL constraint separately.
    await queryRunner.query(
      `ALTER TABLE "clients" ALTER COLUMN "infradocId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "clients" DROP COLUMN "isInternal"`,
    );
  }
}
