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

  getQnapGroup(index: number): FormGroup {
    return this.qnapDeviceControls.at(index) as FormGroup;
  }

  diskSlotOptions(index: number): string[] {
    const count = Number(this.qnapDeviceControls.at(index).get('diskCount')?.value);
    if (!count || isNaN(count) || count <= 0) return [];
    return Array.from({ length: count }, (_, k) => `Disk ${k + 1}`);
  }

  qnapFirmwareUpdated(index: number): boolean {
    return this.qnapDeviceControls.at(index).get('firmwareUpdated')?.value === true;
  }

  spaceRatio(index: number): number {
    const g = this.getQnapGroup(index).value;
    const total = Number(g.totalSpaceGB) * (g.totalSpaceUnit === 'TB' ? 1024 : 1);
    const used  = Number(g.usedSpaceGB)  * (g.usedSpaceUnit  === 'TB' ? 1024 : 1);
    return total ? (used / total) * 100 : 0;
  }

  qnapCardHealth(index: number): 'ok' | 'warn' | 'crit' {
    const g = this.getQnapGroup(index).value;
    const ratio = this.spaceRatio(index);
    if (g.disksWithError?.length || g.raidStatus === 'failed' || ratio > 85) return 'crit';
    if (g.raidStatus === 'degraded' || ratio > 70) return 'warn';
    return 'ok';
  }

  selectClass(value: string): string {
    if (!value) return 'mf-sel--na';
    if (value === 'ok') return 'mf-sel--ok';
    if (value === 'degraded') return 'mf-sel--warn';
    if (value === 'failed') return 'mf-sel--crit';
    return 'mf-sel--na';
  }

  metricClass(value: number | null, warnThreshold: number, critThreshold: number): string {
    if (value === null || value === undefined || isNaN(value)) return '';
    if (value >= critThreshold) return 'mf-inp--crit';
    if (value >= warnThreshold) return 'mf-inp--warn';
    return 'mf-inp--ok';
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

  submit(): void {
    this.requestComplete.emit(this.buildPayload());
  }

  submitNotDone(): void {
    this.requestNotDone.emit();
  }
}
