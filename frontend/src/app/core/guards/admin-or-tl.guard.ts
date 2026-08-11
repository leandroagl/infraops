import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AdminOrTlGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean {
    const user = this.auth.getCurrentUser();
    if (!user) {
      this.router.navigate(['/login']);
      return false;
    }
    if (user.role !== 'ADMIN' && user.role !== 'TL') {
      this.router.navigate(['/dashboard']);
      return false;
    }
    return true;
  }
}
