import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRouterMaintenanceTaskType1782604800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE task_type_enum ADD VALUE IF NOT EXISTS 'ROUTER_MAINTENANCE'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL no permite eliminar valores de un enum
  }
}
