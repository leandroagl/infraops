export class InfraAssetDto {
  assetId: number;
  name: string;
  ip: string | null;
  os: string | null;
  model: string | null;
}

export class ClientInfrastructureDto {
  servers: InfraAssetDto[];
  vms: InfraAssetDto[];
  nas: InfraAssetDto[];
  routers: InfraAssetDto[];
}
