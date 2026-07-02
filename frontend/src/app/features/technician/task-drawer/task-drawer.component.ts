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
import { Task, TaskStatus, TaskType } from '../../../core/models/task.models';
import { ClientInfrastructure } from '../../../core/models/infradoc.models';
import {
  MaintenancePayload,
  RouterMaintenancePayload,
  VeeamBackupPayload,
  WindowsDomainPayload,
} from '../../../core/models/maintenance-log.models';
import { InfradocService } from '../../../core/services/infradoc.service';
import {
  MaintenanceLog,
  MaintenanceLogsService,
} from '../../../core/services/maintenance-logs.service';
import { TasksService } from '../../../core/services/tasks.service';
import { MaintenanceFormComponent } from './maintenance-form/maintenance-form.component';
import { QnapFormComponent } from './qnap-form/qnap-form.component';
import { VeeamFormComponent } from './veeam-form/veeam-form.component';
import { ServerHostFormComponent } from './server-host-form/server-host-form.component';
import { RouterFormComponent } from './router-form/router-form.component';
import {
  ConfirmMaintenanceDialogComponent,
  ConfirmMaintenanceDialogData,
} from './confirm-maintenance-dialog/confirm-maintenance-dialog.component';
import { TimeSpentDialogComponent } from './time-spent-dialog/time-spent-dialog.component';
import { statusLabel, statusBadge, typeLabel, typeBadge } from '../../../shared/utils/task-labels';
import { daysFromToday, urgencyLabel, urgencyClass } from '../../../shared/utils/urgency';
import { formatOdooTicketId, odooTicketUrl } from '../../../shared/utils/odoo';

@Component({
  selector: 'app-task-drawer',
  templateUrl: './task-drawer.component.html',
  styleUrl: './task-drawer.component.scss',
})
export class TaskDrawerComponent implements OnChanges {
  @Input() task!: Task;

  @Output() taskCompleted = new EventEmitter<void>();
  @Output() taskNotDone = new EventEmitter<void>();
  @Output() taskStatusChanged = new EventEmitter<TaskStatus>();
  @Output() drawerClosed = new EventEmitter<void>();

  @ViewChild(MaintenanceFormComponent) maintenanceForm?: MaintenanceFormComponent;
  @ViewChild(QnapFormComponent) qnapForm?: QnapFormComponent;
  @ViewChild(VeeamFormComponent) veeamForm?: VeeamFormComponent;
  @ViewChild(ServerHostFormComponent) serverHostForm?: ServerHostFormComponent;
  @ViewChild(RouterFormComponent) routerForm?: RouterFormComponent;

  infrastructure: ClientInfrastructure | null = null;
  savedPayload: MaintenancePayload | null = null;
  veeamVms: { name: string; os: string }[] = [];
  loadingInfra = false;
  infraError = '';
  confirmError = '';
  saveProgressMsg = '';
  saveProgressError = '';
  completing = false;

  private pendingPayload: MaintenancePayload | null = null;
  private pendingTimeSpentMinutes: number | null = null;
  private _currentStatus = '';

  constructor(
    private infradocService: InfradocService,
    private logsService: MaintenanceLogsService,
    private tasksService: TasksService,
    private dialog: MatDialog,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['task'] && this.task) {
      this._currentStatus = this.task.status;
      this.loadInfrastructure();
    }
  }

  private get effectiveStatus(): string {
    return this._currentStatus || this.task.status;
  }

  loadInfrastructure(): void {
    this.infrastructure = null;
    this.savedPayload = null;
    this.veeamVms = [];
    this.infraError = '';
    this.loadingInfra = true;

    this.infradocService.getClientInfrastructure(this.task.clientId).pipe(
      switchMap(infra =>
        this.logsService.get(this.task.id).pipe(
          map(log => ({ infra, savedPayload: log.payload })),
          catchError((err: HttpErrorResponse) =>
            err.status === 404
              ? of({ infra, savedPayload: null })
              : throwError(() => err)
          )
        )
      )
    ).subscribe({
      next: ({ infra, savedPayload }) => {
        this.infrastructure = infra;
        this.savedPayload = savedPayload;
        this.veeamVms = [
          ...infra.windowsVMs,
          ...infra.domainControllers,
          ...infra.linuxVMs,
        ].map(v => ({ name: v.name, os: v.os ?? '—' }));
        this.loadingInfra = false;
      },
      error: () => {
        this.infraError = 'No se pudo cargar la infraestructura del cliente.';
        this.loadingInfra = false;
      },
    });
  }

  // ── Urgency helpers ─────────────────────────────────────────────────────────

  daysFromToday(date: string): number { return daysFromToday(date); }
  urgencyLabel(days: number): string  { return urgencyLabel(days); }
  urgencyClass(days: number): string  { return urgencyClass(days); }

  // ── Icon style ──────────────────────────────────────────────────────────────

  drawerIconStyle(): { background: string; borderColor: string; color: string } {
    if (daysFromToday(this.task.scheduledDate) < 0) {
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
    if (payload.type === 'WINDOWS_DOMAIN_MAINTENANCE') {
      const srv = payload as WindowsDomainPayload;
      const dcdiagErrors: string[] = (srv.windows.domainControllers ?? [])
        .flatMap(dc => dc.warnings ?? [])
        .filter(w => w.toUpperCase().startsWith('ERROR'));
      return { dcdiagErrors, veeamMissing: false, emptyFields: [] };
    }

    return { dcdiagErrors: [], veeamMissing: false, emptyFields: [] };
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
    this.qnapForm?.submit();
    this.veeamForm?.submit();
    this.serverHostForm?.submit();
    this.routerForm?.submit();
  }

  triggerFormSave(): void {
    this.maintenanceForm?.save();
  }

  triggerServerHostSave(): void {
    this.serverHostForm?.save();
  }

  triggerRouterFormSave(): void {
    this.routerForm?.save();
  }

  onRequestSave(payload: MaintenancePayload): void {
    this.saveProgressMsg = '';
    this.saveProgressError = '';
    const wasInPending = this.effectiveStatus === 'PENDING';

    this.upsertLog(payload).pipe(
      switchMap(() => {
        if (wasInPending) {
          return this.tasksService.updateStatus(this.task.id, { status: 'IN_PROGRESS' }).pipe(
            tap(() => { this._currentStatus = 'IN_PROGRESS'; }),
          );
        }
        return of(null as unknown as Task);
      })
    ).subscribe({
      next: () => {
        this.saveProgressMsg = 'Progreso guardado.';
        if (wasInPending) this.taskStatusChanged.emit('IN_PROGRESS');
      },
      error: () => { this.saveProgressError = 'No se pudo guardar el progreso. Intentá de nuevo.'; },
    });
  }

  onRequestComplete(payload: MaintenancePayload): void {
    this.pendingPayload = payload;

    this.dialog.open(TimeSpentDialogComponent, { width: '360px' })
      .afterClosed()
      .subscribe((minutes: number | null) => {
        if (minutes == null) return;
        this.pendingTimeSpentMinutes = minutes;
        const issuesSummary = this.detectIssues(payload);
        const hasAlerts = issuesSummary.dcdiagErrors.length > 0 || issuesSummary.veeamMissing;
        const data: ConfirmMaintenanceDialogData = { issuesSummary, hasAlerts };
        this.dialog.open(ConfirmMaintenanceDialogComponent, { data, width: '420px' })
          .afterClosed()
          .subscribe((confirmed: boolean) => {
            if (confirmed) this.saveAndComplete(this.pendingTimeSpentMinutes!);
          });
      });
  }

  private saveAndComplete(timeSpentMinutes: number): void {
    if (!this.pendingPayload) return;
    this.confirmError = '';
    this.completing = true;

    let logSaved = false;
    this.upsertLog(this.pendingPayload).pipe(
      tap(() => { logSaved = true; }),
      switchMap(() => this.transitionToDone(timeSpentMinutes))
    ).subscribe({
      next: () => { this.completing = false; this.taskCompleted.emit(); },
      error: () => {
        this.completing = false;
        this.confirmError = logSaved
          ? 'Log guardado, pero no se pudo actualizar el estado de la tarea.'
          : 'No se pudo guardar el registro. Intentá de nuevo.';
      },
    });
  }

  onRequestNotDone(): void {
    this.dialog.open(TimeSpentDialogComponent, { width: '360px' })
      .afterClosed()
      .subscribe((minutes: number | null) => {
        if (minutes == null) return;
        this.tasksService.updateStatus(this.task.id, { status: 'NOT_DONE', timeSpentMinutes: minutes })
          .subscribe({
            next: () => { this.taskNotDone.emit(); },
            error: () => { this.confirmError = 'No se pudo actualizar el estado de la tarea.'; },
          });
      });
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private upsertLog(payload: MaintenancePayload): Observable<MaintenanceLog> {
    const notes = payload.notes ?? undefined;
    return this.logsService.create(this.task.id, { payload, notes }).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 409) {
          return this.logsService.update(this.task.id, { payload, notes });
        }
        return throwError(() => err);
      })
    );
  }

  private transitionToDone(timeSpentMinutes: number): Observable<Task> {
    if (this.effectiveStatus === 'PENDING') {
      return this.tasksService.updateStatus(this.task.id, { status: 'IN_PROGRESS' }).pipe(
        tap(() => { this._currentStatus = 'IN_PROGRESS'; }),
        switchMap(() =>
          this.tasksService.updateStatus(this.task.id, { status: 'DONE', timeSpentMinutes }),
        ),
      );
    }
    return this.tasksService.updateStatus(this.task.id, { status: 'DONE', timeSpentMinutes });
  }

  get odooLabel(): string | null {
    return this.task.odooTicketId != null ? formatOdooTicketId(this.task.odooTicketId) : null;
  }

  get odooLink(): string | null {
    return this.task.odooTicketId != null ? odooTicketUrl(this.task.odooTicketId) : null;
  }

  get veeamPayload(): VeeamBackupPayload | undefined {
    return this.savedPayload?.type === 'VEEAM_BACKUP'
      ? (this.savedPayload as VeeamBackupPayload)
      : undefined;
  }

  // ── Labels ──────────────────────────────────────────────────name───────────

  typeLabel(type: TaskType): string  { return typeLabel(type); }
  typeBadge(type: TaskType): string  { return typeBadge(type); }
  statusLabel(status: string): string { return statusLabel(status as Parameters<typeof statusLabel>[0]); }
  statusBadge(status: string): string { return statusBadge(status as Parameters<typeof statusBadge>[0]); }
}
