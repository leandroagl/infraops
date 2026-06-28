export type ExpirationType = 'asset_warranty' | 'certificate' | 'domain' | 'software';

export interface ExpirationItem {
  type: ExpirationType;
  clientId: number;
  clientName: string;
  itemName: string;
  expireDate: string;   // YYYY-MM-DD
  daysUntil: number;    // negative = expired
}
