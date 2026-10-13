import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BackupsService } from '../../../features/backups/services/backups.service';
import { BackupsConfigDialogComponent } from './backups-config-dialog/backups-config-dialog.component';
import type { BackupConfig, VeeamClientConfig } from '../../../features/backups/models/backup.models';

@Component({
  selector: 'app-backups-config',
  templateUrl: './backups-config.component.html',
  styleUrl: './backups-config.component.scss',
})
export class BackupsConfigComponent implements OnInit {
  configs: BackupConfig[] = [];
  loading = false;
  readonly displayedColumns = ['clientName', 'provider', 'host', 'port', 'isEnabled', 'actions'];

  constructor(
    private readonly svc: BackupsService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.svc.listConfigs().subscribe({
      next: configs => { this.configs = configs; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  openDialog(config?: BackupConfig): void {
    this.dialog
      .open(BackupsConfigDialogComponent, { data: config ?? null, width: '520px' })
      .afterClosed()
      .subscribe(saved => { if (saved) this.load(); });
  }

  testConnection(config: VeeamClientConfig): void {
    this.svc.testConnection(config.id).subscribe({
      next:  result => this.snackBar.open(result.message, 'Cerrar', { duration: 5000 }),
      error: ()     => this.snackBar.open('Error al conectar', 'Cerrar', { duration: 4000 }),
    });
  }

  providerLabel(config: BackupConfig): string {
    switch (config.provider) {
      case 'JETBACKUP': return 'JetBackup';
      case 'ACRONIS':   return 'Acronis';
      default:          return 'Veeam';
    }
  }

  // Columna "Host / Job / Plan": qué se monitorea en cada fila.
  detailLabel(config: BackupConfig): string {
    switch (config.provider) {
      case 'JETBACKUP': return config.jobName;
      case 'ACRONIS':   return config.tenantName ? `${config.policyName} · ${config.tenantName}` : config.policyName;
      default:          return config.host;
    }
  }

  delete(config: BackupConfig): void {
    switch (config.provider) {
      case 'JETBACKUP':
        if (!confirm(`¿Eliminar configuración de ${config.clientName} — ${config.jobName}?`)) return;
        this.svc.deleteJetbackupConfig(config.id).subscribe(() => this.load());
        return;
      case 'ACRONIS':
        if (!confirm(`¿Eliminar configuración de ${config.clientName} — ${config.policyName}?`)) return;
        this.svc.deleteAcronisConfig(config.id).subscribe(() => this.load());
        return;
      default:
        if (!confirm(`¿Eliminar configuración de ${config.clientName || config.host}?`)) return;
        this.svc.deleteConfig(config.id).subscribe(() => this.load());
    }
  }
}
