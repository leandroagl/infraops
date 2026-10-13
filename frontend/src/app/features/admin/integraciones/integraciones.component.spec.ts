import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { of, throwError } from 'rxjs';
import { IntegracionesComponent } from './integraciones.component';
import { IntegrationConfigService } from '../../../core/services/integration-config.service';

const MASK = '••••••••';

const odooBase     = { url: 'https://odoo.test', db: 'db', username: 'bot@test.com', apiKey: MASK, helpdeskTeamId: 7, expirationsHelpdeskTeamId: 9, expirationsTicketDaysAhead: 30, expirationsTagIds: [], expirationsTypeConfigs: null, stageInProgressName: 'En curso', stageNotDoneName: 'No realizadas', stageDoneName: 'Hecho', updatedAt: null, updatedBy: null };
const infradocBase = { url: 'https://id.test', apiKey: MASK, updatedAt: null, updatedBy: null };
const vmwareBase   = { username: 'ondra-read', password: MASK, updatedAt: null, updatedBy: null };
const veeamBase    = { username: 'ondra-veeam', password: MASK, updatedAt: null, updatedBy: null };
const jetbackupBase = { url: 'https://whm.test:2087', username: 'root', apiKey: MASK, updatedAt: null, updatedBy: null };

describe('IntegracionesComponent', () => {
  let fixture: ComponentFixture<IntegracionesComponent>;
  let comp: IntegracionesComponent;
  let mockSvc: jasmine.SpyObj<IntegrationConfigService>;

  beforeEach(async () => {
    mockSvc = jasmine.createSpyObj('IntegrationConfigService', [
      'getOdoo', 'patchOdoo', 'testOdoo',
      'getInfraDoc', 'patchInfraDoc', 'testInfraDoc',
      'getVmware', 'patchVmware', 'testVmware',
      'getVeeam', 'patchVeeam', 'testVeeam',
      'getJetbackup', 'patchJetbackup', 'testJetbackup',
    ]);
    mockSvc.getOdoo.and.returnValue(of(odooBase));
    mockSvc.patchOdoo.and.returnValue(of(odooBase));
    mockSvc.testOdoo.and.returnValue(of({ ok: true, message: 'OK' }));
    mockSvc.getInfraDoc.and.returnValue(of(infradocBase));
    mockSvc.patchInfraDoc.and.returnValue(of(infradocBase));
    mockSvc.testInfraDoc.and.returnValue(of({ ok: true, message: 'OK' }));
    mockSvc.getVmware.and.returnValue(of(vmwareBase));
    mockSvc.patchVmware.and.returnValue(of(vmwareBase));
    mockSvc.testVmware.and.returnValue(of({ ok: true, message: 'OK' }));
    mockSvc.getVeeam.and.returnValue(of(veeamBase));
    mockSvc.patchVeeam.and.returnValue(of(veeamBase));
    mockSvc.testVeeam.and.returnValue(of({ ok: true, message: 'OK' }));
    mockSvc.getJetbackup.and.returnValue(of(jetbackupBase));
    mockSvc.patchJetbackup.and.returnValue(of(jetbackupBase));
    mockSvc.testJetbackup.and.returnValue(of({ ok: true, message: 'OK' }));

    await TestBed.configureTestingModule({
      declarations: [IntegracionesComponent],
      imports: [NoopAnimationsModule, ReactiveFormsModule, MatSnackBarModule, MatProgressSpinnerModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule],
      providers: [{ provide: IntegrationConfigService, useValue: mockSvc }],
    }).compileComponents();
    fixture = TestBed.createComponent(IntegracionesComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carga config de las cuatro integraciones al iniciar', () => {
    expect(mockSvc.getOdoo).toHaveBeenCalled();
    expect(mockSvc.getInfraDoc).toHaveBeenCalled();
    expect(mockSvc.getVmware).toHaveBeenCalled();
    expect(mockSvc.getVeeam).toHaveBeenCalled();
    expect(mockSvc.getJetbackup).toHaveBeenCalled();
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

  it('no marca connectionStatus como "ok" solo porque la config tiene updatedAt', () => {
    mockSvc.getOdoo.and.returnValue(of({ ...odooBase, updatedAt: new Date('2026-09-01'), updatedBy: 'admin@ondra.com.ar' }));
    mockSvc.getInfraDoc.and.returnValue(of({ ...infradocBase, updatedAt: new Date('2026-09-01'), updatedBy: 'admin@ondra.com.ar' }));
    mockSvc.getVmware.and.returnValue(of({ ...vmwareBase, updatedAt: new Date('2026-09-01'), updatedBy: 'admin@ondra.com.ar' }));
    mockSvc.getVeeam.and.returnValue(of({ ...veeamBase, updatedAt: new Date('2026-09-01'), updatedBy: 'admin@ondra.com.ar' }));
    mockSvc.getJetbackup.and.returnValue(of({ ...jetbackupBase, updatedAt: new Date('2026-09-01'), updatedBy: 'admin@ondra.com.ar' }));

    const freshFixture = TestBed.createComponent(IntegracionesComponent);
    const freshComp = freshFixture.componentInstance;
    freshFixture.detectChanges();

    expect(freshComp.odoo.connectionStatus).toBe('unknown');
    expect(freshComp.infradoc.connectionStatus).toBe('unknown');
    expect(freshComp.vmware.connectionStatus).toBe('unknown');
    expect(freshComp.veeam.connectionStatus).toBe('unknown');
    expect(freshComp.jetbackup.connectionStatus).toBe('unknown');
  });

  it('guardar la config de Odoo no marca connectionStatus como "ok"', () => {
    comp.saveOdoo();
    expect(comp.odoo.connectionStatus).not.toBe('ok');
  });

  it('probar la conexión de Odoo sí marca connectionStatus según el resultado', () => {
    mockSvc.testOdoo.and.returnValue(of({ ok: true, message: 'Conexión exitosa' }));
    comp.testOdoo();
    expect(comp.odoo.connectionStatus).toBe('ok');
  });

  it('muestra el mensaje de error del backend al fallar el guardado de Odoo', () => {
    const snackBar = TestBed.inject(MatSnackBar);
    const openSpy = spyOn(snackBar, 'open');
    mockSvc.patchOdoo.and.returnValue(throwError(() => ({ error: { message: 'INTEGRATIONS_ENCRYPT_KEY no está configurada' } })));

    comp.saveOdoo();

    expect(comp.odoo.saving).toBe(false);
    expect(openSpy).toHaveBeenCalledWith('INTEGRATIONS_ENCRYPT_KEY no está configurada', '', jasmine.any(Object));
  });

  it('buildVeeamPatchDto omite password cuando es MASK', () => {
    comp.veeamForm.patchValue({ password: MASK });
    expect(comp.buildVeeamPatchDto().password).toBeUndefined();
  });

  it('buildVeeamPatchDto incluye password cuando es un valor nuevo', () => {
    comp.veeamForm.patchValue({ password: 'nueva-pass' });
    expect(comp.buildVeeamPatchDto().password).toBe('nueva-pass');
  });

  it('popula el form de JetBackup con url y usuario recibidos', () => {
    expect(comp.jetbackupForm.get('url')?.value).toBe('https://whm.test:2087');
    expect(comp.jetbackupForm.get('username')?.value).toBe('root');
    expect(comp.jetbackupForm.get('apiKey')?.value).toBe(MASK);
  });

  it('buildJetbackupPatchDto omite apiKey cuando es MASK', () => {
    comp.jetbackupForm.patchValue({ apiKey: MASK });
    expect(comp.buildJetbackupPatchDto().apiKey).toBeUndefined();
  });

  it('buildJetbackupPatchDto incluye apiKey cuando es un valor nuevo', () => {
    comp.jetbackupForm.patchValue({ apiKey: 'nuevo-token' });
    expect(comp.buildJetbackupPatchDto().apiKey).toBe('nuevo-token');
  });

  it('guardar la config de JetBackup llama a patchJetbackup y no marca connectionStatus como "ok"', () => {
    comp.saveJetbackup();
    expect(mockSvc.patchJetbackup).toHaveBeenCalled();
    expect(comp.jetbackup.saving).toBe(false);
    expect(comp.jetbackup.connectionStatus).not.toBe('ok');
  });

  it('probar la conexión de JetBackup marca connectionStatus según el resultado', () => {
    mockSvc.testJetbackup.and.returnValue(of({ ok: false, message: 'Invalid token' }));
    comp.testJetbackup();
    expect(comp.jetbackup.connectionStatus).toBe('error');
    expect(comp.jetbackup.connectionMessage).toBe('Invalid token');
  });

  it('muestra el mensaje de error del backend al fallar el guardado de JetBackup', () => {
    const snackBar = TestBed.inject(MatSnackBar);
    const openSpy = spyOn(snackBar, 'open');
    mockSvc.patchJetbackup.and.returnValue(throwError(() => ({ error: { message: 'INTEGRATIONS_ENCRYPT_KEY no está configurada' } })));

    comp.saveJetbackup();

    expect(comp.jetbackup.saving).toBe(false);
    expect(openSpy).toHaveBeenCalledWith('INTEGRATIONS_ENCRYPT_KEY no está configurada', '', jasmine.any(Object));
  });
});
