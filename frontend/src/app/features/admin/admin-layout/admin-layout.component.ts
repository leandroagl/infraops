import { Component } from '@angular/core';
import { Router } from '@angular/router';

interface AdminTab {
  path: string;
  label: string;
}

@Component({
  selector: 'app-admin-layout',
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
})
export class AdminLayoutComponent {
  readonly tabs: AdminTab[] = [
    { path: '/admin/users',       label: 'Usuarios'  },
    { path: '/admin/technicians', label: 'Técnicos'  },
  ];

  constructor(private router: Router) {}

  isActive(path: string): boolean {
    return this.router.isActive(path, {
      paths: 'exact',
      queryParams: 'ignored',
      fragment: 'ignored',
      matrixParams: 'ignored',
    });
  }
}
