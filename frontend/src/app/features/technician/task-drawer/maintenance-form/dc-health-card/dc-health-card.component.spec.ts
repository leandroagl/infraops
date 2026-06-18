import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { Pipe, PipeTransform } from '@angular/core';
import { DcHealthCardComponent } from './dc-health-card.component';
import { InfraAsset } from '../../../../../core/models/infradoc.models';
import { DcHealthSnapshot } from '../../../../../core/models/maintenance-log.models';

@Pipe({ name: 'localDate' })
class MockLocalDatePipe implements PipeTransform {
  transform(value: string): string { return value; }
}

const makeDc = (): InfraAsset => ({
  assetId: 1,
  name: 'DC01',
  ip: '192.168.1.10',
  bmcIp: null,
  bmcType: null,
  os: 'Windows Server 2022',
  model: null,
});

const makeSnapshot = (overrides: Partial<DcHealthSnapshot> = {}): DcHealthSnapshot => ({
  is_dc: true,
  dc_name: 'DC01',
  domain: 'contoso.local',
  collected_at: '2026-06-17T10:00:00Z',
  repl_healthy: true,
  repl_failures: 0,
  repl_partners: 1,
  repl_max_age_hours: 1,
  dns_test_pass: true,
  dns_service_ok: true,
  dns_srv_ok: true,
  dns_zone_count: 3,
  sysvol_state_ok: true,
  sysvol_backlog: 0,
  sysvol_replication: 'DFSR',
  warnings: [],
  ...overrides,
});

describe('DcHealthCardComponent', () => {
  let component: DcHealthCardComponent;
  let fixture: ComponentFixture<DcHealthCardComponent>;

  const createComponent = (readOnly = false) => {
    const formGroup = new FormGroup({ rawJson: new FormControl('') });
    fixture = TestBed.createComponent(DcHealthCardComponent);
    component = fixture.componentInstance;
    component.dc = makeDc();
    component.formGroup = formGroup;
    component.readOnly = readOnly;
    fixture.detectChanges();
    return formGroup;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DcHealthCardComponent, MockLocalDatePipe],
      imports: [
        CommonModule,
        ReactiveFormsModule,
        NoopAnimationsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
      ],
    }).compileComponents();
  });

  it('muestra textarea cuando rawJson está vacío', () => {
    createComponent();
    const textarea = fixture.nativeElement.querySelector('textarea');
    expect(textarea).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.dc-display')).toBeNull();
  });

  it('parsea JSON válido con is_dc: true y muestra display', () => {
    const fg = createComponent();
    fg.get('rawJson')!.setValue(JSON.stringify(makeSnapshot()));
    fixture.detectChanges();
    expect(component.parsed).toBeTruthy();
    expect(component.parseError).toBeNull();
    expect(fixture.nativeElement.querySelector('.dc-display')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('textarea')).toBeNull();
  });

  it('muestra error semántico cuando is_dc === false', () => {
    const fg = createComponent();
    fg.get('rawJson')!.setValue(JSON.stringify(makeSnapshot({ is_dc: false })));
    fixture.detectChanges();
    expect(component.parsed).toBeNull();
    expect(component.parseError).toContain('controlador de dominio');
    expect(fixture.nativeElement.querySelector('.dc-parse-error')).toBeTruthy();
  });

  it('muestra error de parseo ante JSON malformado', () => {
    const fg = createComponent();
    fg.get('rawJson')!.setValue('{ invalid json }');
    fixture.detectChanges();
    expect(component.parsed).toBeNull();
    expect(component.parseError).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.dc-parse-error')).toBeTruthy();
  });

  it('no muestra textarea en modo readOnly cuando no hay snapshot', () => {
    createComponent(true);
    expect(fixture.nativeElement.querySelector('textarea')).toBeNull();
  });

  it('botón Editar limpia parsed y vuelve al textarea', () => {
    const fg = createComponent();
    fg.get('rawJson')!.setValue(JSON.stringify(makeSnapshot()));
    fixture.detectChanges();
    expect(component.parsed).toBeTruthy();

    component.edit();
    fixture.detectChanges();

    expect(component.parsed).toBeNull();
    expect(fixture.nativeElement.querySelector('textarea')).toBeTruthy();
  });

  it('statusClass devuelve dc-badge--ok para true, dc-badge--crit para false, dc-badge--na para null', () => {
    createComponent();
    expect(component.statusClass(true)).toBe('dc-badge--ok');
    expect(component.statusClass(false)).toBe('dc-badge--crit');
    expect(component.statusClass(null)).toBe('dc-badge--na');
  });

  it('muestra sección de warnings cuando hay warnings en el snapshot', () => {
    const fg = createComponent();
    fg.get('rawJson')!.setValue(JSON.stringify(makeSnapshot({ warnings: ['Replication lag detected'] })));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.dc-warnings')).toBeTruthy();
  });
});
