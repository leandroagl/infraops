import { FormBuilder } from '@angular/forms';
import { RouterFormComponent } from './router-form.component';
import { ClientInfrastructure, InfraAsset } from '../../../../core/models/infradoc.models';
import { RouterMaintenancePayload } from '../../../../core/models/maintenance-log.models';
import { Task } from '../../../../core/models/task.models';

const makeTask = (): Task => ({
  id: '1', clientId: '10', technicianId: '2',
  type: 'ROUTER_MAINTENANCE', status: 'PENDING',
  scheduledDate: '2026-06-27T00:00:00.000Z',
  completedDate: null, odooTicketId: null,
  createdAt: '2026-06-01T00:00:00.000Z',
});

const makeRouter = (overrides: Partial<InfraAsset> = {}): InfraAsset => ({
  assetId: 1, name: 'router-mikrotik', ip: '192.168.0.1',
  os: null, model: 'MikroTik RB4011', bmcIp: null, bmcType: null,
  ...overrides,
});

const makeInfra = (routers: InfraAsset[] = [makeRouter()]): ClientInfrastructure => ({
  esxiHosts: [], windowsVMs: [], domainControllers: [], linuxVMs: [], nas: [],
  routers,
});

describe('RouterFormComponent — pure unit tests', () => {
  let component: RouterFormComponent;

  beforeEach(() => {
    component = new RouterFormComponent(new FormBuilder());
    component.task = makeTask();
  });

  describe('buildForm()', () => {
    it('crea un control por cada router en infrastructure', () => {
      component.infrastructure = makeInfra([makeRouter(), makeRouter({ assetId: 2, name: 'fw-02' })]);
      component.ngOnChanges({ infrastructure: {} as any });
      expect(component.routerControls.length).toBe(2);
    });

    it('inicializa firmwareUpdated en false', () => {
      component.infrastructure = makeInfra();
      component.ngOnChanges({ infrastructure: {} as any });
      expect(component.routerControls.at(0).get('firmwareUpdated')?.value).toBe(false);
    });

    it('inicializa backupDone en false', () => {
      component.infrastructure = makeInfra();
      component.ngOnChanges({ infrastructure: {} as any });
      expect(component.routerControls.at(0).get('backupDone')?.value).toBe(false);
    });
  });

  describe('buildPayload()', () => {
    beforeEach(() => {
      component.infrastructure = makeInfra();
      component.ngOnChanges({ infrastructure: {} as any });
    });

    it('retorna payload con type ROUTER_MAINTENANCE', () => {
      const payload = component.buildPayload();
      expect(payload.type).toBe('ROUTER_MAINTENANCE');
    });

    it('mapea router con routerId y routerName del infrastructure', () => {
      const payload = component.buildPayload();
      expect(payload.router[0].routerId).toBe(1);
      expect(payload.router[0].routerName).toBe('router-mikrotik');
    });

    it('mapea firmwareUpdated y backupDone del form', () => {
      component.routerControls.at(0).patchValue({ firmwareUpdated: true, backupDone: true });
      const payload = component.buildPayload();
      expect(payload.router[0].firmwareUpdated).toBe(true);
      expect(payload.router[0].backupDone).toBe(true);
    });

    it('incluye firmwareVersion si no está vacío', () => {
      component.routerControls.at(0).patchValue({ firmwareVersion: '7.14.2' });
      const payload = component.buildPayload();
      expect(payload.router[0].firmwareVersion).toBe('7.14.2');
    });

    it('omite firmwareVersion si está vacío', () => {
      component.routerControls.at(0).patchValue({ firmwareVersion: '' });
      const payload = component.buildPayload();
      expect(payload.router[0].firmwareVersion).toBeUndefined();
    });

    it('incluye notes si no está vacío', () => {
      component.form.patchValue({ notes: 'revisar config' });
      expect(component.buildPayload().notes).toBe('revisar config');
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

    it('restaura firmwareUpdated y backupDone del payload guardado', () => {
      const payload: RouterMaintenancePayload = {
        type: 'ROUTER_MAINTENANCE',
        router: [{ routerId: 1, routerName: 'router-mikrotik', firmwareUpdated: true, firmwareVersion: '7.14.2', backupDone: true }],
      };
      component.savedPayload = payload;
      component.ngOnChanges({ infrastructure: {} as any });
      expect(component.routerControls.at(0).get('firmwareUpdated')?.value).toBe(true);
      expect(component.routerControls.at(0).get('firmwareVersion')?.value).toBe('7.14.2');
      expect(component.routerControls.at(0).get('backupDone')?.value).toBe(true);
    });

    it('ignora payload de otro tipo', () => {
      component.savedPayload = { type: 'QNAP_MAINTENANCE', qnap: [] };
      component.ngOnChanges({ infrastructure: {} as any });
      expect(component.routerControls.at(0).get('firmwareUpdated')?.value).toBe(false);
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

  describe('getRouterGroup()', () => {
    it('devuelve el FormGroup en el índice correcto del FormArray', () => {
      component.infrastructure = makeInfra([makeRouter(), makeRouter({ assetId: 2, name: 'fw-02' })]);
      component.ngOnChanges({ infrastructure: {} as any });
      const group = component.getRouterGroup(1);
      expect(group).toBeTruthy();
      expect(group.get('firmwareUpdated')).not.toBeNull();
    });
  });

  describe('outputs', () => {
    beforeEach(() => {
      component.infrastructure = makeInfra();
      component.ngOnChanges({ infrastructure: {} as any });
    });

    it('submit() emite requestComplete con payload ROUTER_MAINTENANCE', () => {
      let emitted: RouterMaintenancePayload | undefined;
      component.requestComplete.subscribe(p => emitted = p);
      component.submit();
      expect(emitted?.type).toBe('ROUTER_MAINTENANCE');
    });

    it('save() emite requestSave con payload ROUTER_MAINTENANCE', () => {
      let emitted: RouterMaintenancePayload | undefined;
      component.requestSave.subscribe(p => emitted = p);
      component.save();
      expect(emitted?.type).toBe('ROUTER_MAINTENANCE');
    });

    it('submitNotDone() emite requestNotDone', () => {
      let emitted = false;
      component.requestNotDone.subscribe(() => emitted = true);
      component.submitNotDone();
      expect(emitted).toBe(true);
    });
  });
});
