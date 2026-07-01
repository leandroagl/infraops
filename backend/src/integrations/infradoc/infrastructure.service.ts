import { Injectable, NotFoundException } from '@nestjs/common';
import { ClientsService } from '../../clients/clients.service';
import {
  InfradocAssetsService,
  RawInfradocAsset,
} from './infradoc-assets.service';
import {
  ClientInfrastructureDto,
  InfraAssetDto,
} from './dto/client-infrastructure.dto';

@Injectable()
export class InfrastructureService {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly infradocAssetsService: InfradocAssetsService,
  ) {}

  async getClientInfrastructure(
    clientId: string,
  ): Promise<ClientInfrastructureDto> {
    const infradocId = await this.clientsService.findInfradocId(clientId);
    if (infradocId === null)
      throw new NotFoundException('Cliente no encontrado');

    const raw = await this.infradocAssetsService.getAssets(infradocId);

    const serverIds = [
      ...new Set(
        raw
          .filter((a) => (a.asset_type ?? '').trim().toLowerCase() === 'server')
          .map((a) => a.asset_id),
      ),
    ];

    const settledResults = await Promise.allSettled(
      serverIds.map((id) =>
        this.infradocAssetsService.getAssetInterfaces(Number(id)),
      ),
    );

    const interfaceArrays = settledResults.map((r) =>
      r.status === 'fulfilled' ? r.value : [],
    );

    const bmcMap = new Map<
      string,
      { bmcIp: string | null; bmcType: string | null }
    >();
    const uriMap = new Map<
      string,
      { uri1: string | null; uri2: string | null }
    >();
    serverIds.forEach((id, i) => {
      bmcMap.set(id, this.resolveBmc(interfaceArrays[i]));
      uriMap.set(id, this.resolveVmwareUris(interfaceArrays[i]));
    });

    return this.groupAssets(raw, bmcMap, uriMap);
  }

  private resolveVmwareUris(
    interfaces: RawInfradocAsset[],
  ): { uri1: string | null; uri2: string | null } {
    const best = interfaces.find((i) => i.asset_uri || i.asset_uri_2);
    return { uri1: best?.asset_uri ?? null, uri2: best?.asset_uri_2 ?? null };
  }

  private resolveBmc(interfaces: RawInfradocAsset[]): {
    bmcIp: string | null;
    bmcType: string | null;
  } {
    const BMC_PATTERNS = ['ilo', 'idrac', 'xclarity'];
    const bmc = interfaces.find((iface) =>
      BMC_PATTERNS.some((p) =>
        (iface.interface_name ?? '').toLowerCase().includes(p),
      ),
    );
    if (!bmc) return { bmcIp: null, bmcType: null };
    return {
      bmcIp: bmc.interface_ip || null,
      bmcType: bmc.interface_name ?? null,
    };
  }

  private groupAssets(
    raw: RawInfradocAsset[],
    bmcMap: Map<string, { bmcIp: string | null; bmcType: string | null }>,
    uriMap: Map<string, { uri1: string | null; uri2: string | null }>,
  ): ClientInfrastructureDto {
    const result: ClientInfrastructureDto = {
      esxiHosts: [],
      windowsVMs: [],
      domainControllers: [],
      linuxVMs: [],
      nas: [],
      routers: [],
    };

    const seen = new Set<string>();

    for (const asset of raw) {
      if (seen.has(asset.asset_id)) continue;
      seen.add(asset.asset_id);

      const type = (asset.asset_type ?? '').trim().toLowerCase();
      const make = (asset.asset_make ?? '').trim().toLowerCase();
      const os = (asset.asset_os ?? '').trim().toLowerCase();

      if (type === 'server') {
        result.esxiHosts.push(
          this.mapAsset(asset, bmcMap.get(asset.asset_id), uriMap.get(asset.asset_id)),
        );
      } else if (
        type === 'virtual machine' &&
        os.startsWith('windows server')
      ) {
        const description = (asset.asset_description ?? '').toLowerCase();
        if (description.includes('domain controller')) {
          result.domainControllers.push(this.mapAsset(asset));
        } else {
          result.windowsVMs.push(this.mapAsset(asset));
        }
      } else if (type === 'virtual machine' && os !== '' && !os.startsWith('windows server')) {
        result.linuxVMs.push(this.mapAsset(asset));
      } else if (
        type === 'firewall/router' ||
        type === 'router' ||
        type === 'firewall'
      ) {
        result.routers.push(this.mapAsset(asset));
      } else if (type === 'nas' || make === 'qnap') {
        result.nas.push(this.mapAsset(asset));
      }
    }

    return result;
  }

  private mapAsset(
    raw: RawInfradocAsset,
    bmc?: { bmcIp: string | null; bmcType: string | null },
    uriOverride?: { uri1: string | null; uri2: string | null },
  ): InfraAssetDto {
    return {
      assetId: Number(raw.asset_id),
      name: raw.asset_name,
      ip: raw.interface_ip || null,
      bmcIp: bmc?.bmcIp ?? null,
      bmcType: bmc?.bmcType ?? null,
      os: raw.asset_os || null,
      model: raw.asset_model || null,
      uri1: uriOverride?.uri1 ?? raw.asset_uri ?? null,
      uri2: uriOverride?.uri2 ?? raw.asset_uri_2 ?? null,
    };
  }
}
