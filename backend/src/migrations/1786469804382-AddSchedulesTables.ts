import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchedulesTables1786469804382 implements MigrationInterface {
  name = 'AddSchedulesTables1786469804382';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."schedule_group_enum" AS ENUM(
        'BIMONTHLY_ODD', 'BIMONTHLY_EVEN'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."rotation_config_frequency_enum" AS ENUM(
        'EVERY_GENERATION', 'EVERY_TWO_GENERATIONS'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "client_schedules" (
        "id"             uuid NOT NULL DEFAULT uuid_generate_v4(),
        "client_id"      uuid NOT NULL,
        "schedule_group" "public"."schedule_group_enum",
        "technician_id"  uuid,
        "is_active"      boolean NOT NULL DEFAULT true,
        "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_client_schedules_client_id" UNIQUE ("client_id"),
        CONSTRAINT "PK_client_schedules" PRIMARY KEY ("id"),
        CONSTRAINT "FK_client_schedules_client"
          FOREIGN KEY ("client_id") REFERENCES "clients"("id"),
        CONSTRAINT "FK_client_schedules_technician"
          FOREIGN KEY ("technician_id") REFERENCES "technicians"("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "rotation_config" (
        "id"                              uuid NOT NULL DEFAULT uuid_generate_v4(),
        "is_active"                       boolean NOT NULL DEFAULT false,
        "frequency"                       "public"."rotation_config_frequency_enum"
                                          NOT NULL DEFAULT 'EVERY_GENERATION',
        "generations_since_last_rotation" integer NOT NULL DEFAULT 0,
        "updated_at"                      TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rotation_config" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "rotation_config"`);
    await queryRunner.query(`DROP TABLE "client_schedules"`);
    await queryRunner.query(`DROP TYPE "public"."rotation_config_frequency_enum"`);
    await queryRunner.query(`DROP TYPE "public"."schedule_group_enum"`);
  }
}
