import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
import { LoginResponse } from '../models/auth.models';

const MOCK_RESPONSE: LoginResponse = {
  accessToken: 'eyJhbGciOiJIUzI1NiJ9.test.sig',
  user: { id: 1, email: 'pepe@ondra.com.ar', role: 'ADMIN' },
};

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      providers: [AuthService],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    localStorage.clear();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('login', () => {
    it('should POST credentials and store token + user', () => {
      service.login('pepe@ondra.com.ar', '1234').subscribe(res => {
        expect(res).toEqual(MOCK_RESPONSE);
        expect(service.getToken()).toBe(MOCK_RESPONSE.accessToken);
        expect(service.getCurrentUser()).toEqual(MOCK_RESPONSE.user);
      });

      const req = http.expectOne(`${environment.apiUrl}/auth/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'pepe@ondra.com.ar', password: '1234' });
      req.flush(MOCK_RESPONSE);
    });
  });

  describe('logout', () => {
    it('should clear token and user from storage', () => {
      spyOn(router, 'navigate');
      localStorage.setItem('token', MOCK_RESPONSE.accessToken);
      localStorage.setItem('user', JSON.stringify(MOCK_RESPONSE.user));

      service.logout();

      expect(service.getToken()).toBeNull();
      expect(service.getCurrentUser()).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when no token is stored', () => {
      expect(service.isAuthenticated()).toBeFalse();
    });

    it('should return true when a token is stored', () => {
      localStorage.setItem('token', MOCK_RESPONSE.accessToken);
      expect(service.isAuthenticated()).toBeTrue();
    });
  });

  describe('getToken', () => {
    it('should return null when storage is empty', () => {
      expect(service.getToken()).toBeNull();
    });

    it('should return the stored token', () => {
      localStorage.setItem('token', 'abc');
      expect(service.getToken()).toBe('abc');
    });
  });

  describe('getCurrentUser', () => {
    it('should return null when no user is stored', () => {
      expect(service.getCurrentUser()).toBeNull();
    });

    it('should return the stored user', () => {
      localStorage.setItem('user', JSON.stringify(MOCK_RESPONSE.user));
      expect(service.getCurrentUser()).toEqual(MOCK_RESPONSE.user);
    });
  });
});
