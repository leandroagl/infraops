import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAppNotifications1790800000000 implements MigrationInterface {
  name = 'CreateAppNotifications1790800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "app_notifications" (
        "id"        uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "type"      varchar     NOT NULL,
        "payload"   jsonb       NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_app_notifications" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "user_notification_reads" (
        "id"             uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "userId"         uuid        NOT NULL,
        "notificationId" uuid        NOT NULL,
        "readAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_notification_reads" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_notification_reads" UNIQUE ("userId", "notificationId"),
        CONSTRAINT "FK_unr_user" FOREIGN KEY ("userId")
          REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_unr_notification" FOREIGN KEY ("notificationId")
          REFERENCES "app_notifications" ("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_notification_reads"`);
    await queryRunner.query(`DROP TABLE "app_notifications"`);
  }
}
