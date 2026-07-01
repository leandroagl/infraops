import { resolveVmwareUri } from './vmware-uri';
import { InfraAsset } from '../../../core/models/infradoc.models';

function makeAsset(uri1: string | null, uri2: string | null): InfraAsset {
  return {
    assetId: 1, name: 'host1', ip: null, bmcIp: null,
    bmcType: null, os: null, model: null, uri1, uri2,
  };
}

describe('resolveVmwareUri', () => {
  it('retorna uri1 cuando tiene puerto 344', () => {
    expect(resolveVmwareUri(makeAsset('esxi.cliente.com:344', null)))
      .toBe('esxi.cliente.com:344');
  });

  it('retorna uri2 cuando uri1 no tiene puerto VMware pero uri2 sí', () => {
    expect(resolveVmwareUri(makeAsset('app.cliente.com:443', 'esxi.cliente.com:346')))
      .toBe('esxi.cliente.com:346');
  });

  it('retorna null cuando ninguna URI tiene puerto VMware', () => {
    expect(resolveVmwareUri(makeAsset('app.cliente.com:443', 'db.cliente.com:5432')))
      .toBeNull();
  });

  it('retorna null cuando ambas URIs son null', () => {
    expect(resolveVmwareUri(makeAsset(null, null))).toBeNull();
  });

  it('retorna null cuando la URI no tiene puerto', () => {
    expect(resolveVmwareUri(makeAsset('esxi.cliente.com', null))).toBeNull();
  });

  [344, 345, 346, 347, 348].forEach((port) => {
    it(`acepta puerto ${port}`, () => {
      expect(resolveVmwareUri(makeAsset(`esxi.cliente.com:${port}`, null)))
        .toBe(`esxi.cliente.com:${port}`);
    });
  });

  it('no acepta puerto 343 (fuera del rango)', () => {
    expect(resolveVmwareUri(makeAsset('esxi.cliente.com:343', null))).toBeNull();
  });

  it('no acepta puerto 349 (fuera del rango)', () => {
    expect(resolveVmwareUri(makeAsset('esxi.cliente.com:349', null))).toBeNull();
  });
});
