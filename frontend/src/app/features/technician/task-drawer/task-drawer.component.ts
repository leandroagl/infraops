import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, switchMap, tap, throwError } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { Task, TaskType } from '../../../core/models/task.models';
import { ClientInfrastructure } from '../../../core/models/infradoc.models';
import {
  MaintenancePayload,
  ServerMaintenancePayload,
} from '../../../core/models/maintenance-log.models';
import { InfradocService } from '../../../core/services/infradoc.service';
import {
  MaintenanceLog,
  MaintenanceLogsService,
} from '../../../core/services/maintenance-logs.service';
import { TasksService } from '../../../core/services/tasks.service';
import { MaintenanceFormComponent } from './maintenance-form/maintenance-form.component';
import {
  ConfirmMaintenanceDialogComponent,
  ConfirmMaintenanceDialogData,
} from './confirm-maintenance-dialog/confirm-maintenance-dialog.component';

@Component({
  selector: 'app-task-drawer',
  templateUrl: './task-drawer.component.html',
  styleUrl: './task-drawer.component.scss',
})
export class TaskDrawerComponent implements OnChanges {
  @Input() task!: Task;

  @Output() taskCompleted = new EventEmitter<void>();
  @Output() taskNotDone = new EventEmitter<void>();
  @Output() drawerClosed = new EventEmitter<void>();

  @ViewChild(MaintenanceFormComponent) maintenanceForm?: MaintenanceFormComponent;

  infrastructure: ClientInfrastructure | null = null;
  savedPayload: MaintenancePayload | null = null;
  loadingInfra = false;
  infraError = '';
  confirmError = '';
  saveProgressMsg = '';
  saveProgressError = '';

  private pendingPayload: MaintenancePayload | null = null;

  constructor(
    private infradocService: InfradocService,
    private logsService: MaintenanceLogsService,
    private tasksService: TasksService,
    private dialog: MatDialog,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['task'] && this.task) {
      this.loadInfrastructure();
    }
  }

  loadInfrastructure(): void {
    this.infrastructure = null;
    this.savedPayload = null;
    this.infraError = '';
    this.loadingInfra = true;

    this.infradocService.getClientInfrastructure(this.task.clientId).pipe(
      switchMap(infra =>
        this.logsService.get(this.task.id).pipe(
          map(log => ({ infra, savedPayload: log.payload })),
          catchError(() => of({ infra, savedPayload: null }))
        )
      )
    ).subscribe({
      next: ({ infra, savedPayload }) => {
        this.infrastructure = infra;
        this.savedPayload = savedPayload;
        this.loadingInfra = false;
      },
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

    const veeamMissing = srv.veeam?.status === 'missing' || srv.veeam?.status === 'partial';

    const emptyFields: string[] = [];
    if (srv.vmware?.length) {
      srv.vmware.forEach((host) => {
        const label = srv.vmware!.length > 1 ? ` (${host.hostName})` : '';
        if (isNaN(host.cpuUsage))     emptyFields.push(`CPU%${label}`);
        if (isNaN(host.memUsage))     emptyFields.push(`Memoria%${label}`);
        if (isNaN(host.storageUsage)) emptyFields.push(`Storage%${label}`);
      });
    }

    return { dcdiagErrors, veeamMissing, emptyFields };
  }

  // ── Getters ─────────────────────────────────────────────────────────────────

  get hasInfra(): boolean {
    if (!this.infrastructure) return false;
    const { esxiHosts, windowsVMs, nas, routers } = this.infrastructure;
    return esxiHosts.length + windowsVMs.length + nas.length + routers.length > 0;
  }

  get isActiveTask(): boolean {
    return this.task.status !== 'DONE'
      && this.task.status !== 'ESCALATED'
      && this.task.status !== 'NOT_DONE';
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  triggerFormComplete(): void {
    this.maintenanceForm?.submit();
  }

  triggerFormSave(): void {
    this.maintenanceForm?.save();
  }

  onRequestSave(payload: MaintenancePayload): void {
    this.saveProgressMsg = '';
    this.saveProgressError = '';

    this.upsertLog(payload).pipe(
      switchMap(() => {
        if (this.task.status === 'PENDING') {
          return this.tasksService.updateStatus(this.task.id, { status: 'IN_PROGRESS' });
        }
        return of(null as unknown as Task);
      })
    ).subscribe({
      next: () => { this.saveProgressMsg = 'Progreso guardado.'; },
      error: () => { this.saveProgressError = 'No se pudo guardar el progreso. Intentá de nuevo.'; },
    });
  }

  onRequestComplete(payload: MaintenancePayload): void {
    this.pendingPayload = payload;
    const issuesSummary = this.detectIssues(payload);
    const hasAlerts = issuesSummary.dcdiagErrors.length > 0 || issuesSummary.veeamMissing;

    const data: ConfirmMaintenanceDialogData = { issuesSummary, hasAlerts };
    this.dialog.open(ConfirmMaintenanceDialogComponent, { data, width: '420px' })
      .afterClosed()
      .subscribe((confirmed: boolean) => {
        if (confirmed) this.saveAndComplete();
      });
  }

  private saveAndComplete(): void {
    if (!this.pendingPayload) return;
    this.confirmError = '';

    let logSaved = false;
    this.upsertLog(this.pendingPayload).pipe(
      tap(() => { logSaved = true; }),
      switchMap(() => this.transitionToDone())
    ).subscribe({
      next: () => { this.taskCompleted.emit(); },
      error: () => {
        this.confirmError = logSaved
          ? 'Log guardado, pero no se pudo actualizar el estado de la tarea.'
          : 'No se pudo guardar el registro. Intentá de nuevo.';
      },
    });
  }

  onRequestNotDone(): void {
    this.tasksService.updateStatus(this.task.id, { status: 'NOT_DONE' }).subscribe({
      next: () => { this.taskNotDone.emit(); },
      error: () => { this.confirmError = 'No se pudo actualizar el estado de la tarea.'; },
    });
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private upsertLog(payload: MaintenancePayload): Observable<MaintenanceLog> {
    return this.logsService.create(this.task.id, { payload }).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 409) {
          return this.logsService.update(this.task.id, { payload });
        }
        return throwError(() => err);
      })
    );
  }

  private transitionToDone(): Observable<Task> {
    if (this.task.status === 'PENDING') {
      return this.tasksService.updateStatus(this.task.id, { status: 'IN_PROGRESS' }).pipe(
        switchMap(() => this.tasksService.updateStatus(this.task.id, { status: 'DONE' }))
      );
    }
    return this.tasksService.updateStatus(this.task.id, { status: 'DONE' });
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
