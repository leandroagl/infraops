import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { AdminGuard } from './admin.guard';
import { AuthService } from '../services/auth.service';

describe('AdminGuard', () => {
  let guard: AdminGuard;
  let authSpy: jasmine.SpyObj<AuthService>;
  let router: Router;

  beforeEach(() => {
    authSpy = jasmine.createSpyObj('AuthService', ['getCurrentUser']);
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [
        AdminGuard,
        { provide: AuthService, useValue: authSpy },
      ],
    });
    guard = TestBed.inject(AdminGuard);
    router = TestBed.inject(Router);
  });

  it('devuelve true cuando el usuario tiene rol ADMIN', () => {
    authSpy.getCurrentUser.and.returnValue({
      id: 'uuid-1',
      email: 'admin@ondra.com.ar',
      role: 'ADMIN',
    });
    expect(guard.canActivate()).toBeTrue();
  });

  it('devuelve false y redirige a /dashboard para rol TECHNICIAN', () => {
    authSpy.getCurrentUser.and.returnValue({
      id: 'uuid-2',
      email: 'tech@ondra.com.ar',
      role: 'TECHNICIAN',
    });
    const navSpy = spyOn(router, 'navigate');
    expect(guard.canActivate()).toBeFalse();
    expect(navSpy).toHaveBeenCalledWith(['/dashboard']);
  });

  it('devuelve false y redirige cuando no hay sesión', () => {
    authSpy.getCurrentUser.and.returnValue(null);
    const navSpy = spyOn(router, 'navigate');
    expect(guard.canActivate()).toBeFalse();
    expect(navSpy).toHaveBeenCalledWith(['/login']);
  });
});
