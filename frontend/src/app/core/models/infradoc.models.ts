export interface InfraAsset {
  assetId: number;
  name: string;
  ip: string | null;
  bmcIp: string | null;
  bmcType: string | null;
  os: string | null;
  model: string | null;
  uri1: string | null;
  uri2: string | null;
}

export interface ClientInfrastructure {
  esxiHosts: InfraAsset[];
  windowsVMs: InfraAsset[];
  domainControllers: InfraAsset[];
  linuxVMs: InfraAsset[];
  nas: InfraAsset[];
  routers: InfraAsset[];
}
