import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BackupsService } from '../../../features/backups/services/backups.service';
import { BackupsConfigDialogComponent } from './backups-config-dialog/backups-config-dialog.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
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
  private readonly destroyRef = inject(DestroyRef);

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
    this.svc.listConfigs().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: configs => { this.configs = configs; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  openDialog(config?: BackupConfig): void {
    this.dialog
      .open(BackupsConfigDialogComponent, { data: config ?? null, width: '520px' })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(saved => { if (saved) this.load(); });
  }

  testConnection(config: VeeamClientConfig): void {
    this.svc.testConnection(config.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
    const message = config.provider === 'JETBACKUP'
      ? `¿Eliminar configuración de ${config.clientName} — ${config.jobName}?`
      : config.provider === 'ACRONIS'
        ? `¿Eliminar configuración de ${config.clientName} — ${config.policyName}?`
        : `¿Eliminar configuración de ${config.clientName || config.host}?`;

    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Eliminar configuración', message },
      width: '420px',
    }).afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(confirmed => {
      if (!confirmed) return;
      const call$ = config.provider === 'JETBACKUP'
        ? this.svc.deleteJetbackupConfig(config.id)
        : config.provider === 'ACRONIS'
          ? this.svc.deleteAcronisConfig(config.id)
          : this.svc.deleteConfig(config.id);
      call$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
    });
  }
}
