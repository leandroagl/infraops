import { Component, DestroyRef, inject, OnInit, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatSidenavContainer } from '@angular/material/sidenav';
import { AuthService } from '../services/auth.service';
import { AuthUser } from '../models/auth.models';
import { SidenavContextService, ClientSidenavContext } from '../services/sidenav-context.service';

interface NavItem {
  route: string;
  label: string;
  icon: 'dashboard' | 'clients' | 'tasks' | 'admin';
}

@Component({
  selector: 'app-shell',
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit {
  readonly navItems: NavItem[] = [
    { route: '/dashboard', label: 'Dashboard',  icon: 'dashboard' },
    { route: '/clients',   label: 'Clientes',   icon: 'clients'   },
    { route: '/tasks',     label: 'Mis tareas', icon: 'tasks'     },
    { route: '/admin',     label: 'Admin',      icon: 'admin'     },
  ];

  @ViewChild(MatSidenavContainer) private readonly sidenavContainer!: MatSidenavContainer;

  private readonly destroyRef = inject(DestroyRef);

  readonly currentUser: AuthUser | null;
  clientContext: ClientSidenavContext | null = null;

  constructor(
    private readonly router: Router,
    private readonly auth: AuthService,
    private readonly sidenavCtx: SidenavContextService,
  ) {
    this.currentUser = this.auth.getCurrentUser();
  }

  ngOnInit(): void {
    this.sidenavCtx.client$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(ctx => {
        this.clientContext = ctx;
        // mat-sidenav width cambia via CSS class; Angular Material no detecta
        // el cambio automáticamente en v17, forzamos el recálculo del margen.
        setTimeout(() => this.sidenavContainer?.updateContentMargins());
      });
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
