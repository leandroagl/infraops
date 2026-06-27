import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { RouterDeviceCardComponent } from './router-device-card.component';
import { InfraAsset } from '../../../../../core/models/infradoc.models';

const mockDevice: InfraAsset = {
  assetId: 1, name: 'MikroTik RB4011', ip: '192.168.0.1',
  bmcIp: null, bmcType: null, os: null, model: 'RB4011',
};

function makeGroup(fb: FormBuilder) {
  return fb.group({
    firmwareUpdated: [false],
    firmwareVersion: [''],
    backupDone:      [false],
  });
}

describe('RouterDeviceCardComponent', () => {
  let component: RouterDeviceCardComponent;
  let fixture: ComponentFixture<RouterDeviceCardComponent>;
  let fb: FormBuilder;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RouterDeviceCardComponent],
      imports: [
        ReactiveFormsModule, CommonModule, NoopAnimationsModule,
        MatFormFieldModule, MatInputModule, MatCheckboxModule,
      ],
    }).compileComponents();

    fb = TestBed.inject(FormBuilder);
    fixture = TestBed.createComponent(RouterDeviceCardComponent);
    component = fixture.componentInstance;
    component.device = mockDevice;
    component.group = makeGroup(fb);
    fixture.detectChanges();
  });

  it('renders device name', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('MikroTik RB4011');
  });

  it('renders device IP', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('192.168.0.1');
  });

  it('renders — when IP is null', () => {
    component.device = { ...mockDevice, ip: null };
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('—');
  });

  describe('firmwareUpdated getter', () => {
    it('returns false by default', () => {
      expect(component.firmwareUpdated).toBeFalse();
    });

    it('returns true when control is true', () => {
      component.group.patchValue({ firmwareUpdated: true });
      expect(component.firmwareUpdated).toBeTrue();
    });
  });

  describe('firmwareVersion field (conditional)', () => {
    it('oculta el campo firmwareVersion cuando firmwareUpdated es false', () => {
      component.group.patchValue({ firmwareUpdated: false });
      fixture.detectChanges();
      const field = fixture.nativeElement.querySelector('mat-form-field');
      expect(field).toBeNull();
    });

    it('muestra el campo firmwareVersion cuando firmwareUpdated es true', () => {
      component.group.patchValue({ firmwareUpdated: true });
      fixture.detectChanges();
      const field = fixture.nativeElement.querySelector('mat-form-field');
      expect(field).not.toBeNull();
    });
  });
});
