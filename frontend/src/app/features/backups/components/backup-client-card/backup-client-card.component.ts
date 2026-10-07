import { Component, Input, Output, EventEmitter } from '@angular/core';
import type { ClientBackup } from '../../models/backup.models';

@Component({
  selector: 'app-backup-client-card',
  templateUrl: './backup-client-card.component.html',
  styleUrl: './backup-client-card.component.scss',
})
export class BackupClientCardComponent {
  @Input() client!: ClientBackup;
  @Input() selected = false;
  @Output() cardClick = new EventEmitter<ClientBackup>();

  get statusClass(): string {
    return `st-${this.client.status.replace('_', '-')}`;
  }

  get statusDotClass(): string {
    const map: Record<string, string> = {
      ok: 'ok',
      warn: 'warn',
      crit: 'crit',
      no_data: 'nd',
    };
    return map[this.client.status] ?? 'nd';
  }

  get hoursAgo(): string {
    if (!this.client.jobs.length) return '';
    const times = this.client.jobs
      .map(j => j.hoursAgo)
      .filter((h): h is number => h !== null);
    if (!times.length) return '';
    const max = Math.max(...times);
    return `hace ${Math.round(max)}h`;
  }
}
