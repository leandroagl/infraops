import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AuthGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let auth: AuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule, HttpClientTestingModule],
      providers: [AuthGuard, AuthService],
    });
    guard  = TestBed.inject(AuthGuard);
    auth   = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    localStorage.clear();
  });

  afterEach(() => localStorage.clear());

  it('permite acceso cuando está autenticado y sin cambio de contraseña pendiente', () => {
    spyOn(auth, 'isAuthenticated').and.returnValue(true);
    spyOn(auth, 'mustChangePassword').and.returnValue(false);
    expect(guard.canActivate()).toBeTrue();
  });

  it('redirige a /login cuando no está autenticado', () => {
    spyOn(auth, 'isAuthenticated').and.returnValue(false);
    const nav = spyOn(router, 'navigate');
    expect(guard.canActivate()).toBeFalse();
    expect(nav).toHaveBeenCalledWith(['/login']);
  });

  it('redirige a /login/change-password cuando mustChangePassword es true', () => {
    spyOn(auth, 'isAuthenticated').and.returnValue(true);
    spyOn(auth, 'mustChangePassword').and.returnValue(true);
    const nav = spyOn(router, 'navigate');
    expect(guard.canActivate()).toBeFalse();
    expect(nav).toHaveBeenCalledWith(['/login/change-password']);
  });
});
