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

  @Output() requestComplete = new EventEmitter<ServerMaintenancePayload | TerminalPayload>();
  @Output() requestNotDone = new EventEmitter<void>();

  form!: FormGroup;

  constructor(private fb: FormBuilder) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['infrastructure'] && this.infrastructure) {
      this.buildForm();
    }
  }

  // ── Getters condicionales ────────────────────────────────────────────────────

  get hasServers(): boolean  { return this.infrastructure?.servers?.length > 0; }
  get hasVMware(): boolean   { return this.infrastructure?.vms?.length > 0; }
  get hasQNAP(): boolean     { return this.infrastructure?.nas?.length > 0; }
  get hasVeeam(): boolean    { return this.infrastructure?.vms?.length > 0; }
  get hasRouter(): boolean   { return this.infrastructure?.routers?.length > 0; }

  get serverControls(): FormArray {
    return this.form.get('servers') as FormArray;
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
      // Windows servers (FormArray, rebuilt from infrastructure.servers)
      servers: this.fb.array(
        this.infrastructure.servers.map(() => this.fb.group({
          reboot:   ['—'],
          updates:  ['—'],
          notes:    [''],
          expanded: [false],
        }))
      ),
      // DCDIAG (global)
      dcdiag:       ['OK'],
      dcdiagDetail: [''],
      // VMware
      vmCpu:        [null as number | null],
      vmMem:        [null as number | null],
      vmStorage:    [null as number | null],
      highVMs:      [''],
      snapshotsOk:  [false],
      // QNAP
      qnapSpace:    [null as number | null],
      qnapRaid:     ['ok'],
      qnapFirmware: [false],
      // Veeam
      veeamStatus:   ['ok'],
      veeamAffected: [''],
      // Router
      routerFirmwareUpdated: [false],
      routerFirmwareVersion: [''],
      routerBackupDone:      [false],
      // Terminal checklist
      cleanedTemp:     [false],
      windowsUpdates:  [false],
      antivirusOk:     [false],
      diskSpace:       [false],
      licenses:        [false],
      // Network checklist
      connectivity: [false],
      switches:     [false],
      // Observations (terminal)
      observations: [''],
      // Notes (always)
      notes: [''],
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  dcdiagHasError(): boolean {
    return this.form.get('dcdiag')?.value?.startsWith('ERROR') ?? false;
  }

  selectClass(value: string): string {
    if (!value || value === '—') return 'mf-sel--na';
    if (value.startsWith('OK') || value.startsWith('Aplicados')) return 'mf-sel--ok';
    if (value.startsWith('Pendiente') || value === 'Pendientes sin aplicar') return 'mf-sel--warn';
    if (value.startsWith('Error')) return 'mf-sel--crit';
    return 'mf-sel--na';
  }

  metricClass(value: number | null, warnThreshold: number, critThreshold: number): string {
    if (value === null || value === undefined || isNaN(value)) return '';
    if (value >= critThreshold) return 'mf-inp--crit';
    if (value >= warnThreshold) return 'mf-inp--warn';
    return 'mf-inp--ok';
  }

  showHighVMs(): boolean {
    const v = this.form.value;
    return Number(v.vmCpu) >= 60 || Number(v.vmMem) >= 70 || Number(v.vmStorage) >= 70;
  }

  toggleExpand(index: number): void {
    const ctrl = this.serverControls.at(index).get('expanded');
    ctrl?.setValue(!ctrl.value);
  }

  getServerGroup(index: number): FormGroup {
    return this.serverControls.at(index) as FormGroup;
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

    // SERVER_MAINTENANCE (and unsupported types — payload still built as server type)
    const servers = this.infrastructure.servers.map((srv, i) => ({
      serverId:   srv.assetId,
      serverName: srv.name,
      reboot:     v.servers[i]?.reboot ?? '—',
      updates:    v.servers[i]?.updates ?? '—',
      notes:      v.servers[i]?.notes || undefined,
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
      payload.vmware = {
        cpuUsage:     Number(v.vmCpu),
        memUsage:     Number(v.vmMem),
        storageUsage: Number(v.vmStorage),
        highUsageVMs: v.highVMs || undefined,
        snapshotsOk:  v.snapshotsOk,
      };
    }

    if (this.hasQNAP) {
      payload.qnap = {
        spaceUsed:       Number(v.qnapSpace),
        raidStatus:      v.qnapRaid,
        firmwareUpdated: v.qnapFirmware,
      };
    }

    if (this.hasVeeam) {
      payload.veeam = {
        status:      v.veeamStatus,
        affectedVMs: v.veeamStatus !== 'ok' ? (v.veeamAffected || undefined) : undefined,
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

  submitNotDone(): void {
    this.requestNotDone.emit();
  }
}
