export interface VmwareHostInfo {
  name: string;
  esxiVersion: string;
  uptimeHours: number;
  cpuUsagePct: number;
  memUsagePct: number;
overallStatus: 'green' | 'yellow' | 'red';
  hardwareAlerts: string[];
}

export interface VmwareDatastore {
  name: string;
  type: string;
  capacityGb: number;
  freeGb: number;
  usedPct: number;
  accessible: boolean;
}

export interface VmwareSnapshot {
  vmName: string;
  count: number;
  oldestDays: number;
}

export interface VmwareVmsInfo {
  poweredOn: number;
  poweredOff: number;
  suspended: number;
  snapshotTotal: number;
  snapshots: VmwareSnapshot[];
  toolsNotOk: number;
}

export interface VmwareNicOnline {
  device: string;
  speedMb: number;
}

export interface VmwareNetworkInfo {
  vswitchErrors: string[];
  nicsFailed: string[];
  nicsOnline: VmwareNicOnline[];
}

export interface VmwareHealthResult {
  host: VmwareHostInfo;
  datastores: VmwareDatastore[];
  vms: VmwareVmsInfo;
  network: VmwareNetworkInfo;
  collectedAt: string;
}
