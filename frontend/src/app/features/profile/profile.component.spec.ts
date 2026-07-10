// frontend/src/app/features/profile/profile.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';

import { ProfileComponent } from './profile.component';
import { ProfileService, MeResponse } from '../../core/services/profile.service';
import { AuthService } from '../../core/services/auth.service';
import { SharedModule } from '../../shared/shared.module';

const mockMe: MeResponse = {
  id: '1', name: 'Valen', email: 'v@ondra.com.ar', role: 'TECHNICIAN',
  technicianId: null, odooKeyValid: true, odooKeyValidatedAt: '2026-07-10T09:42:00Z',
  odooApiEmail: 'v@ondra.com.ar', odooExempt: false,
};

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;
  let profileService: jasmine.SpyObj<ProfileService>;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    profileService = jasmine.createSpyObj('ProfileService', ['getMe', 'updateOdooCredentials']);
    authService    = jasmine.createSpyObj('AuthService', ['clearMustOdooSetup']);
    profileService.getMe.and.returnValue(of(mockMe));

    await TestBed.configureTestingModule({
      declarations: [ProfileComponent],
      imports: [
        ReactiveFormsModule,
        HttpClientTestingModule,
        NoopAnimationsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatSnackBarModule,
        SharedModule,
      ],
      providers: [
        { provide: ProfileService, useValue: profileService },
        { provide: AuthService,    useValue: authService },
      ],
    }).compileComponents();

    fixture   = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carga el perfil al inicializar', () => {
    expect(component.me).toEqual(mockMe);
  });

  it('startEdit crea el formulario pre-cargando el email de Odoo', () => {
    component.startEdit();
    expect(component.editForm?.get('odooApiEmail')?.value).toBe('v@ondra.com.ar');
  });

  it('saveCredentials exitoso recarga el perfil y muestra snackbar', () => {
    profileService.updateOdooCredentials.and.returnValue(of(undefined));
    profileService.getMe.and.returnValue(of({ ...mockMe, odooKeyValidatedAt: '2026-07-10T10:00:00Z' }));
    component.startEdit();
    component.editForm?.setValue({ odooApiEmail: 'v@ondra.com.ar', odooApiKey: 'new-key' });
    component.saveCredentials();
    expect(component.editing).toBeFalse();
    expect(authService.clearMustOdooSetup).toHaveBeenCalled();
  });

  it('saveCredentials con error muestra el mensaje de error', () => {
    profileService.updateOdooCredentials.and.returnValue(
      throwError(() => ({ error: { message: 'Credenciales Odoo inválidas' } }))
    );
    component.startEdit();
    component.editForm?.setValue({ odooApiEmail: 'v@ondra.com.ar', odooApiKey: 'bad' });
    component.saveCredentials();
    expect(component.saveError).toBe('Credenciales Odoo inválidas');
  });
});
