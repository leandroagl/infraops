import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIntegrationConfigTables1788600000000 implements MigrationInterface {
  name = 'CreateIntegrationConfigTables1788600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "odoo_config" (
        "id"               integer     NOT NULL DEFAULT 1,
        "url"              varchar,
        "db"               varchar,
        "username"         varchar,
        "api_key"          varchar,
        "helpdesk_team_id" integer,
        "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_by"       varchar,
        CONSTRAINT "PK_odoo_config"        PRIMARY KEY ("id"),
        CONSTRAINT "CK_odoo_config_single" CHECK ("id" = 1)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "infradoc_config" (
        "id"         integer     NOT NULL DEFAULT 1,
        "url"        varchar,
        "api_key"    varchar,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_by" varchar,
        CONSTRAINT "PK_infradoc_config"        PRIMARY KEY ("id"),
        CONSTRAINT "CK_infradoc_config_single" CHECK ("id" = 1)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "vmware_config" (
        "id"         integer     NOT NULL DEFAULT 1,
        "username"   varchar,
        "password"   varchar,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_by" varchar,
        CONSTRAINT "PK_vmware_config"        PRIMARY KEY ("id"),
        CONSTRAINT "CK_vmware_config_single" CHECK ("id" = 1)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "vmware_config"`);
    await queryRunner.query(`DROP TABLE "infradoc_config"`);
    await queryRunner.query(`DROP TABLE "odoo_config"`);
  }
}
