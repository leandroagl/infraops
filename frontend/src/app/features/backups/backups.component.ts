import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { BackupsService } from './services/backups.service';
import type { ClientBackup } from './models/backup.models';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-backups',
  templateUrl: './backups.component.html',
  styleUrl: './backups.component.scss',
})
export class BackupsComponent implements OnInit, OnDestroy {
  clients: ClientBackup[] = [];
  selectedClient: ClientBackup | null = null;
  drawerOpen = false;
  loading = false;
  kpi = { total: 0, ok: 0, warn: 0, crit: 0, noData: 0 };
  private sub?: Subscription;

  constructor(
    private readonly svc: BackupsService,
    private readonly snackBar: MatSnackBar,
    private readonly router: Router,
    private readonly auth: AuthService,
  ) {}

  get isAdmin(): boolean { return this.auth.getCurrentUser()?.role === 'ADMIN'; }

  ngOnInit(): void { this.load(); }
  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  load(): void {
    this.loading = true;
    this.sub = this.svc.getAll().subscribe({
      next: clients => {
        this.clients = clients;
        this.kpi = {
          total: clients.length,
          ok: clients.filter(c => c.status === 'ok').length,
          warn: clients.filter(c => c.status === 'warn').length,
          crit: clients.filter(c => c.status === 'crit').length,
          noData: clients.filter(c => c.status === 'no_data').length,
        };
        this.loading = false;
      },
      error: () => {
        this.snackBar.open('Error al cargar backups', 'Cerrar', { duration: 3000 });
        this.loading = false;
      },
    });
  }

  selectClient(client: ClientBackup): void {
    this.selectedClient = client;
    this.drawerOpen = true;
  }

  closeDrawer(): void {
    this.drawerOpen = false;
    this.selectedClient = null;
  }

  openConfig(): void { this.router.navigate(['/admin/backups']); }
}
