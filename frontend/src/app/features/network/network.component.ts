import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatTableDataSource } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NetworkService } from '../../core/services/network.service';
import type { NetworkAlert, AlertSeverity } from '../../core/models/network.models';

@Component({
  selector: 'app-network',
  templateUrl: './network.component.html',
  styleUrl: './network.component.scss',
})
export class NetworkComponent implements OnInit {
  dataSource = new MatTableDataSource<NetworkAlert>([]);
  displayedColumns = ['clientName', 'siteName', 'severity', 'type', 'message', 'createdAt', 'odooTicketId'];
  selectedAlert: NetworkAlert | null = null;
  drawerOpen = false;
  loading = false;
  filterClient = '';
  filterSeverity: AlertSeverity | '' = '';
  filterHasTicket: 'all' | 'with' | 'without' = 'all';
  kpi = { total: 0, critical: 0, affectedClients: 0 };
  private allAlerts: NetworkAlert[] = [];
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly svc: NetworkService,
    private readonly snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.svc.getAlerts().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: alerts => {
        this.allAlerts = alerts;
        this.applyFilters();
        this.updateKpi();
        this.loading = false;
      },
      error: () => {
        this.snackBar.open('Error al cargar alertas', 'Cerrar', { duration: 3000 });
        this.loading = false;
      },
    });
  }

  applyFilters(): void {
    this.dataSource.data = this.allAlerts.filter(a => {
      if (this.filterClient && !a.clientName.toLowerCase().includes(this.filterClient.toLowerCase())) return false;
      if (this.filterSeverity && a.severity !== this.filterSeverity) return false;
      if (this.filterHasTicket === 'with'    && a.odooTicketId === null) return false;
      if (this.filterHasTicket === 'without' && a.odooTicketId !== null) return false;
      return true;
    });
  }

  private updateKpi(): void {
    this.kpi = {
      total: this.allAlerts.length,
      critical: this.allAlerts.filter(a => a.severity === 'critical').length,
      affectedClients: new Set(this.allAlerts.map(a => a.clientId)).size,
    };
  }

  selectRow(alert: NetworkAlert): void {
    this.selectedAlert = alert;
    this.drawerOpen = true;
  }

  closeDrawer(): void { this.drawerOpen = false; this.selectedAlert = null; }

  onTicketCreated(updated: NetworkAlert): void {
    const idx = this.allAlerts.findIndex(a => a.alertId === updated.alertId);
    if (idx !== -1) this.allAlerts[idx] = { ...this.allAlerts[idx], odooTicketId: updated.odooTicketId };
    this.applyFilters();
    this.updateKpi();
    this.closeDrawer();
  }

  timeAgo(iso: string): string {
    const h = Math.round((Date.now() - new Date(iso).getTime()) / 3600000);
    return h < 1 ? '<1h' : `${h}h`;
  }
}
