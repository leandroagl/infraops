import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1781100461468 implements MigrationInterface {
    name = 'InitialSchema1781100461468'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "technicians" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b14514b23605f79475be53065b3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('ADMIN', 'TL', 'TECHNICIAN', 'COORDINATOR')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL DEFAULT '', "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL, "mustChangePassword" boolean NOT NULL DEFAULT true, "lastLogoutAt" TIMESTAMP WITH TIME ZONE, "isActive" boolean NOT NULL DEFAULT true, "technician_id" uuid, "odoo_user_id" integer, "odoo_synced_at" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "REL_19e69c3fe3a5ae70788236fdb4" UNIQUE ("technician_id"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "clients" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "infradocId" integer NOT NULL, "name" character varying NOT NULL, "abbreviation" character varying, "type" character varying, "website" character varying, "referral" character varying, "rate" numeric, "currencyCode" character varying, "netTerms" integer, "taxIdNumber" character varying, "isLead" boolean NOT NULL DEFAULT false, "primaryAddress" character varying(500), "notes" text, "odooPartnerId" integer, "odooSyncedAt" TIMESTAMP WITH TIME ZONE, "isActive" boolean NOT NULL DEFAULT true, "lastSyncedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_cfe4e5eefd714467f129b0d4235" UNIQUE ("infradocId"), CONSTRAINT "PK_f1ab7cf3a5714dbc6bb4e1c28a4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."tasks_type_enum" AS ENUM('SERVER_MAINTENANCE', 'TERMINAL_MAINTENANCE', 'SITE_VISIT', 'AV_CONTROL', 'UPS_CONTROL', 'ENDPOINT_INVENTORY')`);
        await queryRunner.query(`CREATE TYPE "public"."tasks_status_enum" AS ENUM('PENDING', 'IN_PROGRESS', 'DONE', 'ESCALATED', 'NOT_DONE')`);
        await queryRunner.query(`CREATE TABLE "tasks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "client_id" uuid NOT NULL, "technician_id" uuid NOT NULL, "type" "public"."tasks_type_enum" NOT NULL, "status" "public"."tasks_status_enum" NOT NULL DEFAULT 'PENDING', "scheduledDate" date NOT NULL, "completedDate" TIMESTAMP WITH TIME ZONE, "odoo_ticket_id" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8d12ff38fcc62aaba2cab748772" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "maintenance_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "task_id" uuid NOT NULL, "technician_id" uuid NOT NULL, "payload" jsonb NOT NULL, "notes" text, "registeredAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_fe546cfa26746b115703c6ee793" UNIQUE ("task_id"), CONSTRAINT "PK_096e4b6bb7c9fe74d960e7523e4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_19e69c3fe3a5ae70788236fdb42" FOREIGN KEY ("technician_id") REFERENCES "technicians"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "FK_928436d97a43697186374c4ef77" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "FK_ace74a211fad775871b3d70770c" FOREIGN KEY ("technician_id") REFERENCES "technicians"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "maintenance_logs" ADD CONSTRAINT "FK_fe546cfa26746b115703c6ee793" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "maintenance_logs" ADD CONSTRAINT "FK_a2833b5ff04d55f57fcb2853a1a" FOREIGN KEY ("technician_id") REFERENCES "technicians"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "maintenance_logs" DROP CONSTRAINT "FK_a2833b5ff04d55f57fcb2853a1a"`);
        await queryRunner.query(`ALTER TABLE "maintenance_logs" DROP CONSTRAINT "FK_fe546cfa26746b115703c6ee793"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_ace74a211fad775871b3d70770c"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_928436d97a43697186374c4ef77"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_19e69c3fe3a5ae70788236fdb42"`);
        await queryRunner.query(`DROP TABLE "maintenance_logs"`);
        await queryRunner.query(`DROP TABLE "tasks"`);
        await queryRunner.query(`DROP TYPE "public"."tasks_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."tasks_type_enum"`);
        await queryRunner.query(`DROP TABLE "clients"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP TABLE "technicians"`);
    }

}
