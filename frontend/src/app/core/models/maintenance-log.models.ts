// Payload jsonb structures for MaintenanceLogs

// --- Server Maintenance ---

export interface DcHealthSnapshot {
  is_dc: boolean;
  dc_name: string;
  domain: string | null;
  collected_at: string;
  repl_healthy: boolean | null;
  repl_failures: number | null;
  repl_partners: number | null;
  repl_max_age_hours: number | null;
  dns_test_pass: boolean | null;
  dns_service_ok: boolean | null;
  dns_srv_ok: boolean | null;
  dns_zone_count: number | null;
  sysvol_state_ok: boolean | null;
  sysvol_backlog: number | null;
  sysvol_replication: string | null;
  warnings: string[];
}

export interface WindowsServerEntry {
  serverId: number;
  serverName: string;
  updates: 'ok' | 'pending' | 'failed';
  notes?: string;
}

export interface WindowsSection {
  servers: WindowsServerEntry[];
  domainControllers: DcHealthSnapshot[];
}

export interface VMwareHostEntry {
  hostId: number;
  hostName: string;
  cpuUsage: number;
  memUsage: number;
  storageUsage: number;
  highUsageVMs?: string[];
  snapshotsOk: boolean;
}

export interface QNAPSection {
  deviceId: number;
  deviceName: string;
  diskCount: number;
  totalSpaceGB: number;
  usedSpaceGB: number;
  disksWithError: string[];
  raidStatus: 'ok' | 'degraded' | 'failed';
  firmwareVersion: string;
  firmwareUpdated: boolean;
  firmwareNewVersion?: string;
}

export interface VeeamSection {
  status: 'ok' | 'partial' | 'missing';
  missingVMs?: string[];
}

export interface RouterEntry {
  routerId: number;
  routerName: string;
  firmwareUpdated: boolean;
  firmwareVersion?: string;
  backupDone: boolean;
}

export type BmcAlertCategory = 'fan' | 'psu' | 'temperatura' | 'cpu' | 'memoria' | 'storage' | 'nic' | 'sistema';

export interface BmcEntry {
  hostId:             number;
  hostName:           string;
  firmwareVersion?:   string;
  biosVersion?:       string;
  alertStatus:        'ok' | 'alerta';
  alertCategories?:   BmcAlertCategory[];
  alertLogs?:         string;
}

export interface ServerMaintenancePayload {
  type: 'SERVER_MAINTENANCE';
  windows: WindowsSection;
  vmware?: VMwareHostEntry[];
  qnap?: QNAPSection[];
  veeam?: VeeamSection;
  router?: RouterEntry[];
  bmc?: BmcEntry[];
  notes?: string;
}

// --- Terminal Maintenance ---

export interface TerminalChecks {
  cleanedTemp: boolean;
  windowsUpdates: boolean;
  antivirusOk: boolean;
  diskSpace: boolean;
  licenses: boolean;
}

export interface NetworkChecks {
  connectivity: boolean;
  switches: boolean;
}

export interface TerminalPayload {
  type: 'TERMINAL_MAINTENANCE';
  checks: TerminalChecks;
  network: NetworkChecks;
  observations?: string;
  notes?: string;
}

export type MaintenancePayload = ServerMaintenancePayload | TerminalPayload;
