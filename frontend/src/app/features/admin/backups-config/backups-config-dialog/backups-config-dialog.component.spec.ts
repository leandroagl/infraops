import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BackupsConfigDialogComponent } from './backups-config-dialog.component';
import { BackupsService } from '../../../../features/backups/services/backups.service';
import { ClientsService } from '../../../../core/services/clients.service';
import { InfradocService } from '../../../../core/services/infradoc.service';

const mockClients = [
  { id: 'c1', name: 'ACME', isActive: true, primaryAddress: null, createdAt: '2024-01-01' },
  { id: 'c2', name: 'Otra Empresa', isActive: true, primaryAddress: null, createdAt: '2024-01-01' },
];

const mockJobs = [
  { jobId: 'j1', name: 'PSQ', disabled: false, configured: false, configuredClientName: null },
  { jobId: 'j2', name: 'PARADORATALAYA', disabled: false, configured: false, configuredClientName: null },
  { jobId: 'j3', name: 'ATALAYACOMAR', disabled: false, configured: true, configuredClientName: 'Atalaya' },
];

const mockEmptyInfra = {
  esxiHosts: [], windowsVMs: [], domainControllers: [], linuxVMs: [], nas: [], routers: [],
};

describe('BackupsConfigDialogComponent', () => {
  let mockSvc: jasmine.SpyObj<BackupsService>;
  let mockClientsSvc: jasmine.SpyObj<ClientsService>;
  let mockInfradocSvc: jasmine.SpyObj<InfradocService>;
  let mockDialogRef: jasmine.SpyObj<MatDialogRef<BackupsConfigDialogComponent>>;

  async function setup(data: any = null) {
    mockSvc        = jasmine.createSpyObj('BackupsService',  [
      'createConfig', 'updateConfig', 'listJetbackupJobs', 'createJetbackupConfigs', 'updateJetbackupConfig',
    ]);
    mockSvc.listJetbackupJobs.and.returnValue(of(mockJobs));
    mockClientsSvc = jasmine.createSpyObj('ClientsService',  ['getAll']);
    mockInfradocSvc = jasmine.createSpyObj('InfradocService', ['getClientInfrastructure']);
    mockDialogRef  = jasmine.createSpyObj('MatDialogRef',    ['close']);

    mockClientsSvc.getAll.and.returnValue(of(mockClients));

    await TestBed.configureTestingModule({
      declarations: [BackupsConfigDialogComponent],
      imports: [
        NoopAnimationsModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatCheckboxModule,
        MatButtonModule,
        MatTooltipModule,
        MatProgressSpinnerModule,
      ],
      providers: [
        { provide: BackupsService,  useValue: mockSvc },
        { provide: ClientsService,  useValue: mockClientsSvc },
        { provide: MatDialogRef,    useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: InfradocService, useValue: mockInfradocSvc },
      ],
    }).compileComponents();

    const fixture: ComponentFixture<BackupsConfigDialogComponent> = TestBed.createComponent(BackupsConfigDialogComponent);
    fixture.detectChanges();
    return { fixture, comp: fixture.componentInstance };
  }

  it('auto-popula el host con el hostname de uri1 (sin puerto) al seleccionar cliente', async () => {
    const { comp } = await setup(null);
    mockInfradocSvc.getClientInfrastructure.and.returnValue(of({
      ...mockEmptyInfra,
      esxiHosts: [{ assetId: 1, name: 'hpGL360.covema.local', ip: null, bmcIp: null, bmcType: null, os: null, make: null, model: null, uri1: 'https://acme.ondravirtual.com.ar:344', uri2: null }],
    }));
    comp.onClientChange('c1');
    expect(mockInfradocSvc.getClientInfrastructure).toHaveBeenCalledWith('c1');
    expect(comp.form.controls.host.value).toBe('acme.ondravirtual.com.ar');
  });

  it('usa uri2 si uri1 es null', async () => {
    const { comp } = await setup(null);
    mockInfradocSvc.getClientInfrastructure.and.returnValue(of({
      ...mockEmptyInfra,
      esxiHosts: [{ assetId: 1, name: 'server.local', ip: null, bmcIp: null, bmcType: null, os: null, make: null, model: null, uri1: null, uri2: 'https://beta.ondravirtual.com.ar:344' }],
    }));
    comp.onClientChange('c1');
    expect(comp.form.controls.host.value).toBe('beta.ondravirtual.com.ar');
  });

  it('no modifica el host si esxiHosts está vacío', async () => {
    const { comp } = await setup(null);
    mockInfradocSvc.getClientInfrastructure.and.returnValue(of(mockEmptyInfra));
    comp.form.controls.host.setValue('10.0.0.1');
    comp.onClientChange('c1');
    expect(comp.form.controls.host.value).toBe('10.0.0.1');
  });

  it('crea config con clientId, host, port, isEnabled sin credenciales', async () => {
    const { comp } = await setup(null);
    mockSvc.createConfig.and.returnValue(of({
      provider: 'VEEAM' as const, id: 'new', clientId: 'c1', clientName: 'ACME',
      host: 'acme.ondravirtual.com.ar', port: 9419,
      isEnabled: true, lastConnectedAt: null,
    }));
    comp.form.patchValue({ clientId: 'c1', host: 'acme.ondravirtual.com.ar', port: 9419, isEnabled: true });
    comp.save();
    expect(mockSvc.createConfig).toHaveBeenCalledWith(jasmine.objectContaining({
      clientId: 'c1', clientName: 'ACME', host: 'acme.ondravirtual.com.ar',
    }));
    expect(mockDialogRef.close).toHaveBeenCalledWith(jasmine.objectContaining({ id: 'new' }));
  });

  it('formulario inválido si clientId o host están vacíos en modo creación', async () => {
    const { comp } = await setup(null);
    comp.form.patchValue({ clientId: '', host: '' });
    comp.save();
    expect(mockSvc.createConfig).not.toHaveBeenCalled();
  });

  it('edita config actualizando host, port, isEnabled', async () => {
    const existing = {
      provider: 'VEEAM' as const, id: 'abc', clientName: 'Empresa A', host: '192.168.1.1',
      port: 9419, isEnabled: true, clientId: 'c1', lastConnectedAt: null,
    };
    const { comp } = await setup(existing);
    mockSvc.updateConfig.and.returnValue(of({ ...existing, host: '10.0.0.5', port: 9420 }));
    comp.form.patchValue({ host: '10.0.0.5', port: 9420 });
    comp.save();
    expect(mockSvc.updateConfig).toHaveBeenCalledWith('abc', jasmine.objectContaining({ host: '10.0.0.5', port: 9420 }));
  });

  it('onClientChange no llama a InfraDoc en modo edición', async () => {
    const existing = {
      provider: 'VEEAM' as const, id: 'abc', clientName: 'Empresa A', host: '192.168.1.1',
      port: 9419, isEnabled: true, clientId: 'c1', lastConnectedAt: null,
    };
    const { comp } = await setup(existing);
    comp.onClientChange('c1');
    expect(mockInfradocSvc.getClientInfrastructure).not.toHaveBeenCalled();
  });

  it('carga solo clientes activos en el selector', async () => {
    mockClientsSvc.getAll.and.returnValue(of([
      ...mockClients,
      { id: 'c3', name: 'Inactivo', isActive: false, primaryAddress: null, createdAt: '2024-01-01' },
    ]));
    const { comp } = await setup(null);
    expect(comp.clients.length).toBe(2);
    expect(comp.clients.every(c => c.isActive)).toBe(true);
  });

  describe('tipo JetBackup', () => {
    it('por defecto el tipo es Veeam y no consulta los jobs de JetBackup', async () => {
      const { comp } = await setup(null);
      expect(comp.form.controls.provider.value).toBe('VEEAM');
      expect(mockSvc.listJetbackupJobs).not.toHaveBeenCalled();
    });

    it('al elegir JetBackup carga los jobs disponibles del WHM', async () => {
      const { comp } = await setup(null);
      comp.onProviderChange('JETBACKUP');
      expect(mockSvc.listJetbackupJobs).toHaveBeenCalledTimes(1);
      expect(comp.jobs.length).toBe(3);
      expect(comp.loadingJobs).toBe(false);
    });

    it('no vuelve a consultar los jobs si se alterna entre tipos', async () => {
      const { comp } = await setup(null);
      comp.onProviderChange('JETBACKUP');
      comp.onProviderChange('VEEAM');
      comp.onProviderChange('JETBACKUP');
      expect(mockSvc.listJetbackupJobs).toHaveBeenCalledTimes(1);
    });

    it('con JetBackup no pide host ni puerto, pero sí al menos un job', async () => {
      const { comp } = await setup(null);
      comp.onProviderChange('JETBACKUP');
      comp.form.patchValue({ clientId: 'c1', host: '', jobIds: [] });
      expect(comp.isValid).toBe(false);
      comp.form.patchValue({ jobIds: ['j1'] });
      expect(comp.isValid).toBe(true);
    });

    it('al volver a Veeam vuelven a ser obligatorios host y puerto', async () => {
      const { comp } = await setup(null);
      comp.onProviderChange('JETBACKUP');
      comp.onProviderChange('VEEAM');
      comp.form.patchValue({ clientId: 'c1', host: '' });
      expect(comp.isValid).toBe(false);
    });

    it('muestra el error cuando falla la carga de jobs (ej. JetBackup sin configurar)', async () => {
      const { comp } = await setup(null);
      mockSvc.listJetbackupJobs.and.returnValue(throwError(() => ({ error: { message: 'JetBackup no está configurado' } })));
      comp.onProviderChange('JETBACKUP');
      expect(comp.jobsError).toBe('JetBackup no está configurado');
      expect(comp.loadingJobs).toBe(false);
    });

    it('crea una config por cada job elegido', async () => {
      const { comp } = await setup(null);
      mockSvc.createJetbackupConfigs.and.returnValue(of([]));
      comp.onProviderChange('JETBACKUP');
      comp.form.patchValue({ clientId: 'c1', jobIds: ['j1', 'j2'], isEnabled: true });
      comp.save();
      expect(mockSvc.createJetbackupConfigs).toHaveBeenCalledWith({
        clientId: 'c1', clientName: 'ACME', isEnabled: true,
        jobs: [{ jobId: 'j1', jobName: 'PSQ' }, { jobId: 'j2', jobName: 'PARADORATALAYA' }],
      });
      expect(mockSvc.createConfig).not.toHaveBeenCalled();
      expect(mockDialogRef.close).toHaveBeenCalledWith(jasmine.anything());
    });

    it('muestra el mensaje del backend si algún job ya estaba asignado y no cierra el dialog', async () => {
      const { comp } = await setup(null);
      mockSvc.createJetbackupConfigs.and.returnValue(throwError(() => ({ error: { message: 'Ya configurado: PSQ (Atalaya)' } })));
      comp.onProviderChange('JETBACKUP');
      comp.form.patchValue({ clientId: 'c1', jobIds: ['j1'] });
      comp.save();
      expect(comp.errorMessage).toBe('Ya configurado: PSQ (Atalaya)');
      expect(comp.saving).toBe(false);
      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });

    it('en edición de un job de JetBackup solo permite cambiar si está habilitado', async () => {
      const existing = {
        provider: 'JETBACKUP' as const, id: 'jc1', clientId: 'c1', clientName: 'ACME',
        jobId: 'j1', jobName: 'PSQ', isEnabled: true,
      };
      const { comp } = await setup(existing);
      mockSvc.updateJetbackupConfig.and.returnValue(of({ ...existing, isEnabled: false }));
      expect(comp.form.controls.provider.disabled).toBe(true);
      expect(mockSvc.listJetbackupJobs).not.toHaveBeenCalled();
      comp.form.patchValue({ isEnabled: false });
      comp.save();
      expect(mockSvc.updateJetbackupConfig).toHaveBeenCalledWith('jc1', { isEnabled: false });
      expect(mockDialogRef.close).toHaveBeenCalledWith(jasmine.objectContaining({ id: 'jc1' }));
    });
  });
});
