import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { User, CreateUserPayload, UpdateUserPayload } from '../../../../core/models/user.models';
import { UserRole } from '../../../../core/models/auth.models';
import { UsersService } from '../../../../core/services/users.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export interface UserFormDialogData {
  mode: 'create' | 'edit';
  user?: User;
}

@Component({
  selector: 'app-user-form-dialog',
  templateUrl: './user-form-dialog.component.html',
})
export class UserFormDialogComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  loading = false;
  error = '';
  private destroy$ = new Subject<void>();

  readonly roles: { value: UserRole; label: string }[] = [
    { value: 'ADMIN',       label: 'Admin' },
    { value: 'TL',          label: 'Team Lead' },
    { value: 'COORDINATOR', label: 'Coordinador' },
    { value: 'TECHNICIAN',  label: 'Técnico' },
  ];

  constructor(
    private fb: FormBuilder,
    private usersService: UsersService,
    private dialogRef: MatDialogRef<UserFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: UserFormDialogData,
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void {
    const u = this.data.user;
    this.form = this.fb.group({
      name:  [u?.name  ?? '', Validators.required],
      email: [u?.email ?? '', [Validators.required, Validators.email]],
      role:  [u?.role  ?? 'TECHNICIAN', Validators.required],
    });
    if (this.data.mode === 'edit') {
      this.form.get('email')?.disable();
    }
  }

  submit(): void {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';

    if (this.data.mode === 'create') {
      const payload: CreateUserPayload = this.form.getRawValue();
      this.usersService.create(payload).pipe(takeUntil(this.destroy$)).subscribe({
        next: res => {
          this.loading = false;
          this.dialogRef.close({ name: res.name, plainPassword: res.plainPassword });
        },
        error: err => {
          this.loading = false;
          this.error = err.error?.message ?? 'No se pudo crear el usuario.';
        },
      });
    } else {
      const payload: UpdateUserPayload = {
        name: this.form.value.name,
        role: this.form.value.role,
      };
      this.usersService.update(this.data.user!.id, payload).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.loading = false;
          this.dialogRef.close(true);
        },
        error: err => {
          this.loading = false;
          this.error = err.error?.message ?? 'No se pudo actualizar el usuario.';
        },
      });
    }
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
