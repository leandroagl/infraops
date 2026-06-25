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
import { ClientInfrastructure, InfraAsset } from '../../../../core/models/infradoc.models';
import {
  MaintenancePayload,
  VeeamBackupPayload,
} from '../../../../core/models/maintenance-log.models';

@Component({
  selector: 'app-veeam-form',
  templateUrl: './veeam-form.component.html',
  styleUrl: './veeam-form.component.scss',
})
export class VeeamFormComponent implements OnChanges {
  @Input() task!: Task;
  @Input() infrastructure!: ClientInfrastructure;
  @Input() savedPayload: MaintenancePayload | null = null;
  @Input() readOnly = false;

  @Output() requestComplete = new EventEmitter<VeeamBackupPayload>();
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

  get allVMs(): InfraAsset[] {
    return [
      ...(this.infrastructure?.windowsVMs ?? []),
      ...(this.infrastructure?.domainControllers ?? []),
      ...(this.infrastructure?.linuxVMs ?? []),
    ];
  }

  get jobControls(): FormArray {
    return this.form.get('jobs') as FormArray;
  }

  addJob(): void {
    this.jobControls.push(this.fb.group({
      jobName:        [''],
      fullsAvailable: [null as number | null],
      restorePoints:  [null as number | null],
    }));
  }

  removeJob(i: number): void {
    this.jobControls.removeAt(i);
  }

  isUncovered(assetId: number): boolean {
    const current: number[] = this.form.get('uncoveredVMs')?.value ?? [];
    return current.includes(assetId);
  }

  toggleVM(assetId: number): void {
    const ctrl = this.form.get('uncoveredVMs')!;
    const current: number[] = [...(ctrl.value as number[] ?? [])];
    const idx = current.indexOf(assetId);
    if (idx === -1) {
      current.push(assetId);
    } else {
      current.splice(idx, 1);
    }
    ctrl.setValue(current);
  }

  buildPayload(): VeeamBackupPayload {
    const v = this.form.getRawValue();
    return {
      type: 'VEEAM_BACKUP',
      jobs: v.jobs ?? [],
      uncoveredVMs: v.uncoveredVMs ?? [],
      notes: v.notes || undefined,
    };
  }

  submit(): void {
    this.requestComplete.emit(this.buildPayload());
  }

  submitNotDone(): void {
    this.requestNotDone.emit();
  }

  private buildForm(): void {
    this.form = this.fb.group({
      jobs:         this.fb.array([]),
      uncoveredVMs: [[] as number[]],
      notes:        [''],
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
    if (payload.type !== 'VEEAM_BACKUP') return;
    const vb = payload as VeeamBackupPayload;
    const jobsArray = this.jobControls;
    while (jobsArray.length) jobsArray.removeAt(0);
    (vb.jobs ?? []).forEach(job => {
      jobsArray.push(this.fb.group({
        jobName:        [job.jobName],
        fullsAvailable: [job.fullsAvailable],
        restorePoints:  [job.restorePoints],
      }));
    });
    this.form.patchValue({
      uncoveredVMs: vb.uncoveredVMs ?? [],
      notes:        vb.notes ?? '',
    });
  }
}
