import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAvatarPathToUser1787500000000 implements MigrationInterface {
  name = 'AddAvatarPathToUser1787500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "avatar_path" character varying DEFAULT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatar_path"`);
  }
}
