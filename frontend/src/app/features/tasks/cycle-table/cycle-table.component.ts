import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Task, TaskGroup } from '../../../core/models/task.models';
import { typeLabel, typeBadge, statusLabel, statusBadge } from '../../../shared/utils/task-labels';
import { formatOdooTicketId } from '../../../shared/utils/odoo';

@Component({
  selector: 'app-cycle-table',
  templateUrl: './cycle-table.component.html',
  styleUrl: './cycle-table.component.scss',
})
export class CycleTableComponent {
  @Input() groups: TaskGroup[] = [];
  @Input() selectedTaskId: string | null = null;
  @Output() taskSelected = new EventEmitter<Task>();

  groupDoneCount(group: TaskGroup): number {
    return group.tasks.filter(t => t.status === 'DONE').length;
  }

  groupProgressPct(group: TaskGroup): number {
    if (!group.tasks.length) return 0;
    return Math.round((this.groupDoneCount(group) / group.tasks.length) * 100);
  }

  typeLabel(t: Task): string  { return typeLabel(t.type); }
  typeBadge(t: Task): string  { return typeBadge(t.type); }
  statusLabel(t: Task): string { return statusLabel(t.status); }
  statusBadge(t: Task): string { return statusBadge(t.status); }

  ticketLabel(t: Task): string {
    return t.odooTicketId != null ? formatOdooTicketId(t.odooTicketId) : '—';
  }
}
