export type AlertSeverity = 'critical' | 'high';
export type AlertType = 'console_offline' | 'device_offline';

export interface NetworkAlert {
  alertId: string;
  siteId: string;
  siteName: string;
  clientId: string;
  clientName: string;
  severity: AlertSeverity;
  type: AlertType;
  message: string;
  deviceName: string;
  deviceModel: string;
  hostId: string;
  lastSeen: string;
  odooTicketId: number | null;
}

export interface OfflineDevice {
  alertId: string;
  siteId: string;
  siteName: string;
  deviceName: string;
  deviceModel: string;
  type: AlertType;
  severity: AlertSeverity;
  lastSeen: string;
}

export interface ClientOfflineAlert {
  clientId: string;
  clientName: string;
  devices: OfflineDevice[];
  severity: AlertSeverity;  // peor severidad del grupo
  lastSeen: string;         // lastSeen más reciente del grupo
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

export interface AvailableUnifiSite {
  siteId: string;
  siteName: string;
}

export interface CreateUnifiSiteRequest {
  clientId: string;
  clientName: string;
  siteId: string;
  siteName: string;
  isEnabled?: boolean;
}

export interface CreateUnifiSitesBulkRequest {
  clientId: string;
  clientName: string;
  isEnabled?: boolean;
  sites: AvailableUnifiSite[];
}

export interface UpdateUnifiSiteRequest {
  isEnabled?: boolean;
}
