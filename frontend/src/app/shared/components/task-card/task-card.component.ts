// frontend/src/app/shared/components/task-card/task-card.component.ts
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Task } from '../../../core/models/task.models';
import { daysUntilCycleClose, urgencyLabel, urgencyClass } from '../../utils/urgency';
import { typeLabel, typeBadge, expirationTypeLabel } from '../../utils/task-labels';
import { formatOdooTicketId } from '../../utils/odoo';
import { OdooUrlService } from '../../../core/services/odoo-url.service';

@Component({
  selector: 'app-task-card',
  templateUrl: './task-card.component.html',
  styleUrl: './task-card.component.scss',
})
export class TaskCardComponent {
  @Input() task!: Task;
  @Input() active = false;
  @Input() showTechnicianAvatar = false;
  @Output() selected = new EventEmitter<Task>();

  constructor(private readonly odooUrl: OdooUrlService) {}

  get isActive(): boolean {
    return this.task.status === 'PENDING' || this.task.status === 'IN_PROGRESS';
  }

  /** Días restantes hasta el cierre de ciclo — iguales para toda tarea activa. */
  get days(): number { return daysUntilCycleClose(); }

  get borderClass(): string {
    if (!this.isActive) return 'tc-done';
    const t = this.task.type;
    if (t === 'TERMINAL_MAINTENANCE' || t === 'SITE_VISIT') return 'tc-visit';
    return 'tc-srv';
  }

  get isExpiration(): boolean    { return this.task.type === 'EXPIRATION_CONTROL'; }
  get urgencyLabelText(): string { return urgencyLabel(this.days); }
  get urgencyClassStr(): string  { return urgencyClass(this.days); }
  get typeLabel(): string {
    return this.isExpiration
      ? expirationTypeLabel(this.task.expirationType)
      : typeLabel(this.task.type);
  }
  get typeBadgeClass(): string   { return typeBadge(this.task.type); }

  get odooLabel(): string | null {
    return this.task.odooTicketId != null ? formatOdooTicketId(this.task.odooTicketId) : null;
  }

  get odooLink(): string | null {
    if (this.task.odooTicketId == null) return null;
    const url = this.odooUrl.ticketUrl(this.task.odooTicketId);
    return url || null;
  }

  get technicianInitial(): string {
    return this.task.technician?.user?.name?.[0]?.toUpperCase() ?? '';
  }
}
