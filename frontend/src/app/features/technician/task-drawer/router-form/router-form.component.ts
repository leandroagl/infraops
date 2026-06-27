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
  RouterEntry,
  RouterMaintenancePayload,
} from '../../../../core/models/maintenance-log.models';

@Component({
  selector: 'app-router-form',
  templateUrl: './router-form.component.html',
  styleUrl: './router-form.component.scss',
})
export class RouterFormComponent implements OnChanges {
  @Input() task!: Task;
  @Input() infrastructure!: ClientInfrastructure;
  @Input() savedPayload: MaintenancePayload | null = null;
  @Input() readOnly = false;

  @Output() requestComplete = new EventEmitter<RouterMaintenancePayload>();
  @Output() requestSave     = new EventEmitter<RouterMaintenancePayload>();
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

  get routerControls(): FormArray {
    return this.form.get('routers') as FormArray;
  }

  buildPayload(): RouterMaintenancePayload {
    const router: RouterEntry[] = this.infrastructure.routers.map((r, i) => {
      const ctrl = this.routerControls.at(i).value;
      const entry: RouterEntry = {
        routerId:        r.assetId,
        routerName:      r.name,
        firmwareUpdated: ctrl.firmwareUpdated,
        backupDone:      ctrl.backupDone,
      };
      if (ctrl.firmwareVersion) entry.firmwareVersion = ctrl.firmwareVersion;
      return entry;
    });

    return {
      type: 'ROUTER_MAINTENANCE',
      router,
      notes: this.form.value.notes || undefined,
    };
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

  private buildForm(): void {
    this.form = this.fb.group({
      routers: this.fb.array(
        this.infrastructure.routers.map(() => this.fb.group({
          firmwareUpdated: [false],
          firmwareVersion: [''],
          backupDone:      [false],
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
    if (payload.type !== 'ROUTER_MAINTENANCE') return;
    const saved = payload as RouterMaintenancePayload;

    this.form.patchValue({ notes: saved.notes ?? '' });

    if (saved.router?.length) {
      this.infrastructure.routers.forEach((router, i) => {
        const entry = saved.router.find(r => r.routerId === router.assetId);
        if (entry) {
          this.routerControls.at(i).patchValue({
            firmwareUpdated: entry.firmwareUpdated,
            firmwareVersion: entry.firmwareVersion ?? '',
            backupDone:      entry.backupDone,
          });
        }
      });
    }
  }
}
