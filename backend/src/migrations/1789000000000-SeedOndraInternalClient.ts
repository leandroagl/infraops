import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedOndraInternalClient1789000000000 implements MigrationInterface {
  name = 'SeedOndraInternalClient1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "clients" (id, name, "isInternal", "isActive", "isLead", "infradocId", "createdAt")
      SELECT gen_random_uuid(), 'ONDRA', true, true, false, NULL, NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM "clients" WHERE "isInternal" = true AND name = 'ONDRA'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "clients" WHERE "isInternal" = true AND name = 'ONDRA'`,
    );
  }
}
