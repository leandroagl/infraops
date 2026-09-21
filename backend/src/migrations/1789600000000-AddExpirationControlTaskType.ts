import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExpirationControlTaskType1789600000000 implements MigrationInterface {
  name = 'AddExpirationControlTaskType1789600000000';
  transaction = false as const; // ALTER TYPE ADD VALUE no puede ejecutarse dentro de una transacción

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."tasks_type_enum" ADD VALUE IF NOT EXISTS 'EXPIRATION_CONTROL'`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL no soporta eliminar valores de un enum sin recrearlo.
    // El down se deja vacío intencionalmente.
  }
}
