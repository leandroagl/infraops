import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsInternalToClients1788800000000 implements MigrationInterface {
  name = 'AddIsInternalToClients1788800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "clients" ADD COLUMN "is_internal" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "clients" ALTER COLUMN "infradoc_id" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "clients" ALTER COLUMN "infradoc_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "clients" DROP COLUMN "is_internal"`,
    );
  }
}
