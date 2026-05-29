import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AuthUser } from '../models/auth.models';

interface NavItem {
  route: string;
  label: string;
  icon: 'dashboard' | 'admin';
}

@Component({
  selector: 'app-shell',
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  readonly navItems: NavItem[] = [
    { route: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { route: '/admin',     label: 'Admin',      icon: 'admin'     },
  ];

  readonly currentUser: AuthUser | null;

  constructor(private router: Router, private auth: AuthService) {
    this.currentUser = this.auth.getCurrentUser();
  }

  isActive(route: string): boolean {
    return this.router.isActive(route, {
      paths: 'subset',
      queryParams: 'ignored',
      fragment: 'ignored',
      matrixParams: 'ignored',
    });
  }

  logout(): void {
    this.auth.logout();
  }
}
