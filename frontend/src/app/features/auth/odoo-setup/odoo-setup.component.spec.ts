import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { of, throwError } from 'rxjs';

import { OdooSetupComponent } from './odoo-setup.component';
import { AuthService } from '../../../core/services/auth.service';
import { ProfileService } from '../../../core/services/profile.service';

describe('OdooSetupComponent', () => {
  let component: OdooSetupComponent;
  let fixture: ComponentFixture<OdooSetupComponent>;
  let authService: jasmine.SpyObj<AuthService>;
  let profileService: jasmine.SpyObj<ProfileService>;
  let router: Router;

  beforeEach(async () => {
    authService    = jasmine.createSpyObj('AuthService', ['getCurrentUser', 'clearMustOdooSetup', 'logout']);
    profileService = jasmine.createSpyObj('ProfileService', ['updateOdooCredentials']);
    authService.getCurrentUser.and.returnValue({
      id: '1',
      email: 'v@ondra.com.ar',
      role: 'TECHNICIAN',
      odooKeyValid: false,
      odooExempt: false,
    });

    await TestBed.configureTestingModule({
      declarations: [OdooSetupComponent],
      imports: [
        ReactiveFormsModule,
        RouterTestingModule,
        HttpClientTestingModule,
        NoopAnimationsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatProgressSpinnerModule,
      ],
      providers: [
        { provide: AuthService,    useValue: authService },
        { provide: ProfileService, useValue: profileService },
      ],
    }).compileComponents();

    fixture   = TestBed.createComponent(OdooSetupComponent);
    component = fixture.componentInstance;
    router    = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('pre-carga el email del usuario actual', () => {
    expect(component.form.get('odooApiEmail')?.value).toBe('v@ondra.com.ar');
  });

  it('no envía si el formulario es inválido', () => {
    component.form.get('odooApiKey')?.setValue('');
    component.submit();
    expect(profileService.updateOdooCredentials).not.toHaveBeenCalled();
  });

  it('en submit exitoso limpia el flag y navega a /dashboard', () => {
    profileService.updateOdooCredentials.and.returnValue(of(undefined));
    const navigateSpy = spyOn(router, 'navigate');
    component.form.setValue({ odooApiEmail: 'v@ondra.com.ar', odooApiKey: 'my-key' });
    component.submit();
    expect(authService.clearMustOdooSetup).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard']);
  });

  it('en error muestra el mensaje y no navega', () => {
    profileService.updateOdooCredentials.and.returnValue(
      throwError(() => ({ error: { message: 'Credenciales Odoo inválidas' } })),
    );
    component.form.setValue({ odooApiEmail: 'v@ondra.com.ar', odooApiKey: 'bad-key' });
    component.submit();
    expect(component.errorMessage).toBe('Credenciales Odoo inválidas');
  });

  it('logout llama a auth.logout()', () => {
    component.logout();
    expect(authService.logout).toHaveBeenCalled();
  });
});
