import { Injectable, NotFoundException } from '@nestjs/common';
import { ClientsService } from '../../clients/clients.service';
import { InfradocAssetsService, RawInfradocAsset } from './infradoc-assets.service';
import { ClientInfrastructureDto, InfraAssetDto } from './dto/client-infrastructure.dto';

const ASSET_TYPE_MAP = {
  servers: ['Server'],
  vms:     ['Virtual Machine'],
  nas:     ['NAS', 'QNAP'],
  routers: ['Router', 'Firewall'],
};

@Injectable()
export class InfrastructureService {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly infradocAssetsService: InfradocAssetsService,
  ) {}

  async getClientInfrastructure(clientId: string): Promise<ClientInfrastructureDto> {
    const infradocId = await this.clientsService.findInfradocId(clientId);
    if (infradocId === null) throw new NotFoundException('Cliente no encontrado');

    const raw = await this.infradocAssetsService.getAssets(infradocId);
    return this.groupAssets(raw);
  }

  private groupAssets(raw: RawInfradocAsset[]): ClientInfrastructureDto {
    const result: ClientInfrastructureDto = { servers: [], vms: [], nas: [], routers: [] };

    for (const asset of raw) {
      const type = (asset.asset_type ?? '').trim();
      const mapped = this.mapAsset(asset);

      if (ASSET_TYPE_MAP.servers.includes(type)) result.servers.push(mapped);
      else if (ASSET_TYPE_MAP.vms.includes(type)) result.vms.push(mapped);
      else if (ASSET_TYPE_MAP.nas.includes(type)) result.nas.push(mapped);
      else if (ASSET_TYPE_MAP.routers.includes(type)) result.routers.push(mapped);
    }

    return result;
  }

  private mapAsset(raw: RawInfradocAsset): InfraAssetDto {
    return {
      assetId: Number(raw.asset_id),
      name: raw.asset_name,
      ip: raw.asset_ip ?? null,
      os: raw.asset_os ?? null,
      model: raw.asset_model ?? null,
    };
  }
}
