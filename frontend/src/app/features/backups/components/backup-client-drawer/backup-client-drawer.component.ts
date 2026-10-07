import { Component, Input, Output, EventEmitter } from '@angular/core';
import type { ClientBackup, BackupJobStatus } from '../../models/backup.models';

@Component({
  selector: 'app-backup-client-drawer',
  templateUrl: './backup-client-drawer.component.html',
  styleUrl: './backup-client-drawer.component.scss',
})
export class BackupClientDrawerComponent {
  @Input() client: ClientBackup | null = null;
  @Input() open = false;
  @Output() closed = new EventEmitter<void>();

  readonly displayedColumns = ['name', 'jobType', 'lastResult', 'hoursAgo'];

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

  hoursClass(job: BackupJobStatus): string {
    return job.isStale ? 'hours--stale' : '';
  }

  hoursLabel(job: BackupJobStatus): string {
    if (job.hoursAgo === null) return '—';
    return `${job.hoursAgo.toFixed(1)}h`;
  }

  stateLabel(job: BackupJobStatus): string {
    return job.isRunning ? 'En curso' : 'Inactivo';
  }

  stateClass(job: BackupJobStatus): string {
    return job.isRunning ? 'chip--running' : 'chip--neutral';
  }
}
