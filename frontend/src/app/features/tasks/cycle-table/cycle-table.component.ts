import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Task, TaskGroup } from '../../../core/models/task.models';
import { Technician } from '../../../core/models/technician.models';
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
  @Input() taskTypes: { value: string; label: string }[] = [];
  @Input() technicians: Technician[] = [];
  @Input() taskStatuses: { value: string; label: string }[] = [];
  @Input() typeFilter: string | null = null;
  @Input() techFilter: string | null = null;
  @Input() statusFilter: string | null = null;
  @Output() taskSelected = new EventEmitter<Task>();
  @Output() typeFilterChange = new EventEmitter<string | null>();
  @Output() techFilterChange = new EventEmitter<string | null>();
  @Output() statusFilterChange = new EventEmitter<string | null>();

  get selectedTechnicianObj(): Technician | null {
    if (!this.techFilter) return null;
    return this.technicians?.find(t => t.id === this.techFilter) ?? null;
  }

  onTypeFilterChange(value: string | null): void {
    this.typeFilterChange.emit(value);
  }

  onTechFilterChange(value: string | null): void {
    this.techFilterChange.emit(value);
  }

  onStatusFilterChange(value: string | null): void {
    this.statusFilterChange.emit(value);
  }

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
