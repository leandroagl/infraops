import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { BackupsConfigDialogComponent } from './backups-config-dialog.component';
import { BackupsService } from '../../../../features/backups/services/backups.service';
import { ClientsService } from '../../../../core/services/clients.service';
import { InfradocService } from '../../../../core/services/infradoc.service';
import { CredentialVaultService } from '../../../../core/services/credential-vault.service';

const mockClients = [
  { id: 'c1', name: 'ACME', isActive: true, primaryAddress: null, createdAt: '2024-01-01' },
  { id: 'c2', name: 'Otra Empresa', isActive: true, primaryAddress: null, createdAt: '2024-01-01' },
];

const mockVaultEntries = [
  { id: 'v1', name: 'Veeam ACME', createdAt: '2026-01-01' },
  { id: 'v2', name: 'Veeam Beta', createdAt: '2026-02-01' },
];

const mockEmptyInfra = {
  esxiHosts: [], windowsVMs: [], domainControllers: [], linuxVMs: [], nas: [], routers: [],
};

const mockSvc       = { createConfig: jest.fn(), updateConfig: jest.fn() };
const mockDialogRef = { close: jest.fn() };
const mockClientsSvc   = { getAll: jest.fn() };
const mockInfradocSvc  = { getClientInfrastructure: jest.fn() };
const mockVaultSvc     = { list: jest.fn() };

describe('BackupsConfigDialogComponent', () => {
  async function setup(data: any = null) {
    mockClientsSvc.getAll.mockReturnValue(of(mockClients));
    mockVaultSvc.list.mockReturnValue(of(mockVaultEntries));

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
        MatIconModule,
      ],
      providers: [
        { provide: BackupsService,         useValue: mockSvc },
        { provide: ClientsService,         useValue: mockClientsSvc },
        { provide: MatDialogRef,           useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA,        useValue: data },
        { provide: InfradocService,        useValue: mockInfradocSvc },
        { provide: CredentialVaultService, useValue: mockVaultSvc },
      ],
    }).compileComponents();

    const fixture: ComponentFixture<BackupsConfigDialogComponent> = TestBed.createComponent(BackupsConfigDialogComponent);
    fixture.detectChanges();
    return { fixture, comp: fixture.componentInstance };
  }

  beforeEach(() => { jest.clearAllMocks(); });

  it('auto-popula el host con el hostname de uri1 (sin puerto) al seleccionar cliente', async () => {
    const { comp } = await setup(null);
    mockInfradocSvc.getClientInfrastructure.mockReturnValue(of({
      ...mockEmptyInfra,
      esxiHosts: [{ assetId: 1, name: 'hpGL360.covema.local', ip: null, bmcIp: null, bmcType: null, os: null, make: null, model: null, uri1: 'acme.ondravirtual.com.ar:344', uri2: null }],
    }));
    comp.onClientChange('c1');
    expect(mockInfradocSvc.getClientInfrastructure).toHaveBeenCalledWith('c1');
    expect(comp.form.controls.host.value).toBe('acme.ondravirtual.com.ar');
  });

  it('usa uri2 si uri1 es null', async () => {
    const { comp } = await setup(null);
    mockInfradocSvc.getClientInfrastructure.mockReturnValue(of({
      ...mockEmptyInfra,
      esxiHosts: [{ assetId: 1, name: 'server.local', ip: null, bmcIp: null, bmcType: null, os: null, make: null, model: null, uri1: null, uri2: 'beta.ondravirtual.com.ar:344' }],
    }));
    comp.onClientChange('c1');
    expect(comp.form.controls.host.value).toBe('beta.ondravirtual.com.ar');
  });

  it('no modifica el host si esxiHosts está vacío', async () => {
    const { comp } = await setup(null);
    mockInfradocSvc.getClientInfrastructure.mockReturnValue(of(mockEmptyInfra));
    comp.form.controls.host.setValue('10.0.0.1');
    comp.onClientChange('c1');
    expect(comp.form.controls.host.value).toBe('10.0.0.1');
  });

  it('crea config con credentialVaultId', async () => {
    const { comp } = await setup(null);
    mockSvc.createConfig.mockReturnValue(of({
      id: 'new', clientId: 'c1', clientName: 'ACME',
      host: 'acme.ondravirtual.com.ar', port: 9419, username: 'admin',
      isEnabled: true, lastConnectedAt: null, credentialVaultEntryId: 'v1',
    }));
    comp.form.patchValue({
      clientId:          'c1',
      host:              'acme.ondravirtual.com.ar',
      port:              9419,
      username:          'admin',
      credentialVaultId: 'v1',
      isEnabled:         true,
    });
    comp.save();
    expect(mockSvc.createConfig).toHaveBeenCalledWith(expect.objectContaining({
      clientId:          'c1',
      clientName:        'ACME',
      credentialVaultId: 'v1',
    }));
    expect(mockDialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ id: 'new' }));
  });

  it('formulario inválido si no hay credentialVaultId en modo creación', async () => {
    const { comp } = await setup(null);
    comp.form.patchValue({
      clientId: 'c1', host: 'acme.ondravirtual.com.ar',
      port: 9419, username: 'admin', isEnabled: true,
    });
    comp.save();
    expect(mockSvc.createConfig).not.toHaveBeenCalled();
  });

  it('edita config actualizando credentialVaultId', async () => {
    const existing = {
      id: 'abc', clientName: 'Empresa A', host: '192.168.1.1',
      port: 9419, username: 'svc_veeam', isEnabled: true, clientId: 'c1',
      credentialVaultEntryId: 'v1', lastConnectedAt: null,
    };
    const { comp } = await setup(existing);
    mockSvc.updateConfig.mockReturnValue(of({ ...existing, credentialVaultEntryId: 'v2' }));
    comp.form.patchValue({ credentialVaultId: 'v2' });
    comp.save();
    expect(mockSvc.updateConfig).toHaveBeenCalledWith('abc', expect.objectContaining({ credentialVaultId: 'v2' }));
  });

  it('onClientChange no llama a InfraDoc en modo edición', async () => {
    const existing = {
      id: 'abc', clientName: 'Empresa A', host: '192.168.1.1',
      port: 9419, username: 'svc_veeam', isEnabled: true, clientId: 'c1',
      credentialVaultEntryId: 'v1', lastConnectedAt: null,
    };
    const { comp } = await setup(existing);
    comp.onClientChange('c1');
    expect(mockInfradocSvc.getClientInfrastructure).not.toHaveBeenCalled();
  });

  it('carga solo clientes activos en el selector', async () => {
    mockClientsSvc.getAll.mockReturnValue(of([
      ...mockClients,
      { id: 'c3', name: 'Inactivo', isActive: false, primaryAddress: null, createdAt: '2024-01-01' },
    ]));
    const { comp } = await setup(null);
    expect(comp.clients.length).toBe(2);
    expect(comp.clients.every(c => c.isActive)).toBe(true);
  });
});
