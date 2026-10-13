import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Una fila por plan de backup de Acronis (policy.id) asignado a un cliente de InfraOps.
// Los nombres de policy y tenant se guardan solo para mostrarlos en Admin sin consultar a Acronis.
@Entity('acronis_plan_configs')
export class AcronisPlanConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'client_id' })
  clientId: string;

  @Column({ type: 'varchar', name: 'client_name', default: '' })
  clientName: string;

  @Column({ type: 'varchar', name: 'policy_id', unique: true })
  policyId: string;

  @Column({ type: 'varchar', name: 'policy_name' })
  policyName: string;

  @Column({ type: 'varchar', name: 'tenant_name', default: '' })
  tenantName: string;

  @Column({ type: 'boolean', name: 'is_enabled', default: true })
  isEnabled: boolean;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'now()' })
  updatedAt: Date;
}
