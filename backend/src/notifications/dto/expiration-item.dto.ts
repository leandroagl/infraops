export type ExpirationType = 'asset_warranty' | 'certificate' | 'domain' | 'software';

export class ExpirationItemDto {
  sourceId!: string;
  type!: ExpirationType;
  clientId!: number;
  clientName!: string;
  itemName!: string;
  make?: string;
  model?: string;
  serial?: string;
  expireDate!: string;
  daysUntil!: number;
  odooTicketId?: number;
}

/** Detalle de un vencimiento para el drawer de una Task, resuelto por taskId. */
export class ExpirationDetailDto {
  type!: ExpirationType;
  sourceId!: string;
  expireDate!: string;
  clientId!: string; // InfraOps client id, no InfraDoc id
  clientName!: string | null;
  itemName!: string | null;
  make?: string;
  model?: string;
  serial?: string;
  daysUntil!: number | null;
  odooTicketId!: number | null;
  defaultTimeMinutes!: number | null;
}
