import { EsxiHostCardComponent } from './esxi-host-card.component';
import { InfraAsset } from '../../../../../core/models/infradoc.models';
import { VmwareHealthResult } from '../../../../../core/models/maintenance-log.models';

const makeHost = (uri1: string | null = null, uri2: string | null = null): InfraAsset => ({
  assetId: 1, name: 'esxi01', ip: '192.168.1.10',
  bmcIp: null, bmcType: null, os: null, model: null, uri1, uri2,
});

const MOCK_RESULT: VmwareHealthResult = {
  host: {
    name: 'esxi01', esxiVersion: 'VMware ESXi 7.0.3 build-21930508',
    uptimeHours: 120, cpuUsagePct: 25, memUsagePct: 60,
    memOvercommitRatio: 1.3, overallStatus: 'green', hardwareAlerts: [],
  },
  datastores: [{ name: 'datastore1', type: 'VMFS', capacityGb: 500, freeGb: 200, usedPct: 60, accessible: true }],
  vms: { poweredOn: 3, poweredOff: 1, suspended: 0, snapshots: [], toolsNotOk: 0 },
  network: { vswitchErrors: [], nicsFailed: [] },
  collectedAt: '2026-06-29T10:00:00.000Z',
};

describe('EsxiHostCardComponent', () => {
  let component: EsxiHostCardComponent;

  beforeEach(() => {
    component = new EsxiHostCardComponent();
    component.host = makeHost();
  });

  describe('vmwareUri', () => {
    it('retorna null cuando el host no tiene URIs con puerto VMware', () => {
      expect(component.vmwareUri).toBeNull();
    });

    it('retorna la URI cuando uri1 tiene puerto en rango 344-348', () => {
      component.host = makeHost('esxi.cliente.com:344', null);
      expect(component.vmwareUri).toBe('esxi.cliente.com:344');
    });

    it('retorna uri2 cuando solo uri2 tiene puerto VMware', () => {
      component.host = makeHost('app.cliente.com:443', 'esxi.cliente.com:346');
      expect(component.vmwareUri).toBe('esxi.cliente.com:346');
    });
  });

  describe('canRun', () => {
    it('es false cuando no hay URI VMware', () => {
      expect(component.canRun).toBe(false);
    });

    it('es false cuando loading es true aunque haya URI VMware', () => {
      component.host = makeHost('esxi.cliente.com:344', null);
      component.loading = true;
      expect(component.canRun).toBe(false);
    });

    it('es false cuando readOnly es true', () => {
      component.host = makeHost('esxi.cliente.com:344', null);
      component.readOnly = true;
      expect(component.canRun).toBe(false);
    });

    it('es true cuando hay URI VMware, loading false, readOnly false', () => {
      component.host = makeHost('esxi.cliente.com:344', null);
      expect(component.canRun).toBe(true);
    });
  });

  describe('onRunClick', () => {
    it('emite la URI VMware via runCheck', () => {
      component.host = makeHost('esxi.cliente.com:344', null);
      let emitted: string | undefined;
      component.runCheck.subscribe((v: string) => (emitted = v));
      component.onRunClick();
      expect(emitted).toBe('esxi.cliente.com:344');
    });

    it('no emite cuando no hay URI VMware', () => {
      let emitted = false;
      component.runCheck.subscribe(() => (emitted = true));
      component.onRunClick();
      expect(emitted).toBe(false);
    });
  });

  describe('statusBadgeClass', () => {
    it('retorna badge--crit para overallStatus red', () => {
      expect(component.statusBadgeClass('red')).toBe('badge--crit');
    });
    it('retorna badge--warn para overallStatus yellow', () => {
      expect(component.statusBadgeClass('yellow')).toBe('badge--warn');
    });
    it('retorna badge--ok para overallStatus green', () => {
      expect(component.statusBadgeClass('green')).toBe('badge--ok');
    });
  });

  describe('datastoreClass', () => {
    it('retorna metric--crit cuando el datastore no es accesible', () => {
      expect(component.datastoreClass(50, false)).toBe('metric--crit');
    });
    it('retorna metric--crit cuando usedPct > 85', () => {
      expect(component.datastoreClass(86, true)).toBe('metric--crit');
    });
    it('retorna metric--warn cuando usedPct > 70', () => {
      expect(component.datastoreClass(75, true)).toBe('metric--warn');
    });
    it('retorna metric--ok para uso normal accesible', () => {
      expect(component.datastoreClass(60, true)).toBe('metric--ok');
    });
  });

  describe('snapshotClass', () => {
    it('retorna badge--crit para snapshots con más de 90 días', () => {
      expect(component.snapshotClass(91)).toBe('badge--crit');
    });
    it('retorna badge--warn para snapshots entre 31 y 90 días', () => {
      expect(component.snapshotClass(45)).toBe('badge--warn');
    });
    it('retorna badge--ok para snapshots de 30 días o menos', () => {
      expect(component.snapshotClass(30)).toBe('badge--ok');
    });
  });
});
