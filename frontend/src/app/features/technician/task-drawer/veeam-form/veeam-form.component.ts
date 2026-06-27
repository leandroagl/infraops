import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormArray, FormBuilder, FormGroup } from '@angular/forms';
import {
  VeeamBackupPayload,
  VeeamVmEntry,
} from '../../../../core/models/maintenance-log.models';

type VmCoverage = 'job' | 'agent' | 'excluded' | 'no_backup';
type VmRowState = 'ok' | 'warn' | 'no' | 'excl';

@Component({
  selector: 'app-veeam-form',
  templateUrl: './veeam-form.component.html',
  styleUrl: './veeam-form.component.scss',
})
export class VeeamFormComponent implements OnChanges {
  @Input() vms: { name: string; os: string }[] = [];
  @Input() existingPayload?: VeeamBackupPayload;
  @Input() readOnly = false;

  @Output() saved    = new EventEmitter<VeeamBackupPayload>();
  @Output() cancelled = new EventEmitter<void>();

  form!: FormGroup;

  constructor(private fb: FormBuilder) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['vms'] && this.vms.length) {
      this.buildForm();
      if (this.existingPayload) {
        this.patchFromPayload(this.existingPayload);
      }
      this.applyReadOnly();
    } else if (changes['existingPayload'] && this.existingPayload && this.form) {
      this.patchFromPayload(this.existingPayload);
    } else if (changes['readOnly'] && this.form) {
      this.applyReadOnly();
    }
  }

  get vmRows(): FormArray {
    return this.form.get('vmRows') as FormArray;
  }

  vmRowState(i: number): VmRowState {
    const row = this.vmRows.at(i).getRawValue() as { coverage: VmCoverage; fullsInMonth: number | null };
    if (row.coverage === 'excluded') return 'excl';
    if (row.coverage === 'no_backup') return 'no';
    const fulls = row.fullsInMonth ?? 0;
    if (fulls >= 2) return 'ok';
    if (fulls === 1) return 'warn';
    return 'no';
  }

  vmHint(i: number): { text: string; cls: string } {
    const row = this.vmRows.at(i).getRawValue() as { coverage: VmCoverage; fullsInMonth: number | null };
    if (row.coverage === 'excluded') return { text: 'Excluida ✓', cls: 'h-ok' };
    if (row.coverage === 'no_backup') return { text: 'Sin cobertura', cls: 'h-no' };
    const fulls = row.fullsInMonth ?? 0;
    if (fulls === 0) return { text: 'Sin fulls registrados', cls: 'h-no' };
    if (fulls === 1) return { text: 'Verificar cadena de incrementales', cls: 'h-warn' };
    return { text: `${fulls} fulls ✓`, cls: 'h-ok' };
  }

  showFulls(i: number): boolean {
    const cov: VmCoverage = this.vmRows.at(i).get('coverage')?.value;
    return cov === 'job' || cov === 'agent';
  }

  covClass(i: number): string {
    const s = this.vmRowState(i);
    return s === 'no' ? 'cov--no' : s === 'warn' ? 'cov--warn' : 'cov--ok';
  }

  fullsClass(i: number): string {
    const s = this.vmRowState(i);
    return s === 'ok' ? 'fulls--ok' : s === 'warn' ? 'fulls--warn' : 'fulls--no';
  }

  get summaryOk(): number {
    return this.vms.reduce((n, _, i) => {
      const s = this.vmRowState(i);
      return n + (s === 'ok' || s === 'excl' ? 1 : 0);
    }, 0);
  }

  get summaryWarn(): number {
    return this.vms.reduce((n, _, i) => n + (this.vmRowState(i) === 'warn' ? 1 : 0), 0);
  }

  get summaryNo(): number {
    return this.vms.reduce((n, _, i) => n + (this.vmRowState(i) === 'no' ? 1 : 0), 0);
  }

  onCoverageChange(i: number): void {
    const cov: VmCoverage = this.vmRows.at(i).get('coverage')?.value;
    if (cov === 'excluded' || cov === 'no_backup') {
      this.vmRows.at(i).get('fullsInMonth')?.setValue(null, { emitEvent: false });
    }
  }

  buildPayload(): VeeamBackupPayload {
    const raw = this.form.getRawValue() as {
      vmRows: { coverage: VmCoverage; fullsInMonth: number | null }[];
      notes: string;
    };
    const vms: VeeamVmEntry[] = this.vms.map((vm, i) => {
      const { coverage, fullsInMonth } = raw.vmRows[i];
      return {
        vmName: vm.name,
        coverage,
        fullsInMonth: (coverage === 'excluded' || coverage === 'no_backup') ? null : (fullsInMonth ?? null),
      };
    });
    return {
      type: 'VEEAM_BACKUP',
      vms,
      notes: raw.notes?.trim() || null,
    };
  }

  submit(): void {
    this.saved.emit(this.buildPayload());
  }

  private buildForm(): void {
    this.form = this.fb.group({
      vmRows: this.fb.array(
        this.vms.map(() =>
          this.fb.group({
            coverage:     ['job' as VmCoverage],
            fullsInMonth: [null as number | null],
          })
        )
      ),
      notes: [''],
    });
  }

  private patchFromPayload(payload: VeeamBackupPayload): void {
    payload.vms.forEach(entry => {
      const idx = this.vms.findIndex(v => v.name === entry.vmName);
      if (idx === -1) return;
      this.vmRows.at(idx).patchValue({
        coverage:     entry.coverage,
        fullsInMonth: entry.fullsInMonth,
      }, { emitEvent: false });
    });
    this.form.patchValue({ notes: payload.notes ?? '' }, { emitEvent: false });
  }

  private applyReadOnly(): void {
    if (!this.form) return;
    if (this.readOnly) {
      this.form.disable({ emitEvent: false });
    } else {
      this.form.enable({ emitEvent: false });
    }
  }
}
