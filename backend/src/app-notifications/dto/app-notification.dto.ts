export class AppNotificationPayloadDto {
  clientName?: string;
  expirationType?: string;
  itemName?: string;
  daysUntil?: number;
  odooTicketId?: number;
}

export class AppNotificationResponseDto {
  id: string;
  type: string;
  payload: AppNotificationPayloadDto;
  createdAt: Date;
}
