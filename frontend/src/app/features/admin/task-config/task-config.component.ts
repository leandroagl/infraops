import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TaskConfigService } from '../../../core/services/task-config.service';
import { TaskTypeConfigDto } from '../../../core/models/task.models';
import { TaskEditDialogComponent } from './task-edit-dialog/task-edit-dialog.component';

@Component({
  selector: 'app-task-config',
  templateUrl: './task-config.component.html',
  styleUrl: './task-config.component.scss',
})
export class TaskConfigComponent implements OnInit {
  configs: TaskTypeConfigDto[] = [];
  displayedColumns = ['taskType', 'defaultTimeMinutes', 'odooTags', 'actions'];
  loading = true;

  constructor(
    private taskConfigService: TaskConfigService,
    private dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.taskConfigService.getAll().subscribe({
      next: configs => { this.configs = configs; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  openEdit(config: TaskTypeConfigDto): void {
    this.dialog.open(TaskEditDialogComponent, { data: { config }, width: '720px', maxWidth: '90vw' })
      .afterClosed()
      .subscribe((updated: TaskTypeConfigDto | null) => {
        if (updated) this.onConfigUpdated(updated);
      });
  }

  onConfigUpdated(updated: TaskTypeConfigDto): void {
    this.configs = this.configs.map(c =>
      c.taskType === updated.taskType ? { ...updated } : c
    );
  }

  formatMinutes(minutes: number | null): string {
    if (minutes == null) return '— sin configurar';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}:${m.toString().padStart(2, '0')} h`;
  }

  readonly taskTypeLabels: Partial<Record<string, string>> = {
    SERVER_HOST_MAINTENANCE:    'Hosts VMware / BMC',
    WINDOWS_DOMAIN_MAINTENANCE: 'Servidores Windows',
    QNAP_MAINTENANCE:           'QNAP / NAS',
    VEEAM_BACKUP:               'Veeam Backup',
    ROUTER_MAINTENANCE:         'Router / Firewall',
    TERMINAL_MAINTENANCE:       'Terminales',
    SITE_VISIT:                 'Visita presencial',
    AV_CONTROL:                 'Control de antivirus',
    UPS_CONTROL:                'Control de UPS',
    ENDPOINT_INVENTORY:         'Inventario de endpoints',
  };
}
