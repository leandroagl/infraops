import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatTableDataSource } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NetworkService } from '../../core/services/network.service';
import type { NetworkAlert, ClientOfflineAlert, AlertSeverity } from '../../core/models/network.models';

@Component({
  selector: 'app-network',
  templateUrl: './network.component.html',
  styleUrl: './network.component.scss',
})
export class NetworkComponent implements OnInit {
  dataSource = new MatTableDataSource<ClientOfflineAlert>([]);
  displayedColumns = ['clientName', 'severity', 'deviceCount', 'lastSeen'];
  selectedClient: ClientOfflineAlert | null = null;
  drawerOpen = false;
  loading = false;
  filterClient = '';
  filterSeverity: AlertSeverity | '' = '';
  kpi = { total: 0, critical: 0, high: 0, affectedClients: 0 };

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
    const grouped = this.groupByClient(this.allAlerts);
    this.dataSource.data = grouped.filter(c => {
      if (this.filterClient && !c.clientName.toLowerCase().includes(this.filterClient.toLowerCase())) return false;
      if (this.filterSeverity && c.severity !== this.filterSeverity) return false;
      return true;
    });
  }

  private groupByClient(alerts: NetworkAlert[]): ClientOfflineAlert[] {
    const map = new Map<string, ClientOfflineAlert>();
    for (const a of alerts) {
      if (!map.has(a.clientId)) {
        map.set(a.clientId, { clientId: a.clientId, clientName: a.clientName, devices: [], severity: 'high', lastSeen: a.lastSeen });
      }
      const client = map.get(a.clientId)!;
      client.devices.push({ alertId: a.alertId, siteId: a.siteId, siteName: a.siteName, deviceName: a.deviceName, deviceModel: a.deviceModel, type: a.type, severity: a.severity, lastSeen: a.lastSeen });
      if (a.severity === 'critical') client.severity = 'critical';
      if (a.lastSeen > client.lastSeen) client.lastSeen = a.lastSeen;
    }
    return Array.from(map.values());
  }

  private updateKpi(): void {
    this.kpi = {
      total: this.allAlerts.length,
      critical: this.allAlerts.filter(a => a.severity === 'critical').length,
      high: this.allAlerts.filter(a => a.severity === 'high').length,
      affectedClients: new Set(this.allAlerts.map(a => a.clientId)).size,
    };
  }

  toggleSeverity(severity: AlertSeverity): void {
    this.filterSeverity = this.filterSeverity === severity ? '' : severity;
    this.applyFilters();
  }

  clearFilters(): void {
    this.filterClient = '';
    this.filterSeverity = '';
    this.applyFilters();
  }

  selectRow(client: ClientOfflineAlert): void {
    this.selectedClient = client;
    this.drawerOpen = true;
  }

  closeDrawer(): void { this.drawerOpen = false; this.selectedClient = null; }

  lastSeenLabel(iso: string): string {
    const h = Math.round((Date.now() - new Date(iso).getTime()) / 3600000);
    if (h < 1) return '<1h';
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  }
}
