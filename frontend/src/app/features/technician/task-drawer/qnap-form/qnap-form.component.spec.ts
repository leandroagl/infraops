import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, SimpleChange } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { QnapFormComponent } from './qnap-form.component';
import { Task } from '../../../../core/models/task.models';
import { ClientInfrastructure } from '../../../../core/models/infradoc.models';
import { QnapPayload } from '../../../../core/models/maintenance-log.models';

const makeTask = (): Task => ({
  id: '1',
  clientId: '10',
  technicianId: '2',
  type: 'QNAP_MAINTENANCE',
  status: 'PENDING',
  scheduledDate: '2026-06-01T00:00:00.000Z',
  completedDate: null,
  odooTicketId: null,
  createdAt: '2026-05-01T00:00:00.000Z',
});

const makeInfra = (): ClientInfrastructure => ({
  esxiHosts: [],
  windowsVMs: [],
  domainControllers: [],
  nas: [
    { assetId: 10, name: 'QNAP-01', ip: '192.168.1.21', bmcIp: null, bmcType: null, os: null, model: 'QNAP TS-453D' },
    { assetId: 11, name: 'QNAP-02', ip: '192.168.1.22', bmcIp: null, bmcType: null, os: null, model: 'QNAP TS-653D' },
  ],
  routers: [],
});

const makeSingleNasInfra = (): ClientInfrastructure => ({
  ...makeInfra(),
  nas: [{ assetId: 10, name: 'QNAP-01', ip: '192.168.1.21', bmcIp: null, bmcType: null, os: null, model: 'QNAP TS-453D' }],
});

describe('QnapFormComponent', () => {
  let component: QnapFormComponent;
  let fixture: ComponentFixture<QnapFormComponent>;

  function init(infra = makeInfra(), savedPayload: QnapPayload | null = null): void {
    fixture = TestBed.createComponent(QnapFormComponent);
    component = fixture.componentInstance;
    component.task = makeTask();
    component.infrastructure = infra;
    component.savedPayload = savedPayload;
    component.ngOnChanges({
      infrastructure: new SimpleChange(undefined, infra, true),
    });
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [QnapFormComponent],
      imports: [
        ReactiveFormsModule,
        NoopAnimationsModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatSelectModule,
        MatInputModule,
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  describe('form initialization', () => {
    it('crea un FormGroup por cada NAS en infrastructure', () => {
      init();
      expect(component.qnapDeviceControls.length).toBe(2);
    });

    it('cada FormGroup tiene los controles esperados', () => {
      init();
      const group = component.qnapDeviceControls.at(0);
      expect(group.get('diskCount')).not.toBeNull();
      expect(group.get('totalSpaceGB')).not.toBeNull();
      expect(group.get('totalSpaceUnit')).not.toBeNull();
      expect(group.get('usedSpaceGB')).not.toBeNull();
      expect(group.get('usedSpaceUnit')).not.toBeNull();
      expect(group.get('disksWithError')).not.toBeNull();
      expect(group.get('raidStatus')).not.toBeNull();
      expect(group.get('firmwareVersion')).not.toBeNull();
      expect(group.get('firmwareUpdated')).not.toBeNull();
      expect(group.get('firmwareNewVersion')).not.toBeNull();
    });

    it('totalSpaceUnit y usedSpaceUnit default a "GB"', () => {
      init();
      expect(component.qnapDeviceControls.at(0).get('totalSpaceUnit')?.value).toBe('GB');
      expect(component.qnapDeviceControls.at(0).get('usedSpaceUnit')?.value).toBe('GB');
    });

    it('raidStatus default a "ok"', () => {
      init();
      expect(component.qnapDeviceControls.at(0).get('raidStatus')?.value).toBe('ok');
    });
  });

  describe('diskSlotOptions', () => {
    it('retorna [] cuando diskCount es null', () => {
      init();
      component.qnapDeviceControls.at(0).patchValue({ diskCount: null });
      expect(component.diskSlotOptions(0)).toEqual([]);
    });

    it('retorna ["Disk 1".."Disk 4"] cuando diskCount es 4', () => {
      init();
      component.qnapDeviceControls.at(0).patchValue({ diskCount: 4 });
      expect(component.diskSlotOptions(0)).toEqual(['Disk 1', 'Disk 2', 'Disk 3', 'Disk 4']);
    });

    it('retorna [] cuando diskCount es 0', () => {
      init();
      component.qnapDeviceControls.at(0).patchValue({ diskCount: 0 });
      expect(component.diskSlotOptions(0)).toEqual([]);
    });
  });

  describe('qnapFirmwareUpdated', () => {
    it('retorna false cuando firmwareUpdated es false', () => {
      init();
      component.qnapDeviceControls.at(0).patchValue({ firmwareUpdated: false });
      expect(component.qnapFirmwareUpdated(0)).toBe(false);
    });

    it('retorna true cuando firmwareUpdated es true', () => {
      init();
      component.qnapDeviceControls.at(0).patchValue({ firmwareUpdated: true });
      expect(component.qnapFirmwareUpdated(0)).toBe(true);
    });
  });

  describe('spaceRatio', () => {
    it('retorna 0 cuando totalSpaceGB es 0', () => {
      init();
      component.qnapDeviceControls.at(0).patchValue({ totalSpaceGB: 0, usedSpaceGB: 0, totalSpaceUnit: 'GB', usedSpaceUnit: 'GB' });
      expect(component.spaceRatio(0)).toBe(0);
    });

    it('retorna 50 cuando used es la mitad del total (GB)', () => {
      init();
      component.qnapDeviceControls.at(0).patchValue({ totalSpaceGB: 1000, usedSpaceGB: 500, totalSpaceUnit: 'GB', usedSpaceUnit: 'GB' });
      expect(component.spaceRatio(0)).toBe(50);
    });

    it('normaliza cross-unit: 512 GB usados / 1 TB total = 50%', () => {
      init();
      component.qnapDeviceControls.at(0).patchValue({ totalSpaceGB: 1, usedSpaceGB: 512, totalSpaceUnit: 'TB', usedSpaceUnit: 'GB' });
      expect(component.spaceRatio(0)).toBe(50);
    });
  });

  describe('qnapCardHealth', () => {
    it('retorna "ok" cuando no hay errores', () => {
      init();
      component.qnapDeviceControls.at(0).patchValue({
        disksWithError: [], raidStatus: 'ok',
        totalSpaceGB: 1000, usedSpaceGB: 500, totalSpaceUnit: 'GB', usedSpaceUnit: 'GB',
      });
      expect(component.qnapCardHealth(0)).toBe('ok');
    });

    it('retorna "crit" cuando hay discos con error', () => {
      init();
      component.qnapDeviceControls.at(0).patchValue({
        disksWithError: ['Disk 1'], raidStatus: 'ok',
        totalSpaceGB: 1000, usedSpaceGB: 500, totalSpaceUnit: 'GB', usedSpaceUnit: 'GB',
      });
      expect(component.qnapCardHealth(0)).toBe('crit');
    });

    it('retorna "crit" cuando raidStatus es "failed"', () => {
      init();
      component.qnapDeviceControls.at(0).patchValue({
        disksWithError: [], raidStatus: 'failed',
        totalSpaceGB: 1000, usedSpaceGB: 500, totalSpaceUnit: 'GB', usedSpaceUnit: 'GB',
      });
      expect(component.qnapCardHealth(0)).toBe('crit');
    });

    it('retorna "crit" cuando espacio usado supera 85%', () => {
      init();
      component.qnapDeviceControls.at(0).patchValue({
        disksWithError: [], raidStatus: 'ok',
        totalSpaceGB: 100, usedSpaceGB: 90, totalSpaceUnit: 'GB', usedSpaceUnit: 'GB',
      });
      expect(component.qnapCardHealth(0)).toBe('crit');
    });

    it('retorna "warn" cuando raidStatus es "degraded"', () => {
      init();
      component.qnapDeviceControls.at(0).patchValue({
        disksWithError: [], raidStatus: 'degraded',
        totalSpaceGB: 1000, usedSpaceGB: 500, totalSpaceUnit: 'GB', usedSpaceUnit: 'GB',
      });
      expect(component.qnapCardHealth(0)).toBe('warn');
    });

    it('retorna "warn" cuando espacio usado supera 70% pero no 85%', () => {
      init();
      component.qnapDeviceControls.at(0).patchValue({
        disksWithError: [], raidStatus: 'ok',
        totalSpaceGB: 100, usedSpaceGB: 75, totalSpaceUnit: 'GB', usedSpaceUnit: 'GB',
      });
      expect(component.qnapCardHealth(0)).toBe('warn');
    });
  });

  describe('buildPayload', () => {
    it('retorna QnapPayload con type QNAP_MAINTENANCE', () => {
      init(makeSingleNasInfra());
      expect(component.buildPayload().type).toBe('QNAP_MAINTENANCE');
    });

    it('mapea deviceId y deviceName desde infrastructure.nas', () => {
      init(makeSingleNasInfra());
      const payload = component.buildPayload();
      expect(payload.qnap[0].deviceId).toBe(10);
      expect(payload.qnap[0].deviceName).toBe('QNAP-01');
    });

    it('incluye firmwareNewVersion cuando firmwareUpdated es true', () => {
      init(makeSingleNasInfra());
      component.qnapDeviceControls.at(0).patchValue({ firmwareUpdated: true, firmwareNewVersion: '5.2.0.2800' });
      const payload = component.buildPayload();
      expect(payload.qnap[0].firmwareUpdated).toBe(true);
      expect(payload.qnap[0].firmwareNewVersion).toBe('5.2.0.2800');
    });

    it('NO incluye firmwareNewVersion cuando firmwareUpdated es false', () => {
      init(makeSingleNasInfra());
      component.qnapDeviceControls.at(0).patchValue({ firmwareUpdated: false, firmwareNewVersion: '5.2.0.2800' });
      expect(component.buildPayload().qnap[0].firmwareNewVersion).toBeUndefined();
    });

    it('incluye notes cuando está presente', () => {
      init(makeSingleNasInfra());
      component.form.patchValue({ notes: 'revisado' });
      expect(component.buildPayload().notes).toBe('revisado');
    });

    it('omite notes cuando está vacío', () => {
      init(makeSingleNasInfra());
      component.form.patchValue({ notes: '' });
      expect(component.buildPayload().notes).toBeUndefined();
    });

    it('incluye todos los dispositivos NAS', () => {
      init();
      expect(component.buildPayload().qnap.length).toBe(2);
    });

    it('preserva totalSpaceUnit y usedSpaceUnit en el payload', () => {
      init(makeSingleNasInfra());
      component.qnapDeviceControls.at(0).patchValue({ totalSpaceUnit: 'TB', usedSpaceUnit: 'TB' });
      const payload = component.buildPayload();
      expect(payload.qnap[0].totalSpaceUnit).toBe('TB');
      expect(payload.qnap[0].usedSpaceUnit).toBe('TB');
    });
  });

  describe('patchFormFromPayload via savedPayload en ngOnChanges', () => {
    it('parchea diskCount, raidStatus, disksWithError desde savedPayload', () => {
      const saved: QnapPayload = {
        type: 'QNAP_MAINTENANCE',
        qnap: [{
          deviceId: 10, deviceName: 'QNAP-01',
          diskCount: 4, totalSpaceGB: 16000, usedSpaceGB: 11200,
          totalSpaceUnit: 'GB', usedSpaceUnit: 'GB',
          disksWithError: ['Disk 2'], raidStatus: 'degraded',
          firmwareVersion: '5.1.0.2566', firmwareUpdated: false,
        }],
      };
      init(makeSingleNasInfra(), saved);

      expect(component.qnapDeviceControls.at(0).get('diskCount')?.value).toBe(4);
      expect(component.qnapDeviceControls.at(0).get('raidStatus')?.value).toBe('degraded');
      expect(component.qnapDeviceControls.at(0).get('disksWithError')?.value).toEqual(['Disk 2']);
    });

    it('parchea firmwareNewVersion cuando está en el payload', () => {
      const saved: QnapPayload = {
        type: 'QNAP_MAINTENANCE',
        qnap: [{
          deviceId: 10, deviceName: 'QNAP-01',
          diskCount: 4, totalSpaceGB: 8, totalSpaceUnit: 'TB',
          usedSpaceGB: 5, usedSpaceUnit: 'TB',
          disksWithError: [], raidStatus: 'ok',
          firmwareVersion: '5.1.0.2400',
          firmwareUpdated: true, firmwareNewVersion: '5.2.0.2800',
        }],
      };
      init(makeSingleNasInfra(), saved);

      expect(component.qnapDeviceControls.at(0).get('firmwareUpdated')?.value).toBe(true);
      expect(component.qnapDeviceControls.at(0).get('firmwareNewVersion')?.value).toBe('5.2.0.2800');
    });

    it('parchea totalSpaceUnit y usedSpaceUnit', () => {
      const saved: QnapPayload = {
        type: 'QNAP_MAINTENANCE',
        qnap: [{
          deviceId: 10, deviceName: 'QNAP-01',
          diskCount: 4, totalSpaceGB: 8, totalSpaceUnit: 'TB',
          usedSpaceGB: 5, usedSpaceUnit: 'TB',
          disksWithError: [], raidStatus: 'ok',
          firmwareVersion: '5.1.0', firmwareUpdated: false,
        }],
      };
      init(makeSingleNasInfra(), saved);

      expect(component.qnapDeviceControls.at(0).get('totalSpaceUnit')?.value).toBe('TB');
      expect(component.qnapDeviceControls.at(0).get('usedSpaceUnit')?.value).toBe('TB');
    });

    it('defaultea totalSpaceUnit a GB cuando el payload no tiene units (logs viejos)', () => {
      const saved: QnapPayload = {
        type: 'QNAP_MAINTENANCE',
        qnap: [{
          deviceId: 10, deviceName: 'QNAP-01',
          diskCount: 4, totalSpaceGB: 16000, usedSpaceGB: 11200,
          disksWithError: [], raidStatus: 'ok',
          firmwareVersion: '5.1.0', firmwareUpdated: false,
        }],
      };
      init(makeSingleNasInfra(), saved);

      expect(component.qnapDeviceControls.at(0).get('totalSpaceUnit')?.value).toBe('GB');
    });

    it('matchea por deviceId, ignora entries que no están en infrastructure', () => {
      const saved: QnapPayload = {
        type: 'QNAP_MAINTENANCE',
        qnap: [
          { deviceId: 99, deviceName: 'OTRO', diskCount: 2, totalSpaceGB: 100, usedSpaceGB: 50, disksWithError: [], raidStatus: 'ok', firmwareVersion: '1.0', firmwareUpdated: false },
          { deviceId: 10, deviceName: 'QNAP-01', diskCount: 4, totalSpaceGB: 16000, usedSpaceGB: 11200, disksWithError: [], raidStatus: 'ok', firmwareVersion: '5.1.0', firmwareUpdated: false },
        ],
      };
      init(makeSingleNasInfra(), saved);

      expect(component.qnapDeviceControls.at(0).get('diskCount')?.value).toBe(4);
    });
  });

  describe('readOnly', () => {
    it('deshabilita el formulario cuando readOnly es true', () => {
      fixture = TestBed.createComponent(QnapFormComponent);
      component = fixture.componentInstance;
      component.task = makeTask();
      component.infrastructure = makeSingleNasInfra();
      component.readOnly = true;
      component.ngOnChanges({ infrastructure: new SimpleChange(undefined, makeSingleNasInfra(), true) });
      fixture.detectChanges();

      expect(component.form.disabled).toBe(true);
    });
  });

  describe('submit', () => {
    it('emite requestComplete con el payload del formulario', () => {
      init(makeSingleNasInfra());
      const emitted: QnapPayload[] = [];
      component.requestComplete.subscribe((p: QnapPayload) => emitted.push(p));

      component.submit();

      expect(emitted.length).toBe(1);
      expect(emitted[0].type).toBe('QNAP_MAINTENANCE');
    });
  });

  describe('submitNotDone', () => {
    it('emite requestNotDone', () => {
      init(makeSingleNasInfra());
      let emitted = false;
      component.requestNotDone.subscribe(() => { emitted = true; });

      component.submitNotDone();

      expect(emitted).toBe(true);
    });
  });
});
