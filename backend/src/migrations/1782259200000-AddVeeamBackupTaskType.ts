import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVeeamBackupTaskType1782259200000 implements MigrationInterface {
  name = 'AddVeeamBackupTaskType1782259200000';
  transaction = false as const; // ALTER TYPE ADD VALUE no puede ejecutarse dentro de una transacción

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."tasks_type_enum" ADD VALUE IF NOT EXISTS 'VEEAM_BACKUP'`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL no soporta eliminar valores de un enum sin recrearlo.
    // El down se deja vacío intencionalmente.
  }
}
