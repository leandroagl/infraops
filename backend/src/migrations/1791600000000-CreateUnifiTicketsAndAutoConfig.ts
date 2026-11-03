import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUnifiTicketsAndAutoConfig1791600000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE unifi_tickets (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        alert_id VARCHAR NOT NULL UNIQUE,
        site_id VARCHAR NOT NULL,
        client_id UUID NOT NULL,
        odoo_ticket_id INT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE unifi_auto_config (
        id INT PRIMARY KEY DEFAULT 1,
        enabled BOOLEAN NOT NULL DEFAULT false,
        severities TEXT[] NOT NULL DEFAULT ARRAY['critical'],
        helpdesk_team_id INT,
        tag_ids INT[] NOT NULL DEFAULT ARRAY[]::INT[]
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS unifi_tickets`);
    await queryRunner.query(`DROP TABLE IF EXISTS unifi_auto_config`);
  }
}
