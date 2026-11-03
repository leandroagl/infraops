import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('unifi_auto_config')
export class UnifiAutoConfig {
  @PrimaryColumn({ type: 'int', default: 1 })
  id: number = 1;

  @Column({ type: 'boolean', default: false })
  enabled: boolean = false;

  @Column({ name: 'severities', type: 'text', array: true, default: () => "ARRAY['critical']" })
  severities: string[] = ['critical'];

  @Column({ name: 'helpdesk_team_id', type: 'int', nullable: true })
  helpdeskTeamId: number | null = null;

  @Column({ name: 'tag_ids', type: 'int', array: true, default: () => 'ARRAY[]::int[]' })
  tagIds: number[] = [];
}
