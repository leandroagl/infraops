import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { of, throwError } from 'rxjs';
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
    mockService.getOdoo.and.returnValue(of({ url: 'https://odoo.test', db: 'db', username: 'bot@test.com', apiKey: MASK, helpdeskTeamId: 7, stageInProgressName: 'En curso', stageNotDoneName: 'No realizadas', stageDoneName: 'Hecho', updatedAt: null, updatedBy: null }));
    mockService.patchOdoo.and.returnValue(of({ url: 'https://odoo.test', db: 'db', username: 'bot@test.com', apiKey: MASK, helpdeskTeamId: 7, stageInProgressName: 'En curso', stageNotDoneName: 'No realizadas', stageDoneName: 'Hecho', updatedAt: null, updatedBy: null } as OdooConfigDto));
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

  it('no marca connectionStatus como "ok" solo porque la config tiene updatedAt (sin haber probado la conexión)', () => {
    // Reconfigura el mock para simular una config ya guardada previamente (updatedAt seteado)
    // pero cuya conexión nunca fue probada exitosamente en esta sesión.
    mockService.getOdoo.and.returnValue(of({
      url: 'https://odoo.test', db: 'db', username: 'bot@test.com', apiKey: MASK, helpdeskTeamId: 7,
      stageInProgressName: '', stageNotDoneName: '', stageDoneName: '',
      updatedAt: new Date('2026-09-01'), updatedBy: 'admin@ondra.com.ar',
    }));
    mockService.getInfraDoc.and.returnValue(of({ url: 'https://id.test', apiKey: MASK, updatedAt: new Date('2026-09-01'), updatedBy: 'admin@ondra.com.ar' }));
    mockService.getVmware.and.returnValue(of({ username: 'ondra-read', password: MASK, updatedAt: new Date('2026-09-01'), updatedBy: 'admin@ondra.com.ar' }));

    const freshFixture = TestBed.createComponent(IntegracionesComponent);
    const freshComp = freshFixture.componentInstance;
    freshFixture.detectChanges();

    expect(freshComp.odoo.connectionStatus).toBe('unknown');
    expect(freshComp.infradoc.connectionStatus).toBe('unknown');
    expect(freshComp.vmware.connectionStatus).toBe('unknown');
  });

  it('guardar la config de Odoo no marca connectionStatus como "ok" (solo "Probar conexión" lo hace)', () => {
    comp.saveOdoo();
    expect(comp.odoo.connectionStatus).not.toBe('ok');
  });

  it('probar la conexión de Odoo sí marca connectionStatus según el resultado', () => {
    mockService.testOdoo.and.returnValue(of({ ok: true, message: 'Conexión exitosa' }));
    comp.testOdoo();
    expect(comp.odoo.connectionStatus).toBe('ok');
  });

  it('muestra el mensaje de error del backend al fallar el guardado de Odoo', () => {
    const snackBar = (comp as unknown as { snackBar: { open: jasmine.Spy } }).snackBar;
    spyOn(snackBar, 'open');
    mockService.patchOdoo.and.returnValue(throwError(() => ({ error: { message: 'INTEGRATIONS_ENCRYPT_KEY no está configurada' } })));

    comp.saveOdoo();

    expect(comp.odoo.saving).toBe(false);
    expect(snackBar.open).toHaveBeenCalledWith('INTEGRATIONS_ENCRYPT_KEY no está configurada', '', jasmine.any(Object));
  });
});
