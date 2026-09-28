// Espejo de frontend/src/app/core/models/maintenance-log.models.ts — mantener sincronizados.
// El backend no valida la forma interna del payload (jsonb, solo @IsObject()), así que un
// drift entre estos dos archivos no rompe nada en runtime, pero sí vuelve mentiroso este tipo.

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
  restartScript: 'ok' | 'error' | 'no_task';
  notes?: string;
}

export interface WindowsSection {
  servers: WindowsServerEntry[];
  domainControllers: DcHealthSnapshot[];
}

export interface QNAPSection {
  deviceId: number;
  deviceName: string;
  diskCount: number;
  totalSpaceGB: number;
  totalSpaceUnit?: 'GB' | 'TB';
  usedSpaceGB: number;
  usedSpaceUnit?: 'GB' | 'TB';
  disksWithError: string[];
  raidStatus: 'ok' | 'degraded' | 'failed';
  firmwareVersion: string;
  firmwareUpdated: boolean;
  firmwareNewVersion?: string;
}

export interface VeeamVmEntry {
  vmName: string;
  coverage: 'job' | 'agent' | 'excluded' | 'no_backup';
  fullsInMonth: number | null;
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

export interface VmwareHealthResult {
  host: {
    name: string;
    esxiVersion: string;
    uptimeHours: number;
    cpuUsagePct: number;
    memUsagePct: number;
    overallStatus: 'green' | 'yellow' | 'red';
    hardwareAlerts: string[];
  };
  datastores: Array<{
    name: string;
    type: string;
    capacityGb: number;
    freeGb: number;
    usedPct: number;
    accessible: boolean;
  }>;
  vms: {
    poweredOn: number;
    poweredOff: number;
    suspended: number;
    snapshotTotal: number;
    snapshots: Array<{ vmName: string; count: number; oldestDays: number }>;
    toolsNotOk: number;
  };
  network: {
    vswitchErrors: string[];
    nicsFailed: string[];
    nicsOnline: Array<{ device: string; speedMb: number }>;
  };
  collectedAt: string;
}

export interface EsxiHostEntry {
  assetId: number;
  vmwareCheck: VmwareHealthResult | null;
  notes?: string;
}

export interface ServerHostPayload {
  type: 'SERVER_HOST_MAINTENANCE';
  esxiHosts: EsxiHostEntry[];
  windowsHosts?: WindowsServerEntry[];
  bmc?: BmcEntry[];
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

export interface QnapPayload {
  type: 'QNAP_MAINTENANCE';
  qnap: QNAPSection[];
  notes?: string;
}

export interface VeeamBackupPayload {
  type: 'VEEAM_BACKUP';
  vms: VeeamVmEntry[];
  notes: string | null;
}

export interface ExpirationControlPayload {
  type: 'EXPIRATION_CONTROL';
  notes?: string;
}

export type MaintenancePayload =
  | ServerHostPayload
  | WindowsDomainPayload
  | RouterMaintenancePayload
  | TerminalPayload
  | QnapPayload
  | VeeamBackupPayload
  | ExpirationControlPayload;
