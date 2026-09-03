import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';
import { RouterTestingModule } from '@angular/router/testing';
import { ErrorInterceptor } from './error.interceptor';
import { AuthService } from '../services/auth.service';

describe('ErrorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authService: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      providers: [
        AuthService,
        { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
      ],
    });
    http        = TestBed.inject(HttpClient);
    httpMock    = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should call auth.logout() when receiving a 401 response', () => {
    spyOn(authService, 'logout');

    http.get('/test').subscribe({ error: () => {} });

    const req = httpMock.expectOne('/test');
    req.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(authService.logout).toHaveBeenCalledTimes(1);
  });

  it('should not call auth.logout() on other error statuses', () => {
    spyOn(authService, 'logout');

    http.get('/test').subscribe({ error: () => {} });

    const req = httpMock.expectOne('/test');
    req.flush({ message: 'Not Found' }, { status: 404, statusText: 'Not Found' });

    expect(authService.logout).not.toHaveBeenCalled();
  });

  it('should propagate the error after handling 401', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let errorReceived: any;
    spyOn(authService, 'logout');

    http.get('/test').subscribe({ error: err => (errorReceived = err) });

    const req = httpMock.expectOne('/test');
    req.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(errorReceived.status).toBe(401);
  });
});
