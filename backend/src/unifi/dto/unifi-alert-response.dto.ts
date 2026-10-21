export class AlertWithTicketDto {
  alertId: string;
  siteId: string;
  siteName: string;
  clientId: string;
  clientName: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  message: string;
  createdAt: string;
  odooTicketId: number | null;
}
