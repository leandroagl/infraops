// frontend/src/app/shared/components/task-card/task-card.component.ts
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Task } from '../../../core/models/task.models';
import { daysFromToday, urgencyLabel, urgencyClass } from '../../utils/urgency';
import { typeLabelLong, statusLabel as getStatusLabel } from '../../utils/task-labels';
import { formatOdooTicketId, odooTicketUrl } from '../../utils/odoo';

@Component({
  selector: 'app-task-card',
  templateUrl: './task-card.component.html',
  styleUrl: './task-card.component.scss',
})
export class TaskCardComponent {
  @Input() task!: Task;
  @Input() active = false;
  @Output() selected = new EventEmitter<Task>();

  get isActive(): boolean {
    return this.task.status === 'PENDING' || this.task.status === 'IN_PROGRESS';
  }

  get days(): number { return daysFromToday(this.task.scheduledDate); }

  get borderClass(): string {
    if (!this.isActive) return 'tc-done';
    if (this.days < 0) return 'tc-crit';
    const t = this.task.type;
    if (t === 'TERMINAL_MAINTENANCE' || t === 'SITE_VISIT') return 'tc-visit';
    return 'tc-srv';
  }

  get urgencyLabelText(): string { return urgencyLabel(this.days); }
  get urgencyClassStr(): string  { return urgencyClass(this.days); }
  get typeLabel(): string        { return typeLabelLong(this.task.type); }

  get statusLabel(): string { return getStatusLabel(this.task.status); }

  get statusDotColor(): string {
    if (!this.isActive) return 'transparent';
    if (this.days < 0) return 'var(--crit)';
    if (this.days <= 7) return 'var(--warn)';
    return 'var(--ok)';
  }

  get odooLabel(): string | null {
    return this.task.odooTicketId !== null ? formatOdooTicketId(this.task.odooTicketId) : null;
  }

  get odooLink(): string | null {
    return this.task.odooTicketId !== null ? odooTicketUrl(this.task.odooTicketId) : null;
  }
}
