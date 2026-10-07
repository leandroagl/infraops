import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BackupsService } from '../../../features/backups/services/backups.service';
import { BackupsConfigDialogComponent } from './backups-config-dialog/backups-config-dialog.component';
import type { VeeamClientConfig } from '../../../features/backups/models/backup.models';

@Component({
  selector: 'app-backups-config',
  templateUrl: './backups-config.component.html',
  styleUrl: './backups-config.component.scss',
})
export class BackupsConfigComponent implements OnInit {
  configs: VeeamClientConfig[] = [];
  loading = false;
  readonly displayedColumns = ['clientName', 'host', 'port', 'username', 'isEnabled', 'actions'];

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

  openDialog(config?: VeeamClientConfig): void {
    this.dialog
      .open(BackupsConfigDialogComponent, { data: config ?? null, width: '520px' })
      .afterClosed()
      .subscribe(saved => { if (saved) this.load(); });
  }

  testConnection(config: VeeamClientConfig): void {
    this.svc.testConnection(config.id).subscribe(result => {
      this.snackBar.open(result.message, 'Cerrar', { duration: 5000 });
    });
  }

  delete(config: VeeamClientConfig): void {
    if (!confirm(`¿Eliminar configuración de ${config.clientName || config.host}?`)) return;
    this.svc.deleteConfig(config.id).subscribe(() => this.load());
  }
}
