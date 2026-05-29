export interface InfraAsset {
  assetId: number;
  name: string;
  ip: string | null;
  os: string | null;
  model: string | null;
}

export interface ClientInfrastructure {
  servers: InfraAsset[];
  vms: InfraAsset[];
  nas: InfraAsset[];
  routers: InfraAsset[];
}
