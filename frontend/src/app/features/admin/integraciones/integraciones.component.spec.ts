import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { of } from 'rxjs';
import { IntegracionesComponent } from './integraciones.component';
import { IntegrationConfigService, OdooConfigDto, InfraDocConfigDto, VmwareConfigDto } from '../../../core/services/integration-config.service';

const MASK = '••••••••';

describe('IntegracionesComponent', () => {
  let fixture: ComponentFixture<IntegracionesComponent>;
  let comp: IntegracionesComponent;
  let mockService: jasmine.SpyObj<IntegrationConfigService>;

  beforeEach(async () => {
    mockService = jasmine.createSpyObj('IntegrationConfigService', [
      'getOdoo', 'patchOdoo', 'testOdoo',
      'getInfraDoc', 'patchInfraDoc', 'testInfraDoc',
      'getVmware', 'patchVmware', 'testVmware',
    ]);
    mockService.getOdoo.and.returnValue(of({ url: 'https://odoo.test', db: 'db', username: 'bot@test.com', apiKey: MASK, helpdeskTeamId: 7, updatedAt: null, updatedBy: null }));
    mockService.patchOdoo.and.returnValue(of({ url: 'https://odoo.test', db: 'db', username: 'bot@test.com', apiKey: MASK, helpdeskTeamId: 7, updatedAt: null, updatedBy: null } as OdooConfigDto));
    mockService.testOdoo.and.returnValue(of({ ok: true, message: 'OK' }));
    mockService.getInfraDoc.and.returnValue(of({ url: 'https://id.test', apiKey: MASK, updatedAt: null, updatedBy: null }));
    mockService.patchInfraDoc.and.returnValue(of({ url: 'https://id.test', apiKey: MASK, updatedAt: null, updatedBy: null } as InfraDocConfigDto));
    mockService.testInfraDoc.and.returnValue(of({ ok: true, message: 'OK' }));
    mockService.getVmware.and.returnValue(of({ username: 'ondra-read', password: MASK, updatedAt: null, updatedBy: null }));
    mockService.patchVmware.and.returnValue(of({ username: 'ondra-read', password: MASK, updatedAt: null, updatedBy: null } as VmwareConfigDto));
    mockService.testVmware.and.returnValue(of({ ok: true, message: 'OK' }));

    await TestBed.configureTestingModule({
      declarations: [IntegracionesComponent],
      imports: [NoopAnimationsModule, ReactiveFormsModule, MatSnackBarModule, MatProgressSpinnerModule, MatFormFieldModule, MatInputModule, MatButtonModule],
      providers: [{ provide: IntegrationConfigService, useValue: mockService }],
    }).compileComponents();
    fixture = TestBed.createComponent(IntegracionesComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carga config de las tres integraciones al iniciar', () => {
    expect(mockService.getOdoo).toHaveBeenCalled();
    expect(mockService.getInfraDoc).toHaveBeenCalled();
    expect(mockService.getVmware).toHaveBeenCalled();
  });

  it('popula el form de Odoo con los datos recibidos', () => {
    expect(comp.odooForm.get('url')?.value).toBe('https://odoo.test');
    expect(comp.odooForm.get('apiKey')?.value).toBe(MASK);
  });

  it('buildOdooPatchDto omite apiKey cuando es MASK', () => {
    comp.odooForm.patchValue({ apiKey: MASK });
    expect(comp.buildOdooPatchDto().apiKey).toBeUndefined();
  });

  it('buildOdooPatchDto incluye apiKey cuando es un valor nuevo', () => {
    comp.odooForm.patchValue({ apiKey: 'nueva-key' });
    expect(comp.buildOdooPatchDto().apiKey).toBe('nueva-key');
  });
});
