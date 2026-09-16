export type ExpirationType = 'asset_warranty' | 'certificate' | 'domain' | 'software';

export interface ExpirationItem {
  sourceId: string;
  type: ExpirationType;
  clientId: number;
  clientName: string;
  itemName: string;
  make?: string;
  model?: string;
  serial?: string;
  expireDate: string;   // YYYY-MM-DD
  daysUntil: number;    // negative = expired
  odooTicketId?: number;
}

export interface ExpirationTypeConfigEntry {
  enabled: boolean;
  helpdeskTeamId: number | null;
  daysAhead: number;
  tagIds: number[];
}
