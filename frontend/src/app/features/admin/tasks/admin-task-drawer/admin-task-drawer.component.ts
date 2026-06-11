import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Task } from '../../../../core/models/task.models';
import { typeLabelLong, statusLabel, statusBadge } from '../../../../shared/utils/task-labels';
import { formatOdooTicketId, odooTicketUrl } from '../../../../shared/utils/odoo';

@Component({
  selector: 'app-admin-task-drawer',
  templateUrl: './admin-task-drawer.component.html',
  styleUrls: ['./admin-task-drawer.component.scss'],
})
export class AdminTaskDrawerComponent {
  @Input() task!: Task;
  @Output() drawerClosed = new EventEmitter<void>();

  get typeLabel(): string {
    return typeLabelLong(this.task.type);
  }

  get statusLabel(): string {
    return statusLabel(this.task.status);
  }

  get statusBadge(): string {
    return statusBadge(this.task.status);
  }

  get odooLabel(): string | null {
    return this.task.odooTicketId != null
      ? formatOdooTicketId(this.task.odooTicketId)
      : null;
  }

  get odooLink(): string | null {
    return this.task.odooTicketId != null
      ? odooTicketUrl(this.task.odooTicketId)
      : null;
  }
}
