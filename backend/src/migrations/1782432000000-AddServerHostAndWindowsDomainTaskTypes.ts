import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddServerHostAndWindowsDomainTaskTypes1782432000000 implements MigrationInterface {
  name = 'AddServerHostAndWindowsDomainTaskTypes1782432000000';
  transaction = false as const;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."tasks_type_enum" ADD VALUE IF NOT EXISTS 'SERVER_HOST_MAINTENANCE'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."tasks_type_enum" ADD VALUE IF NOT EXISTS 'WINDOWS_DOMAIN_MAINTENANCE'`,
    );
    await queryRunner.query(
      `UPDATE tasks SET type = 'WINDOWS_DOMAIN_MAINTENANCE' WHERE type = 'SERVER_MAINTENANCE'`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL no soporta eliminar valores de un enum sin recrearlo.
  }
}
