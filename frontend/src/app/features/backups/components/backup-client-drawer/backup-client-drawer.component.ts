import { Component, Input, Output, EventEmitter } from '@angular/core';
import type { ClientBackup, BackupJobStatus, BackupItemStatus, BackupProvider } from '../../models/backup.models';

@Component({
  selector: 'app-backup-client-drawer',
  templateUrl: './backup-client-drawer.component.html',
  styleUrl: './backup-client-drawer.component.scss',
})
export class BackupClientDrawerComponent {
  @Input() client: ClientBackup | null = null;
  @Input() open = false;
  @Input() refreshing = false;
  @Output() closed = new EventEmitter<void>();
  @Output() refreshRequest = new EventEmitter<string>();

  readonly displayedColumns = ['name', 'jobType', 'lastResult', 'hoursAgo'];

  expandedJobId: string | null = null;

  get jobs(): BackupJobStatus[] { return this.client?.jobs ?? []; }

  get okCount(): number { return this.jobs.filter(j => j.lastResult === 'Success').length; }
  get warnCount(): number { return this.jobs.filter(j => j.lastResult === 'Warning').length; }
  get critCount(): number { return this.jobs.filter(j => j.lastResult === 'Failed').length; }

  resultClass(result: string | null): string {
    if (result === 'Success') return 'chip--ok';
    if (result === 'Warning') return 'chip--warn';
    if (result === 'Failed')  return 'chip--crit';
    return 'chip--neutral';
  }

  rowClass(job: BackupJobStatus): string {
    if (job.isRunning)                return 'j-running';
    if (job.lastResult === 'Failed')  return 'j-crit';
    if (job.lastResult === 'Warning') return 'j-warn';
    if (job.lastResult === null)      return 'j-neutral';
    return 'j-ok';
  }

  hasDetails(job: BackupJobStatus): boolean {
    return (job.items?.length ?? 0) > 0 || !!job.aggregate;
  }

  canExpand(job: BackupJobStatus): boolean {
    return (!!job.lastMessage && (job.lastResult === 'Warning' || job.lastResult === 'Failed')) || this.hasDetails(job);
  }

  // Un fallo duro se muestra con su código (error, cancelled…): la antigüedad en ese caso es un valor centinela.
  itemMeta(item: BackupItemStatus): string {
    if (item.lastCode !== 'ok' && item.lastCode !== 'warning') return item.lastCode;
    return `${item.hoursSinceOk.toFixed(1)}h`;
  }

  isExpanded(job: BackupJobStatus): boolean {
    return this.expandedJobId === job.jobId;
  }

  toggleJob(job: BackupJobStatus): void {
    if (!this.canExpand(job)) return;
    this.expandedJobId = this.isExpanded(job) ? null : job.jobId;
  }

  hoursClass(job: BackupJobStatus): string {
    return job.isStale ? 'hours--stale' : '';
  }

  hoursLabel(job: BackupJobStatus): string {
    if (job.hoursAgo === null) return '—';
    return `${job.hoursAgo.toFixed(1)}h`;
  }

  providerLabel(job: BackupJobStatus): string {
    const labels: Record<BackupProvider, string> = { VEEAM: 'Veeam', ACRONIS: 'Acronis', JETBACKUP: 'JetBackup' };
    return labels[job.provider];
  }
}
