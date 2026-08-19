import { of, Subject, throwError } from 'rxjs';
import { ServerHostFormComponent } from './server-host-form.component';
import { ClientInfrastructure, InfraAsset } from '../../../../core/models/infradoc.models';
import { BmcEntry, ServerHostPayload, VmwareHealthResult } from '../../../../core/models/maintenance-log.models';
import { Task } from '../../../../core/models/task.models';

const makeTask = (): Task => ({
  id: '1', clientId: '10', technicianId: '2',
  type: 'SERVER_HOST_MAINTENANCE', status: 'PENDING',
  scheduledDate: '2026-06-01T00:00:00.000Z',
  completedDate: null, odooTicketId: null,
  createdAt: '2026-05-01T00:00:00.000Z',
});

const makeHost = (overrides: Partial<InfraAsset> = {}): InfraAsset => ({
  assetId: 1, name: 'esxi01', ip: '192.168.1.10',
  bmcIp: null, bmcType: null, os: null, make: null, model: null,
  uri1: 'esxi.cliente.com:344', uri2: null,
  ...overrides,
});

const makeWinHost = (overrides: Partial<InfraAsset> = {}): InfraAsset =>
  makeHost({ assetId: 2, name: 'srv-win01', os: 'Windows Server 2019', uri1: null, ...overrides });

const makeInfra = (hosts: InfraAsset[] = [makeHost()]): ClientInfrastructure => ({
  esxiHosts: hosts, windowsVMs: [], domainControllers: [], linuxVMs: [], nas: [], routers: [],
});

const MOCK_RESULT: VmwareHealthResult = {
  host: {
    name: 'esxi01', esxiVersion: '7.0.3', uptimeHours: 100,
    cpuUsagePct: 20, memUsagePct: 50,
    overallStatus: 'green', hardwareAlerts: [],
  },
  datastores: [],
  vms: { poweredOn: 1, poweredOff: 0, suspended: 0, snapshotTotal: 0, snapshots: [], toolsNotOk: 0 },
  network: { vswitchErrors: [], nicsFailed: [], nicsOnline: [] },
  collectedAt: '2026-06-29T00:00:00Z',
};

describe('ServerHostFormComponent', () => {
  let component: ServerHostFormComponent;
  let mockVmwareApi: { healthCheck: jasmine.Spy };

  beforeEach(() => {
    mockVmwareApi = { healthCheck: jasmine.createSpy('healthCheck') };
    component = new ServerHostFormComponent(mockVmwareApi as any);
    component.task = makeTask();
    component.infrastructure = makeInfra();
    component.ngOnChanges({ infrastructure: {} as any });
  });

  // ── isWindowsHost ──────────────────────────────────────────────────────────

  describe('isWindowsHost()', () => {
    it('retorna true cuando os empieza con "Windows"', () => {
      expect(component.isWindowsHost(makeWinHost())).toBe(true);
    });

    it('es case-insensitive', () => {
      expect(component.isWindowsHost(makeHost({ os: 'windows server 2022' }))).toBe(true);
    });

    it('retorna false cuando os es VMware ESXi', () => {
      expect(component.isWindowsHost(makeHost({ os: 'VMware ESXi 7.0' }))).toBe(false);
    });

    it('retorna false cuando os es null', () => {
      expect(component.isWindowsHost(makeHost({ os: null }))).toBe(false);
    });
  });

  // ── ngOnChanges — initWindowsControls ─────────────────────────────────────

  describe('ngOnChanges — infrastructure', () => {
    it('crea controles para hosts Windows', () => {
      component.infrastructure = makeInfra([makeWinHost()]);
      component.ngOnChanges({ infrastructure: {} as any });
      expect(component.windowsControls.has(2)).toBe(true);
    });

    it('no crea controles para hosts VMware', () => {
      expect(component.windowsControls.has(1)).toBe(false);
    });

    it('inicializa updates y restartScript en "ok"', () => {
      component.infrastructure = makeInfra([makeWinHost()]);
      component.ngOnChanges({ infrastructure: {} as any });
      const ctrl = component.windowsControls.get(2)!;
      expect(ctrl.updates.value).toBe('ok');
      expect(ctrl.restartScript.value).toBe('ok');
    });

    it('reinicia controles al cambiar infrastructure', () => {
      component.infrastructure = makeInfra([makeWinHost()]);
      component.ngOnChanges({ infrastructure: {} as any });
      component.infrastructure = makeInfra([makeHost()]);
      component.ngOnChanges({ infrastructure: {} as any });
      expect(component.windowsControls.size).toBe(0);
    });
  });

  // ── buildPayload — hosts VMware ────────────────────────────────────────────

  describe('buildPayload() — hosts VMware', () => {
    it('retorna payload con type SERVER_HOST_MAINTENANCE', () => {
      expect(component.buildPayload().type).toBe('SERVER_HOST_MAINTENANCE');
    });

    it('incluye vmwareCheck null cuando no se ejecutó el check', () => {
      const payload = component.buildPayload();
      expect(payload.esxiHosts[0].vmwareCheck).toBeNull();
    });

    it('incluye vmwareCheck cuando el resultado está disponible', () => {
      component.vmwareResults.set(1, MOCK_RESULT);
      expect(component.buildPayload().esxiHosts[0].vmwareCheck).toEqual(MOCK_RESULT);
    });

    it('mapea un entry por cada host VMware', () => {
      component.infrastructure = makeInfra([makeHost(), makeHost({ assetId: 3, name: 'esxi02' })]);
      component.ngOnChanges({ infrastructure: {} as any });
      expect(component.buildPayload().esxiHosts).toHaveSize(2);
    });

    it('no incluye windowsHosts cuando no hay hosts Windows', () => {
      expect(component.buildPayload().windowsHosts).toBeUndefined();
    });

    it('incluye notes cuando tiene valor', () => {
      component.notesControl.setValue('revisar próxima semana');
      expect(component.buildPayload().notes).toBe('revisar próxima semana');
    });

    it('omite notes cuando está vacío', () => {
      component.notesControl.setValue('');
      expect(component.buildPayload().notes).toBeUndefined();
    });

    it('incluye bmc array con un entry por cada host', () => {
      const payload = component.buildPayload();
      expect(payload.bmc).toHaveSize(1);
      expect(payload.bmc![0].hostId).toBe(1);
    });

    it('incluye alertStatus "ok" por defecto en cada bmc entry', () => {
      expect(component.buildPayload().bmc![0].alertStatus).toBe('ok');
    });

    it('refleja cambios de BMC en el payload cuando onBmcChange es llamado', () => {
      const entry: BmcEntry = { hostId: 1, hostName: 'esxi01', alertStatus: 'alerta', alertCategories: ['fan'] };
      component.onBmcChange(entry);
      const bmc = component.buildPayload().bmc![0];
      expect(bmc.alertStatus).toBe('alerta');
      expect(bmc.alertCategories).toEqual(['fan']);
    });
  });

  // ── buildPayload — hosts Windows ───────────────────────────────────────────

  describe('buildPayload() — hosts Windows', () => {
    beforeEach(() => {
      component.infrastructure = makeInfra([makeWinHost()]);
      component.ngOnChanges({ infrastructure: {} as any });
    });

    it('el host Windows NO aparece en esxiHosts', () => {
      expect(component.buildPayload().esxiHosts).toHaveSize(0);
    });

    it('el host Windows aparece en windowsHosts', () => {
      const payload = component.buildPayload();
      expect(payload.windowsHosts).toHaveSize(1);
    });

    it('windowsHost tiene serverId y serverName correctos', () => {
      const win = component.buildPayload().windowsHosts![0];
      expect(win.serverId).toBe(2);
      expect(win.serverName).toBe('srv-win01');
    });

    it('windowsHost tiene updates "ok" por defecto', () => {
      expect(component.buildPayload().windowsHosts![0].updates).toBe('ok');
    });

    it('windowsHost refleja el valor del control cuando se modifica', () => {
      component.windowsControls.get(2)!.updates.setValue('failed');
      expect(component.buildPayload().windowsHosts![0].updates).toBe('failed');
    });

    it('windowsHost refleja restartScript cuando se modifica', () => {
      component.windowsControls.get(2)!.restartScript.setValue('error');
      expect(component.buildPayload().windowsHosts![0].restartScript).toBe('error');
    });

    it('el bmc entry se incluye igual para hosts Windows', () => {
      const bmc = component.buildPayload().bmc!;
      expect(bmc).toHaveSize(1);
      expect(bmc[0].hostId).toBe(2);
    });
  });

  // ── buildPayload — infraestructura mixta ───────────────────────────────────

  describe('buildPayload() — infraestructura mixta', () => {
    beforeEach(() => {
      component.infrastructure = makeInfra([makeHost(), makeWinHost()]);
      component.ngOnChanges({ infrastructure: {} as any });
    });

    it('separa correctamente VMware de Windows en el payload', () => {
      const payload = component.buildPayload();
      expect(payload.esxiHosts).toHaveSize(1);
      expect(payload.windowsHosts).toHaveSize(1);
    });

    it('el host VMware va a esxiHosts con su assetId', () => {
      expect(component.buildPayload().esxiHosts[0].assetId).toBe(1);
    });

    it('el host Windows va a windowsHosts con su serverId', () => {
      expect(component.buildPayload().windowsHosts![0].serverId).toBe(2);
    });

    it('bmc incluye ambos hosts', () => {
      expect(component.buildPayload().bmc).toHaveSize(2);
    });
  });

  // ── windowsRowState ────────────────────────────────────────────────────────

  describe('windowsRowState()', () => {
    beforeEach(() => {
      component.infrastructure = makeInfra([makeWinHost()]);
      component.ngOnChanges({ infrastructure: {} as any });
    });

    it('retorna "ok" cuando ambos controles son ok', () => {
      expect(component.windowsRowState(2)).toBe('ok');
    });

    it('retorna "warn" cuando updates es "pending"', () => {
      component.windowsControls.get(2)!.updates.setValue('pending');
      expect(component.windowsRowState(2)).toBe('warn');
    });

    it('retorna "warn" cuando restartScript es "no_task"', () => {
      component.windowsControls.get(2)!.restartScript.setValue('no_task');
      expect(component.windowsRowState(2)).toBe('warn');
    });

    it('retorna "crit" cuando updates es "failed"', () => {
      component.windowsControls.get(2)!.updates.setValue('failed');
      expect(component.windowsRowState(2)).toBe('crit');
    });

    it('retorna "crit" cuando restartScript es "error"', () => {
      component.windowsControls.get(2)!.restartScript.setValue('error');
      expect(component.windowsRowState(2)).toBe('crit');
    });

    it('crit tiene prioridad sobre warn', () => {
      component.windowsControls.get(2)!.updates.setValue('failed');
      component.windowsControls.get(2)!.restartScript.setValue('no_task');
      expect(component.windowsRowState(2)).toBe('crit');
    });
  });

  // ── onRunCheck ─────────────────────────────────────────────────────────────

  describe('onRunCheck()', () => {
    it('agrega assetId a loadingHosts mientras espera respuesta', () => {
      mockVmwareApi.healthCheck.and.returnValue(new Subject());
      component.onRunCheck('esxi.cliente.com:344', 1);
      expect(component.loadingHosts.has(1)).toBe(true);
    });

    it('almacena resultado en vmwareResults y elimina de loadingHosts al tener éxito', () => {
      mockVmwareApi.healthCheck.and.returnValue(of(MOCK_RESULT));
      component.onRunCheck('esxi.cliente.com:344', 1);
      expect(component.vmwareResults.get(1)).toEqual(MOCK_RESULT);
      expect(component.loadingHosts.has(1)).toBe(false);
    });

    it('almacena error en hostErrors y elimina de loadingHosts al fallar', () => {
      mockVmwareApi.healthCheck.and.returnValue(
        throwError(() => ({ error: { message: 'Host inaccesible' } })),
      );
      component.onRunCheck('esxi.cliente.com:344', 1);
      expect(component.hostErrors.get(1)).toBe('Host inaccesible');
      expect(component.loadingHosts.has(1)).toBe(false);
    });

    it('limpia error previo al re-ejecutar', () => {
      component.hostErrors.set(1, 'error anterior');
      mockVmwareApi.healthCheck.and.returnValue(new Subject());
      component.onRunCheck('esxi.cliente.com:344', 1);
      expect(component.hostErrors.has(1)).toBe(false);
    });
  });

  // ── ngOnChanges — restoreFromPayload ──────────────────────────────────────

  describe('ngOnChanges — restoreFromPayload', () => {
    it('restaura vmwareResults desde payload guardado', () => {
      component.savedPayload = {
        type: 'SERVER_HOST_MAINTENANCE',
        esxiHosts: [{ assetId: 1, vmwareCheck: MOCK_RESULT }],
      };
      component.ngOnChanges({ savedPayload: {} as any });
      expect(component.vmwareResults.get(1)).toEqual(MOCK_RESULT);
    });

    it('restaura notes desde payload guardado', () => {
      component.savedPayload = {
        type: 'SERVER_HOST_MAINTENANCE',
        esxiHosts: [],
        notes: 'notas de prueba',
      };
      component.ngOnChanges({ savedPayload: {} as any });
      expect(component.notesControl.value).toBe('notas de prueba');
    });

    it('ignora payload de otro tipo', () => {
      component.savedPayload = { type: 'QNAP_MAINTENANCE', qnap: [] };
      component.ngOnChanges({ savedPayload: {} as any });
      expect(component.vmwareResults.size).toBe(0);
    });

    it('restaura bmcData desde payload guardado', () => {
      const bmcEntry: BmcEntry = { hostId: 1, hostName: 'esxi01', alertStatus: 'alerta', alertCategories: ['psu'] };
      component.savedPayload = {
        type: 'SERVER_HOST_MAINTENANCE',
        esxiHosts: [],
        bmc: [bmcEntry],
      };
      component.ngOnChanges({ savedPayload: {} as any });
      expect(component.bmcData.get(1)?.alertStatus).toBe('alerta');
      expect(component.bmcData.get(1)?.alertCategories).toEqual(['psu']);
    });

    it('no falla si el payload no tiene bmc (compatibilidad con logs anteriores)', () => {
      component.savedPayload = {
        type: 'SERVER_HOST_MAINTENANCE',
        esxiHosts: [{ assetId: 1, vmwareCheck: null }],
      };
      expect(() => component.ngOnChanges({ savedPayload: {} as any })).not.toThrow();
      expect(component.bmcData.size).toBe(0);
    });

    it('restaura controles Windows desde windowsHosts del payload', () => {
      component.infrastructure = makeInfra([makeWinHost()]);
      component.ngOnChanges({ infrastructure: {} as any });
      component.savedPayload = {
        type: 'SERVER_HOST_MAINTENANCE',
        esxiHosts: [],
        windowsHosts: [{ serverId: 2, serverName: 'srv-win01', updates: 'pending', restartScript: 'no_task' }],
      };
      component.ngOnChanges({ savedPayload: {} as any });
      const ctrl = component.windowsControls.get(2)!;
      expect(ctrl.updates.value).toBe('pending');
      expect(ctrl.restartScript.value).toBe('no_task');
    });

    it('no falla si el payload no tiene windowsHosts', () => {
      component.savedPayload = {
        type: 'SERVER_HOST_MAINTENANCE',
        esxiHosts: [],
      };
      expect(() => component.ngOnChanges({ savedPayload: {} as any })).not.toThrow();
    });
  });

  // ── readOnly ───────────────────────────────────────────────────────────────

  describe('ngOnChanges — readOnly', () => {
    it('deshabilita notesControl cuando readOnly es true', () => {
      component.readOnly = true;
      component.ngOnChanges({ readOnly: {} as any });
      expect(component.notesControl.disabled).toBe(true);
    });

    it('deshabilita controles Windows cuando readOnly es true', () => {
      component.infrastructure = makeInfra([makeWinHost()]);
      component.ngOnChanges({ infrastructure: {} as any });
      component.readOnly = true;
      component.ngOnChanges({ readOnly: {} as any });
      const ctrl = component.windowsControls.get(2)!;
      expect(ctrl.updates.disabled).toBe(true);
      expect(ctrl.restartScript.disabled).toBe(true);
    });

    it('habilita controles Windows cuando readOnly vuelve a false', () => {
      component.infrastructure = makeInfra([makeWinHost()]);
      component.ngOnChanges({ infrastructure: {} as any });
      component.readOnly = true;
      component.ngOnChanges({ readOnly: {} as any });
      component.readOnly = false;
      component.ngOnChanges({ readOnly: {} as any });
      const ctrl = component.windowsControls.get(2)!;
      expect(ctrl.updates.enabled).toBe(true);
    });
  });

  // ── outputs ────────────────────────────────────────────────────────────────

  describe('outputs', () => {
    it('submit() emite requestComplete con el payload', () => {
      let emitted: ServerHostPayload | undefined;
      component.requestComplete.subscribe(p => (emitted = p));
      component.submit();
      expect(emitted?.type).toBe('SERVER_HOST_MAINTENANCE');
    });

    it('save() emite requestSave con el payload', () => {
      let emitted: ServerHostPayload | undefined;
      component.requestSave.subscribe(p => (emitted = p));
      component.save();
      expect(emitted?.type).toBe('SERVER_HOST_MAINTENANCE');
    });

    it('submitNotDone() emite requestNotDone', () => {
      let emitted = false;
      component.requestNotDone.subscribe(() => (emitted = true));
      component.submitNotDone();
      expect(emitted).toBe(true);
    });
  });
});
