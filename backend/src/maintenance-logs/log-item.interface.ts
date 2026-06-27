export interface WindowsServerEntry {
  serverId: number;
  serverName: string;
  rebootScript: 'ok' | 'error' | 'falta_configurar';
  updates: 'ok' | 'pending' | 'failed';
  notes?: string;
}

export interface WindowsSection {
  servers: WindowsServerEntry[];
  dcdiag: string;
  dcdiagDetail?: string;
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
  spaceUsed: number;
  raidStatus: 'ok' | 'degraded' | 'failed';
  firmwareUpdated: boolean;
}

export interface VeeamSection {
  status: 'ok' | 'partial' | 'missing';
  missingVMs?: string[];
}

export interface RouterSection {
  firmwareUpdated: boolean;
  firmwareVersion?: string;
  backupDone: boolean;
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
  hostId: number;
  hostName: string;
  firmwareVersion?: string;
  biosVersion?: string;
  alertStatus: 'ok' | 'alerta';
  alertCategories?: BmcAlertCategory[];
  alertLogs?: string;
}

export interface ServerMaintenancePayload {
  type: 'SERVER_MAINTENANCE';
  windows: WindowsSection;
  vmware?: VMwareHostEntry[];
  qnap?: QNAPSection[];
  veeam?: VeeamSection;
  router?: RouterSection;
  bmc?: BmcEntry[];
  notes?: string;
}

export interface ServerHostPayload {
  type: 'SERVER_HOST_MAINTENANCE';
  vmware: VMwareHostEntry[];
  bmc: BmcEntry[];
  notes?: string;
}

export interface WindowsDomainPayload {
  type: 'WINDOWS_DOMAIN_MAINTENANCE';
  windows: WindowsSection;
  notes?: string;
}

export interface RouterMaintenancePayload {
  type: 'ROUTER_MAINTENANCE';
  router: RouterEntry[];
  notes?: string;
}

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

export type MaintenancePayload =
  | ServerMaintenancePayload
  | ServerHostPayload
  | WindowsDomainPayload
  | RouterMaintenancePayload
  | TerminalPayload;
