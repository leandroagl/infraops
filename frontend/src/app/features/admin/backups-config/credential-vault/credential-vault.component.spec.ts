import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CredentialVaultComponent } from './credential-vault.component';
import { CredentialVaultService } from '../../../../core/services/credential-vault.service';

const mockEntries = [
  { id: 'u1', name: 'Veeam ACME', createdAt: '2026-01-01' },
  { id: 'u2', name: 'Veeam Beta', createdAt: '2026-02-01' },
];
const mockSvc = { list: jest.fn(), create: jest.fn(), delete: jest.fn() };

describe('CredentialVaultComponent', () => {
  let fixture: ComponentFixture<CredentialVaultComponent>;
  let comp: CredentialVaultComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CredentialVaultComponent],
      imports: [
        NoopAnimationsModule, ReactiveFormsModule,
        MatTableModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule, MatTooltipModule, MatSnackBarModule,
      ],
      providers: [{ provide: CredentialVaultService, useValue: mockSvc }],
    }).compileComponents();
    mockSvc.list.mockReturnValue(of(mockEntries));
    fixture = TestBed.createComponent(CredentialVaultComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => jest.clearAllMocks());

  it('carga entradas del vault al init', () => {
    expect(mockSvc.list).toHaveBeenCalled();
    expect(comp.entries.length).toBe(2);
  });

  it('agregar entrada llama create y recarga', () => {
    mockSvc.create.mockReturnValue(of({ id: 'u3', name: 'Nueva', createdAt: '2026-03-01' }));
    mockSvc.list.mockReturnValue(of([...mockEntries, { id: 'u3', name: 'Nueva', createdAt: '2026-03-01' }]));
    comp.nameCtrl.setValue('Nueva');
    comp.passwordCtrl.setValue('pass123');
    comp.add();
    expect(mockSvc.create).toHaveBeenCalledWith('Nueva', 'pass123');
    expect(comp.entries.length).toBe(3);
  });

  it('add no llama create si el form es inválido', () => {
    comp.nameCtrl.setValue('');
    comp.passwordCtrl.setValue('');
    comp.add();
    expect(mockSvc.create).not.toHaveBeenCalled();
  });

  it('delete muestra snackbar de error si el servidor rechaza la eliminación (credencial en uso)', () => {
    const mockSnackBar = TestBed.inject(MatSnackBar);
    const snackSpy = jest.spyOn(mockSnackBar, 'open');
    mockSvc.delete.mockReturnValue(throwError(() => ({ status: 409, error: { message: 'en uso' } })));
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    comp.delete('u1');
    expect(snackSpy).toHaveBeenCalledWith(expect.stringContaining('uso'), 'Cerrar', expect.any(Object));
    expect(comp.entries.length).toBe(2);
  });

  it('delete llama delete y elimina del array local', () => {
    mockSvc.delete.mockReturnValue(of(undefined));
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    comp.delete('u1');
    expect(mockSvc.delete).toHaveBeenCalledWith('u1');
    expect(comp.entries.find(e => e.id === 'u1')).toBeUndefined();
  });
});
