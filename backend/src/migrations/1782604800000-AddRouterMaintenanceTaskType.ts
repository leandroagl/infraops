import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRouterMaintenanceTaskType1782604800000 implements MigrationInterface {
  name = 'AddRouterMaintenanceTaskType1782604800000';
  transaction = false as const;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."tasks_type_enum" ADD VALUE IF NOT EXISTS 'ROUTER_MAINTENANCE'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL no permite eliminar valores de un enum
  }
}
