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
  MaintenancePayload,
  QNAPSection,
  QnapPayload,
} from '../../../../core/models/maintenance-log.models';

@Component({
  selector: 'app-qnap-form',
  templateUrl: './qnap-form.component.html',
  styleUrl: './qnap-form.component.scss',
})
export class QnapFormComponent implements OnChanges {
  @Input() task!: Task;
  @Input() infrastructure!: ClientInfrastructure;
  @Input() savedPayload: MaintenancePayload | null = null;
  @Input() readOnly = false;

  @Output() requestComplete = new EventEmitter<QnapPayload>();
  @Output() requestSave     = new EventEmitter<QnapPayload>();
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

  get qnapDeviceControls(): FormArray {
    return this.form.get('qnapDevices') as FormArray;
  }

  getQnapGroup(index: number): FormGroup {
    return this.qnapDeviceControls.at(index) as FormGroup;
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

  buildPayload(): QnapPayload {
    const v = this.form.value;
    return {
      type: 'QNAP_MAINTENANCE',
      qnap: this.infrastructure.nas.map((nas, i) => {
        const ctrl = this.qnapDeviceControls.at(i).value;
        const result: QNAPSection = {
          deviceId:        nas.assetId,
          deviceName:      nas.name,
          diskCount:       Number(ctrl.diskCount),
          totalSpaceGB:    Number(ctrl.totalSpaceGB),
          totalSpaceUnit:  ctrl.totalSpaceUnit ?? 'GB',
          usedSpaceGB:     Number(ctrl.usedSpaceGB),
          usedSpaceUnit:   ctrl.usedSpaceUnit ?? 'GB',
          disksWithError:  ctrl.disksWithError ?? [],
          raidStatus:      ctrl.raidStatus,
          firmwareVersion: ctrl.firmwareVersion ?? '',
          firmwareUpdated: ctrl.firmwareUpdated,
        };
        if (ctrl.firmwareUpdated && ctrl.firmwareNewVersion) {
          result.firmwareNewVersion = ctrl.firmwareNewVersion;
        }
        return result;
      }),
      notes: v.notes || undefined,
    };
  }

  private applyReadOnlyState(): void {
    if (!this.form) return;
    if (this.readOnly) {
      this.form.disable({ emitEvent: false });
    } else {
      this.form.enable({ emitEvent: false });
    }
  }

  private buildForm(): void {
    this.form = this.fb.group({
      qnapDevices: this.fb.array(
        this.infrastructure.nas.map(() => this.fb.group({
          diskCount:          [null as number | null],
          totalSpaceGB:       [null as number | null],
          totalSpaceUnit:     ['GB' as 'GB' | 'TB'],
          usedSpaceGB:        [null as number | null],
          usedSpaceUnit:      ['GB' as 'GB' | 'TB'],
          disksWithError:     [[] as string[]],
          raidStatus:         ['ok'],
          firmwareVersion:    [''],
          firmwareUpdated:    [false],
          firmwareNewVersion: [''],
        }))
      ),
      notes: [''],
    });
  }

  private patchFormFromPayload(payload: MaintenancePayload): void {
    if (payload.type !== 'QNAP_MAINTENANCE') return;
    const qnap = payload as QnapPayload;
    this.form.patchValue({ notes: qnap.notes ?? '' });
    if (qnap.qnap?.length) {
      this.infrastructure.nas.forEach((nas, i) => {
        const saved = qnap.qnap.find(d => d.deviceId === nas.assetId);
        if (saved) {
          this.qnapDeviceControls.at(i).patchValue({
            diskCount:          saved.diskCount,
            totalSpaceGB:       saved.totalSpaceGB,
            totalSpaceUnit:     saved.totalSpaceUnit ?? 'GB',
            usedSpaceGB:        saved.usedSpaceGB,
            usedSpaceUnit:      saved.usedSpaceUnit ?? 'GB',
            disksWithError:     saved.disksWithError,
            raidStatus:         saved.raidStatus,
            firmwareVersion:    saved.firmwareVersion,
            firmwareUpdated:    saved.firmwareUpdated,
            firmwareNewVersion: saved.firmwareNewVersion ?? '',
          });
        }
      });
    }
  }
}
