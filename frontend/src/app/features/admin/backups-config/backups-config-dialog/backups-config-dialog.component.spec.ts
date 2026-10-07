import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { BackupsConfigDialogComponent } from './backups-config-dialog.component';
import { BackupsService } from '../../../../features/backups/services/backups.service';

const mockSvc = { createConfig: jest.fn(), updateConfig: jest.fn() };
const mockDialogRef = { close: jest.fn() };

describe('BackupsConfigDialogComponent', () => {
  async function setup(data: any = null) {
    await TestBed.configureTestingModule({
      declarations: [BackupsConfigDialogComponent],
      imports: [
        NoopAnimationsModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatCheckboxModule,
        MatButtonModule,
      ],
      providers: [
        { provide: BackupsService, useValue: mockSvc },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    }).compileComponents();

    const fixture: ComponentFixture<BackupsConfigDialogComponent> = TestBed.createComponent(BackupsConfigDialogComponent);
    fixture.detectChanges();
    return { fixture, comp: fixture.componentInstance };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('crea config nueva con todos los campos requeridos', async () => {
    const { comp } = await setup(null);
    mockSvc.createConfig.mockReturnValue(of({ id: 'new', clientName: 'ACME', host: '10.0.0.1', port: 9419, username: 'admin', isEnabled: true, clientId: 'c1', lastConnectedAt: null }));

    comp.form.patchValue({
      clientName: 'ACME',
      host:       '10.0.0.1',
      port:       9419,
      username:   'admin',
      password:   'secret123',
      isEnabled:  true,
    });

    comp.save();

    expect(mockSvc.createConfig).toHaveBeenCalledWith(expect.objectContaining({
      clientName: 'ACME',
      host:       '10.0.0.1',
      port:       9419,
      username:   'admin',
      password:   'secret123',
      isEnabled:  true,
    }));
    expect(mockDialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ id: 'new' }));
  });

  it('edita config existente sin cambiar contraseña si el campo está vacío', async () => {
    const existing = {
      id: 'abc', clientName: 'Empresa A', host: '192.168.1.1',
      port: 9419, username: 'svc_veeam', isEnabled: true, clientId: 'c1', lastConnectedAt: null,
    };
    const { comp } = await setup(existing);
    mockSvc.updateConfig.mockReturnValue(of({ ...existing, host: '192.168.1.2' }));

    comp.form.patchValue({ host: '192.168.1.2', password: '' });
    comp.save();

    const callArg = mockSvc.updateConfig.mock.calls[0][1];
    expect(callArg['password']).toBeUndefined();
    expect(callArg['host']).toBe('192.168.1.2');
  });
});
