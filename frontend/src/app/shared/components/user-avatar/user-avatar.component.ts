import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-user-avatar',
  templateUrl: './user-avatar.component.html',
  styleUrls: ['./user-avatar.component.scss'],
})
export class UserAvatarComponent {
  @Input() name = '';
  @Input() avatarUrl: string | null = null;
  @Input() size: 'sm' | 'md' | 'lg' = 'sm';

  showFallback = false;

  get initials(): string {
    return this.name?.trim().charAt(0).toUpperCase() || '?';
  }

  get colorClass(): string {
    const palette = ['cyan', 'blue', 'purple', 'ok', 'warn'];
    return `av--${palette[(this.name?.charCodeAt(0) ?? 0) % palette.length]}`;
  }

  onImageError(): void {
    this.showFallback = true;
  }
}
