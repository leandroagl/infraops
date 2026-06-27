import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, SimpleChange } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { VeeamFormComponent } from './veeam-form.component';
import { VeeamBackupPayload } from '../../../../core/models/maintenance-log.models';

const VMS = [
  { name: 'SRV-FILE', os: 'Windows Server 2019' },
  { name: 'DC01',     os: 'Windows Server 2022' },
  { name: 'APP-01',   os: 'Debian 12' },
];

function init(
  component: VeeamFormComponent,
  fixture: ComponentFixture<VeeamFormComponent>,
  vms = VMS,
  existingPayload?: VeeamBackupPayload,
): void {
  component.vms = vms;
  component.existingPayload = existingPayload;
  component.ngOnChanges({ vms: new SimpleChange(undefined, vms, true) });
  fixture.detectChanges();
}

describe('VeeamFormComponent', () => {
  let component: VeeamFormComponent;
  let fixture: ComponentFixture<VeeamFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VeeamFormComponent],
      imports: [
        ReactiveFormsModule,
        NoopAnimationsModule,
        MatFormFieldModule,
        MatSelectModule,
        MatInputModule,
        MatButtonModule,
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture   = TestBed.createComponent(VeeamFormComponent);
    component = fixture.componentInstance;
  });

  describe('inicialización', () => {
    it('crea un FormArray con un grupo por VM', () => {
      init(component, fixture);
      expect(component.vmRows.length).toBe(3);
    });

    it('defaults: coverage=job, fullsInMonth=null', () => {
      init(component, fixture);
      const first = component.vmRows.at(0);
      expect(first.get('coverage')?.value).toBe('job');
      expect(first.get('fullsInMonth')?.value).toBeNull();
    });

    it('notas vacías por defecto', () => {
      init(component, fixture);
      expect(component.form.get('notes')?.value).toBe('');
    });
  });

  describe('onCoverageChange', () => {
    it('excluded → fullsInMonth = null', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'excluded', fullsInMonth: 3 });
      component.onCoverageChange(0);
      expect(component.vmRows.at(0).get('fullsInMonth')?.value).toBeNull();
    });

    it('no_backup → fullsInMonth = null', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'no_backup', fullsInMonth: 3 });
      component.onCoverageChange(0);
      expect(component.vmRows.at(0).get('fullsInMonth')?.value).toBeNull();
    });

    it('job no modifica fullsInMonth', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'job', fullsInMonth: 3 });
      component.onCoverageChange(0);
      expect(component.vmRows.at(0).get('fullsInMonth')?.value).toBe(3);
    });

    it('agent no modifica fullsInMonth', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'agent', fullsInMonth: 2 });
      component.onCoverageChange(0);
      expect(component.vmRows.at(0).get('fullsInMonth')?.value).toBe(2);
    });
  });

  describe('vmRowState', () => {
    it('excluded → excl', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'excluded', fullsInMonth: null });
      expect(component.vmRowState(0)).toBe('excl');
    });

    it('no_backup → no', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'no_backup', fullsInMonth: null });
      expect(component.vmRowState(0)).toBe('no');
    });

    it('job + fullsInMonth null → no', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'job', fullsInMonth: null });
      expect(component.vmRowState(0)).toBe('no');
    });

    it('job + fullsInMonth 0 → no', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'job', fullsInMonth: 0 });
      expect(component.vmRowState(0)).toBe('no');
    });

    it('job + fullsInMonth 1 → warn', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'job', fullsInMonth: 1 });
      expect(component.vmRowState(0)).toBe('warn');
    });

    it('job + fullsInMonth 2 → ok', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'job', fullsInMonth: 2 });
      expect(component.vmRowState(0)).toBe('ok');
    });

    it('agent + fullsInMonth 3 → ok', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'agent', fullsInMonth: 3 });
      expect(component.vmRowState(0)).toBe('ok');
    });
  });

  describe('vmHint', () => {
    it('excluded → Excluida ✓ / h-ok', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'excluded', fullsInMonth: null });
      expect(component.vmHint(0)).toEqual({ text: 'Excluida ✓', cls: 'h-ok' });
    });

    it('no_backup → Sin cobertura / h-no', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'no_backup', fullsInMonth: null });
      expect(component.vmHint(0)).toEqual({ text: 'Sin cobertura', cls: 'h-no' });
    });

    it('job + 0 fulls → Sin fulls registrados / h-no', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'job', fullsInMonth: 0 });
      expect(component.vmHint(0)).toEqual({ text: 'Sin fulls registrados', cls: 'h-no' });
    });

    it('job + null fulls → Sin fulls registrados / h-no', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'job', fullsInMonth: null });
      expect(component.vmHint(0)).toEqual({ text: 'Sin fulls registrados', cls: 'h-no' });
    });

    it('job + 1 full → Verificar cadena de incrementales / h-warn', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'job', fullsInMonth: 1 });
      expect(component.vmHint(0)).toEqual({ text: 'Verificar cadena de incrementales', cls: 'h-warn' });
    });

    it('job + 2 fulls → 2 fulls ✓ / h-ok', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'job', fullsInMonth: 2 });
      expect(component.vmHint(0)).toEqual({ text: '2 fulls ✓', cls: 'h-ok' });
    });

    it('agent + 5 fulls → 5 fulls ✓ / h-ok', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'agent', fullsInMonth: 5 });
      expect(component.vmHint(0)).toEqual({ text: '5 fulls ✓', cls: 'h-ok' });
    });
  });

  describe('pills summaryOk / summaryWarn / summaryNo', () => {
    it('excl cuenta como ok en summaryOk', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'excluded' });
      component.vmRows.at(1).patchValue({ coverage: 'job', fullsInMonth: 2 });
      component.vmRows.at(2).patchValue({ coverage: 'no_backup' });
      expect(component.summaryOk).toBe(2);
      expect(component.summaryNo).toBe(1);
    });

    it('summaryWarn cuenta job+1 correctamente', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'job', fullsInMonth: 1 });
      component.vmRows.at(1).patchValue({ coverage: 'job', fullsInMonth: 1 });
      component.vmRows.at(2).patchValue({ coverage: 'job', fullsInMonth: 2 });
      expect(component.summaryWarn).toBe(2);
      expect(component.summaryOk).toBe(1);
    });

    it('suma de los tres pills es igual al total de VMs', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'job', fullsInMonth: 2 });
      component.vmRows.at(1).patchValue({ coverage: 'job', fullsInMonth: 1 });
      component.vmRows.at(2).patchValue({ coverage: 'no_backup' });
      expect(component.summaryOk + component.summaryWarn + component.summaryNo).toBe(3);
    });
  });

  describe('showFulls', () => {
    it('true para job', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'job' });
      expect(component.showFulls(0)).toBeTrue();
    });

    it('true para agent', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'agent' });
      expect(component.showFulls(0)).toBeTrue();
    });

    it('false para excluded', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'excluded' });
      expect(component.showFulls(0)).toBeFalse();
    });

    it('false para no_backup', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'no_backup' });
      expect(component.showFulls(0)).toBeFalse();
    });
  });

  describe('existingPayload patch', () => {
    it('parchea valores por nombre de VM al inicializar', () => {
      const payload: VeeamBackupPayload = {
        type: 'VEEAM_BACKUP',
        vms: [
          { vmName: 'DC01',     coverage: 'agent',    fullsInMonth: 4 },
          { vmName: 'SRV-FILE', coverage: 'excluded', fullsInMonth: null },
        ],
        notes: 'todo ok',
      };
      init(component, fixture, VMS, payload);
      expect(component.vmRows.at(0).get('coverage')?.value).toBe('excluded');
      expect(component.vmRows.at(0).get('fullsInMonth')?.value).toBeNull();
      expect(component.vmRows.at(1).get('coverage')?.value).toBe('agent');
      expect(component.vmRows.at(1).get('fullsInMonth')?.value).toBe(4);
      expect(component.form.get('notes')?.value).toBe('todo ok');
    });

    it('ignora VMs del payload que no están en vms[]', () => {
      const payload: VeeamBackupPayload = {
        type: 'VEEAM_BACKUP',
        vms: [{ vmName: 'VM-INEXISTENTE', coverage: 'job', fullsInMonth: 4 }],
        notes: null,
      };
      init(component, fixture, VMS, payload);
      expect(component.vmRows.length).toBe(3);
      expect(component.vmRows.at(0).get('coverage')?.value).toBe('job');
    });
  });

  describe('readOnly', () => {
    it('deshabilita el formulario cuando readOnly es true', () => {
      component.vms = VMS;
      component.readOnly = true;
      component.ngOnChanges({ vms: new SimpleChange(undefined, VMS, true) });
      fixture.detectChanges();
      expect(component.form.disabled).toBeTrue();
    });

    it('form habilitado cuando readOnly es false', () => {
      init(component, fixture);
      expect(component.form.disabled).toBeFalse();
    });
  });

  describe('saved / cancelled', () => {
    it('submit emite saved con type VEEAM_BACKUP', () => {
      init(component, fixture);
      const emitted: VeeamBackupPayload[] = [];
      component.saved.subscribe((p: VeeamBackupPayload) => emitted.push(p));
      component.submit();
      expect(emitted.length).toBe(1);
      expect(emitted[0].type).toBe('VEEAM_BACKUP');
    });

    it('cancelled emite correctamente', () => {
      init(component, fixture);
      let emitted = false;
      component.cancelled.subscribe(() => { emitted = true; });
      component.cancelled.emit();
      expect(emitted).toBeTrue();
    });
  });

  describe('buildPayload', () => {
    it('retorna una entrada por VM con nombre correcto', () => {
      init(component, fixture);
      const payload = component.buildPayload();
      expect(payload.vms.length).toBe(3);
      expect(payload.vms[0].vmName).toBe('SRV-FILE');
      expect(payload.vms[1].vmName).toBe('DC01');
      expect(payload.vms[2].vmName).toBe('APP-01');
    });

    it('excluded → fullsInMonth null en payload', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'excluded', fullsInMonth: 3 });
      expect(component.buildPayload().vms[0].fullsInMonth).toBeNull();
    });

    it('no_backup → fullsInMonth null en payload', () => {
      init(component, fixture);
      component.vmRows.at(0).patchValue({ coverage: 'no_backup', fullsInMonth: 3 });
      expect(component.buildPayload().vms[0].fullsInMonth).toBeNull();
    });

    it('notes null cuando está vacío', () => {
      init(component, fixture);
      component.form.patchValue({ notes: '' });
      expect(component.buildPayload().notes).toBeNull();
    });

    it('notes con valor cuando no está vacío', () => {
      init(component, fixture);
      component.form.patchValue({ notes: 'revisar DC01' });
      expect(component.buildPayload().notes).toBe('revisar DC01');
    });

    it('buildPayload funciona aunque el form esté deshabilitado (readOnly)', () => {
      component.vms = VMS;
      component.readOnly = true;
      component.ngOnChanges({ vms: new SimpleChange(undefined, VMS, true) });
      fixture.detectChanges();
      const payload = component.buildPayload();
      expect(payload.type).toBe('VEEAM_BACKUP');
      expect(payload.vms.length).toBe(3);
    });
  });
});
