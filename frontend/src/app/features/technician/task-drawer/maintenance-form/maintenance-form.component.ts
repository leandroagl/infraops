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
  MaintenancePayload,
  ServerMaintenancePayload,
  TerminalPayload,
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

  @Output() requestComplete = new EventEmitter<ServerMaintenancePayload | TerminalPayload>();
  @Output() requestSave = new EventEmitter<ServerMaintenancePayload | TerminalPayload>();
  @Output() requestNotDone = new EventEmitter<void>();

  form!: FormGroup;

  constructor(private fb: FormBuilder) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['infrastructure'] && this.infrastructure) {
      this.buildForm();
    }
  }

  // ── Getters condicionales ────────────────────────────────────────────────────

  get hasServers(): boolean { return this.infrastructure?.windowsVMs?.length > 0; }
  get hasVMware(): boolean  { return this.infrastructure?.esxiHosts?.length > 0; }
  get hasQNAP(): boolean    { return this.infrastructure?.nas?.length > 0; }
  get hasVeeam(): boolean   { return this.infrastructure?.esxiHosts?.length > 0; }
  get hasRouter(): boolean  { return this.infrastructure?.routers?.length > 0; }

  get serverControls(): FormArray {
    return this.form.get('servers') as FormArray;
  }

  get vmwareHostControls(): FormArray {
    return this.form.get('vmwareHosts') as FormArray;
  }

  get qnapDeviceControls(): FormArray {
    return this.form.get('qnapDevices') as FormArray;
  }

  get bmcHostControls(): FormArray {
    return this.form.get('bmcHosts') as FormArray;
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

  // ── Form construction ───────────────────────────────────────────────────────

  private buildForm(): void {
    this.form = this.fb.group({
      servers: this.fb.array(
        this.infrastructure.windowsVMs.map(() => this.fb.group({
          rebootScript: ['ok'],
          updates:      ['ok'],
          notes:        [''],
          expanded:     [false],
        }))
      ),
      dcdiag:       ['OK'],
      dcdiagDetail: [''],
      vmwareHosts: this.fb.array(
        this.infrastructure.esxiHosts.map(() => this.fb.group({
          cpuUsage:     [null as number | null],
          memUsage:     [null as number | null],
          storageUsage: [null as number | null],
          highUsageVMs: [[] as string[]],
          snapshotsOk:  [false],
        }))
      ),
      qnapDevices: this.fb.array(
        this.infrastructure.nas.map(() => this.fb.group({
          spaceUsed:       [null as number | null],
          raidStatus:      ['ok'],
          firmwareUpdated: [false],
        }))
      ),
      bmcHosts: this.fb.array(
        this.infrastructure.esxiHosts.map(() => this.fb.group({
          firmwareVersion: [''],
          biosVersion:     [''],
          alertStatus:     ['ok'],
          alertNote:       [''],
        }))
      ),
      veeamStatus:  ['ok'],
      veeamMissing: [[] as string[]],
      routerFirmwareUpdated: [false],
      routerFirmwareVersion: [''],
      routerBackupDone:      [false],
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

  dcdiagHasError(): boolean {
    return this.form.get('dcdiag')?.value?.startsWith('ERROR') ?? false;
  }

  selectClass(value: string): string {
    if (!value) return 'mf-sel--na';
    if (value === 'ok' || value === 'OK') return 'mf-sel--ok';
    if (value === 'pending' || value === 'degraded' || value === 'falta_configurar' || value === 'ERROR Systemlog') return 'mf-sel--warn';
    if (value === 'error' || value === 'failed' || value === 'ERROR' || value === 'alerta') return 'mf-sel--crit';
    return 'mf-sel--na';
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
      serverId:     vm.assetId,
      serverName:   vm.name,
      rebootScript: v.servers[i]?.rebootScript ?? 'ok',
      updates:      v.servers[i]?.updates ?? 'ok',
      notes:        v.servers[i]?.notes || undefined,
    }));

    const payload: ServerMaintenancePayload = {
      type: 'SERVER_MAINTENANCE',
      windows: {
        servers,
        dcdiag:       v.dcdiag,
        dcdiagDetail: this.dcdiagHasError() ? (v.dcdiagDetail || undefined) : undefined,
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
        if (ctrl.alertStatus === 'alerta' && ctrl.alertNote) entry.alertNote = ctrl.alertNote;
        return entry;
      });
    }

    if (this.hasQNAP) {
      payload.qnap = this.infrastructure.nas.map((nas, i) => {
        const ctrl = this.qnapDeviceControls.at(i).value;
        return {
          deviceId:        nas.assetId,
          deviceName:      nas.name,
          spaceUsed:       Number(ctrl.spaceUsed),
          raidStatus:      ctrl.raidStatus,
          firmwareUpdated: ctrl.firmwareUpdated,
        };
      });
    }

    if (this.hasVeeam) {
      payload.veeam = {
        status:     v.veeamStatus,
        missingVMs: v.veeamStatus !== 'ok' ? (v.veeamMissing ?? []) : undefined,
      };
    }

    if (this.hasRouter) {
      payload.router = {
        firmwareUpdated: v.routerFirmwareUpdated,
        firmwareVersion: v.routerFirmwareVersion || undefined,
        backupDone:      v.routerBackupDone,
      };
    }

    return payload;
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
