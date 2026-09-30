import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMaintenanceDeviations1790100000000 implements MigrationInterface {
  name = 'CreateMaintenanceDeviations1790100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."maintenance_deviations_status_enum" AS ENUM(
        'PENDING', 'CONFIRMED', 'DISMISSED'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "maintenance_deviations" (
        "id"                    uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "log_id"                uuid        NOT NULL,
        "task_id"               uuid        NOT NULL,
        "rule_id"               uuid,
        "task_type"             "public"."tasks_type_enum" NOT NULL,
        "signal_key"            varchar     NOT NULL,
        "operator"              "public"."deviation_rules_operator_enum" NOT NULL,
        "threshold_number"      numeric,
        "threshold_boolean"     boolean,
        "detected_value_number" numeric,
        "detected_value_boolean" boolean,
        "helpdesk_team_id"      integer,
        "tag_ids"               integer[]   NOT NULL DEFAULT '{}',
        "status"                "public"."maintenance_deviations_status_enum" NOT NULL DEFAULT 'PENDING',
        "detected_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),
        "resolved_at"           TIMESTAMPTZ,
        "resolved_by_user_id"   uuid,
        "odoo_ticket_id"        integer,
        CONSTRAINT "PK_maintenance_deviations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_maintenance_deviations_log_signal" UNIQUE ("log_id", "signal_key"),
        CONSTRAINT "FK_maintenance_deviations_log"
          FOREIGN KEY ("log_id") REFERENCES "maintenance_logs" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_maintenance_deviations_task"
          FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_maintenance_deviations_rule"
          FOREIGN KEY ("rule_id") REFERENCES "deviation_rules" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_maintenance_deviations_resolved_by"
          FOREIGN KEY ("resolved_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "maintenance_deviations"`);
    await queryRunner.query(`DROP TYPE "public"."maintenance_deviations_status_enum"`);
  }
}
