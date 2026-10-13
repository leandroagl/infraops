export interface AppNotificationPayload {
  clientName?: string;
  expirationType?: string;
  itemName?: string;
  daysUntil?: number;
  odooTicketId?: number;
}

export interface AppNotification {
  id: string;
  type: string;
  payload: AppNotificationPayload;
  createdAt: string;
}
