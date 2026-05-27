import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AuthGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let authService: AuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule, HttpClientTestingModule],
      providers: [AuthGuard, AuthService],
    });
    guard = TestBed.inject(AuthGuard);
    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    localStorage.clear();
  });

  afterEach(() => localStorage.clear());

  it('should allow access when authenticated', () => {
    spyOn(authService, 'isAuthenticated').and.returnValue(true);
    expect(guard.canActivate()).toBeTrue();
  });

  it('should redirect to /login and deny access when not authenticated', () => {
    spyOn(authService, 'isAuthenticated').and.returnValue(false);
    const navigateSpy = spyOn(router, 'navigate');

    expect(guard.canActivate()).toBeFalse();
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });
});
