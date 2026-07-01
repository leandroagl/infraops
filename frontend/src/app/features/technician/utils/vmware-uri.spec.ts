import { resolveVmwareUri } from './vmware-uri';
import { InfraAsset } from '../../../core/models/infradoc.models';

function makeAsset(uri1: string | null, uri2: string | null, ip: string | null = null): InfraAsset {
  return {
    assetId: 1, name: 'host1', ip, bmcIp: null,
    bmcType: null, os: null, model: null, uri1, uri2,
  };
}

describe('resolveVmwareUri', () => {
  it('retorna uri1 cuando está presente', () => {
    expect(resolveVmwareUri(makeAsset('esxi.cliente.com:443', 'otro.cliente.com:443')))
      .toBe('esxi.cliente.com:443');
  });

  it('retorna uri2 cuando uri1 es null', () => {
    expect(resolveVmwareUri(makeAsset(null, 'esxi.cliente.com:443')))
      .toBe('esxi.cliente.com:443');
  });

  it('retorna ip cuando ambas URIs son null', () => {
    expect(resolveVmwareUri(makeAsset(null, null, '192.168.1.100')))
      .toBe('192.168.1.100');
  });

  it('retorna null cuando uri1, uri2 e ip son null', () => {
    expect(resolveVmwareUri(makeAsset(null, null, null))).toBeNull();
  });

  it('acepta URIs sin puerto (el backend usa 443 por defecto)', () => {
    expect(resolveVmwareUri(makeAsset('esxi.cliente.com', null)))
      .toBe('esxi.cliente.com');
  });
});
