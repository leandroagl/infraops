import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { UsersComponent } from './users.component';
import { UsersService } from '../../../core/services/users.service';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../core/models/user.models';
import { SharedModule } from '../../../shared/shared.module';

const seedAdmin: User = {
  id: 'seed-id',
  name: 'Admin ONDRA',
  email: 'admininfraops@ondra.com.ar',
  role: 'ADMIN',
  mustChangePassword: false,
  isActive: true,
  technicianId: null,
  avatarUrl: null,
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
  avatarUrl: null,
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
      'getAll', 'updateStatus', 'resetPassword', 'remove',
    ]);
    authServiceSpy = jasmine.createSpyObj('AuthService', ['getCurrentUser']);
    usersServiceSpy.getAll.and.returnValue(of([seedAdmin, techUser]));
    authServiceSpy.getCurrentUser.and.returnValue({
      id: 'current-id', name: 'Current Admin', email: 'current@ondra.com.ar', role: 'ADMIN', technicianId: null, avatarUrl: null,
    });

    await TestBed.configureTestingModule({
      declarations: [UsersComponent],
      imports: [
        MatDialogModule,
        MatMenuModule,
        MatSnackBarModule,
        MatTableModule,
        MatProgressBarModule,
        NoopAnimationsModule,
        SharedModule,
      ],
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

  describe('deleteUser()', () => {
    it('no elimina si se cancela el diálogo de confirmación', () => {
      spyOn(dialog, 'open').and.returnValue({ afterClosed: () => of(false) } as any);

      component.deleteUser(techUser);

      expect(usersServiceSpy.remove).not.toHaveBeenCalled();
    });

    it('llama a usersService.remove cuando se confirma', () => {
      spyOn(dialog, 'open').and.returnValue({ afterClosed: () => of(true) } as any);
      usersServiceSpy.remove.and.returnValue(of({ ok: true }));

      component.deleteUser(techUser);

      expect(usersServiceSpy.remove).toHaveBeenCalledWith(techUser.id);
    });

    it('quita el usuario del array local sin recargar desde la API', () => {
      spyOn(dialog, 'open').and.returnValue({ afterClosed: () => of(true) } as any);
      usersServiceSpy.remove.and.returnValue(of({ ok: true }));
      component.users = [seedAdmin, techUser];

      component.deleteUser(techUser);

      expect(component.users).toEqual([seedAdmin]);
      expect(usersServiceSpy.getAll).toHaveBeenCalledTimes(1); // solo la carga inicial
    });

    it('muestra el mensaje de error del backend si la eliminación falla', () => {
      spyOn(dialog, 'open').and.returnValue({ afterClosed: () => of(true) } as any);
      usersServiceSpy.remove.and.returnValue(
        throwError(() => ({ error: { message: 'Este usuario tiene un perfil técnico vinculado.' } })),
      );
      const snackBar = TestBed.inject(MatSnackBar);
      const snackSpy = spyOn(snackBar, 'open');

      component.deleteUser(techUser);

      expect(snackSpy).toHaveBeenCalledWith(
        'Este usuario tiene un perfil técnico vinculado.',
        '',
        jasmine.any(Object),
      );
    });
  });
});
