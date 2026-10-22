export interface UnifiApiHost {
  id: string;
  reportedState?: { name?: string; hardware?: { name?: string } };
}

export interface UnifiApiSite {
  siteId: string;
  hostId: string;
  meta: { desc: string; name: string; timezone?: string; gatewayMac?: string };
  statistics?: {
    counts?: { gatewayDevice?: number };
    ispInfo?: { name?: string; asn?: number };
    wans?: { WAN?: { externalIp?: string }; WAN2?: { externalIp?: string } };
  };
}

export interface UnifiApiDevice {
  id: string;
  mac: string;
  name: string;
  model: string;
  ip: string;
  status: 'online' | 'offline' | string;
  version: string;
  firmwareStatus: string;
  isConsole: boolean;
  isManaged: boolean;
}

export interface UnifiApiDeviceGroup {
  hostId: string;
  hostName: string;
  devices: UnifiApiDevice[];
  updatedAt: string;
}

export interface UnifiApiListResponse<T> {
  data: T[];
  nextPage?: string;
}

export interface UnifiApiDevicesResponse {
  data: UnifiApiDeviceGroup[];
  httpStatusCode: number;
  traceId?: string;
}

// ── UniFi Network Application local server API (legacy paths) ──

export interface UnifiLocalSite {
  id: string;              // UUID
  internalReference: string; // site short name — usado en el path de devices
  name: string;
}

export interface UnifiLocalSitesResponse {
  offset: number;
  limit: number;
  count: number;
  totalCount: number;
  data: UnifiLocalSite[];
}

export interface UnifiLocalDevice {
  _id: string;
  mac: string;
  name: string;
  model: string;
  ip?: string;
  state: number;  // 0 = offline, 1 = online/connected
  type?: string;  // "uap", "ugw", "usw", "udm", etc.
}

export interface UnifiLegacyDevicesResponse {
  meta: { rc: string };
  data: UnifiLocalDevice[];
}
