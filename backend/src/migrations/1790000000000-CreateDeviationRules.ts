import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDeviationRules1790000000000 implements MigrationInterface {
  name = 'CreateDeviationRules1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."deviation_rules_operator_enum" AS ENUM(
        'gt', 'gte', 'lt', 'lte', 'eq'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "deviation_rules" (
        "id"                uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "task_type"         "public"."tasks_type_enum" NOT NULL,
        "signal_key"        varchar     NOT NULL,
        "operator"          "public"."deviation_rules_operator_enum" NOT NULL,
        "threshold_number"  numeric,
        "threshold_boolean" boolean,
        "enabled"           boolean     NOT NULL DEFAULT true,
        "helpdesk_team_id"  integer,
        "tag_ids"           integer[]   NOT NULL DEFAULT '{}',
        "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_deviation_rules" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_deviation_rules_task_signal" UNIQUE ("task_type", "signal_key")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "deviation_rules"`);
    await queryRunner.query(`DROP TYPE "public"."deviation_rules_operator_enum"`);
  }
}
