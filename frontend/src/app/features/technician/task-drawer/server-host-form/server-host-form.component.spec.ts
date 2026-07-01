import { FormBuilder } from '@angular/forms';
import { ServerHostFormComponent } from './server-host-form.component';
import { ClientInfrastructure, InfraAsset } from '../../../../core/models/infradoc.models';
import { ServerHostPayload } from '../../../../core/models/maintenance-log.models';
import { Task } from '../../../../core/models/task.models';

const makeTask = (): Task => ({
  id: '1', clientId: '10', technicianId: '2',
  type: 'SERVER_HOST_MAINTENANCE', status: 'PENDING',
  scheduledDate: '2026-06-01T00:00:00.000Z',
  completedDate: null, odooTicketId: null,
  createdAt: '2026-05-01T00:00:00.000Z',
});

const makeHost = (overrides: Partial<InfraAsset> = {}): InfraAsset => ({
  assetId: 1, name: 'host1.ondra', ip: '192.168.0.104',
  bmcIp: '192.168.0.200', bmcType: 'iLO',
  os: 'VMware ESXi 7.0', model: 'HPE DL380',
  uri1: null, uri2: null,
  ...overrides,
});

const makeInfra = (hosts: InfraAsset[] = [makeHost()]): ClientInfrastructure => ({
  esxiHosts: hosts,
  windowsVMs: [], domainControllers: [], linuxVMs: [], nas: [], routers: [],
});

describe('ServerHostFormComponent — pure unit tests', () => {
  let component: ServerHostFormComponent;

  beforeEach(() => {
    component = new ServerHostFormComponent(new FormBuilder());
    component.task = makeTask();
  });

  describe('buildForm()', () => {
    it('crea un grupo vmwareHosts y bmcHosts por cada esxiHost', () => {
      component.infrastructure = makeInfra([makeHost(), makeHost({ assetId: 2, name: 'host2' })]);
      component.ngOnChanges({ infrastructure: {} as any });
      expect(component.vmwareHostControls.length).toBe(2);
      expect(component.bmcHostControls.length).toBe(2);
    });

    it('inicializa alertStatus en "ok" para cada host', () => {
      component.infrastructure = makeInfra();
      component.ngOnChanges({ infrastructure: {} as any });
      expect(component.bmcHostControls.at(0).get('alertStatus')?.value).toBe('ok');
    });
  });

  describe('buildPayload()', () => {
    beforeEach(() => {
      component.infrastructure = makeInfra();
      component.ngOnChanges({ infrastructure: {} as any });
    });

    it('retorna payload con type SERVER_HOST_MAINTENANCE', () => {
      const payload = component.buildPayload();
      expect(payload.type).toBe('SERVER_HOST_MAINTENANCE');
    });

    it('mapea vmware con hostId, hostName y métricas del form', () => {
      component.vmwareHostControls.at(0).patchValue({ cpuUsage: 45, memUsage: 60, storageUsage: 70, snapshotsOk: true });
      const payload = component.buildPayload();
      expect(payload.vmware![0].hostId).toBe(1);
      expect(payload.vmware![0].hostName).toBe('host1.ondra');
      expect(payload.vmware![0].cpuUsage).toBe(45);
      expect(payload.vmware![0].snapshotsOk).toBe(true);
    });

    it('mapea bmc con alertStatus y omite alertCategories si no hay alerta', () => {
      component.bmcHostControls.at(0).patchValue({ alertStatus: 'ok', firmwareVersion: '2.82' });
      const payload = component.buildPayload();
      expect(payload.bmc![0].alertStatus).toBe('ok');
      expect(payload.bmc![0].firmwareVersion).toBe('2.82');
      expect(payload.bmc![0].alertCategories).toBeUndefined();
    });

    it('incluye alertCategories en bmc cuando alertStatus es "alerta"', () => {
      component.bmcHostControls.at(0).patchValue({ alertStatus: 'alerta', alertCategories: ['fan', 'psu'] });
      const payload = component.buildPayload();
      expect(payload.bmc![0].alertCategories).toEqual(['fan', 'psu']);
    });

    it('incluye notes si no está vacío', () => {
      component.form.patchValue({ notes: 'revisar próxima semana' });
      expect(component.buildPayload().notes).toBe('revisar próxima semana');
    });

    it('omite notes si está vacío', () => {
      component.form.patchValue({ notes: '' });
      expect(component.buildPayload().notes).toBeUndefined();
    });
  });

  describe('patchFormFromPayload()', () => {
    beforeEach(() => {
      component.infrastructure = makeInfra();
      component.ngOnChanges({ infrastructure: {} as any });
    });

    it('restaura valores de vmware del payload guardado', () => {
      const payload: ServerHostPayload = {
        type: 'SERVER_HOST_MAINTENANCE',
        vmware: [{ hostId: 1, hostName: 'host1.ondra', cpuUsage: 55, memUsage: 72, storageUsage: 80, snapshotsOk: false }],
        bmc: [{ hostId: 1, hostName: 'host1.ondra', alertStatus: 'ok' }],
      };
      component.savedPayload = payload;
      component.ngOnChanges({ infrastructure: {} as any });
      expect(component.vmwareHostControls.at(0).get('cpuUsage')?.value).toBe(55);
      expect(component.vmwareHostControls.at(0).get('memUsage')?.value).toBe(72);
    });

    it('restaura alertStatus de bmc del payload guardado', () => {
      const payload: ServerHostPayload = {
        type: 'SERVER_HOST_MAINTENANCE',
        vmware: [{ hostId: 1, hostName: 'host1.ondra', cpuUsage: 0, memUsage: 0, storageUsage: 0, snapshotsOk: false }],
        bmc: [{ hostId: 1, hostName: 'host1.ondra', alertStatus: 'alerta', alertCategories: ['fan'] }],
      };
      component.savedPayload = payload;
      component.ngOnChanges({ infrastructure: {} as any });
      expect(component.bmcHostControls.at(0).get('alertStatus')?.value).toBe('alerta');
      expect(component.bmcHostControls.at(0).get('alertCategories')?.value).toEqual(['fan']);
    });

    it('ignora payload de otro tipo', () => {
      component.savedPayload = { type: 'QNAP_MAINTENANCE', qnap: [] };
      component.ngOnChanges({ infrastructure: {} as any });
      expect(component.vmwareHostControls.at(0).get('cpuUsage')?.value).toBeNull();
    });
  });

  describe('readOnly', () => {
    it('deshabilita el form cuando readOnly = true', () => {
      component.infrastructure = makeInfra();
      component.readOnly = true;
      component.ngOnChanges({ infrastructure: {} as any });
      expect(component.form.disabled).toBe(true);
    });

    it('habilita el form cuando readOnly cambia a false', () => {
      component.infrastructure = makeInfra();
      component.readOnly = true;
      component.ngOnChanges({ infrastructure: {} as any });
      component.readOnly = false;
      component.ngOnChanges({ readOnly: {} as any });
      expect(component.form.disabled).toBe(false);
    });
  });

  describe('helpers', () => {
    beforeEach(() => {
      component.infrastructure = makeInfra();
      component.ngOnChanges({ infrastructure: {} as any });
    });

    it('metricClass retorna "mf-inp--crit" cuando value >= critThreshold', () => {
      expect(component.metricClass(85, 60, 80)).toBe('mf-inp--crit');
    });

    it('metricClass retorna "mf-inp--warn" cuando value >= warnThreshold', () => {
      expect(component.metricClass(65, 60, 80)).toBe('mf-inp--warn');
    });

    it('metricClass retorna "mf-inp--ok" cuando value < warnThreshold', () => {
      expect(component.metricClass(40, 60, 80)).toBe('mf-inp--ok');
    });

    it('metricClass retorna "" para null', () => {
      expect(component.metricClass(null, 60, 80)).toBe('');
    });

    it('showHighVMsForHost retorna true cuando cpu >= 60', () => {
      component.vmwareHostControls.at(0).patchValue({ cpuUsage: 60, memUsage: 0, storageUsage: 0 });
      expect(component.showHighVMsForHost(0)).toBe(true);
    });

    it('bmcHasAlert retorna true cuando alertStatus es "alerta"', () => {
      component.bmcHostControls.at(0).patchValue({ alertStatus: 'alerta' });
      expect(component.bmcHasAlert(0)).toBe(true);
    });
  });

  describe('outputs', () => {
    beforeEach(() => {
      component.infrastructure = makeInfra();
      component.ngOnChanges({ infrastructure: {} as any });
    });

    it('submit() emite requestComplete con el payload', () => {
      let emitted: ServerHostPayload | undefined;
      component.requestComplete.subscribe(p => emitted = p);
      component.submit();
      expect(emitted?.type).toBe('SERVER_HOST_MAINTENANCE');
    });

    it('save() emite requestSave con el payload', () => {
      let emitted: ServerHostPayload | undefined;
      component.requestSave.subscribe(p => emitted = p);
      component.save();
      expect(emitted?.type).toBe('SERVER_HOST_MAINTENANCE');
    });

    it('submitNotDone() emite requestNotDone', () => {
      let emitted = false;
      component.requestNotDone.subscribe(() => emitted = true);
      component.submitNotDone();
      expect(emitted).toBe(true);
    });
  });
});
