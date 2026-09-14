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
