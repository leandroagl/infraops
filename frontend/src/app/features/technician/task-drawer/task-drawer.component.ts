import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { Task, TaskType } from '../../../core/models/task.models';
import { ClientInfrastructure } from '../../../core/models/infradoc.models';
import {
  MaintenancePayload,
  ServerMaintenancePayload,
} from '../../../core/models/maintenance-log.models';
import { InfradocService } from '../../../core/services/infradoc.service';
import { MaintenanceLogsService } from '../../../core/services/maintenance-logs.service';
import { TasksService } from '../../../core/services/tasks.service';
import { MaintenanceFormComponent } from './maintenance-form/maintenance-form.component';

@Component({
  selector: 'app-task-drawer',
  templateUrl: './task-drawer.component.html',
  styleUrl: './task-drawer.component.scss',
})
export class TaskDrawerComponent implements OnChanges {
  @Input() task!: Task;

  @Output() taskCompleted = new EventEmitter<void>();
  @Output() taskNotDone = new EventEmitter<void>();

  @ViewChild(MaintenanceFormComponent) maintenanceForm?: MaintenanceFormComponent;

  infrastructure: ClientInfrastructure | null = null;
  loadingInfra = false;
  infraError = '';

  showConfirmModal = false;
  pendingPayload: MaintenancePayload | null = null;
  issuesSummary: { dcdiagErrors: string[]; veeamMissing: boolean; emptyFields: string[] } | null = null;
  confirmError = '';

  constructor(
    private infradocService: InfradocService,
    private logsService: MaintenanceLogsService,
    private tasksService: TasksService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['task'] && this.task) {
      this.loadInfrastructure();
    }
  }

  loadInfrastructure(): void {
    this.infrastructure = null;
    this.infraError = '';
    this.loadingInfra = true;

    this.infradocService.getClientInfrastructure(this.task.clientId).subscribe({
      next: data => { this.infrastructure = data; this.loadingInfra = false; },
      error: () => {
        this.infraError = 'No se pudo cargar la infraestructura del cliente.';
        this.loadingInfra = false;
      },
    });
  }

  // ── Urgency helpers ─────────────────────────────────────────────────────────

  /** Días enteros entre hoy (medianoche local) y la fecha dada. Positivo = futuro, negativo = pasado. */
  daysFromToday(date: string): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [year, month, day] = date.split('T')[0].split('-').map(Number);
    const target = new Date(year, month - 1, day, 0, 0, 0, 0);
    return Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  urgencyLabel(days: number): string {
    if (days < 0) return `+${Math.abs(days)}d vencido`;
    if (days <= 7) return `vence en ${days}d`;
    return `${days}d restantes`;
  }

  urgencyClass(days: number): string {
    if (days < 0) return 'urg-crit';
    if (days <= 7) return 'urg-warn';
    return 'urg-ok';
  }

  // ── Icon style ──────────────────────────────────────────────────────────────

  drawerIconStyle(): { background: string; borderColor: string; color: string } {
    if (this.daysFromToday(this.task.scheduledDate) < 0) {
      return { background: 'var(--crit-bg)', borderColor: 'var(--crit-bd)', color: 'var(--crit)' };
    }
    if (this.task.type === 'TERMINAL_MAINTENANCE' || this.task.type === 'SITE_VISIT') {
      return { background: 'var(--purple-bg)', borderColor: 'var(--purple-bd)', color: 'var(--purple)' };
    }
    return { background: 'var(--srv-bg)', borderColor: 'var(--srv-bd)', color: 'var(--srv)' };
  }

  // ── Issue detection ─────────────────────────────────────────────────────────

  detectIssues(payload: MaintenancePayload): {
    dcdiagErrors: string[];
    veeamMissing: boolean;
    emptyFields: string[];
  } {
    if (payload.type !== 'SERVER_MAINTENANCE') {
      return { dcdiagErrors: [], veeamMissing: false, emptyFields: [] };
    }

    const srv = payload as ServerMaintenancePayload;

    const dcdiagErrors: string[] = srv.windows.dcdiag.toUpperCase().startsWith('ERROR')
      ? [srv.windows.dcdiag]
      : [];

    const veeamMissing = srv.veeam?.status === 'missing';

    const emptyFields: string[] = [];
    if (srv.vmware) {
      if (isNaN(srv.vmware.cpuUsage))     emptyFields.push('CPU%');
      if (isNaN(srv.vmware.memUsage))     emptyFields.push('Memoria%');
      if (isNaN(srv.vmware.storageUsage)) emptyFields.push('Storage%');
    }

    return { dcdiagErrors, veeamMissing, emptyFields };
  }

  // ── Getters ─────────────────────────────────────────────────────────────────

  get hasInfra(): boolean {
    if (!this.infrastructure) return false;
    const { servers, vms, nas, routers } = this.infrastructure;
    return servers.length + vms.length + nas.length + routers.length > 0;
  }

  get isActiveTask(): boolean {
    return this.task.status !== 'DONE'
      && this.task.status !== 'ESCALATED'
      && this.task.status !== 'NOT_DONE';
  }

  get hasAlerts(): boolean {
    return (this.issuesSummary?.dcdiagErrors.length ?? 0) > 0
      || (this.issuesSummary?.veeamMissing ?? false);
  }

  // ── Modal actions ───────────────────────────────────────────────────────────

  onRequestComplete(payload: MaintenancePayload): void {
    this.pendingPayload = payload;
    this.issuesSummary = this.detectIssues(payload);
    this.showConfirmModal = true;
  }

  onCancelModal(): void {
    this.showConfirmModal = false;
  }

  onConfirmModal(): void {
    if (!this.pendingPayload) return;
    this.confirmError = '';

    this.logsService.create(this.task.id, { payload: this.pendingPayload }).subscribe({
      next: () => {
        this.tasksService.updateStatus(this.task.id, { status: 'DONE' }).subscribe({
          next: () => {
            this.showConfirmModal = false;
            this.taskCompleted.emit();
          },
          error: () => {
            this.confirmError = 'Log guardado, pero no se pudo actualizar el estado de la tarea.';
          },
        });
      },
      error: () => {
        this.confirmError = 'No se pudo guardar el registro. Intentá de nuevo.';
      },
    });
  }

  onRequestNotDone(): void {
    this.tasksService.updateStatus(this.task.id, { status: 'NOT_DONE' }).subscribe({
      next: () => { this.taskNotDone.emit(); },
      error: () => { this.confirmError = 'No se pudo actualizar el estado de la tarea.'; },
    });
  }

  triggerFormComplete(): void {
    this.maintenanceForm?.submit();
  }

  // ── Labels ──────────────────────────────────────────────────────────────────

  typeLabel(type: TaskType): string {
    const labels: Record<TaskType, string> = {
      SERVER_MAINTENANCE:   'Mantenimiento de servidores',
      TERMINAL_MAINTENANCE: 'Visita de terminales',
      SITE_VISIT:           'Visita presencial',
      AV_CONTROL:           'Control antivirus',
      UPS_CONTROL:          'Control UPS',
      ENDPOINT_INVENTORY:   'Inventario',
    };
    return labels[type];
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      PENDING: 'Pendiente', IN_PROGRESS: 'En curso',
      DONE: 'Listo', ESCALATED: 'Escalado', NOT_DONE: 'No realizado',
    };
    return labels[status] ?? status;
  }

  statusBadge(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'badge--neutral', IN_PROGRESS: 'badge--accent',
      DONE: 'badge--ok', ESCALATED: 'badge--warn', NOT_DONE: 'badge--crit',
    };
    return map[status] ?? 'badge--neutral';
  }
}
