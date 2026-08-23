import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth.service';
import { UsersService } from '../../core/services/users.service';
import { AuthUser } from '../../core/models/auth.models';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent {
  user: AuthUser | null;
  uploadState: 'idle' | 'uploading' | 'success' | 'error' = 'idle';
  uploadError = '';

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly auth: AuthService,
    private readonly usersService: UsersService,
  ) {
    this.user = auth.getCurrentUser();
    this.auth.user$.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(u => { this.user = u; });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      this.uploadState = 'error';
      this.uploadError = 'Solo se permiten archivos JPG, PNG o WEBP.';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      this.uploadState = 'error';
      this.uploadError = 'El archivo no puede superar los 2 MB.';
      return;
    }

    this.uploadState = 'uploading';
    this.uploadError = '';
    this.usersService.uploadAvatar(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updatedUser) => {
          this.uploadState = 'success';
          this.auth.refreshCurrentUser(updatedUser);
        },
        error: () => {
          this.uploadState = 'error';
          this.uploadError = 'No se pudo subir la imagen. Intentá de nuevo.';
        },
      });
  }
}
