import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormArray, FormBuilder, FormGroup } from '@angular/forms';
import { Task } from '../../../../core/models/task.models';
import { ClientInfrastructure } from '../../../../core/models/infradoc.models';
import {
  BmcEntry,
  DcHealthSnapshot,
  MaintenancePayload,
  RouterEntry,
  ServerMaintenancePayload,
  TerminalPayload,
  VeeamJobEntry,
} from '../../../../core/models/maintenance-log.models';

@Component({
  selector: 'app-maintenance-form',
  templateUrl: './maintenance-form.component.html',
  styleUrl: './maintenance-form.component.scss',
})
export class MaintenanceFormComponent implements OnChanges {
  @Input() task!: Task;
  @Input() infrastructure!: ClientInfrastructure;
  @Input() savedPayload: MaintenancePayload | null = null;
  @Input() readOnly = false;

  @Output() requestComplete = new EventEmitter<ServerMaintenancePayload | TerminalPayload>();
  @Output() requestSave = new EventEmitter<ServerMaintenancePayload | TerminalPayload>();
  @Output() requestNotDone = new EventEmitter<void>();

  form!: FormGroup;

  constructor(private fb: FormBuilder) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['infrastructure'] && this.infrastructure) {
      this.buildForm();
      if (this.savedPayload) {
        this.patchFormFromPayload(this.savedPayload);
      }
      this.applyReadOnlyState();
    } else if (changes['savedPayload'] && this.savedPayload && this.form) {
      this.patchFormFromPayload(this.savedPayload);
      this.applyReadOnlyState();
    } else if (changes['readOnly'] && this.form) {
      this.applyReadOnlyState();
    }
  }

  // ── Getters condicionales ────────────────────────────────────────────────────

  get hasServers(): boolean { return this.infrastructure?.windowsVMs?.length > 0; }
  get hasVMware(): boolean  { return this.infrastructure?.esxiHosts?.length > 0; }
  get hasVeeam(): boolean   { return this.infrastructure?.esxiHosts?.length > 0; }
  get hasRouter(): boolean  { return this.infrastructure?.routers?.length > 0; }

  get serverControls(): FormArray {
    return this.form.get('servers') as FormArray;
  }

  get vmwareHostControls(): FormArray {
    return this.form.get('vmwareHosts') as FormArray;
  }

  get bmcHostControls(): FormArray {
    return this.form.get('bmcHosts') as FormArray;
  }

  get routerDeviceControls(): FormArray {
    return this.form.get('routerDevices') as FormArray;
  }

  get dcControls(): FormArray {
    return this.form.get('domainControllers') as FormArray;
  }

  get hasDomainControllers(): boolean {
    return (this.infrastructure?.domainControllers?.length ?? 0) > 0;
  }

  get isTerminalType(): boolean {
    return this.task?.type === 'TERMINAL_MAINTENANCE' || this.task?.type === 'SITE_VISIT';
  }

  get isServerType(): boolean {
    return this.task?.type === 'SERVER_MAINTENANCE';
  }

  get isUnsupported(): boolean {
    return this.task?.type === 'AV_CONTROL'
      || this.task?.type === 'UPS_CONTROL'
      || this.task?.type === 'ENDPOINT_INVENTORY';
  }

  // ── Read-only state ─────────────────────────────────────────────────────────

  private applyReadOnlyState(): void {
    if (!this.form) return;
    if (this.readOnly) {
      this.form.disable({ emitEvent: false });
    } else {
      this.form.enable({ emitEvent: false });
    }
  }

  // ── Form construction ───────────────────────────────────────────────────────

  private buildForm(): void {
    this.form = this.fb.group({
      servers: this.fb.array(
        this.infrastructure.windowsVMs.map(() => this.fb.group({
          updates:  ['ok'],
          notes:    [''],
          expanded: [false],
        }))
      ),
      domainControllers: this.fb.array(
        (this.infrastructure.domainControllers ?? []).map(() =>
          this.fb.group({ rawJson: [''] })
        )
      ),
      vmwareHosts: this.fb.array(
        this.infrastructure.esxiHosts.map(() => this.fb.group({
          cpuUsage:     [null as number | null],
          memUsage:     [null as number | null],
          storageUsage: [null as number | null],
          highUsageVMs: [[] as string[]],
          snapshotsOk:  [false],
        }))
      ),
      bmcHosts: this.fb.array(
        this.infrastructure.esxiHosts.map(() => this.fb.group({
          firmwareVersion:  [''],
          biosVersion:      [''],
          alertStatus:      ['ok'],
          alertCategories:  [[] as string[]],
          alertLogs:        [''],
        }))
      ),
      veeamJobs:        [[] as VeeamJobEntry[]],
      veeamUncovered:   [[] as number[]],
      routerDevices: this.fb.array(
        this.infrastructure.routers.map(() => this.fb.group({
          firmwareUpdated: [false],
          firmwareVersion: [''],
          backupDone:      [false],
        }))
      ),
      cleanedTemp:    [false],
      windowsUpdates: [false],
      antivirusOk:    [false],
      diskSpace:      [false],
      licenses:       [false],
      connectivity: [false],
      switches:     [false],
      observations: [''],
      notes: [''],
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  selectClass(value: string): string {
    if (!value) return 'mf-sel--na';
    if (value === 'ok' || value === 'OK') return 'mf-sel--ok';
    if (value === 'pending' || value === 'degraded' || value === 'falta_configurar' || value === 'ERROR Systemlog') return 'mf-sel--warn';
    if (value === 'error' || value === 'failed' || value === 'ERROR' || value === 'alerta') return 'mf-sel--crit';
    return 'mf-sel--na';
  }

  serverRowClass(i: number): string {
    const group = this.getServerGroup(i);
    const sc = this.selectClass(group.get('updates')?.value);
    if (sc === 'mf-sel--crit') return 'mf-srv-row--crit';
    if (sc === 'mf-sel--warn') return 'mf-srv-row--warn';
    return '';
  }

  metricClass(value: number | null, warnThreshold: number, critThreshold: number): string {
    if (value === null || value === undefined || isNaN(value)) return '';
    if (value >= critThreshold) return 'mf-inp--crit';
    if (value >= warnThreshold) return 'mf-inp--warn';
    return 'mf-inp--ok';
  }

  showHighVMsForHost(i: number): boolean {
    const ctrl = this.vmwareHostControls.at(i);
    const cpu     = Number(ctrl.get('cpuUsage')?.value);
    const mem     = Number(ctrl.get('memUsage')?.value);
    const storage = Number(ctrl.get('storageUsage')?.value);
    return cpu >= 60 || mem >= 70 || storage >= 70;
  }

  toggleExpand(index: number): void {
    const ctrl = this.serverControls.at(index).get('expanded');
    ctrl?.setValue(!ctrl.value);
  }

  getServerGroup(index: number): FormGroup {
    return this.serverControls.at(index) as FormGroup;
  }

  getBmcGroup(index: number): FormGroup {
    return this.bmcHostControls.at(index) as FormGroup;
  }

  bmcHasAlert(index: number): boolean {
    return this.getBmcGroup(index).get('alertStatus')?.value === 'alerta';
  }

  // ── Payload construction ────────────────────────────────────────────────────

  buildPayload(): ServerMaintenancePayload | TerminalPayload {
    const v = this.form.value;

    if (this.isTerminalType) {
      const payload: TerminalPayload = {
        type: 'TERMINAL_MAINTENANCE',
        checks: {
          cleanedTemp:    v.cleanedTemp,
          windowsUpdates: v.windowsUpdates,
          antivirusOk:    v.antivirusOk,
          diskSpace:      v.diskSpace,
          licenses:       v.licenses,
        },
        network: {
          connectivity: v.connectivity,
          switches:     v.switches,
        },
        observations: v.observations || undefined,
        notes:        v.notes || undefined,
      };
      return payload;
    }

    const servers = this.infrastructure.windowsVMs.map((vm, i) => ({
      serverId:   vm.assetId,
      serverName: vm.name,
      updates:    v.servers[i]?.updates ?? 'ok',
      notes:      v.servers[i]?.notes || undefined,
    }));

    const payload: ServerMaintenancePayload = {
      type: 'SERVER_MAINTENANCE',
      windows: {
        servers,
        domainControllers: (this.infrastructure.domainControllers ?? [])
          .map((_, i) => {
            const raw = this.dcControls.at(i).get('rawJson')?.value ?? '';
            try { return JSON.parse(raw) as DcHealthSnapshot; }
            catch { return null; }
          })
          .filter((s): s is DcHealthSnapshot => s !== null),
      },
      notes: v.notes || undefined,
    };

    if (this.hasVMware) {
      payload.vmware = this.infrastructure.esxiHosts.map((host, i) => {
        const ctrl = this.vmwareHostControls.at(i).value;
        return {
          hostId:       host.assetId,
          hostName:     host.name,
          cpuUsage:     Number(ctrl.cpuUsage),
          memUsage:     Number(ctrl.memUsage),
          storageUsage: Number(ctrl.storageUsage),
          highUsageVMs: ctrl.highUsageVMs?.length ? ctrl.highUsageVMs : undefined,
          snapshotsOk:  ctrl.snapshotsOk,
        };
      });

      payload.bmc = this.infrastructure.esxiHosts.map((host, i) => {
        const ctrl = this.bmcHostControls.at(i).value;
        const entry: BmcEntry = {
          hostId:      host.assetId,
          hostName:    host.name,
          alertStatus: ctrl.alertStatus,
        };
        if (ctrl.firmwareVersion) entry.firmwareVersion = ctrl.firmwareVersion;
        if (ctrl.biosVersion)     entry.biosVersion     = ctrl.biosVersion;
        if (ctrl.alertStatus === 'alerta' && ctrl.alertCategories?.length) entry.alertCategories = ctrl.alertCategories;
        if (ctrl.alertLogs)       entry.alertLogs       = ctrl.alertLogs;
        return entry;
      });
    }

    if (this.hasVeeam) {
      payload.veeam = {
        jobs:         v.veeamJobs ?? [],
        uncoveredVMs: v.veeamUncovered ?? [],
      };
    }

    if (this.hasRouter) {
      payload.router = this.infrastructure.routers.map((router, i): RouterEntry => {
        const ctrl = this.routerDeviceControls.at(i).value;
        return {
          routerId:        router.assetId,
          routerName:      router.name,
          firmwareUpdated: ctrl.firmwareUpdated,
          firmwareVersion: ctrl.firmwareVersion || undefined,
          backupDone:      ctrl.backupDone,
        };
      });
    }

    return payload;
  }

  private patchFormFromPayload(payload: MaintenancePayload): void {
    if (payload.type === 'SERVER_MAINTENANCE') {
      const srv = payload as ServerMaintenancePayload;

      this.form.patchValue({
        notes:        srv.notes ?? '',
        veeamJobs:      srv.veeam?.jobs ?? [],
        veeamUncovered: srv.veeam?.uncoveredVMs ?? [],
      });

      if (srv.router?.length) {
        this.infrastructure.routers.forEach((router, i) => {
          const saved = srv.router!.find(r => r.routerId === router.assetId);
          if (saved) {
            this.routerDeviceControls.at(i).patchValue({
              firmwareUpdated: saved.firmwareUpdated,
              firmwareVersion: saved.firmwareVersion ?? '',
              backupDone:      saved.backupDone,
            });
          }
        });
      }

      if (srv.windows.servers?.length) {
        this.infrastructure.windowsVMs.forEach((vm, i) => {
          const saved = srv.windows.servers.find(s => s.serverId === vm.assetId);
          if (saved) {
            this.serverControls.at(i).patchValue({
              updates: saved.updates,
              notes:   saved.notes ?? '',
            });
          }
        });
      }

      if (srv.vmware?.length) {
        this.infrastructure.esxiHosts.forEach((host, i) => {
          const saved = srv.vmware!.find(h => h.hostId === host.assetId);
          if (saved) {
            this.vmwareHostControls.at(i).patchValue({
              cpuUsage:     saved.cpuUsage,
              memUsage:     saved.memUsage,
              storageUsage: saved.storageUsage,
              highUsageVMs: saved.highUsageVMs ?? [],
              snapshotsOk:  saved.snapshotsOk,
            });
          }
        });
      }

      if (srv.bmc?.length) {
        this.infrastructure.esxiHosts.forEach((host, i) => {
          const saved = srv.bmc!.find(b => b.hostId === host.assetId);
          if (saved) {
            this.bmcHostControls.at(i).patchValue({
              firmwareVersion:  saved.firmwareVersion ?? '',
              biosVersion:      saved.biosVersion ?? '',
              alertStatus:      saved.alertStatus,
              alertCategories:  saved.alertCategories ?? [],
              alertLogs:        saved.alertLogs ?? '',
            });
          }
        });
      }

      if (srv.windows.domainControllers?.length) {
        srv.windows.domainControllers.forEach((snapshot, i) => {
          this.dcControls.at(i)?.patchValue({
            rawJson: JSON.stringify(snapshot, null, 2),
          });
        });
      }
    } else if (payload.type === 'TERMINAL_MAINTENANCE') {
      const t = payload as TerminalPayload;
      this.form.patchValue({
        cleanedTemp:    t.checks?.cleanedTemp    ?? false,
        windowsUpdates: t.checks?.windowsUpdates ?? false,
        antivirusOk:    t.checks?.antivirusOk    ?? false,
        diskSpace:      t.checks?.diskSpace      ?? false,
        licenses:       t.checks?.licenses       ?? false,
        connectivity:   t.network?.connectivity  ?? false,
        switches:       t.network?.switches      ?? false,
        observations:   t.observations ?? '',
        notes:          t.notes ?? '',
      });
    }
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  submit(): void {
    this.requestComplete.emit(this.buildPayload());
  }

  save(): void {
    this.requestSave.emit(this.buildPayload());
  }

  submitNotDone(): void {
    this.requestNotDone.emit();
  }
}
