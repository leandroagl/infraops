import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { BackupsService } from './services/backups.service';
import type { ClientBackup, ClientBackupStatus } from './models/backup.models';
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
  drawerRefreshing = false;
  staleSince: string | null = null;
  kpi = { total: 0, ok: 0, warn: 0, crit: 0, noData: 0 };
  statusFilter: ClientBackupStatus | null = null;
  private subs: Subscription[] = [];

  get filteredClients(): ClientBackup[] {
    if (!this.statusFilter) return this.clients;
    if (this.statusFilter === 'no_data') {
      return this.clients.filter(c => c.status === 'no_data' || c.status === 'disconnected');
    }
    return this.clients.filter(c => c.status === this.statusFilter);
  }

  constructor(
    private readonly svc: BackupsService,
    private readonly snackBar: MatSnackBar,
    private readonly router: Router,
    private readonly auth: AuthService,
  ) {}

  get isAdmin(): boolean { return this.auth.getCurrentUser()?.role === 'ADMIN'; }

  ngOnInit(): void { this.load(); }

  ngOnDestroy(): void { this.subs.forEach(s => s.unsubscribe()); }

  // Al abrir el módulo se usa el último snapshot guardado (el cron lo actualiza una vez al día).
  // Solo se consulta en vivo si todavía no hay ninguno; después, únicamente vía refresh().
  load(): void {
    this.loading = true;
    const snapSub = this.svc.getSnapshot().subscribe({
      next: snapshot => {
        if (!snapshot.length) {
          this.loadLive();
          return;
        }
        this.clients = snapshot;
        this.staleSince = this.computeStaleSince(snapshot);
        this.updateKpi();
        this.loading = false;
      },
      error: () => this.loadLive(),
    });
    this.subs.push(snapSub);
  }

  refresh(): void {
    this.loading = true;
    this.loadLive();
  }

  // Fecha (YYYY-MM-DD) del snapshot más reciente si tiene 2+ días de diferencia calendario con hoy.
  // Se compara por día y no por 24h: snapshotDate no trae hora y el cron corre a las 7am.
  private computeStaleSince(clients: ClientBackup[]): string | null {
    const dates = clients.filter(c => c.isSnapshot).map(c => c.lastReadAt);
    if (!dates.length) return null;
    const latest = dates.reduce((a, b) => (a > b ? a : b));
    const today = new Date().toISOString().split('T')[0];
    const days = (Date.parse(today) - Date.parse(latest)) / 86400000;
    return days >= 2 ? latest : null;
  }

  private loadLive(): void {
    const liveSub = this.svc.getAll().subscribe({
      next: clients => {
        this.clients = clients;
        this.staleSince = null;
        this.updateKpi();
        this.loading = false;
      },
      error: () => {
        this.snackBar.open('Error al cargar backups', 'Cerrar', { duration: 3000 });
        this.loading = false;
      },
    });
    this.subs.push(liveSub);
  }

  private updateKpi(): void {
    this.kpi = {
      total: this.clients.length,
      ok: this.clients.filter(c => c.status === 'ok').length,
      warn: this.clients.filter(c => c.status === 'warn').length,
      crit: this.clients.filter(c => c.status === 'crit').length,
      noData: this.clients.filter(c => c.status === 'no_data' || c.status === 'disconnected').length,
    };
  }

  selectClient(client: ClientBackup): void {
    this.selectedClient = client;
    this.drawerOpen = true;
  }

  closeDrawer(): void {
    this.drawerOpen = false;
    this.selectedClient = null;
  }

  onDrawerRefresh(clientId: string): void {
    this.drawerRefreshing = true;
    const sub = this.svc.getOne(clientId).subscribe({
      next: updated => {
        const idx = this.clients.findIndex(c => c.clientId === clientId);
        if (idx !== -1) {
          this.clients[idx] = updated;
          this.updateKpi();
        }
        this.selectedClient = updated;
        this.drawerRefreshing = false;
      },
      error: () => {
        this.snackBar.open('Error al actualizar backup', 'Cerrar', { duration: 3000 });
        this.drawerRefreshing = false;
      },
    });
    this.subs.push(sub);
  }

  toggleStatusFilter(status: ClientBackupStatus | null): void {
    this.statusFilter = this.statusFilter === status ? null : status;
  }

  openConfig(): void { this.router.navigate(['/admin/backups']); }
}
