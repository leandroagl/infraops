import { FormControl } from '@angular/forms';
import { of, Subject, throwError } from 'rxjs';
import { ServerHostFormComponent } from './server-host-form.component';
import { ClientInfrastructure, InfraAsset } from '../../../../core/models/infradoc.models';
import { ServerHostPayload, VmwareHealthResult } from '../../../../core/models/maintenance-log.models';
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
  bmcIp: null, bmcType: null, os: null, model: null,
  uri1: 'esxi.cliente.com:344', uri2: null,
  ...overrides,
});

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
  });

  describe('buildPayload()', () => {
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

    it('permite completar sin haber ejecutado el check (vmwareCheck null es válido)', () => {
      const payload = component.buildPayload();
      expect(payload.type).toBe('SERVER_HOST_MAINTENANCE');
      expect(payload.esxiHosts[0].vmwareCheck).toBeNull();
    });

    it('mapea un entry por cada esxiHost de la infrastructure', () => {
      component.infrastructure = makeInfra([makeHost(), makeHost({ assetId: 2, name: 'esxi02' })]);
      expect(component.buildPayload().esxiHosts).toHaveSize(2);
    });

    it('incluye notes cuando tiene valor', () => {
      component.notesControl.setValue('revisar próxima semana');
      expect(component.buildPayload().notes).toBe('revisar próxima semana');
    });

    it('omite notes cuando está vacío', () => {
      component.notesControl.setValue('');
      expect(component.buildPayload().notes).toBeUndefined();
    });
  });

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
  });

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
