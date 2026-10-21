export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface NetworkAlert {
  alertId: string;
  siteId: string;
  siteName: string;
  clientId: string;
  clientName: string;
  severity: AlertSeverity;
  type: string;
  message: string;
  createdAt: string;
  odooTicketId: number | null;
}

export interface UnifiSiteConfig {
  id: string;
  clientId: string;
  clientName: string;
  siteId: string;
  siteName: string;
  isEnabled: boolean;
  createdAt: string;
}

export interface UnifiAutoConfig {
  enabled: boolean;
  severities: string[];
  helpdeskTeamId: number | null;
  tagIds: number[];
}

export interface CreateUnifiSiteRequest {
  clientId: string;
  clientName: string;
  siteId: string;
  siteName: string;
  isEnabled?: boolean;
}

export interface UpdateUnifiSiteRequest {
  siteName?: string;
  isEnabled?: boolean;
}
