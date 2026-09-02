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
import { UserRole } from '../../../core/models/auth.models';
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
  ConfirmCloseDialogComponent,
  ConfirmCloseDialogData,
} from './confirm-close-dialog/confirm-close-dialog.component';
import { TaskConfigService } from '../../../core/services/task-config.service';
import { TaskTypeConfigDto } from '../../../core/models/task.models';
import { statusLabel, statusBadge, typeLabel, typeBadge } from '../../../shared/utils/task-labels';
import { daysUntilCycleClose, urgencyLabel, urgencyClass } from '../../../shared/utils/urgency';
import { formatOdooTicketId, odooTicketUrl } from '../../../shared/utils/odoo';

@Component({
  selector: 'app-task-drawer',
  templateUrl: './task-drawer.component.html',
  styleUrl: './task-drawer.component.scss',
})
export class TaskDrawerComponent implements OnChanges {
  @Input() task!: Task;
  @Input() userRole: UserRole = 'TECHNICIAN';
  @Input() cycleClosed = false;

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
  taskConfig: TaskTypeConfigDto | null = null;

  private pendingPayload: MaintenancePayload | null = null;
  private _currentStatus = '';

  constructor(
    private infradocService: InfradocService,
    private logsService: MaintenanceLogsService,
    private tasksService: TasksService,
    private dialog: MatDialog,
    private taskConfigService: TaskConfigService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['task'] && this.task) {
      this._currentStatus = this.task.status;
      this.loadInfrastructure();
      this.taskConfigService.getAll().subscribe(configs => {
        this.taskConfig = configs.find(c => c.taskType === this.task.type) ?? null;
      });
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

  daysUntilCycleClose(): number      { return daysUntilCycleClose(); }
  urgencyLabel(days: number): string { return urgencyLabel(days); }
  urgencyClass(days: number): string { return urgencyClass(days); }

  // ── Icon style ──────────────────────────────────────────────────────────────

  drawerIconStyle(): { background: string; borderColor: string; color: string } {
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

  get canExecute(): boolean {
    return !this.cycleClosed
      && (this.userRole === 'TECHNICIAN' || this.userRole === 'TL' || this.userRole === 'ADMIN');
  }

  get canMarkNotDone(): boolean {
    return !this.cycleClosed
      && this.isActiveTask
      && (this.userRole === 'ADMIN' || this.userRole === 'TL');
  }

  get isConfigMissing(): boolean {
    return this.taskConfig?.defaultTimeMinutes == null
      || !this.taskConfig?.odooTagIds?.length;
  }

  get formReadOnly(): boolean {
    return !this.isActiveTask || this.isConfigMissing;
  }

  get configWarningMessage(): string {
    return 'El administrador debe configurar el tiempo estimado y los tags de Odoo para este tipo de tarea antes de poder trabajarla.';
  }

  get canComplete(): boolean {
    return this.isActiveTask
      && this.canExecute
      && !this.isConfigMissing;
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

  triggerQnapSave(): void {
    this.qnapForm?.save();
  }

  triggerVeeamSave(): void {
    this.veeamForm?.save();
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
    if (!this.taskConfig) return;
    this.pendingPayload = payload;

    const data: ConfirmCloseDialogData = {
      mode: 'DONE',
      taskType: this.task.type,
      config: this.taskConfig,
      odooTicketId: this.task.odooTicketId,
      issuesSummary: this.detectIssues(payload),
    };

    this.dialog.open(ConfirmCloseDialogComponent, { data, width: '420px' })
      .afterClosed()
      .subscribe((result: { confirmed: boolean; reason?: string } | null) => {
        if (result?.confirmed) this.saveAndComplete(this.taskConfig!.defaultTimeMinutes!);
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
    if (!this.taskConfig) return;

    const data: ConfirmCloseDialogData = {
      mode: 'NOT_DONE',
      taskType: this.task.type,
      config: this.taskConfig,
      odooTicketId: this.task.odooTicketId,
      issuesSummary: { dcdiagErrors: [], veeamMissing: false, emptyFields: [] },
    };

    this.dialog.open(ConfirmCloseDialogComponent, { data, width: '420px' })
      .afterClosed()
      .subscribe((result: { confirmed: boolean; reason?: string } | null) => {
        if (!result?.confirmed) return;
        this.tasksService.updateStatus(this.task.id, {
          status: 'NOT_DONE',
          reason: result.reason,
        }).subscribe({
          next: () => { this.taskNotDone.emit(); },
          error: () => { this.confirmError = 'No se pudo actualizar el estado de la tarea.'; },
        });
      });
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private upsertLog(payload: MaintenancePayload): Observable<MaintenanceLog> {
    const notes = payload.notes ?? undefined;
    const body = notes !== undefined ? { payload, notes } : { payload };
    return this.logsService.create(this.task.id, body).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 409) {
          return this.logsService.update(this.task.id, body);
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
