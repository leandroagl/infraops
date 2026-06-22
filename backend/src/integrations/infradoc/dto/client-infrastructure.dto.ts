export class InfraAssetDto {
  assetId: number;
  name: string;
  ip: string | null;
  bmcIp: string | null;
  bmcType: string | null;
  os: string | null;
  model: string | null;
}

export class ClientInfrastructureDto {
  esxiHosts: InfraAssetDto[];
  windowsVMs: InfraAssetDto[];
  domainControllers: InfraAssetDto[];
  linuxVMs: InfraAssetDto[];
  nas: InfraAssetDto[];
  routers: InfraAssetDto[];
}
