import { Component, Input, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup } from '@angular/forms';
import { InfraAsset } from '../../../../core/models/infradoc.models';

@Component({
  selector: 'app-veeam-form',
  templateUrl: './veeam-form.component.html',
  styleUrl: './veeam-form.component.scss',
})
export class VeeamFormComponent implements OnInit {
  @Input() formGroup!: FormGroup;
  @Input() allVMs: InfraAsset[] = [];
  @Input() readOnly = false;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    if (this.readOnly) {
      this.formGroup.disable({ emitEvent: false });
    }
  }

  get jobControls(): FormArray {
    return this.formGroup.get('jobs') as FormArray;
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
    const current: number[] = this.formGroup.get('uncoveredVMs')?.value ?? [];
    return current.includes(assetId);
  }

  toggleVM(assetId: number): void {
    const ctrl = this.formGroup.get('uncoveredVMs')!;
    const current: number[] = [...(ctrl.value as number[] ?? [])];
    const idx = current.indexOf(assetId);
    if (idx === -1) {
      current.push(assetId);
    } else {
      current.splice(idx, 1);
    }
    ctrl.setValue(current);
  }
}
