import { InfraAsset } from '../../../core/models/infradoc.models';

const VMWARE_PORTS = new Set([344, 345, 346, 347, 348]);

export function resolveVmwareUri(asset: InfraAsset): string | null {
  for (const uri of [asset.uri1, asset.uri2]) {
    if (!uri) continue;
    const colonIdx = uri.lastIndexOf(':');
    if (colonIdx < 0) continue;
    const port = parseInt(uri.slice(colonIdx + 1), 10);
    if (VMWARE_PORTS.has(port)) return uri;
  }
  return null;
}
