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
  ServerHostPayload,
  VMwareHostEntry,
} from '../../../../core/models/maintenance-log.models';

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
    } else if (changes['readOnly'] && this.form) {
      this.applyReadOnlyState();
    }
  }

  get vmwareHostControls(): FormArray {
    return this.form.get('vmwareHosts') as FormArray;
  }

  get bmcHostControls(): FormArray {
    return this.form.get('bmcHosts') as FormArray;
  }

  getBmcGroup(index: number): FormGroup {
    return this.bmcHostControls.at(index) as FormGroup;
  }

  bmcHasAlert(index: number): boolean {
    return this.getBmcGroup(index).get('alertStatus')?.value === 'alerta';
  }

  selectClass(value: string): string {
    if (!value) return 'shf-sel--na';
    if (value === 'ok') return 'shf-sel--ok';
    if (value === 'alerta') return 'shf-sel--crit';
    return 'shf-sel--na';
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

  submit(): void {
    this.requestComplete.emit(this.buildPayload());
  }

  save(): void {
    this.requestSave.emit(this.buildPayload());
  }

  submitNotDone(): void {
    this.requestNotDone.emit();
  }

  buildPayload(): ServerHostPayload {
    const vmware: VMwareHostEntry[] = this.infrastructure.esxiHosts.map((host, i) => {
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

    const bmc: BmcEntry[] = this.infrastructure.esxiHosts.map((host, i) => {
      const ctrl = this.bmcHostControls.at(i).value;
      const entry: BmcEntry = {
        hostId:      host.assetId,
        hostName:    host.name,
        alertStatus: ctrl.alertStatus,
      };
      if (ctrl.firmwareVersion) entry.firmwareVersion = ctrl.firmwareVersion;
      if (ctrl.biosVersion)     entry.biosVersion     = ctrl.biosVersion;
      if (ctrl.alertStatus === 'alerta' && ctrl.alertCategories?.length) {
        entry.alertCategories = ctrl.alertCategories;
      }
      if (ctrl.alertLogs) entry.alertLogs = ctrl.alertLogs;
      return entry;
    });

    return {
      type: 'SERVER_HOST_MAINTENANCE',
      esxiHosts: [],
      vmware,
      bmc,
      notes: this.form.value.notes || undefined,
    };
  }

  private buildForm(): void {
    this.form = this.fb.group({
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
      notes: [''],
    });
  }

  private applyReadOnlyState(): void {
    if (!this.form) return;
    if (this.readOnly) {
      this.form.disable({ emitEvent: false });
    } else {
      this.form.enable({ emitEvent: false });
    }
  }

  private patchFormFromPayload(payload: MaintenancePayload): void {
    if (payload.type !== 'SERVER_HOST_MAINTENANCE') return;
    const srv = payload as ServerHostPayload;

    this.form.patchValue({ notes: srv.notes ?? '' });

    if (srv.vmware?.length) {
      const vmware = srv.vmware;
      this.infrastructure.esxiHosts.forEach((host, i) => {
        const saved = vmware.find(h => h.hostId === host.assetId);
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
      const bmc = srv.bmc;
      this.infrastructure.esxiHosts.forEach((host, i) => {
        const saved = bmc.find(b => b.hostId === host.assetId);
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
  }
}
