import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MaintenanceFormComponent } from './maintenance-form.component';
import { Task } from '../../../../core/models/task.models';
import { ClientInfrastructure } from '../../../../core/models/infradoc.models';
import {
  ServerMaintenancePayload,
  TerminalPayload,
} from '../../../../core/models/maintenance-log.models';

const makeTask = (type = 'SERVER_MAINTENANCE'): Task => ({
  id: '1',
  clientId: '10',
  technicianId: '2',
  type: type as Task['type'],
  status: 'PENDING',
  scheduledDate: '2026-06-01T00:00:00.000Z',
  completedDate: null,
  odooTicketId: null,
  createdAt: '2026-05-01T00:00:00.000Z',
});

const makeInfra = (overrides: Partial<ClientInfrastructure> = {}): ClientInfrastructure => ({
  servers: [{ assetId: 1, name: 'SRV-DC01', ip: '10.0.0.1', os: 'Windows Server 2019', model: null }],
  vms: [{ assetId: 2, name: 'VM-APP01', ip: '10.0.0.2', os: null, model: null }],
  nas: [{ assetId: 3, name: 'NAS-01', ip: '10.0.0.3', os: null, model: 'QNAP TS-453D' }],
  routers: [{ assetId: 4, name: 'MKT-01', ip: '10.0.0.254', os: null, model: 'MikroTik' }],
  ...overrides,
});

describe('MaintenanceFormComponent', () => {
  let component: MaintenanceFormComponent;
  let fixture: ComponentFixture<MaintenanceFormComponent>;

  function init(task: Task, infra: ClientInfrastructure): void {
    fixture = TestBed.createComponent(MaintenanceFormComponent);
    component = fixture.componentInstance;
    component.task = task;
    component.infrastructure = infra;
    component.ngOnChanges({
      infrastructure: new SimpleChange(undefined, infra, true),
      task: new SimpleChange(undefined, task, true),
    });
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MaintenanceFormComponent],
      imports: [ReactiveFormsModule],
    }).compileComponents();
  });

  // ── Getters condicionales ───────────────────────────────────────────────────

  describe('conditional getters', () => {
    it('hasServers should be true when infrastructure.servers.length > 0', () => {
      init(makeTask(), makeInfra());
      expect(component.hasServers).toBeTrue();
    });

    it('hasServers should be false when servers array is empty', () => {
      init(makeTask(), makeInfra({ servers: [] }));
      expect(component.hasServers).toBeFalse();
    });

    it('hasVMware should be true when infrastructure.vms.length > 0', () => {
      init(makeTask(), makeInfra());
      expect(component.hasVMware).toBeTrue();
    });

    it('hasVMware should be false when vms array is empty', () => {
      init(makeTask(), makeInfra({ vms: [] }));
      expect(component.hasVMware).toBeFalse();
    });

    it('hasQNAP should be true when infrastructure.nas.length > 0', () => {
      init(makeTask(), makeInfra());
      expect(component.hasQNAP).toBeTrue();
    });

    it('hasQNAP should be false when nas array is empty', () => {
      init(makeTask(), makeInfra({ nas: [] }));
      expect(component.hasQNAP).toBeFalse();
    });

    it('hasVeeam should be true when infrastructure.vms.length > 0', () => {
      init(makeTask(), makeInfra());
      expect(component.hasVeeam).toBeTrue();
    });

    it('hasVeeam should be false when vms array is empty', () => {
      init(makeTask(), makeInfra({ vms: [] }));
      expect(component.hasVeeam).toBeFalse();
    });

    it('hasRouter should be true when infrastructure.routers.length > 0', () => {
      init(makeTask(), makeInfra());
      expect(component.hasRouter).toBeTrue();
    });

    it('hasRouter should be false when routers array is empty', () => {
      init(makeTask(), makeInfra({ routers: [] }));
      expect(component.hasRouter).toBeFalse();
    });
  });

  // ── buildPayload — SERVER_MAINTENANCE ───────────────────────────────────────

  describe('buildPayload — SERVER_MAINTENANCE', () => {
    it('should build ServerMaintenancePayload with type SERVER_MAINTENANCE', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ vms: [], nas: [], routers: [] }));
      const payload = component.buildPayload() as ServerMaintenancePayload;
      expect(payload.type).toBe('SERVER_MAINTENANCE');
    });

    it('should include windows.servers with reboot and updates per server', () => {
      const infra = makeInfra({ vms: [], nas: [], routers: [] });
      init(makeTask('SERVER_MAINTENANCE'), infra);
      component.serverControls.at(0).patchValue({ reboot: 'OK', updates: 'Aplicados hoy' });
      const payload = component.buildPayload() as ServerMaintenancePayload;
      expect(payload.windows.servers.length).toBe(1);
      expect(payload.windows.servers[0].serverName).toBe('SRV-DC01');
      expect(payload.windows.servers[0].reboot).toBe('OK');
      expect(payload.windows.servers[0].updates).toBe('Aplicados hoy');
    });

    it('should include windows.dcdiag from form value', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ vms: [], nas: [], routers: [] }));
      component.form.patchValue({ dcdiag: 'OK (FSR)' });
      const payload = component.buildPayload() as ServerMaintenancePayload;
      expect(payload.windows.dcdiag).toBe('OK (FSR)');
    });

    it('should include windows.dcdiagDetail only when dcdiag starts with ERROR', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ vms: [], nas: [], routers: [] }));
      component.form.patchValue({ dcdiag: 'ERROR (DNS)', dcdiagDetail: 'DNS lookup failed' });
      const payload = component.buildPayload() as ServerMaintenancePayload;
      expect(payload.windows.dcdiagDetail).toBe('DNS lookup failed');
    });

    it('should NOT include windows.dcdiagDetail when dcdiag does not start with ERROR', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ vms: [], nas: [], routers: [] }));
      component.form.patchValue({ dcdiag: 'OK', dcdiagDetail: 'some text' });
      const payload = component.buildPayload() as ServerMaintenancePayload;
      expect(payload.windows.dcdiagDetail).toBeUndefined();
    });

    it('should include vmware section only when hasVMware is true', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ nas: [], routers: [] }));
      component.form.patchValue({ vmCpu: 45, vmMem: 60, vmStorage: 55, snapshotsOk: true });
      const payload = component.buildPayload() as ServerMaintenancePayload;
      expect(payload.vmware).toBeDefined();
      expect(payload.vmware!.cpuUsage).toBe(45);
    });

    it('should NOT include vmware section when hasVMware is false', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ vms: [], nas: [], routers: [] }));
      const payload = component.buildPayload() as ServerMaintenancePayload;
      expect(payload.vmware).toBeUndefined();
    });

    it('should include qnap section only when hasQNAP is true', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ vms: [], routers: [] }));
      component.form.patchValue({ qnapSpace: 65, qnapRaid: 'ok', qnapFirmware: false });
      const payload = component.buildPayload() as ServerMaintenancePayload;
      expect(payload.qnap).toBeDefined();
      expect(payload.qnap!.spaceUsed).toBe(65);
    });

    it('should include veeam section only when hasVeeam is true', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ nas: [], routers: [] }));
      component.form.patchValue({ veeamStatus: 'ok' });
      const payload = component.buildPayload() as ServerMaintenancePayload;
      expect(payload.veeam).toBeDefined();
      expect(payload.veeam!.status).toBe('ok');
    });

    it('should include veeam.affectedVMs only when status is partial', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ nas: [], routers: [] }));
      component.form.patchValue({ veeamStatus: 'partial', veeamAffected: 'VM-APP01, VM-DB01' });
      const payload = component.buildPayload() as ServerMaintenancePayload;
      expect(payload.veeam!.affectedVMs).toBe('VM-APP01, VM-DB01');
    });

    it('should include veeam.affectedVMs when status is missing', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ nas: [], routers: [] }));
      component.form.patchValue({ veeamStatus: 'missing', veeamAffected: 'VM-ALL' });
      const payload = component.buildPayload() as ServerMaintenancePayload;
      expect(payload.veeam!.affectedVMs).toBe('VM-ALL');
    });

    it('should NOT include veeam.affectedVMs when status is ok', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ nas: [], routers: [] }));
      component.form.patchValue({ veeamStatus: 'ok', veeamAffected: 'should be ignored' });
      const payload = component.buildPayload() as ServerMaintenancePayload;
      expect(payload.veeam!.affectedVMs).toBeUndefined();
    });

    it('should include router section only when hasRouter is true', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ vms: [], nas: [] }));
      component.form.patchValue({ routerFirmwareUpdated: true, routerFirmwareVersion: '7.14', routerBackupDone: true });
      const payload = component.buildPayload() as ServerMaintenancePayload;
      expect(payload.router).toBeDefined();
      expect(payload.router!.firmwareUpdated).toBeTrue();
      expect(payload.router!.firmwareVersion).toBe('7.14');
    });
  });

  // ── buildPayload — TERMINAL_MAINTENANCE ─────────────────────────────────────

  describe('buildPayload — TERMINAL_MAINTENANCE', () => {
    it('should build TerminalPayload with type TERMINAL_MAINTENANCE', () => {
      init(makeTask('TERMINAL_MAINTENANCE'), makeInfra());
      const payload = component.buildPayload() as TerminalPayload;
      expect(payload.type).toBe('TERMINAL_MAINTENANCE');
    });

    it('should map checklist booleans to checks object', () => {
      init(makeTask('TERMINAL_MAINTENANCE'), makeInfra());
      component.form.patchValue({
        cleanedTemp: true, windowsUpdates: true, antivirusOk: false, diskSpace: true, licenses: false,
      });
      const payload = component.buildPayload() as TerminalPayload;
      expect(payload.checks.cleanedTemp).toBeTrue();
      expect(payload.checks.windowsUpdates).toBeTrue();
      expect(payload.checks.antivirusOk).toBeFalse();
      expect(payload.checks.diskSpace).toBeTrue();
      expect(payload.checks.licenses).toBeFalse();
    });

    it('should map network checklist to network object', () => {
      init(makeTask('TERMINAL_MAINTENANCE'), makeInfra());
      component.form.patchValue({ connectivity: true, switches: false });
      const payload = component.buildPayload() as TerminalPayload;
      expect(payload.network.connectivity).toBeTrue();
      expect(payload.network.switches).toBeFalse();
    });

    it('should also build TerminalPayload for SITE_VISIT type', () => {
      init(makeTask('SITE_VISIT'), makeInfra());
      const payload = component.buildPayload() as TerminalPayload;
      expect(payload.type).toBe('TERMINAL_MAINTENANCE');
    });
  });

  // ── Outputs ─────────────────────────────────────────────────────────────────

  describe('outputs', () => {
    it('should emit requestComplete with payload on submit()', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ vms: [], nas: [], routers: [] }));
      const emitted: (ServerMaintenancePayload | TerminalPayload)[] = [];
      component.requestComplete.subscribe(p => emitted.push(p));
      component.submit();
      expect(emitted.length).toBe(1);
      expect(emitted[0].type).toBe('SERVER_MAINTENANCE');
    });

    it('should emit requestNotDone on submitNotDone()', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra());
      let emitted = false;
      component.requestNotDone.subscribe(() => (emitted = true));
      component.submitNotDone();
      expect(emitted).toBeTrue();
    });

    it('should NOT inject logsService or tasksService — constructor only has FormBuilder', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra());
      // If the component compiled and initialized without those services being provided,
      // it means it doesn't depend on them
      expect(component).toBeTruthy();
      expect((component as any).logsService).toBeUndefined();
      expect((component as any).tasksService).toBeUndefined();
    });
  });

  // ── ngOnChanges ─────────────────────────────────────────────────────────────

  describe('ngOnChanges', () => {
    it('should rebuild serverControls when infrastructure input changes', () => {
      const infra1 = makeInfra({ servers: [{ assetId: 1, name: 'SRV-A', ip: null, os: null, model: null }] });
      init(makeTask('SERVER_MAINTENANCE'), infra1);
      expect(component.serverControls.length).toBe(1);

      // Simulate infrastructure input change with 2 servers
      const infra2: ClientInfrastructure = {
        ...infra1,
        servers: [
          { assetId: 1, name: 'SRV-A', ip: null, os: null, model: null },
          { assetId: 2, name: 'SRV-B', ip: null, os: null, model: null },
        ],
      };
      component.infrastructure = infra2;
      component.ngOnChanges({ infrastructure: { currentValue: infra2, previousValue: infra1, firstChange: false, isFirstChange: () => false } });

      expect(component.serverControls.length).toBe(2);
    });
  });

  // ── selectClass ─────────────────────────────────────────────────────────────

  describe('selectClass', () => {
    it('should return mf-sel--na for dash value', () => {
      init(makeTask(), makeInfra());
      expect(component.selectClass('—')).toBe('mf-sel--na');
    });

    it('should return mf-sel--ok for OK value', () => {
      init(makeTask(), makeInfra());
      expect(component.selectClass('OK')).toBe('mf-sel--ok');
    });

    it('should return mf-sel--warn for Pendiente value', () => {
      init(makeTask(), makeInfra());
      expect(component.selectClass('Pendiente — ventana')).toBe('mf-sel--warn');
    });

    it('should return mf-sel--crit for Error value', () => {
      init(makeTask(), makeInfra());
      expect(component.selectClass('Error')).toBe('mf-sel--crit');
    });
  });

  // ── dcdiagHasError ──────────────────────────────────────────────────────────

  describe('dcdiagHasError', () => {
    it('should return true when dcdiag starts with ERROR', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra());
      component.form.patchValue({ dcdiag: 'ERROR (DNS)' });
      expect(component.dcdiagHasError()).toBeTrue();
    });

    it('should return false when dcdiag is OK', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra());
      component.form.patchValue({ dcdiag: 'OK' });
      expect(component.dcdiagHasError()).toBeFalse();
    });
  });
});
