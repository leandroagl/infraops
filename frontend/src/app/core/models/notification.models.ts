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

/** Detalle de un vencimiento resuelto por taskId, para el drawer de una tarea EXPIRATION_CONTROL. */
export interface ExpirationDetail {
  type: ExpirationType;
  sourceId: string;
  expireDate: string;
  clientId: string;
  clientName: string | null;
  itemName: string | null;
  make?: string;
  model?: string;
  serial?: string;
  daysUntil: number | null;
  odooTicketId: number | null;
  defaultTimeMinutes: number | null;
  teamSlas: { id: number; name: string; time_days: number }[] | null;
}

export interface UrgentBacklogPreviewItem {
  type: ExpirationType;
  sourceId: string;
  expireDate: string;
  clientName: string | null;
  itemName: string | null;
  daysUntil: number;
}

export interface UrgentBacklogPreview {
  count: number;
  items: UrgentBacklogPreviewItem[];
}

export interface UrgentBacklogResult {
  created: number;
  errors: number;
}

export interface ExpirationTypeConfigEntry {
  enabled: boolean;
  helpdeskTeamId: number | null;
  daysAhead: number;
  tagIds: number[];
  taskName?: string | null;
  defaultTimeMinutes?: number | null;
  ticketDescription?: string | null;
  timesheetDescription?: string | null;
}
