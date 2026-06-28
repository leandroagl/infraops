export type ExpirationType = 'asset_warranty' | 'certificate' | 'domain' | 'software';

export class ExpirationItemDto {
  type!: ExpirationType;
  clientId!: number;
  clientName!: string;
  itemName!: string;
  expireDate!: string;
  daysUntil!: number;
}
