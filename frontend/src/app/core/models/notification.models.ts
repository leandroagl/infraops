export type ExpirationType = 'asset_warranty' | 'certificate' | 'domain' | 'software';

export interface ExpirationItem {
  type: ExpirationType;
  clientId: number;
  clientName: string;
  itemName: string;
  make?: string;
  model?: string;
  serial?: string;
  expireDate: string;   // YYYY-MM-DD
  daysUntil: number;    // negative = expired
}
