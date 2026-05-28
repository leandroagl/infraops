import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { UsersComponent } from './users.component';
import { UsersService } from '../../../core/services/users.service';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../core/models/user.models';

const seedAdmin: User = {
  id: 'seed-id',
  name: 'Admin ONDRA',
  email: 'admininfraops@ondra.com.ar',
  role: 'ADMIN',
  mustChangePassword: false,
  isActive: true,
  technicianId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const techUser: User = {
  id: 'user-2',
  name: 'Valen Técnico',
  email: 'valen@ondra.com.ar',
  role: 'TECHNICIAN',
  mustChangePassword: false,
  isActive: true,
  technicianId: 'tech-1',
  createdAt: '2026-01-15T00:00:00.000Z',
};

describe('UsersComponent', () => {
  let component: UsersComponent;
  let fixture: ComponentFixture<UsersComponent>;
  let usersServiceSpy: jasmine.SpyObj<UsersService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let dialog: MatDialog;

  beforeEach(async () => {
    usersServiceSpy = jasmine.createSpyObj('UsersService', [
      'getAll', 'updateStatus', 'resetPassword',
    ]);
    authServiceSpy = jasmine.createSpyObj('AuthService', ['getCurrentUser']);
    usersServiceSpy.getAll.and.returnValue(of([seedAdmin, techUser]));
    authServiceSpy.getCurrentUser.and.returnValue({
      id: 'current-id', email: 'current@ondra.com.ar', role: 'ADMIN',
    });

    await TestBed.configureTestingModule({
      declarations: [UsersComponent],
      imports: [MatDialogModule, MatMenuModule, MatSnackBarModule, NoopAnimationsModule],
      providers: [
        { provide: UsersService, useValue: usersServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UsersComponent);
    component = fixture.componentInstance;
    dialog = TestBed.inject(MatDialog);
    fixture.detectChanges();
  });

  it('carga usuarios en ngOnInit', () => {
    expect(usersServiceSpy.getAll).toHaveBeenCalledTimes(1);
    expect(component.users).toEqual([seedAdmin, techUser]);
  });

  it('setea error y loading=false cuando getAll falla', () => {
    usersServiceSpy.getAll.and.returnValue(throwError(() => new Error('Network')));
    component.loadUsers();
    expect(component.error).toBeTruthy();
    expect(component.loading).toBeFalse();
  });

  describe('isSeedAdmin()', () => {
    it('devuelve true para el email del seed admin', () => {
      expect(component.isSeedAdmin(seedAdmin)).toBeTrue();
    });
    it('devuelve false para otros usuarios', () => {
      expect(component.isSeedAdmin(techUser)).toBeFalse();
    });
  });

  describe('isCurrentUser()', () => {
    it('devuelve true cuando el id coincide con el usuario logueado', () => {
      const me: User = { ...techUser, id: 'current-id' };
      expect(component.isCurrentUser(me)).toBeTrue();
    });
    it('devuelve false para otros usuarios', () => {
      expect(component.isCurrentUser(techUser)).toBeFalse();
    });
  });

  describe('roleBadgeClass()', () => {
    it('ADMIN → badge--accent',       () => expect(component.roleBadgeClass('ADMIN')).toBe('badge--accent'));
    it('TL → badge--srv',             () => expect(component.roleBadgeClass('TL')).toBe('badge--srv'));
    it('COORDINATOR → badge--purple', () => expect(component.roleBadgeClass('COORDINATOR')).toBe('badge--purple'));
    it('TECHNICIAN → badge--neutral', () => expect(component.roleBadgeClass('TECHNICIAN')).toBe('badge--neutral'));
  });

  describe('toggleStatus()', () => {
    it('chama updateStatus con el id y el estado invertido', () => {
      usersServiceSpy.updateStatus.and.returnValue(of({ ...techUser, isActive: false }));
      component.toggleStatus(techUser);
      expect(usersServiceSpy.updateStatus).toHaveBeenCalledWith(techUser.id, false);
    });

    it('llama loadUsers cuando updateStatus tiene éxito', () => {
      usersServiceSpy.updateStatus.and.returnValue(of({ ...techUser, isActive: false }));
      spyOn(component, 'loadUsers').and.callThrough();
      component.toggleStatus(techUser);
      expect(component.loadUsers).toHaveBeenCalled();
    });
  });

  describe('resetPassword()', () => {
    it('llama resetPassword con el id del usuario', () => {
      usersServiceSpy.resetPassword.and.returnValue(of({ plainPassword: 'Test123!' }));
      spyOn(dialog, 'open').and.callThrough();
      component.resetPassword(techUser);
      expect(usersServiceSpy.resetPassword).toHaveBeenCalledWith(techUser.id);
    });

    it('abre PasswordDisplayDialogComponent con la contraseña generada', () => {
      usersServiceSpy.resetPassword.and.returnValue(of({ plainPassword: 'Test123!' }));
      const openSpy = spyOn(dialog, 'open').and.returnValue({
        afterClosed: () => of(null),
      } as any);
      component.resetPassword(techUser);
      expect(openSpy).toHaveBeenCalled();
      const call = openSpy.calls.mostRecent();
      expect(call.args[1]!.data).toEqual({ name: techUser.name, plainPassword: 'Test123!' });
    });
  });
});
