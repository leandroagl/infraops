import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateExpirationTickets1789200000000
  implements MigrationInterface
{
  name = 'CreateExpirationTickets1789200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "expiration_tickets" (
        "id"           uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "type"         varchar     NOT NULL,
        "sourceId"     varchar     NOT NULL,
        "expireDate"   date        NOT NULL,
        "clientId"     uuid        NOT NULL,
        "odooTicketId" integer,
        "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_expiration_tickets" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_expiration_tickets_source" UNIQUE ("type", "sourceId", "expireDate"),
        CONSTRAINT "FK_expiration_tickets_client" FOREIGN KEY ("clientId")
          REFERENCES "clients" ("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "expiration_tickets"`);
  }
}
