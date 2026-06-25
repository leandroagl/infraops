import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, SimpleChange } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { VeeamFormComponent } from './veeam-form.component';
import { Task } from '../../../../core/models/task.models';
import { ClientInfrastructure } from '../../../../core/models/infradoc.models';
import { VeeamBackupPayload } from '../../../../core/models/maintenance-log.models';

const makeTask = (): Task => ({
  id: '1',
  clientId: '10',
  technicianId: '2',
  type: 'VEEAM_BACKUP',
  status: 'PENDING',
  scheduledDate: '2026-06-01T00:00:00.000Z',
  completedDate: null,
  odooTicketId: null,
  createdAt: '2026-05-01T00:00:00.000Z',
});

const makeInfra = (): ClientInfrastructure => ({
  esxiHosts:         [],
  windowsVMs:        [{ assetId: 1, name: 'SRV-FILE', ip: '192.168.1.10', bmcIp: null, bmcType: null, os: 'Windows Server 2019', model: null }],
  domainControllers: [{ assetId: 2, name: 'DC01',     ip: '192.168.1.11', bmcIp: null, bmcType: null, os: 'Windows Server 2022', model: null }],
  linuxVMs:          [{ assetId: 3, name: 'DEBIAN-01', ip: '192.168.1.12', bmcIp: null, bmcType: null, os: 'Debian 12',          model: null }],
  nas:               [],
  routers:           [],
});

const makeEmptyInfra = (): ClientInfrastructure => ({
  esxiHosts: [], windowsVMs: [], domainControllers: [], linuxVMs: [], nas: [], routers: [],
});

function init(
  component: VeeamFormComponent,
  fixture: ComponentFixture<VeeamFormComponent>,
  infra = makeInfra(),
  savedPayload: VeeamBackupPayload | null = null,
): void {
  component.task         = makeTask();
  component.infrastructure = infra;
  component.savedPayload   = savedPayload;
  component.ngOnChanges({
    infrastructure: new SimpleChange(undefined, infra, true),
  });
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
        MatCheckboxModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture   = TestBed.createComponent(VeeamFormComponent);
    component = fixture.componentInstance;
  });

  describe('inicialización del formulario', () => {
    it('crea un FormGroup con jobs (vacío), uncoveredVMs (vacío) y notes', () => {
      init(component, fixture);
      expect(component.form).toBeDefined();
      expect(component.jobControls.length).toBe(0);
      expect(component.form.get('uncoveredVMs')?.value).toEqual([]);
      expect(component.form.get('notes')?.value).toBe('');
    });
  });

  describe('allVMs', () => {
    it('concatena windowsVMs + domainControllers + linuxVMs', () => {
      init(component, fixture);
      expect(component.allVMs.length).toBe(3);
      expect(component.allVMs.map(v => v.assetId)).toEqual([1, 2, 3]);
    });

    it('retorna arreglo vacío cuando infrastructure no tiene VMs', () => {
      init(component, fixture, makeEmptyInfra());
      expect(component.allVMs.length).toBe(0);
    });
  });

  describe('addJob / removeJob', () => {
    it('addJob agrega un FormGroup con jobName, fullsAvailable, restorePoints', () => {
      init(component, fixture);
      component.addJob();
      expect(component.jobControls.length).toBe(1);
      expect(component.jobControls.at(0).get('jobName')?.value).toBe('');
      expect(component.jobControls.at(0).get('fullsAvailable')?.value).toBeNull();
      expect(component.jobControls.at(0).get('restorePoints')?.value).toBeNull();
    });

    it('removeJob elimina el job en el índice dado', () => {
      init(component, fixture);
      component.addJob();
      component.addJob();
      component.jobControls.at(0).patchValue({ jobName: 'Job A' });
      component.jobControls.at(1).patchValue({ jobName: 'Job B' });
      component.removeJob(0);
      expect(component.jobControls.length).toBe(1);
      expect(component.jobControls.at(0).get('jobName')?.value).toBe('Job B');
    });
  });

  describe('isUncovered / toggleVM', () => {
    it('isUncovered retorna false cuando uncoveredVMs está vacío', () => {
      init(component, fixture);
      expect(component.isUncovered(1)).toBeFalse();
    });

    it('toggleVM agrega el assetId cuando no estaba en la lista', () => {
      init(component, fixture);
      component.toggleVM(1);
      expect(component.form.get('uncoveredVMs')!.value).toContain(1);
    });

    it('toggleVM quita el assetId cuando ya estaba en la lista', () => {
      init(component, fixture);
      component.form.get('uncoveredVMs')!.setValue([1]);
      component.toggleVM(1);
      expect(component.form.get('uncoveredVMs')!.value).not.toContain(1);
    });

    it('toggleVM preserva los demás assetIds al quitar uno', () => {
      init(component, fixture);
      component.form.get('uncoveredVMs')!.setValue([1, 2]);
      component.toggleVM(1);
      expect(component.form.get('uncoveredVMs')!.value).toEqual([2]);
    });
  });

  describe('buildPayload', () => {
    it('retorna VeeamBackupPayload con type VEEAM_BACKUP', () => {
      init(component, fixture);
      expect(component.buildPayload().type).toBe('VEEAM_BACKUP');
    });

    it('incluye los jobs del FormArray en el payload', () => {
      init(component, fixture);
      component.addJob();
      component.jobControls.at(0).patchValue({ jobName: 'Backup diario', fullsAvailable: 4, restorePoints: 14 });
      const payload = component.buildPayload();
      expect(payload.jobs.length).toBe(1);
      expect(payload.jobs[0].jobName).toBe('Backup diario');
      expect(payload.jobs[0].fullsAvailable).toBe(4);
      expect(payload.jobs[0].restorePoints).toBe(14);
    });

    it('incluye uncoveredVMs en el payload', () => {
      init(component, fixture);
      component.form.get('uncoveredVMs')!.setValue([1, 3]);
      expect(component.buildPayload().uncoveredVMs).toEqual([1, 3]);
    });

    it('incluye notes cuando está presente', () => {
      init(component, fixture);
      component.form.patchValue({ notes: 'revisar job nocturno' });
      expect(component.buildPayload().notes).toBe('revisar job nocturno');
    });

    it('omite notes cuando está vacío', () => {
      init(component, fixture);
      component.form.patchValue({ notes: '' });
      expect(component.buildPayload().notes).toBeUndefined();
    });
  });

  describe('patchFormFromPayload via savedPayload en ngOnChanges', () => {
    it('reconstituye los jobs y uncoveredVMs desde savedPayload', () => {
      const saved: VeeamBackupPayload = {
        type: 'VEEAM_BACKUP',
        jobs: [
          { jobName: 'Backup diario', fullsAvailable: 4, restorePoints: 14 },
          { jobName: 'Backup semanal', fullsAvailable: 2, restorePoints: 5 },
        ],
        uncoveredVMs: [3],
        notes: 'todo ok',
      };
      init(component, fixture, makeInfra(), saved);

      expect(component.jobControls.length).toBe(2);
      expect(component.jobControls.at(0).get('jobName')?.value).toBe('Backup diario');
      expect(component.jobControls.at(1).get('jobName')?.value).toBe('Backup semanal');
      expect(component.form.get('uncoveredVMs')?.value).toEqual([3]);
      expect(component.form.get('notes')?.value).toBe('todo ok');
    });

    it('ignora un payload de tipo distinto (e.g. QNAP_MAINTENANCE)', () => {
      init(component, fixture);
      component.addJob();
      component.form.get('uncoveredVMs')!.setValue([1]);
      // Simula recibir un savedPayload de tipo incorrecto
      component.savedPayload = { type: 'QNAP_MAINTENANCE', qnap: [], notes: undefined } as any;
      component.ngOnChanges({ savedPayload: new SimpleChange(null, component.savedPayload, false) });
      // No debe modificar el estado actual
      expect(component.jobControls.length).toBe(1);
      expect(component.form.get('uncoveredVMs')?.value).toEqual([1]);
    });
  });

  describe('readOnly', () => {
    it('deshabilita el formulario cuando readOnly es true', () => {
      fixture = TestBed.createComponent(VeeamFormComponent);
      component = fixture.componentInstance;
      component.task           = makeTask();
      component.infrastructure = makeInfra();
      component.readOnly       = true;
      component.ngOnChanges({ infrastructure: new SimpleChange(undefined, makeInfra(), true) });
      fixture.detectChanges();

      expect(component.form.disabled).toBe(true);
    });
  });

  describe('submit / submitNotDone', () => {
    it('submit emite requestComplete con el payload del formulario', () => {
      init(component, fixture);
      const emitted: VeeamBackupPayload[] = [];
      component.requestComplete.subscribe((p: VeeamBackupPayload) => emitted.push(p));
      component.submit();
      expect(emitted.length).toBe(1);
      expect(emitted[0].type).toBe('VEEAM_BACKUP');
    });

    it('submitNotDone emite requestNotDone', () => {
      init(component, fixture);
      let emitted = false;
      component.requestNotDone.subscribe(() => { emitted = true; });
      component.submitNotDone();
      expect(emitted).toBe(true);
    });

    it('buildPayload retorna el payload aunque el formulario esté deshabilitado', () => {
      fixture = TestBed.createComponent(VeeamFormComponent);
      component = fixture.componentInstance;
      component.task           = makeTask();
      component.infrastructure = makeInfra();
      component.readOnly       = true;
      component.ngOnChanges({ infrastructure: new SimpleChange(undefined, makeInfra(), true) });
      fixture.detectChanges();

      const payload = component.buildPayload();
      expect(payload.type).toBe('VEEAM_BACKUP');
      expect(Array.isArray(payload.jobs)).toBeTrue();
      expect(Array.isArray(payload.uncoveredVMs)).toBeTrue();
    });
  });
});
