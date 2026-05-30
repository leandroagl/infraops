export interface InfraAsset {
  assetId: number;
  name: string;
  ip: string | null;
  bmcIp: string | null;
  bmcType: string | null;
  os: string | null;
  model: string | null;
}

export interface ClientInfrastructure {
  esxiHosts: InfraAsset[];
  windowsVMs: InfraAsset[];
  nas: InfraAsset[];
  routers: InfraAsset[];
}
