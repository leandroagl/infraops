import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClientSubscriptionHourSnapshots1789100000000
  implements MigrationInterface
{
  name = 'CreateClientSubscriptionHourSnapshots1789100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "client_subscription_hour_snapshots" (
        "id"         uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "clientId"   uuid        NOT NULL,
        "year"       integer     NOT NULL,
        "month"      integer     NOT NULL,
        "contracted" numeric     NOT NULL DEFAULT 0,
        "delivered"  numeric     NOT NULL DEFAULT 0,
        "available"  numeric     NOT NULL DEFAULT 0,
        "snapshotAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_client_subscription_hour_snapshots" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_client_subscription_hour_snapshots_period" UNIQUE ("clientId", "year", "month"),
        CONSTRAINT "FK_client_subscription_hour_snapshots_client" FOREIGN KEY ("clientId")
          REFERENCES "clients" ("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "client_subscription_hour_snapshots"`);
  }
}
