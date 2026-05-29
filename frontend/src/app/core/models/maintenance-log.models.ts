// Payload jsonb structures for MaintenanceLogs

// --- Server Maintenance ---

export interface WindowsServerEntry {
  serverId: number;
  serverName: string;
  reboot: 'yes' | 'no' | 'pending';
  updates: 'ok' | 'pending' | 'failed';
  notes?: string;
}

export interface WindowsSection {
  servers: WindowsServerEntry[];
  dcdiag: string;        // 'OK' | 'ERROR: ...' — texto libre
  dcdiagDetail?: string; // Solo cuando dcdiag empieza con 'ERROR'
}

export interface VMwareSection {
  cpuUsage: number;       // %
  memUsage: number;       // %
  storageUsage: number;   // %
  highUsageVMs?: string;  // Texto libre si alguna métrica alta
  snapshotsOk: boolean;
}

export interface QNAPSection {
  spaceUsed: number;
  raidStatus: 'ok' | 'degraded' | 'failed';
  firmwareUpdated: boolean;
}

export interface VeeamSection {
  status: 'ok' | 'partial' | 'missing';
  affectedVMs?: string;  // Solo cuando status es partial o missing
}

export interface RouterSection {
  firmwareUpdated: boolean;
  firmwareVersion?: string;
  backupDone: boolean;
}

export interface ServerMaintenancePayload {
  type: 'SERVER_MAINTENANCE';
  windows: WindowsSection;
  vmware?: VMwareSection;
  qnap?: QNAPSection;
  veeam?: VeeamSection;
  router?: RouterSection;
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
