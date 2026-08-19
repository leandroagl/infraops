import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTaskTypeConfig1787200000000 implements MigrationInterface {
  name = 'CreateTaskTypeConfig1787200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "task_type_config" (
        "task_type"             "public"."tasks_type_enum"  NOT NULL,
        "default_time_minutes"  integer,
        "odoo_tag_ids"          integer[]  NOT NULL DEFAULT '{}',
        "odoo_tag_names"        text[]     NOT NULL DEFAULT '{}',
        "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_task_type_config" PRIMARY KEY ("task_type")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "task_type_config"`);
  }
}
