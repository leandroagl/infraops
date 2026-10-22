export class AlertWithTicketDto {
  alertId: string;
  siteId: string;
  siteName: string;
  clientId: string;
  clientName: string;
  severity: 'critical' | 'high';
  type: 'console_offline' | 'device_offline';
  message: string;
  deviceName: string;
  deviceModel: string;
  hostId: string;
  lastSeen: string;
  odooTicketId: number | null;
}
