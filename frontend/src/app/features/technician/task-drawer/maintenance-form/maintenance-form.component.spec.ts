import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, SimpleChange } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MaintenanceFormComponent } from './maintenance-form.component';
import { Task } from '../../../../core/models/task.models';
import { ClientInfrastructure, InfraAsset } from '../../../../core/models/infradoc.models';
import {
  DcHealthSnapshot,
  WindowsDomainPayload,
  TerminalPayload,
} from '../../../../core/models/maintenance-log.models';

const makeTask = (type = 'WINDOWS_DOMAIN_MAINTENANCE'): Task => ({
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
  domainControllers: [],
  linuxVMs: [],
  nas: [{ assetId: 10, name: 'QNAP', ip: '192.168.1.21', bmcIp: null, bmcType: null, os: null, model: 'QNAP TS-453D' }],
  routers: [{ assetId: 1, name: 'MikroTik', ip: '192.168.99.1', bmcIp: null, bmcType: null, os: 'RouterOS', model: 'CCR2004' }],
  ...overrides,
});

const makeDcAsset = (overrides: Partial<InfraAsset> = {}): InfraAsset => ({
  assetId: 5,
  name: 'DC01',
  ip: '192.168.1.5',
  bmcIp: null,
  bmcType: null,
  os: 'Windows Server 2022',
  model: null,
  ...overrides,
});

const makeDcSnapshot = (overrides: Partial<DcHealthSnapshot> = {}): DcHealthSnapshot => ({
  is_dc: true,
  dc_name: 'DC01',
  domain: 'contoso.local',
  collected_at: '2026-06-17T10:00:00Z',
  repl_healthy: true,
  repl_failures: 0,
  repl_partners: 1,
  repl_max_age_hours: 1,
  dns_test_pass: true,
  dns_service_ok: true,
  dns_srv_ok: true,
  dns_zone_count: 3,
  sysvol_state_ok: true,
  sysvol_backlog: 0,
  sysvol_replication: 'DFSR',
  warnings: [],
  ...overrides,
});

const makeVM = (overrides: Partial<InfraAsset> = {}): InfraAsset => ({
  assetId: 3, name: 'SRV-TEST', ip: null,
  bmcIp: null, bmcType: null, os: null, model: null,
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
      schemas: [NO_ERRORS_SCHEMA],
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

    it('hasRouter should be true when routers.length > 0', () => {
      init(makeTask(), makeInfra());
      expect(component.hasRouter).toBeTrue();
    });

    it('hasRouter should be false when routers is empty', () => {
      init(makeTask(), makeInfra({ routers: [] }));
      expect(component.hasRouter).toBeFalse();
    });
  });

  describe('allVMs getter', () => {
    it('combina windowsVMs + domainControllers + linuxVMs', () => {
      const infra = makeInfra({
        esxiHosts: [], nas: [], routers: [],
        windowsVMs:        [makeVM({ assetId: 3 })],
        domainControllers: [makeVM({ assetId: 4 })],
        linuxVMs:          [makeVM({ assetId: 7 })],
      });
      init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), infra);
      expect(component.allVMs).toHaveSize(3);
      expect(component.allVMs.map(v => v.assetId)).toEqual([3, 4, 7]);
    });

    it('retorna array vacío cuando no hay VMs en ninguna categoría', () => {
      const infra = makeInfra({
        esxiHosts: [], nas: [], routers: [],
        windowsVMs: [], domainControllers: [], linuxVMs: [],
      });
      init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), infra);
      expect(component.allVMs).toHaveSize(0);
    });
  });

  // ── buildPayload — WINDOWS_DOMAIN_MAINTENANCE ───────────────────────────────

  describe('buildPayload — WINDOWS_DOMAIN_MAINTENANCE', () => {
    it('should build WindowsDomainPayload with type WINDOWS_DOMAIN_MAINTENANCE', () => {
      init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }));
      const payload = component.buildPayload() as WindowsDomainPayload;
      expect(payload.type).toBe('WINDOWS_DOMAIN_MAINTENANCE');
    });

    it('should include windows.servers with updates per VM', () => {
      const infra = makeInfra({ esxiHosts: [], nas: [], routers: [] });
      init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), infra);
      component.serverControls.at(0).patchValue({ updates: 'ok' });
      const payload = component.buildPayload() as WindowsDomainPayload;
      expect(payload.windows.servers.length).toBe(1);
      expect(payload.windows.servers[0].serverName).toBe('47DC');
      expect(payload.windows.servers[0].updates).toBe('ok');
    });

    it('should capture updates pending value', () => {
      const infra = makeInfra({ esxiHosts: [], nas: [], routers: [] });
      init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), infra);
      component.serverControls.at(0).patchValue({ updates: 'pending' });
      const payload = component.buildPayload() as WindowsDomainPayload;
      expect(payload.windows.servers[0].updates).toBe('pending');
    });

    it('should include windows.domainControllers as empty array in payload', () => {
      init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }));
      const payload = component.buildPayload() as WindowsDomainPayload;
      expect(Array.isArray(payload.windows.domainControllers)).toBeTrue();
    });

    it('should include router section as array when hasRouter is true', () => {
      init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [] }));
      component.routerDeviceControls.at(0).patchValue({ firmwareUpdated: true, firmwareVersion: '7.14', backupDone: true });
      const payload = component.buildPayload() as WindowsDomainPayload;
      expect(payload.router).toBeDefined();
      expect(Array.isArray(payload.router)).toBeTrue();
      expect(payload.router![0].routerId).toBe(1);
      expect(payload.router![0].routerName).toBe('MikroTik');
      expect(payload.router![0].firmwareUpdated).toBeTrue();
      expect(payload.router![0].firmwareVersion).toBe('7.14');
      expect(payload.router![0].backupDone).toBeTrue();
    });

    it('should support multiple routers for HA architecture', () => {
      const infra = makeInfra({
        esxiHosts: [], nas: [],
        routers: [
          { assetId: 1, name: 'MikroTik-Primary', ip: '192.168.99.1', bmcIp: null, bmcType: null, os: 'RouterOS', model: 'CCR2004' },
          { assetId: 2, name: 'MikroTik-Secondary', ip: '192.168.99.2', bmcIp: null, bmcType: null, os: 'RouterOS', model: 'CCR2004' },
        ],
      });
      init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), infra);
      expect(component.routerDeviceControls.length).toBe(2);
      const payload = component.buildPayload() as WindowsDomainPayload;
      expect(payload.router!.length).toBe(2);
      expect(payload.router![0].routerName).toBe('MikroTik-Primary');
      expect(payload.router![1].routerName).toBe('MikroTik-Secondary');
    });

    it('should NOT include router section when hasRouter is false', () => {
      init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }));
      const payload = component.buildPayload() as WindowsDomainPayload;
      expect(payload.router).toBeUndefined();
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
      init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }));
      const emitted: (WindowsDomainPayload | TerminalPayload)[] = [];
      component.requestComplete.subscribe(p => emitted.push(p));
      component.submit();
      expect(emitted.length).toBe(1);
      expect(emitted[0].type).toBe('WINDOWS_DOMAIN_MAINTENANCE');
    });

    it('should emit requestNotDone on submitNotDone()', () => {
      init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), makeInfra());
      let emitted = false;
      component.requestNotDone.subscribe(() => (emitted = true));
      component.submitNotDone();
      expect(emitted).toBeTrue();
    });

    it('should NOT inject logsService or tasksService — constructor only has FormBuilder', () => {
      init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), makeInfra());
      expect(component).toBeTruthy();
      expect((component as any).logsService).toBeUndefined();
      expect((component as any).tasksService).toBeUndefined();
    });
  });

  // ── ngOnChanges ─────────────────────────────────────────────────────────────

  describe('ngOnChanges', () => {
    it('should rebuild serverControls when infrastructure input changes', () => {
      const infra1 = makeInfra({ windowsVMs: [{ assetId: 1, name: 'VM-A', ip: null, bmcIp: null, bmcType: null, os: 'Windows Server 2019', model: null }] });
      init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), infra1);
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
        makeTask('WINDOWS_DOMAIN_MAINTENANCE'),
        makeInfra({ esxiHosts: [], nas: [], routers: [] }),
        true,
      );
      expect(component.form.disabled).toBeTrue();
    });

    it('should keep the FormGroup enabled when readOnly is false on init', () => {
      initWithReadOnly(
        makeTask('WINDOWS_DOMAIN_MAINTENANCE'),
        makeInfra({ esxiHosts: [], nas: [], routers: [] }),
        false,
      );
      expect(component.form.disabled).toBeFalse();
    });

    it('should disable the FormGroup when readOnly changes to true after init', () => {
      init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }));
      expect(component.form.disabled).toBeFalse();

      component.readOnly = true;
      component.ngOnChanges({
        readOnly: new SimpleChange(false, true, false),
      });

      expect(component.form.disabled).toBeTrue();
    });

    it('should enable the FormGroup when readOnly changes to false after being true', () => {
      initWithReadOnly(
        makeTask('WINDOWS_DOMAIN_MAINTENANCE'),
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
      const task = makeTask('WINDOWS_DOMAIN_MAINTENANCE');
      const infra = makeInfra({ esxiHosts: [], nas: [], routers: [] });
      const savedPayload: WindowsDomainPayload = {
        type: 'WINDOWS_DOMAIN_MAINTENANCE',
        windows: { servers: [], domainControllers: [] },
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

      expect(component.form.disabled).toBeTrue();
    });
  });

  // ── Router controls ─────────────────────────────────────────────────────────

  describe('Router controls', () => {
    it('routerDeviceControls should have one entry per router', () => {
      init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [] }));
      expect(component.routerDeviceControls.length).toBe(1);
    });

    it('routerDeviceControls should be empty when routers is empty', () => {
      init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }));
      expect(component.routerDeviceControls.length).toBe(0);
    });

    it('should rebuild routerDeviceControls when infrastructure changes', () => {
      const infra1 = makeInfra({ esxiHosts: [], nas: [], routers: [{ assetId: 1, name: 'R1', ip: null, bmcIp: null, bmcType: null, os: null, model: null }] });
      init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), infra1);
      expect(component.routerDeviceControls.length).toBe(1);

      const infra2: ClientInfrastructure = {
        ...infra1,
        routers: [
          { assetId: 1, name: 'R1', ip: null, bmcIp: null, bmcType: null, os: null, model: null },
          { assetId: 2, name: 'R2', ip: null, bmcIp: null, bmcType: null, os: null, model: null },
        ],
      };
      component.infrastructure = infra2;
      component.ngOnChanges({ infrastructure: { currentValue: infra2, previousValue: infra1, firstChange: false, isFirstChange: () => false } });
      expect(component.routerDeviceControls.length).toBe(2);
    });
  });

  // ── selectClass — alerta ─────────────────────────────────────────────────────

  describe('selectClass — alerta', () => {
    it('should return mf-sel--crit for "alerta"', () => {
      init(makeTask(), makeInfra());
      expect(component.selectClass('alerta')).toBe('mf-sel--crit');
    });
  });

  // ── serverRowClass ───────────────────────────────────────────────────────────

  describe('serverRowClass', () => {
    it('should return empty string when updates is ok', () => {
      init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }));
      component.serverControls.at(0).patchValue({ updates: 'ok' });
      expect(component.serverRowClass(0)).toBe('');
    });

    it('should return mf-srv-row--crit when updates is failed', () => {
      init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }));
      component.serverControls.at(0).patchValue({ updates: 'failed' });
      expect(component.serverRowClass(0)).toBe('mf-srv-row--crit');
    });

    it('should return mf-srv-row--warn when updates is pending', () => {
      init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }));
      component.serverControls.at(0).patchValue({ updates: 'pending' });
      expect(component.serverRowClass(0)).toBe('mf-srv-row--warn');
    });
  });

  // ── Domain controllers (DC health snapshot) ─────────────────────────────────

  describe('domain controllers', () => {
    it('hasDomainControllers is false when domainControllers is empty', () => {
      init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }));
      expect((component as any).hasDomainControllers).toBeFalse();
    });

    it('hasDomainControllers is true when domainControllers has entries', () => {
      const infra = makeInfra({ esxiHosts: [], nas: [], routers: [], domainControllers: [makeDcAsset()] });
      init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), infra);
      expect((component as any).hasDomainControllers).toBeTrue();
    });

    it('dcControls has one FormGroup per DC', () => {
      const infra = makeInfra({ esxiHosts: [], nas: [], routers: [], domainControllers: [makeDcAsset(), makeDcAsset({ assetId: 6, name: 'DC02' })] });
      init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), infra);
      expect((component as any).dcControls.length).toBe(2);
    });

    it('buildPayload incluye snapshot del DC cuando rawJson es JSON válido con is_dc true', () => {
      const infra = makeInfra({ esxiHosts: [], nas: [], routers: [], domainControllers: [makeDcAsset()] });
      init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), infra);

      const snapshot = makeDcSnapshot();
      (component as any).dcControls.at(0).patchValue({ rawJson: JSON.stringify(snapshot) });

      const payload = component.buildPayload() as WindowsDomainPayload;
      expect(payload.windows.domainControllers.length).toBe(1);
      expect(payload.windows.domainControllers[0].dc_name).toBe('DC01');
      expect(payload.windows.domainControllers[0].is_dc).toBeTrue();
    });

    it('buildPayload omite DC cuando rawJson está vacío', () => {
      const infra = makeInfra({ esxiHosts: [], nas: [], routers: [], domainControllers: [makeDcAsset()] });
      init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), infra);
      // rawJson defaults to '' — no value set

      const payload = component.buildPayload() as WindowsDomainPayload;
      expect(payload.windows.domainControllers).toEqual([]);
    });

    it('buildPayload omite DC cuando rawJson es JSON malformado', () => {
      const infra = makeInfra({ esxiHosts: [], nas: [], routers: [], domainControllers: [makeDcAsset()] });
      init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), infra);
      (component as any).dcControls.at(0).patchValue({ rawJson: '{ invalid }' });

      const payload = component.buildPayload() as WindowsDomainPayload;
      expect(payload.windows.domainControllers).toEqual([]);
    });

    it('patchFormFromPayload rellena rawJson del DC con JSON del snapshot guardado', () => {
      const snapshot = makeDcSnapshot();
      const saved: WindowsDomainPayload = {
        type: 'WINDOWS_DOMAIN_MAINTENANCE',
        windows: {
          servers: [],
          domainControllers: [snapshot],
        },
      };

      const infra = makeInfra({ esxiHosts: [], nas: [], routers: [], domainControllers: [makeDcAsset()] });
      // Use initWithSavedPayload pattern
      fixture = TestBed.createComponent(MaintenanceFormComponent);
      component = fixture.componentInstance;
      component.task = makeTask('WINDOWS_DOMAIN_MAINTENANCE');
      component.infrastructure = infra;
      component.savedPayload = saved;
      const changes: { [k: string]: any } = {
        infrastructure: new SimpleChange(undefined, infra, true),
        task: new SimpleChange(undefined, makeTask('WINDOWS_DOMAIN_MAINTENANCE'), true),
        savedPayload: new SimpleChange(undefined, saved, true),
      };
      component.ngOnChanges(changes);
      fixture.detectChanges();

      const rawJson = (component as any).dcControls.at(0).get('rawJson')?.value;
      const parsed = JSON.parse(rawJson);
      expect(parsed.dc_name).toBe('DC01');
      expect(parsed.is_dc).toBeTrue();
    });

    it('windows.servers no incluye rebootScript en ningún entry', () => {
      const infra = makeInfra({ esxiHosts: [], nas: [], routers: [] });
      init(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), infra);
      const payload = component.buildPayload() as WindowsDomainPayload;
      const server = payload.windows.servers[0] as any;
      expect(server.rebootScript).toBeUndefined();
    });
  });

  // ── patchFormFromPayload ─────────────────────────────────────────────────────

  describe('patchFormFromPayload via savedPayload input', () => {
    function initWithSavedPayload(
      task: Task,
      infra: ClientInfrastructure,
      savedPayload: WindowsDomainPayload | TerminalPayload | null,
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

    it('parchea dcdiag — campo eliminado, domainControllers se maneja por DcHealthCardComponent', () => {
      const saved: WindowsDomainPayload = {
        type: 'WINDOWS_DOMAIN_MAINTENANCE',
        windows: { servers: [], domainControllers: [] },
      };
      initWithSavedPayload(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }), saved);
      expect(component.form).toBeTruthy(); // formulario construido sin errores
    });

    it('parchea updates del servidor correcto usando serverId', () => {
      // makeInfra tiene windowsVMs[0].assetId = 3
      const saved: WindowsDomainPayload = {
        type: 'WINDOWS_DOMAIN_MAINTENANCE',
        windows: {
          servers: [{ serverId: 3, serverName: '47DC', updates: 'pending' }],
          domainControllers: [],
        },
      };
      initWithSavedPayload(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }), saved);

      expect(component.serverControls.at(0).get('updates')?.value).toBe('pending');
    });

    it('ignora entrada guardada si el serverId no está en la infra actual', () => {
      // infra tiene assetId 3; payload tiene serverId 999 (no existe)
      const saved: WindowsDomainPayload = {
        type: 'WINDOWS_DOMAIN_MAINTENANCE',
        windows: {
          servers: [{ serverId: 999, serverName: 'OldServer', updates: 'failed' }],
          domainControllers: [],
        },
      };
      initWithSavedPayload(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [], routers: [] }), saved);

      // el control en index 0 (assetId 3) mantiene el default
      expect(component.serverControls.at(0).get('updates')?.value).toBe('ok');
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

    it('parchea sección router usando routerId', () => {
      const saved: WindowsDomainPayload = {
        type: 'WINDOWS_DOMAIN_MAINTENANCE',
        windows: { servers: [], domainControllers: [] },
        router: [{ routerId: 1, routerName: 'MikroTik', firmwareUpdated: true, firmwareVersion: '7.14', backupDone: true }],
      };
      initWithSavedPayload(makeTask('WINDOWS_DOMAIN_MAINTENANCE'), makeInfra({ esxiHosts: [], nas: [] }), saved);
      expect(component.routerDeviceControls.at(0).get('firmwareUpdated')?.value).toBeTrue();
      expect(component.routerDeviceControls.at(0).get('firmwareVersion')?.value).toBe('7.14');
      expect(component.routerDeviceControls.at(0).get('backupDone')?.value).toBeTrue();
    });

    it('no modifica el formulario cuando savedPayload es null', () => {
      initWithSavedPayload(
        makeTask('WINDOWS_DOMAIN_MAINTENANCE'),
        makeInfra({ esxiHosts: [], nas: [], routers: [] }),
        null,
      );

      // defaults intactos
      expect(component.serverControls.at(0).get('updates')?.value).toBe('ok');
    });
  });

});
