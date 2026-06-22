import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { QnapDeviceCardComponent } from './qnap-device-card.component';
import { InfraAsset } from '../../../../../core/models/infradoc.models';

const mockDevice: InfraAsset = {
  assetId: 1, name: 'QNAP TS-219P+', ip: '192.168.0.1',
  bmcIp: null, bmcType: null, os: null, model: 'TS-219P+',
};

function makeGroup(fb: FormBuilder) {
  return fb.group({
    diskCount:          [4],
    totalSpaceGB:       [4],
    totalSpaceUnit:     ['TB'],
    usedSpaceGB:        [1.8],
    usedSpaceUnit:      ['TB'],
    disksWithError:     [[]],
    raidStatus:         ['ok'],
    firmwareVersion:    ['5.1.0.2566'],
    firmwareUpdated:    [false],
    firmwareNewVersion: [''],
  });
}

describe('QnapDeviceCardComponent', () => {
  let component: QnapDeviceCardComponent;
  let fixture: ComponentFixture<QnapDeviceCardComponent>;
  let fb: FormBuilder;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [QnapDeviceCardComponent],
      imports: [
        ReactiveFormsModule, CommonModule, NoopAnimationsModule,
        MatFormFieldModule, MatInputModule, MatSelectModule, MatCheckboxModule,
      ],
    }).compileComponents();

    fb = TestBed.inject(FormBuilder);
    fixture = TestBed.createComponent(QnapDeviceCardComponent);
    component = fixture.componentInstance;
    component.device = mockDevice;
    component.group = makeGroup(fb);
    fixture.detectChanges();
  });

  describe('spaceRatio', () => {
    it('computes ratio as percentage of used/total in same unit', () => {
      component.group.patchValue({ totalSpaceGB: 4, totalSpaceUnit: 'TB', usedSpaceGB: 2, usedSpaceUnit: 'TB' });
      expect(component.spaceRatio).toBe(50);
    });

    it('converts TB to GB for cross-unit comparison', () => {
      component.group.patchValue({ totalSpaceGB: 1, totalSpaceUnit: 'TB', usedSpaceGB: 512, usedSpaceUnit: 'GB' });
      expect(component.spaceRatio).toBe(50);
    });

    it('returns 0 when total is 0', () => {
      component.group.patchValue({ totalSpaceGB: 0, usedSpaceGB: 100 });
      expect(component.spaceRatio).toBe(0);
    });
  });

  describe('cardHealth', () => {
    it('returns ok when RAID ok and space under 70%', () => {
      component.group.patchValue({ raidStatus: 'ok', totalSpaceGB: 4, totalSpaceUnit: 'TB', usedSpaceGB: 1, usedSpaceUnit: 'TB', disksWithError: [] });
      expect(component.cardHealth).toBe('ok');
    });

    it('returns warn when RAID degraded', () => {
      component.group.patchValue({ raidStatus: 'degraded', disksWithError: [] });
      expect(component.cardHealth).toBe('warn');
    });

    it('returns warn when space ratio exceeds 70%', () => {
      component.group.patchValue({ raidStatus: 'ok', totalSpaceGB: 4, totalSpaceUnit: 'TB', usedSpaceGB: 3, usedSpaceUnit: 'TB', disksWithError: [] });
      expect(component.cardHealth).toBe('warn');
    });

    it('returns crit when RAID failed', () => {
      component.group.patchValue({ raidStatus: 'failed', disksWithError: [] });
      expect(component.cardHealth).toBe('crit');
    });

    it('returns crit when there are disks with error', () => {
      component.group.patchValue({ raidStatus: 'ok', totalSpaceGB: 4, totalSpaceUnit: 'TB', usedSpaceGB: 1, usedSpaceUnit: 'TB', disksWithError: ['Disk 1'] });
      expect(component.cardHealth).toBe('crit');
    });

    it('returns crit when space ratio exceeds 85%', () => {
      component.group.patchValue({ raidStatus: 'ok', totalSpaceGB: 4, totalSpaceUnit: 'TB', usedSpaceGB: 3.8, usedSpaceUnit: 'TB', disksWithError: [] });
      expect(component.cardHealth).toBe('crit');
    });
  });

  describe('diskSlotOptions', () => {
    it('generates disk slot labels from diskCount', () => {
      component.group.patchValue({ diskCount: 3 });
      expect(component.diskSlotOptions).toEqual(['Disk 1', 'Disk 2', 'Disk 3']);
    });

    it('returns empty array when diskCount is 0', () => {
      component.group.patchValue({ diskCount: 0 });
      expect(component.diskSlotOptions).toEqual([]);
    });

    it('returns empty array when diskCount is null', () => {
      component.group.patchValue({ diskCount: null });
      expect(component.diskSlotOptions).toEqual([]);
    });
  });

  describe('firmwareUpdated', () => {
    it('returns false by default', () => {
      expect(component.firmwareUpdated).toBeFalse();
    });

    it('returns true when checkbox is checked', () => {
      component.group.patchValue({ firmwareUpdated: true });
      expect(component.firmwareUpdated).toBeTrue();
    });
  });
});
