import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { Task } from '../../../../core/models/task.models';
import { ClientInfrastructure, InfraAsset } from '../../../../core/models/infradoc.models';
import {
  BmcEntry,
  EsxiHostEntry,
  MaintenancePayload,
  ServerHostPayload,
  VmwareHealthResult,
  WindowsServerEntry,
} from '../../../../core/models/maintenance-log.models';
import { VmwareApiService } from '../../services/vmware-api.service';

type RowState = 'ok' | 'warn' | 'crit';

interface WindowsHostControls {
  updates: FormControl<string | null>;
  restartScript: FormControl<string | null>;
}

@Component({
  selector: 'app-server-host-form',
  templateUrl: './server-host-form.component.html',
  styleUrl: './server-host-form.component.scss',
})
export class ServerHostFormComponent implements OnChanges {
  @Input() task!: Task;
  @Input() infrastructure!: ClientInfrastructure;
  @Input() savedPayload: MaintenancePayload | null = null;
  @Input() readOnly = false;

  @Output() requestComplete = new EventEmitter<ServerHostPayload>();
  @Output() requestSave     = new EventEmitter<ServerHostPayload>();
  @Output() requestNotDone  = new EventEmitter<void>();

  vmwareResults   = new Map<number, VmwareHealthResult>();
  loadingHosts    = new Set<number>();
  hostErrors      = new Map<number, string>();
  bmcData         = new Map<number, BmcEntry>();
  windowsControls = new Map<number, WindowsHostControls>();
  notesControl    = new FormControl('');

  constructor(private readonly vmwareApiService: VmwareApiService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['infrastructure'] && this.infrastructure) {
      this.initWindowsControls();
    }
    if (changes['savedPayload'] && this.savedPayload) {
      this.restoreFromPayload(this.savedPayload);
    }
    if (changes['readOnly']) {
      if (this.readOnly) {
        this.notesControl.disable({ emitEvent: false });
        this.windowsControls.forEach(c => {
          c.updates.disable({ emitEvent: false });
          c.restartScript.disable({ emitEvent: false });
        });
      } else {
        this.notesControl.enable({ emitEvent: false });
        this.windowsControls.forEach(c => {
          c.updates.enable({ emitEvent: false });
          c.restartScript.enable({ emitEvent: false });
        });
      }
    }
  }

  isWindowsHost(host: InfraAsset): boolean {
    return (host.os ?? '').toLowerCase().startsWith('windows');
  }

  getWindowsCtrl(assetId: number): WindowsHostControls {
    return this.windowsControls.get(assetId)!;
  }

  selectClass(value: string | null): string {
    if (!value) return '';
    if (value === 'ok') return 'shf-sel--ok';
    if (value === 'pending' || value === 'no_task') return 'shf-sel--warn';
    if (value === 'failed' || value === 'error') return 'shf-sel--crit';
    return '';
  }

  windowsRowState(assetId: number): RowState {
    const ctrl = this.windowsControls.get(assetId);
    if (!ctrl) return 'ok';
    const updates       = ctrl.updates.value;
    const restartScript = ctrl.restartScript.value;
    if (updates === 'failed' || restartScript === 'error') return 'crit';
    if (updates === 'pending' || restartScript === 'no_task') return 'warn';
    return 'ok';
  }

  onRunCheck(uri: string, assetId: number): void {
    this.loadingHosts.add(assetId);
    this.hostErrors.delete(assetId);
    this.vmwareApiService.healthCheck(uri).subscribe({
      next: (result) => {
        this.vmwareResults.set(assetId, result);
        this.loadingHosts.delete(assetId);
      },
      error: (err) => {
        this.hostErrors.set(assetId, err?.error?.message ?? 'Error al ejecutar el control');
        this.loadingHosts.delete(assetId);
      },
    });
  }

  submit(): void {
    this.requestComplete.emit(this.buildPayload());
  }

  save(): void {
    this.requestSave.emit(this.buildPayload());
  }

  submitNotDone(): void {
    this.requestNotDone.emit();
  }

  onBmcChange(entry: BmcEntry): void {
    this.bmcData.set(entry.hostId, entry);
  }

  buildPayload(): ServerHostPayload {
    const vmwareHosts  = this.infrastructure.esxiHosts.filter(h => !this.isWindowsHost(h));
    const windowsHosts = this.infrastructure.esxiHosts.filter(h =>  this.isWindowsHost(h));

    const payload: ServerHostPayload = {
      type: 'SERVER_HOST_MAINTENANCE',
      esxiHosts: vmwareHosts.map((host): EsxiHostEntry => ({
        assetId:     host.assetId,
        vmwareCheck: this.vmwareResults.get(host.assetId) ?? null,
      })),
      bmc: this.infrastructure.esxiHosts.map((host): BmcEntry =>
        this.bmcData.get(host.assetId) ?? {
          hostId:      host.assetId,
          hostName:    host.name,
          alertStatus: 'ok',
        }
      ),
      notes: this.notesControl.value || undefined,
    };

    if (windowsHosts.length > 0) {
      payload.windowsHosts = windowsHosts.map((host): WindowsServerEntry => {
        const ctrl = this.windowsControls.get(host.assetId);
        return {
          serverId:      host.assetId,
          serverName:    host.name,
          updates:       (ctrl?.updates.value ?? 'ok') as WindowsServerEntry['updates'],
          restartScript: (ctrl?.restartScript.value ?? 'ok') as WindowsServerEntry['restartScript'],
        };
      });
    }

    return payload;
  }

  private initWindowsControls(): void {
    this.windowsControls.clear();
    for (const host of this.infrastructure.esxiHosts) {
      if (this.isWindowsHost(host)) {
        this.windowsControls.set(host.assetId, {
          updates:       new FormControl('ok'),
          restartScript: new FormControl('ok'),
        });
      }
    }
  }

  private restoreFromPayload(payload: MaintenancePayload): void {
    if (payload.type !== 'SERVER_HOST_MAINTENANCE') return;
    const srv = payload as ServerHostPayload;
    this.notesControl.setValue(srv.notes ?? '', { emitEvent: false });
    for (const entry of (srv.esxiHosts ?? [])) {
      if (entry.vmwareCheck) {
        this.vmwareResults.set(entry.assetId, entry.vmwareCheck);
      }
    }
    for (const bmc of (srv.bmc ?? [])) {
      this.bmcData.set(bmc.hostId, bmc);
    }
    for (const win of (srv.windowsHosts ?? [])) {
      const ctrl = this.windowsControls.get(win.serverId);
      if (ctrl) {
        ctrl.updates.setValue(win.updates, { emitEvent: false });
        ctrl.restartScript.setValue(win.restartScript, { emitEvent: false });
      }
    }
  }
}
