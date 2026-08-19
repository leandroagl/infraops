import { SimpleChange } from '@angular/core';
import { BmcHostCardComponent } from './bmc-host-card.component';
import { InfraAsset } from '../../../../../core/models/infradoc.models';
import { BmcEntry } from '../../../../../core/models/maintenance-log.models';

const makeHost = (overrides: Partial<InfraAsset> = {}): InfraAsset => ({
  assetId: 1, name: 'esxi01', ip: '192.168.1.10',
  bmcIp: '192.168.1.200', bmcType: 'iDRAC',
  os: null, make: null, model: null, uri1: null, uri2: null,
  ...overrides,
});

const makeEntry = (overrides: Partial<BmcEntry> = {}): BmcEntry => ({
  hostId: 1,
  hostName: 'esxi01',
  alertStatus: 'ok',
  ...overrides,
});

describe('BmcHostCardComponent', () => {
  let component: BmcHostCardComponent;

  beforeEach(() => {
    component = new BmcHostCardComponent();
    component.host = makeHost();
    component.ngOnInit();
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  describe('buildEntry()', () => {
    it('retorna hostId y hostName del host recibido', () => {
      const entry = component.buildEntry();
      expect(entry.hostId).toBe(1);
      expect(entry.hostName).toBe('esxi01');
    });

    it('retorna alertStatus "ok" por defecto', () => {
      expect(component.buildEntry().alertStatus).toBe('ok');
    });

    it('omite alertCategories cuando alertStatus es "ok"', () => {
      component.alertStatusCtrl.setValue('ok');
      component.categoriesCtrl.setValue(['fan', 'psu']);
      expect(component.buildEntry().alertCategories).toBeUndefined();
    });

    it('incluye alertCategories cuando alertStatus es "alerta" y hay categorías', () => {
      component.alertStatusCtrl.setValue('alerta');
      component.categoriesCtrl.setValue(['fan', 'psu']);
      expect(component.buildEntry().alertCategories).toEqual(['fan', 'psu']);
    });

    it('omite alertCategories cuando alertStatus es "alerta" pero la selección está vacía', () => {
      component.alertStatusCtrl.setValue('alerta');
      component.categoriesCtrl.setValue([]);
      expect(component.buildEntry().alertCategories).toBeUndefined();
    });

    it('omite alertLogs cuando alertStatus es "ok"', () => {
      component.alertLogsCtrl.setValue('hay algo');
      expect(component.buildEntry().alertLogs).toBeUndefined();
    });

    it('incluye alertLogs cuando alertStatus es "alerta" y hay texto', () => {
      component.alertStatusCtrl.setValue('alerta');
      component.alertLogsCtrl.setValue('Fan running slow');
      expect(component.buildEntry().alertLogs).toBe('Fan running slow');
    });

    it('omite alertLogs cuando alertStatus es "alerta" pero el campo está vacío', () => {
      component.alertStatusCtrl.setValue('alerta');
      component.alertLogsCtrl.setValue('');
      expect(component.buildEntry().alertLogs).toBeUndefined();
    });

    it('omite firmwareVersion cuando firmwareUpdatedCtrl es false', () => {
      component.firmwareUpdatedCtrl.setValue(false);
      component.firmwareVersionCtrl.setValue('6.10.30');
      expect(component.buildEntry().firmwareVersion).toBeUndefined();
    });

    it('incluye firmwareVersion cuando firmwareUpdatedCtrl es true y hay versión', () => {
      component.firmwareUpdatedCtrl.setValue(true);
      component.firmwareVersionCtrl.setValue('6.10.30.20');
      expect(component.buildEntry().firmwareVersion).toBe('6.10.30.20');
    });

    it('omite firmwareVersion cuando firmwareUpdatedCtrl es true pero la versión está vacía', () => {
      component.firmwareUpdatedCtrl.setValue(true);
      component.firmwareVersionCtrl.setValue('');
      expect(component.buildEntry().firmwareVersion).toBeUndefined();
    });

    it('omite biosVersion cuando biosUpdatedCtrl es false', () => {
      component.biosUpdatedCtrl.setValue(false);
      component.biosVersionCtrl.setValue('2.20.1');
      expect(component.buildEntry().biosVersion).toBeUndefined();
    });

    it('incluye biosVersion cuando biosUpdatedCtrl es true y hay versión', () => {
      component.biosUpdatedCtrl.setValue(true);
      component.biosVersionCtrl.setValue('2.20.1');
      expect(component.buildEntry().biosVersion).toBe('2.20.1');
    });

    it('omite biosVersion cuando biosUpdatedCtrl es true pero la versión está vacía', () => {
      component.biosUpdatedCtrl.setValue(true);
      component.biosVersionCtrl.setValue('');
      expect(component.buildEntry().biosVersion).toBeUndefined();
    });
  });

  describe('setValue()', () => {
    it('restaura alertStatus', () => {
      component.setValue(makeEntry({ alertStatus: 'alerta' }));
      expect(component.alertStatusCtrl.value).toBe('alerta');
    });

    it('restaura alertCategories', () => {
      component.setValue(makeEntry({ alertStatus: 'alerta', alertCategories: ['fan', 'cpu'] }));
      expect(component.categoriesCtrl.value).toEqual(['fan', 'cpu']);
    });

    it('restaura alertLogs', () => {
      component.setValue(makeEntry({ alertStatus: 'alerta', alertLogs: 'Fan issue detected' }));
      expect(component.alertLogsCtrl.value).toBe('Fan issue detected');
    });

    it('restaura firmwareVersion y marca firmwareUpdatedCtrl como true', () => {
      component.setValue(makeEntry({ firmwareVersion: '6.10.30.20' }));
      expect(component.firmwareUpdatedCtrl.value).toBe(true);
      expect(component.firmwareVersionCtrl.value).toBe('6.10.30.20');
    });

    it('no marca firmwareUpdatedCtrl cuando firmwareVersion no está en el entry', () => {
      component.setValue(makeEntry());
      expect(component.firmwareUpdatedCtrl.value).toBe(false);
    });

    it('restaura biosVersion y marca biosUpdatedCtrl como true', () => {
      component.setValue(makeEntry({ biosVersion: '2.20.1' }));
      expect(component.biosUpdatedCtrl.value).toBe(true);
      expect(component.biosVersionCtrl.value).toBe('2.20.1');
    });

    it('no marca biosUpdatedCtrl cuando biosVersion no está en el entry', () => {
      component.setValue(makeEntry());
      expect(component.biosUpdatedCtrl.value).toBe(false);
    });

    it('no dispara bmcChange al llamar setValue (emitEvent false)', () => {
      const emitted: BmcEntry[] = [];
      component.bmcChange.subscribe(e => emitted.push(e));
      component.setValue(makeEntry({ alertStatus: 'alerta' }));
      expect(emitted.length).toBe(0);
    });
  });

  describe('ngOnChanges — savedEntry', () => {
    it('aplica savedEntry cuando llega como input', () => {
      component.savedEntry = makeEntry({ alertStatus: 'alerta', alertCategories: ['psu'] });
      component.ngOnChanges({
        savedEntry: new SimpleChange(null, component.savedEntry, true),
      });
      expect(component.alertStatusCtrl.value).toBe('alerta');
      expect(component.categoriesCtrl.value).toEqual(['psu']);
    });

    it('ignora ngOnChanges si savedEntry es null', () => {
      component.savedEntry = null;
      component.ngOnChanges({
        savedEntry: new SimpleChange(null, null, true),
      });
      expect(component.alertStatusCtrl.value).toBe('ok');
    });
  });

  describe('showAlertDetails', () => {
    it('es false cuando alertStatus es "ok"', () => {
      component.alertStatusCtrl.setValue('ok');
      expect(component.showAlertDetails).toBeFalse();
    });

    it('es true cuando alertStatus es "alerta"', () => {
      component.alertStatusCtrl.setValue('alerta');
      expect(component.showAlertDetails).toBeTrue();
    });
  });

  describe('bmcChange output', () => {
    it('emite cuando alertStatus cambia', () => {
      const emitted: BmcEntry[] = [];
      component.bmcChange.subscribe(e => emitted.push(e));
      component.alertStatusCtrl.setValue('alerta');
      expect(emitted.length).toBeGreaterThan(0);
      expect(emitted[emitted.length - 1].alertStatus).toBe('alerta');
    });

    it('emite cuando firmwareUpdatedCtrl cambia', () => {
      const emitted: BmcEntry[] = [];
      component.bmcChange.subscribe(e => emitted.push(e));
      component.firmwareUpdatedCtrl.setValue(true);
      expect(emitted.length).toBeGreaterThan(0);
    });

    it('emite cuando categoriesCtrl cambia y alertStatus es alerta', () => {
      component.alertStatusCtrl.setValue('alerta');
      const emitted: BmcEntry[] = [];
      component.bmcChange.subscribe(e => emitted.push(e));
      component.categoriesCtrl.setValue(['fan']);
      const last = emitted[emitted.length - 1];
      expect(last.alertCategories).toEqual(['fan']);
    });
  });

  describe('bmcTypeLabel', () => {
    it('retorna "iDRAC" cuando bmcType contiene "idrac" (case insensitive)', () => {
      component.host = makeHost({ bmcType: 'iDRAC Management' });
      expect(component.bmcTypeLabel).toBe('iDRAC');
    });

    it('retorna "iLO" cuando bmcType contiene "ilo"', () => {
      component.host = makeHost({ bmcType: 'iLO Port' });
      expect(component.bmcTypeLabel).toBe('iLO');
    });

    it('retorna "xClarity" cuando bmcType contiene "xclarity"', () => {
      component.host = makeHost({ bmcType: 'xClarity Controller' });
      expect(component.bmcTypeLabel).toBe('xClarity');
    });

    it('retorna el valor original cuando no coincide con ningún patrón conocido', () => {
      component.host = makeHost({ bmcType: 'BMC-Custom' });
      expect(component.bmcTypeLabel).toBe('BMC-Custom');
    });

    it('retorna null cuando bmcType es null', () => {
      component.host = makeHost({ bmcType: null });
      expect(component.bmcTypeLabel).toBeNull();
    });
  });

  describe('isOk', () => {
    it('es true cuando alertStatus es "ok"', () => {
      component.alertStatusCtrl.setValue('ok');
      expect(component.isOk).toBeTrue();
    });

    it('es false cuando alertStatus es "alerta"', () => {
      component.alertStatusCtrl.setValue('alerta');
      expect(component.isOk).toBeFalse();
    });
  });

  describe('readOnly', () => {
    it('deshabilita todos los controles cuando readOnly es true en ngOnInit', () => {
      component.ngOnDestroy();
      component = new BmcHostCardComponent();
      component.host = makeHost();
      component.readOnly = true;
      component.ngOnInit();
      expect(component.alertStatusCtrl.disabled).toBeTrue();
      expect(component.firmwareUpdatedCtrl.disabled).toBeTrue();
    });
  });
});
