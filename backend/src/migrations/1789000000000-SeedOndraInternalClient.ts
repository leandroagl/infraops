import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedOndraInternalClient1789000000000 implements MigrationInterface {
  name = 'SeedOndraInternalClient1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "clients" (id, name, is_internal, is_active, is_lead, infradoc_id, created_at)
      SELECT gen_random_uuid(), 'ONDRA', true, true, false, NULL, NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM "clients" WHERE is_internal = true AND name = 'ONDRA'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "clients" WHERE is_internal = true AND name = 'ONDRA'`,
    );
  }
}
