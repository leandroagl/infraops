import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { User } from '../../../core/models/user.models';
import { UserRole } from '../../../core/models/auth.models';
import { UsersService } from '../../../core/services/users.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserFormDialogComponent } from './user-form-dialog/user-form-dialog.component';
import { PasswordDisplayDialogComponent } from './password-display-dialog/password-display-dialog.component';

const SEED_ADMIN_EMAIL = 'admininfraops@ondra.com.ar';

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent implements OnInit, OnDestroy {
  users: User[] = [];
  loading = false;
  error = '';

  private readonly currentUserId: string;
  private destroy$ = new Subject<void>();

  constructor(
    private usersService: UsersService,
    private authService: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {
    this.currentUserId = this.authService.getCurrentUser()?.id ?? '';
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadUsers(): void {
    this.loading = true;
    this.error = '';
    this.usersService.getAll().subscribe({
      next: users => {
        this.users = users;
        this.loading = false;
      },
      error: () => {
        this.error = 'No se pudieron cargar los usuarios.';
        this.loading = false;
      },
    });
  }

  isSeedAdmin(user: User): boolean {
    return user.email === SEED_ADMIN_EMAIL;
  }

  isCurrentUser(user: User): boolean {
    return !!this.currentUserId && user.id === this.currentUserId;
  }

  roleBadgeClass(role: UserRole): string {
    const map: Record<UserRole, string> = {
      ADMIN:       'badge--accent',
      TL:          'badge--srv',
      COORDINATOR: 'badge--purple',
      TECHNICIAN:  'badge--neutral',
    };
    return map[role];
  }

  roleLabel(role: UserRole): string {
    const labels: Record<UserRole, string> = {
      ADMIN:       'Admin',
      TL:          'Team Lead',
      COORDINATOR: 'Coordinador',
      TECHNICIAN:  'Técnico',
    };
    return labels[role];
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(UserFormDialogComponent, {
      data: { mode: 'create' },
      width: '480px',
    });
    ref.afterClosed().pipe(takeUntil(this.destroy$)).subscribe(result => {
      if (!result) return;
      this.loadUsers();
      if (result.plainPassword) {
        this.dialog.open(PasswordDisplayDialogComponent, {
          data: { name: result.name, plainPassword: result.plainPassword },
          width: '420px',
        });
      }
    });
  }

  openEditDialog(user: User): void {
    this.dialog
      .open(UserFormDialogComponent, { data: { mode: 'edit', user }, width: '480px' })
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe(updated => { if (updated) this.loadUsers(); });
  }

  toggleStatus(user: User): void {
    this.usersService.updateStatus(user.id, !user.isActive).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.loadUsers(),
      error: () =>
        this.snackBar.open('No se pudo actualizar el estado.', '', {
          duration: 3000,
          panelClass: 'snack-error',
        }),
    });
  }

  resetPassword(user: User): void {
    this.usersService.resetPassword(user.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: res =>
        this.dialog.open(PasswordDisplayDialogComponent, {
          data: { name: user.name, plainPassword: res.plainPassword },
          width: '420px',
        }),
      error: () =>
        this.snackBar.open('No se pudo resetear la contraseña.', '', {
          duration: 3000,
          panelClass: 'snack-error',
        }),
    });
  }
}
