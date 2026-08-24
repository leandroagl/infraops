import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { ProfileComponent } from './profile.component';
import { SharedModule } from '../../shared/shared.module';
import { AuthService } from '../../core/services/auth.service';
import { UsersService } from '../../core/services/users.service';
import { AuthUser } from '../../core/models/auth.models';

const mockUser: AuthUser = {
  id: '1', name: 'Valentina', email: 'v@ondra.com.ar', role: 'TECHNICIAN', technicianId: null, avatarUrl: null,
};

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;

  beforeEach(async () => {
    const authService = jasmine.createSpyObj('AuthService', ['getCurrentUser', 'refreshCurrentUser', 'logout'], {
      user$: of(mockUser),
    });
    authService.getCurrentUser.and.returnValue(mockUser);

    await TestBed.configureTestingModule({
      declarations: [ProfileComponent],
      imports: [
        CommonModule,
        NoopAnimationsModule,
        HttpClientTestingModule,
        RouterTestingModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        MatSnackBarModule,
        SharedModule,
      ],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: UsersService, useValue: jasmine.createSpyObj('UsersService', ['uploadAvatar', 'getUsers']) },
      ],
    }).compileComponents();

    fixture   = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carga el usuario desde AuthService al inicializar', () => {
    expect(component.user).toEqual(mockUser);
  });
});

const mockUser2: AuthUser = {
  id: 'u1', name: 'Leandro', email: 'l@test.com',
  role: 'ADMIN' as any, technicianId: null, avatarUrl: null,
};

describe('ProfileComponent — avatar upload', () => {
  let fixture: ComponentFixture<ProfileComponent>;
  let component: ProfileComponent;
  let authService: jasmine.SpyObj<AuthService>;
  let usersService: jasmine.SpyObj<UsersService>;

  beforeEach(async () => {
    authService = jasmine.createSpyObj('AuthService', ['getCurrentUser', 'refreshCurrentUser', 'logout'], {
      user$: of(mockUser2),
    });
    authService.getCurrentUser.and.returnValue(mockUser2);
    usersService = jasmine.createSpyObj('UsersService', ['uploadAvatar', 'getUsers']);

    await TestBed.configureTestingModule({
      imports: [
        NoopAnimationsModule, HttpClientTestingModule, RouterTestingModule,
        MatButtonModule, MatProgressSpinnerModule, MatSnackBarModule, SharedModule,
      ],
      declarations: [ProfileComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: UsersService, useValue: usersService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('rechaza archivos con tipo no permitido', () => {
    const file = new File(['data'], 'malware.exe', { type: 'application/x-msdownload' });
    const event = { target: { files: [file] } } as unknown as Event;
    component.onFileSelected(event);
    expect(component.uploadState).toBe('error');
    expect(usersService.uploadAvatar).not.toHaveBeenCalled();
  });

  it('rechaza archivos mayores a 2MB', () => {
    const bigContent = new Uint8Array(2 * 1024 * 1024 + 1);
    const file = new File([bigContent], 'big.jpg', { type: 'image/jpeg' });
    const event = { target: { files: [file] } } as unknown as Event;
    component.onFileSelected(event);
    expect(component.uploadState).toBe('error');
  });

  it('llama a uploadAvatar y refreshCurrentUser con un archivo válido', () => {
    const updatedUser: AuthUser = { ...mockUser2, avatarUrl: '/avatars/new.jpg' };
    usersService.uploadAvatar.and.returnValue(of(updatedUser));

    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    const event = { target: { files: [file] } } as unknown as Event;
    component.onFileSelected(event);

    expect(usersService.uploadAvatar).toHaveBeenCalledWith(file);
    expect(authService.refreshCurrentUser).toHaveBeenCalledWith(updatedUser);
    expect(component.uploadState).toBe('success');
  });

  it('pone estado error si el upload falla', () => {
    usersService.uploadAvatar.and.returnValue(throwError(() => new Error('fail')));
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    const event = { target: { files: [file] } } as unknown as Event;
    component.onFileSelected(event);
    expect(component.uploadState).toBe('error');
  });
});
