import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
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
  esxiHosts: [{ assetId: 2, name: 'host1.kemini', ip: '192.168.0.104', bmcIp: '192.168.0.200', bmcType: 'iLO', os: 'VMware ESXi 7.0', model: 'HPE DL380' }],
  windowsVMs: [{ assetId: 3, name: '47DC', ip: '192.168.1.18', bmcIp: null, bmcType: null, os: 'Windows Server 2019', model: null }],
  nas: [{ assetId: 10, name: 'QNAP', ip: '192.168.1.21', bmcIp: null, bmcType: null, os: null, model: 'QNAP TS-453D' }],
  routers: [{ assetId: 1, name: 'MikroTik', ip: '192.168.99.1', bmcIp: null, bmcType: null, os: 'RouterOS', model: 'CCR2004' }],
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
      imports: [
        ReactiveFormsModule,
        NoopAnimationsModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatSelectModule,
        MatInputModule,
        MatButtonModule,
      ],
    }).compileComponents();
  });

  // ── Getters condicionales ───────────────────────────────────────────────────

  describe('conditional getters', () => {
    it('hasServers should be true when windowsVMs.length > 0', () => {
      init(makeTask(), makeInfra());
      expect(component.hasServers).toBeTrue();
    });

    it('hasServers should be false when windowsVMs is empty', () => {
      init(makeTask(), makeInfra({ windowsVMs: [] }));
      expect(component.hasServers).toBeFalse();
    });

    it('hasVMware should be true when esxiHosts.length > 0', () => {
      init(makeTask(), makeInfra());
      expect(component.hasVMware).toBeTrue();
    });

    it('hasVMware should be false when esxiHosts is empty', () => {
      init(makeTask(), makeInfra({ esxiHosts: [] }));
      expect(component.hasVMware).toBeFalse();
    });

    it('hasQNAP should be true when nas.length > 0', () => {
      init(makeTask(), makeInfra());
      expect(component.hasQNAP).toBeTrue();
    });

    it('hasQNAP should be false when nas is empty', () => {
      init(makeTask(), makeInfra({ nas: [] }));
      expect(component.hasQNAP).toBeFalse();
    });

    it('hasVeeam should be true when esxiHosts.length > 0', () => {
      init(makeTask(), makeInfra());
      expect(component.hasVeeam).toBeTrue();
    });

    it('hasVeeam should be false when esxiHosts is empty', () => {
      init(makeTask(), makeInfra({ esxiHosts: [] }));
      expect(component.hasVeeam).toBeFalse();
    });

    it('hasRouter should be true when routers.length > 0', () => {
      init(makeTask(), makeInfra());
      expect(component.hasRouter).toBeTrue();
    });

    it('hasRouter should be false when routers is empty', () => {
      init(makeTask(), makeInfra({ routers: [] }));
      expect(component.hasRouter).toBeFalse();
    });
  });

  // ── buildPayload — SERVER_MAINTENANCE ───────────────────────────────────────

  describe('buildPayload — SERVER_MAINTENANCE', () => {
    it('should build ServerMaintenancePayload with type SERVER_MAINTENANCE', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }));
      const payload = component.buildPayload() as ServerMaintenancePayload;
      expect(payload.type).toBe('SERVER_MAINTENANCE');
    });

    it('should include windows.servers with rebootScript and updates per VM', () => {
      const infra = makeInfra({ esxiHosts: [], nas: [], routers: [] });
      init(makeTask('SERVER_MAINTENANCE'), infra);
      component.serverControls.at(0).patchValue({ rebootScript: 'ok', updates: 'ok' });
      const payload = component.buildPayload() as ServerMaintenancePayload;
      expect(payload.windows.servers.length).toBe(1);
      expect(payload.windows.servers[0].serverName).toBe('47DC');
      expect(payload.windows.servers[0].rebootScript).toBe('ok');
      expect(payload.windows.servers[0].updates).toBe('ok');
    });

    it('should capture rebootScript error value', () => {
      const infra = makeInfra({ esxiHosts: [], nas: [], routers: [] });
      init(makeTask('SERVER_MAINTENANCE'), infra);
      component.serverControls.at(0).patchValue({ rebootScript: 'error' });
      const payload = component.buildPayload() as ServerMaintenancePayload;
      expect(payload.windows.servers[0].rebootScript).toBe('error');
    });

    it('should include windows.dcdiag from form value', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }));
      component.form.patchValue({ dcdiag: 'OK (FSR)' });
      const payload = component.buildPayload() as ServerMaintenancePayload;
      expect(payload.windows.dcdiag).toBe('OK (FSR)');
    });

    it('should include windows.dcdiagDetail only when dcdiag starts with ERROR', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }));
      component.form.patchValue({ dcdiag: 'ERROR (DNS)', dcdiagDetail: 'DNS lookup failed' });
      const payload = component.buildPayload() as ServerMaintenancePayload;
      expect(payload.windows.dcdiagDetail).toBe('DNS lookup failed');
    });

    it('should NOT include windows.dcdiagDetail when dcdiag does not start with ERROR', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }));
      component.form.patchValue({ dcdiag: 'OK', dcdiagDetail: 'some text' });
      const payload = component.buildPayload() as ServerMaintenancePayload;
      expect(payload.windows.dcdiagDetail).toBeUndefined();
    });

    it('should include vmware as array of host entries when hasVMware is true', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ nas: [], routers: [] }));
      component.vmwareHostControls.at(0).patchValue({ cpuUsage: 45, memUsage: 60, storageUsage: 55, snapshotsOk: true });
      const payload = component.buildPayload() as ServerMaintenancePayload;
      expect(payload.vmware).toBeDefined();
      expect(Array.isArray(payload.vmware)).toBeTrue();
      expect(payload.vmware![0].cpuUsage).toBe(45);
      expect(payload.vmware![0].hostName).toBe('host1.kemini');
      expect(payload.vmware![0].snapshotsOk).toBeTrue();
    });

    it('should NOT include vmware section when hasVMware is false', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }));
      const payload = component.buildPayload() as ServerMaintenancePayload;
      expect(payload.vmware).toBeUndefined();
    });

    it('should include qnap section as array when hasQNAP is true', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], routers: [] }));
      component.qnapDeviceControls.at(0).patchValue({ spaceUsed: 65, raidStatus: 'ok', firmwareUpdated: false });
      const payload = component.buildPayload() as ServerMaintenancePayload;
      expect(payload.qnap).toBeDefined();
      expect(Array.isArray(payload.qnap)).toBeTrue();
      expect(payload.qnap![0].spaceUsed).toBe(65);
      expect(payload.qnap![0].deviceName).toBe('QNAP');
    });

    it('should include veeam section only when hasVeeam is true', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ nas: [], routers: [] }));
      component.form.patchValue({ veeamStatus: 'ok' });
      const payload = component.buildPayload() as ServerMaintenancePayload;
      expect(payload.veeam).toBeDefined();
      expect(payload.veeam!.status).toBe('ok');
    });

    it('should include veeam.missingVMs array when status is missing', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ nas: [], routers: [] }));
      component.form.patchValue({ veeamStatus: 'missing', veeamMissing: ['VM-APP01', 'VM-DB01'] });
      const payload = component.buildPayload() as ServerMaintenancePayload;
      expect(payload.veeam!.missingVMs).toEqual(['VM-APP01', 'VM-DB01']);
    });

    it('should NOT include veeam.missingVMs when status is ok', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ nas: [], routers: [] }));
      component.form.patchValue({ veeamStatus: 'ok', veeamMissing: ['should be ignored'] });
      const payload = component.buildPayload() as ServerMaintenancePayload;
      expect(payload.veeam!.missingVMs).toBeUndefined();
    });

    it('should include router section only when hasRouter is true', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [] }));
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
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }));
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
      expect(component).toBeTruthy();
      expect((component as any).logsService).toBeUndefined();
      expect((component as any).tasksService).toBeUndefined();
    });
  });

  // ── ngOnChanges ─────────────────────────────────────────────────────────────

  describe('ngOnChanges', () => {
    it('should rebuild serverControls when infrastructure input changes', () => {
      const infra1 = makeInfra({ windowsVMs: [{ assetId: 1, name: 'VM-A', ip: null, bmcIp: null, bmcType: null, os: 'Windows Server 2019', model: null }] });
      init(makeTask('SERVER_MAINTENANCE'), infra1);
      expect(component.serverControls.length).toBe(1);

      const infra2: ClientInfrastructure = {
        ...infra1,
        windowsVMs: [
          { assetId: 1, name: 'VM-A', ip: null, bmcIp: null, bmcType: null, os: 'Windows Server 2019', model: null },
          { assetId: 2, name: 'VM-B', ip: null, bmcIp: null, bmcType: null, os: 'Windows Server 2022', model: null },
        ],
      };
      component.infrastructure = infra2;
      component.ngOnChanges({ infrastructure: { currentValue: infra2, previousValue: infra1, firstChange: false, isFirstChange: () => false } });

      expect(component.serverControls.length).toBe(2);
    });

    it('should rebuild qnapDeviceControls matching nas count', () => {
      const infra1 = makeInfra({ esxiHosts: [], nas: [{ assetId: 10, name: 'NAS1', ip: null, bmcIp: null, bmcType: null, os: null, model: null }] });
      init(makeTask('SERVER_MAINTENANCE'), infra1);
      expect(component.qnapDeviceControls.length).toBe(1);

      const infra2: ClientInfrastructure = {
        ...infra1,
        nas: [
          { assetId: 10, name: 'NAS1', ip: null, bmcIp: null, bmcType: null, os: null, model: null },
          { assetId: 11, name: 'NAS2', ip: null, bmcIp: null, bmcType: null, os: null, model: null },
        ],
      };
      component.infrastructure = infra2;
      component.ngOnChanges({ infrastructure: { currentValue: infra2, previousValue: infra1, firstChange: false, isFirstChange: () => false } });

      expect(component.qnapDeviceControls.length).toBe(2);
    });

    it('should rebuild vmwareHostControls matching esxiHosts count', () => {
      const infra1 = makeInfra({ esxiHosts: [{ assetId: 2, name: 'host1', ip: null, bmcIp: null, bmcType: null, os: 'VMware ESXi 7.0', model: null }] });
      init(makeTask('SERVER_MAINTENANCE'), infra1);
      expect(component.vmwareHostControls.length).toBe(1);

      const infra2: ClientInfrastructure = {
        ...infra1,
        esxiHosts: [
          { assetId: 2, name: 'host1', ip: null, bmcIp: null, bmcType: null, os: 'VMware ESXi 7.0', model: null },
          { assetId: 22, name: 'host2', ip: null, bmcIp: null, bmcType: null, os: 'VMware ESXi 6.7', model: null },
        ],
      };
      component.infrastructure = infra2;
      component.ngOnChanges({ infrastructure: { currentValue: infra2, previousValue: infra1, firstChange: false, isFirstChange: () => false } });

      expect(component.vmwareHostControls.length).toBe(2);
    });
  });

  // ── selectClass ─────────────────────────────────────────────────────────────

  describe('selectClass', () => {
    it('should return mf-sel--na for unrecognized value', () => {
      init(makeTask(), makeInfra());
      expect(component.selectClass('—')).toBe('mf-sel--na');
    });

    it('should return mf-sel--ok for "ok"', () => {
      init(makeTask(), makeInfra());
      expect(component.selectClass('ok')).toBe('mf-sel--ok');
    });

    it('should return mf-sel--ok for "OK"', () => {
      init(makeTask(), makeInfra());
      expect(component.selectClass('OK')).toBe('mf-sel--ok');
    });

    it('should return mf-sel--warn for "pending"', () => {
      init(makeTask(), makeInfra());
      expect(component.selectClass('pending')).toBe('mf-sel--warn');
    });

    it('should return mf-sel--warn for "falta_configurar"', () => {
      init(makeTask(), makeInfra());
      expect(component.selectClass('falta_configurar')).toBe('mf-sel--warn');
    });

    it('should return mf-sel--crit for "error"', () => {
      init(makeTask(), makeInfra());
      expect(component.selectClass('error')).toBe('mf-sel--crit');
    });

    it('should return mf-sel--crit for "failed"', () => {
      init(makeTask(), makeInfra());
      expect(component.selectClass('failed')).toBe('mf-sel--crit');
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

  // ── BMC controls ────────────────────────────────────────────────────────────

  describe('BMC controls', () => {
    it('bmcHostControls should have one entry per esxiHost', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ windowsVMs: [], nas: [], routers: [] }));
      expect(component.bmcHostControls.length).toBe(1);
    });

    it('bmcHostControls should be empty when esxiHosts is empty', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [] }));
      expect(component.bmcHostControls.length).toBe(0);
    });

    it('bmcHasAlert should return false when alertStatus is ok', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ windowsVMs: [], nas: [], routers: [] }));
      component.getBmcGroup(0).patchValue({ alertStatus: 'ok' });
      expect(component.bmcHasAlert(0)).toBeFalse();
    });

    it('bmcHasAlert should return true when alertStatus is alerta', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ windowsVMs: [], nas: [], routers: [] }));
      component.getBmcGroup(0).patchValue({ alertStatus: 'alerta' });
      expect(component.bmcHasAlert(0)).toBeTrue();
    });

    it('getBmcGroup should return the FormGroup for the given index', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ windowsVMs: [], nas: [], routers: [] }));
      const group = component.getBmcGroup(0);
      expect(group.get('firmwareVersion')).not.toBeNull();
      expect(group.get('biosVersion')).not.toBeNull();
      expect(group.get('alertStatus')).not.toBeNull();
      expect(group.get('alertNote')).not.toBeNull();
    });

    it('should rebuild bmcHostControls when infrastructure changes', () => {
      const infra1 = makeInfra({ esxiHosts: [{ assetId: 2, name: 'h1', ip: null, bmcIp: null, bmcType: null, os: null, model: null }] });
      init(makeTask('SERVER_MAINTENANCE'), infra1);
      expect(component.bmcHostControls.length).toBe(1);

      const infra2: ClientInfrastructure = {
        ...infra1,
        esxiHosts: [
          { assetId: 2, name: 'h1', ip: null, bmcIp: null, bmcType: null, os: null, model: null },
          { assetId: 22, name: 'h2', ip: null, bmcIp: null, bmcType: null, os: null, model: null },
        ],
      };
      component.infrastructure = infra2;
      component.ngOnChanges({ infrastructure: { currentValue: infra2, previousValue: infra1, firstChange: false, isFirstChange: () => false } });

      expect(component.bmcHostControls.length).toBe(2);
    });
  });

  // ── buildPayload — BMC section ───────────────────────────────────────────────

  describe('buildPayload — BMC section', () => {
    it('should include bmc array when hasVMware is true', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ windowsVMs: [], nas: [], routers: [] }));
      const payload = component.buildPayload() as ServerMaintenancePayload;
      expect(payload.bmc).toBeDefined();
      expect(Array.isArray(payload.bmc)).toBeTrue();
      expect(payload.bmc!.length).toBe(1);
      expect(payload.bmc![0].hostId).toBe(2);
      expect(payload.bmc![0].hostName).toBe('host1.kemini');
    });

    it('should NOT include bmc when hasVMware is false', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }));
      const payload = component.buildPayload() as ServerMaintenancePayload;
      expect(payload.bmc).toBeUndefined();
    });

    it('should include firmwareVersion and biosVersion when filled', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ windowsVMs: [], nas: [], routers: [] }));
      component.getBmcGroup(0).patchValue({ firmwareVersion: '2.82', biosVersion: 'U30 v2.86' });
      const payload = component.buildPayload() as ServerMaintenancePayload;
      expect(payload.bmc![0].firmwareVersion).toBe('2.82');
      expect(payload.bmc![0].biosVersion).toBe('U30 v2.86');
    });

    it('should omit firmwareVersion and biosVersion when empty', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ windowsVMs: [], nas: [], routers: [] }));
      component.getBmcGroup(0).patchValue({ firmwareVersion: '', biosVersion: '' });
      const payload = component.buildPayload() as ServerMaintenancePayload;
      expect(payload.bmc![0].firmwareVersion).toBeUndefined();
      expect(payload.bmc![0].biosVersion).toBeUndefined();
    });

    it('should include alertNote when alertStatus is alerta', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ windowsVMs: [], nas: [], routers: [] }));
      component.getBmcGroup(0).patchValue({ alertStatus: 'alerta', alertNote: 'Fan warning' });
      const payload = component.buildPayload() as ServerMaintenancePayload;
      expect(payload.bmc![0].alertStatus).toBe('alerta');
      expect(payload.bmc![0].alertNote).toBe('Fan warning');
    });

    it('should NOT include alertNote when alertStatus is ok', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ windowsVMs: [], nas: [], routers: [] }));
      component.getBmcGroup(0).patchValue({ alertStatus: 'ok', alertNote: 'should be ignored' });
      const payload = component.buildPayload() as ServerMaintenancePayload;
      expect(payload.bmc![0].alertStatus).toBe('ok');
      expect(payload.bmc![0].alertNote).toBeUndefined();
    });
  });

  // ── readOnly input ───────────────────────────────────────────────────────────

  describe('readOnly input', () => {
    function initWithReadOnly(
      task: Task,
      infra: ClientInfrastructure,
      readOnly: boolean,
    ): void {
      fixture = TestBed.createComponent(MaintenanceFormComponent);
      component = fixture.componentInstance;
      component.task = task;
      component.infrastructure = infra;
      component.readOnly = readOnly;
      component.ngOnChanges({
        infrastructure: new SimpleChange(undefined, infra, true),
        task: new SimpleChange(undefined, task, true),
      });
      fixture.detectChanges();
    }

    it('should disable the FormGroup when readOnly is true on init', () => {
      initWithReadOnly(
        makeTask('SERVER_MAINTENANCE'),
        makeInfra({ esxiHosts: [], nas: [], routers: [] }),
        true,
      );
      expect(component.form.disabled).toBeTrue();
    });

    it('should keep the FormGroup enabled when readOnly is false on init', () => {
      initWithReadOnly(
        makeTask('SERVER_MAINTENANCE'),
        makeInfra({ esxiHosts: [], nas: [], routers: [] }),
        false,
      );
      expect(component.form.disabled).toBeFalse();
    });

    it('should disable the FormGroup when readOnly changes to true after init', () => {
      init(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }));
      expect(component.form.disabled).toBeFalse();

      component.readOnly = true;
      component.ngOnChanges({
        readOnly: new SimpleChange(false, true, false),
      });

      expect(component.form.disabled).toBeTrue();
    });

    it('should enable the FormGroup when readOnly changes to false after being true', () => {
      initWithReadOnly(
        makeTask('SERVER_MAINTENANCE'),
        makeInfra({ esxiHosts: [], nas: [], routers: [] }),
        true,
      );
      expect(component.form.disabled).toBeTrue();

      component.readOnly = false;
      component.ngOnChanges({
        readOnly: new SimpleChange(true, false, false),
      });

      expect(component.form.disabled).toBeFalse();
    });

    it('should patch savedPayload values and still disable form when readOnly is true', () => {
      fixture = TestBed.createComponent(MaintenanceFormComponent);
      component = fixture.componentInstance;
      const task = makeTask('SERVER_MAINTENANCE');
      const infra = makeInfra({ esxiHosts: [], nas: [], routers: [] });
      const savedPayload: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: { servers: [], dcdiag: 'ERROR (DNS)', dcdiagDetail: 'lookup failed' },
      };
      component.task = task;
      component.infrastructure = infra;
      component.savedPayload = savedPayload;
      component.readOnly = true;
      component.ngOnChanges({
        infrastructure: new SimpleChange(undefined, infra, true),
        savedPayload: new SimpleChange(undefined, savedPayload, true),
      });
      fixture.detectChanges();

      expect(component.form.get('dcdiag')?.value).toBe('ERROR (DNS)');
      expect(component.form.disabled).toBeTrue();
    });
  });

  // ── selectClass — alerta ─────────────────────────────────────────────────────

  describe('selectClass — alerta', () => {
    it('should return mf-sel--crit for "alerta"', () => {
      init(makeTask(), makeInfra());
      expect(component.selectClass('alerta')).toBe('mf-sel--crit');
    });
  });

  // ── patchFormFromPayload ─────────────────────────────────────────────────────

  describe('patchFormFromPayload via savedPayload input', () => {
    function initWithSavedPayload(
      task: Task,
      infra: ClientInfrastructure,
      savedPayload: ServerMaintenancePayload | TerminalPayload | null,
    ): void {
      fixture = TestBed.createComponent(MaintenanceFormComponent);
      component = fixture.componentInstance;
      component.task = task;
      component.infrastructure = infra;
      component.savedPayload = savedPayload;
      const changes: { [k: string]: any } = {
        infrastructure: new SimpleChange(undefined, infra, true),
        task: new SimpleChange(undefined, task, true),
      };
      if (savedPayload !== null) {
        changes['savedPayload'] = new SimpleChange(undefined, savedPayload, true);
      }
      component.ngOnChanges(changes);
      fixture.detectChanges();
    }

    it('parchea dcdiag y dcdiagDetail desde el payload guardado', () => {
      const saved: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: { servers: [], dcdiag: 'ERROR (DNS)', dcdiagDetail: 'lookup failed' },
      };
      initWithSavedPayload(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }), saved);

      expect(component.form.get('dcdiag')?.value).toBe('ERROR (DNS)');
      expect(component.form.get('dcdiagDetail')?.value).toBe('lookup failed');
    });

    it('parchea rebootScript y updates del servidor correcto usando serverId', () => {
      // makeInfra tiene windowsVMs[0].assetId = 3
      const saved: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: {
          servers: [{ serverId: 3, serverName: '47DC', rebootScript: 'error', updates: 'pending' }],
          dcdiag: 'OK',
        },
      };
      initWithSavedPayload(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }), saved);

      expect(component.serverControls.at(0).get('rebootScript')?.value).toBe('error');
      expect(component.serverControls.at(0).get('updates')?.value).toBe('pending');
    });

    it('parchea métricas VMware usando hostId', () => {
      // makeInfra tiene esxiHosts[0].assetId = 2
      const saved: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: { servers: [], dcdiag: 'OK' },
        vmware: [{ hostId: 2, hostName: 'host1.kemini', cpuUsage: 72, memUsage: 81, storageUsage: 65, snapshotsOk: false }],
      };
      initWithSavedPayload(makeTask('SERVER_MAINTENANCE'), makeInfra({ nas: [], routers: [] }), saved);

      expect(component.vmwareHostControls.at(0).get('cpuUsage')?.value).toBe(72);
      expect(component.vmwareHostControls.at(0).get('memUsage')?.value).toBe(81);
      expect(component.vmwareHostControls.at(0).get('snapshotsOk')?.value).toBeFalse();
    });

    it('parchea sección QNAP usando deviceId', () => {
      // makeInfra tiene nas[0].assetId = 10
      const saved: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: { servers: [], dcdiag: 'OK' },
        qnap: [{ deviceId: 10, deviceName: 'QNAP', spaceUsed: 78, raidStatus: 'ok', firmwareUpdated: true }],
      };
      initWithSavedPayload(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], routers: [] }), saved);

      expect(component.qnapDeviceControls.at(0).get('spaceUsed')?.value).toBe(78);
      expect(component.qnapDeviceControls.at(0).get('firmwareUpdated')?.value).toBeTrue();
    });

    it('parchea sección BMC usando hostId', () => {
      // makeInfra tiene esxiHosts[0].assetId = 2
      const saved: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: { servers: [], dcdiag: 'OK' },
        bmc: [{ hostId: 2, hostName: 'host1.kemini', alertStatus: 'alerta', alertNote: 'Fan warning', firmwareVersion: '2.82' }],
      };
      initWithSavedPayload(makeTask('SERVER_MAINTENANCE'), makeInfra({ nas: [], routers: [] }), saved);

      expect(component.bmcHostControls.at(0).get('alertStatus')?.value).toBe('alerta');
      expect(component.bmcHostControls.at(0).get('alertNote')?.value).toBe('Fan warning');
      expect(component.bmcHostControls.at(0).get('firmwareVersion')?.value).toBe('2.82');
    });

    it('parchea veeamStatus y veeamMissing', () => {
      const saved: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: { servers: [], dcdiag: 'OK' },
        veeam: { status: 'partial', missingVMs: ['VM-DB01'] },
      };
      initWithSavedPayload(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }), saved);

      expect(component.form.get('veeamStatus')?.value).toBe('partial');
    });

    it('ignora entrada guardada si el serverId no está en la infra actual', () => {
      // infra tiene assetId 3; payload tiene serverId 999 (no existe)
      const saved: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: {
          servers: [{ serverId: 999, serverName: 'OldServer', rebootScript: 'error', updates: 'ok' }],
          dcdiag: 'OK',
        },
      };
      initWithSavedPayload(makeTask('SERVER_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }), saved);

      // el control en index 0 (assetId 3) mantiene el default
      expect(component.serverControls.at(0).get('rebootScript')?.value).toBe('ok');
    });

    it('parchea TerminalPayload correctamente', () => {
      const saved: TerminalPayload = {
        type: 'TERMINAL_MAINTENANCE',
        checks: { cleanedTemp: true, windowsUpdates: true, antivirusOk: false, diskSpace: true, licenses: false },
        network: { connectivity: true, switches: false },
        observations: 'pantalla rota en terminal 3',
      };
      initWithSavedPayload(makeTask('TERMINAL_MAINTENANCE'), makeInfra(), saved);

      expect(component.form.get('cleanedTemp')?.value).toBeTrue();
      expect(component.form.get('antivirusOk')?.value).toBeFalse();
      expect(component.form.get('connectivity')?.value).toBeTrue();
      expect(component.form.get('switches')?.value).toBeFalse();
      expect(component.form.get('observations')?.value).toBe('pantalla rota en terminal 3');
    });

    it('no modifica el formulario cuando savedPayload es null', () => {
      initWithSavedPayload(
        makeTask('SERVER_MAINTENANCE'),
        makeInfra({ esxiHosts: [], nas: [], routers: [] }),
        null,
      );

      // defaults intactos
      expect(component.form.get('dcdiag')?.value).toBe('OK');
      expect(component.serverControls.at(0).get('rebootScript')?.value).toBe('ok');
    });
  });
});
