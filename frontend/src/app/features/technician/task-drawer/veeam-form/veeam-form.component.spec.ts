import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { VeeamFormComponent } from './veeam-form.component';
import { InfraAsset } from '../../../../core/models/infradoc.models';

const makeVM = (overrides: Partial<InfraAsset> = {}): InfraAsset => ({
  assetId: 1, name: 'SRV-FILE', ip: '192.168.1.10',
  bmcIp: null, bmcType: null, os: 'Windows Server 2019', model: null,
  ...overrides,
});

describe('VeeamFormComponent', () => {
  let component: VeeamFormComponent;
  let fixture: ComponentFixture<VeeamFormComponent>;
  let fb: FormBuilder;

  function makeFormGroup(): FormGroup {
    return fb.group({
      jobs: fb.array([]),
      uncoveredVMs: [[] as number[]],
    });
  }

  function init(vms: InfraAsset[] = [], readOnly = false): void {
    fixture = TestBed.createComponent(VeeamFormComponent);
    component = fixture.componentInstance;
    component.formGroup = makeFormGroup();
    component.allVMs = vms;
    component.readOnly = readOnly;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VeeamFormComponent],
      imports: [
        ReactiveFormsModule,
        NoopAnimationsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatCheckboxModule,
      ],
    }).compileComponents();
    fb = TestBed.inject(FormBuilder);
  });

  // ── addJob ────────────────────────────────────────────────────────────────────

  it('addJob agrega un FormGroup vacío al FormArray de jobs', () => {
    init();
    expect(component.jobControls.length).toBe(0);
    component.addJob();
    expect(component.jobControls.length).toBe(1);
    expect(component.jobControls.at(0).get('jobName')?.value).toBe('');
    expect(component.jobControls.at(0).get('fullsAvailable')?.value).toBeNull();
    expect(component.jobControls.at(0).get('restorePoints')?.value).toBeNull();
  });

  it('addJob puede agregar múltiples jobs independientes', () => {
    init();
    component.addJob();
    component.addJob();
    expect(component.jobControls.length).toBe(2);
  });

  // ── removeJob ─────────────────────────────────────────────────────────────────

  it('removeJob elimina el job en el índice dado y preserva el resto', () => {
    init();
    component.addJob();
    component.addJob();
    component.jobControls.at(0).patchValue({ jobName: 'Job A' });
    component.jobControls.at(1).patchValue({ jobName: 'Job B' });
    component.removeJob(0);
    expect(component.jobControls.length).toBe(1);
    expect(component.jobControls.at(0).get('jobName')?.value).toBe('Job B');
  });

  // ── isUncovered ───────────────────────────────────────────────────────────────

  it('isUncovered retorna false cuando uncoveredVMs está vacío', () => {
    init([makeVM({ assetId: 3 })]);
    expect(component.isUncovered(3)).toBeFalse();
  });

  it('isUncovered retorna true cuando el assetId está en uncoveredVMs', () => {
    init([makeVM({ assetId: 3 })]);
    component.formGroup.get('uncoveredVMs')!.setValue([3]);
    expect(component.isUncovered(3)).toBeTrue();
  });

  it('isUncovered retorna false cuando el assetId NO está en uncoveredVMs', () => {
    init([makeVM({ assetId: 3 }), makeVM({ assetId: 5 })]);
    component.formGroup.get('uncoveredVMs')!.setValue([5]);
    expect(component.isUncovered(3)).toBeFalse();
  });

  // ── toggleVM ──────────────────────────────────────────────────────────────────

  it('toggleVM agrega el assetId cuando no estaba en la lista', () => {
    init([makeVM({ assetId: 3 })]);
    component.toggleVM(3);
    expect(component.formGroup.get('uncoveredVMs')!.value).toContain(3);
  });

  it('toggleVM quita el assetId cuando ya estaba en la lista', () => {
    init([makeVM({ assetId: 3 })]);
    component.formGroup.get('uncoveredVMs')!.setValue([3]);
    component.toggleVM(3);
    expect(component.formGroup.get('uncoveredVMs')!.value).not.toContain(3);
  });

  it('toggleVM preserva los demás assetIds al quitar uno', () => {
    init([makeVM({ assetId: 3 }), makeVM({ assetId: 5 })]);
    component.formGroup.get('uncoveredVMs')!.setValue([3, 5]);
    component.toggleVM(3);
    expect(component.formGroup.get('uncoveredVMs')!.value).toEqual([5]);
  });

  // ── readOnly ──────────────────────────────────────────────────────────────────

  it('deshabilita el formGroup cuando readOnly es true', () => {
    init([], true);
    expect(component.formGroup.disabled).toBeTrue();
  });

  it('mantiene el formGroup habilitado cuando readOnly es false', () => {
    init([], false);
    expect(component.formGroup.disabled).toBeFalse();
  });
});
