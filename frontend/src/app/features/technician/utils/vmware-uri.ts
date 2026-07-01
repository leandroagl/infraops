import { InfraAsset } from '../../../core/models/infradoc.models';

export function resolveVmwareUri(asset: InfraAsset): string | null {
  return asset.uri1 ?? asset.uri2 ?? asset.ip;
}
