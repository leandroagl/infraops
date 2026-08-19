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

    // getAssets returns one row per interface (a server with iDRAC has 2 rows).
    // Group them so we can use the raw rows as a fallback for BMC resolution.
    const rawByAsset = new Map<string, RawInfradocAsset[]>();
    for (const asset of raw) {
      const group = rawByAsset.get(asset.asset_id) ?? [];
      group.push(asset);
      rawByAsset.set(asset.asset_id, group);
    }

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
      // Merge getAssetInterfaces result with raw rows already in memory.
      // This covers the case where getAssetInterfaces returns only the primary
      // interface row while the BMC interface exists in the getAssets response.
      const merged = [...interfaceArrays[i], ...(rawByAsset.get(id) ?? [])];
      bmcMap.set(id, this.resolveBmc(merged));
      uriMap.set(id, this.resolveVmwareUris(merged));
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
      make: raw.asset_make || null,
      model: raw.asset_model || null,
      uri1: uriOverride?.uri1 ?? raw.asset_uri ?? null,
      uri2: uriOverride?.uri2 ?? raw.asset_uri_2 ?? null,
    };
  }
}
