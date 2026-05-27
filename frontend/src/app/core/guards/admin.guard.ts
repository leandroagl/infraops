import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean {
    const user = this.auth.getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      this.router.navigate(['/dashboard']);
      return false;
    }
    return true;
  }
}
