import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, of, throwError } from 'rxjs';

import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/services/auth.service';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let authService: jasmine.SpyObj<AuthService>;
  let router: Router;

  beforeEach(async () => {
    const authSpy = jasmine.createSpyObj('AuthService', ['login']);

    await TestBed.configureTestingModule({
      declarations: [LoginComponent],
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
      providers: [{ provide: AuthService, useValue: authSpy }],
    }).compileComponents();

    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with an invalid form', () => {
    expect(component.form.valid).toBeFalse();
  });

  it('should not call login when form is invalid', () => {
    component.submit();
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('should call login with form values on valid submit', () => {
    authService.login.and.returnValue(of({ accessToken: 'tok', user: { id: 1, email: 'a@b.com', role: 'ADMIN' } } as any));
    component.form.setValue({ email: 'a@b.com', password: '1234' });

    component.submit();

    expect(authService.login).toHaveBeenCalledWith('a@b.com', '1234');
  });

  it('should navigate to /dashboard on successful login', fakeAsync(() => {
    authService.login.and.returnValue(of({ accessToken: 'tok', user: { id: 1, email: 'a@b.com', role: 'ADMIN' } } as any));
    const navigateSpy = spyOn(router, 'navigate');
    component.form.setValue({ email: 'a@b.com', password: '1234' });

    component.submit();
    tick();

    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard']);
  }));

  it('should set errorMessage and loading=false on 401 error', fakeAsync(() => {
    authService.login.and.returnValue(throwError(() => ({ status: 401 })));
    component.form.setValue({ email: 'a@b.com', password: 'wrong' });

    component.submit();
    tick();

    expect(component.errorMessage).toBeTruthy();
    expect(component.loading).toBeFalse();
  }));

  it('should set loading=true during request and false after', fakeAsync(() => {
    const subject = new Subject<any>();
    authService.login.and.returnValue(subject.asObservable());
    spyOn(router, 'navigate');
    component.form.setValue({ email: 'a@b.com', password: '1234' });

    component.submit();
    expect(component.loading).toBeTrue();

    subject.next({ accessToken: 'tok', user: { id: 1, email: 'a@b.com', role: 'ADMIN' } });
    subject.complete();
    tick();
    expect(component.loading).toBeFalse();
  }));
});
