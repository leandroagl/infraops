import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ColDef, ICellRendererParams, ValueFormatterParams, ValueGetterParams } from 'ag-grid-community';
import { Task, TaskStatus, TaskType } from '../../../core/models/task.models';
import { TasksService } from '../../../core/services/tasks.service';
import { TaskCreateDialogComponent } from './task-create-dialog/task-create-dialog.component';

@Component({
  selector: 'app-tasks',
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.scss',
})
export class TasksComponent implements OnInit, OnDestroy {
  tasks: Task[] = [];
  loading = false;
  error = '';
  filterStatus = '';

  private destroy$ = new Subject<void>();

  readonly statusOptions: { value: string; label: string }[] = [
    { value: '',            label: 'Todos'        },
    { value: 'PENDING',     label: 'Pendiente'    },
    { value: 'IN_PROGRESS', label: 'En curso'     },
    { value: 'DONE',        label: 'Completado'   },
    { value: 'ESCALATED',   label: 'Escalado'     },
    { value: 'NOT_DONE',    label: 'No realizado' },
  ];

  readonly noRowsTemplate = `<span style="color:var(--tx-lo);font-size:12px">No hay tareas.</span>`;

  readonly defaultColDef: ColDef = { sortable: true, resizable: true };

  readonly columnDefs: ColDef[] = [
    {
      headerName: 'Cliente',
      valueGetter: (p: ValueGetterParams) => p.data?.client?.name ?? '—',
      flex: 2,
      sort: 'asc',
    },
    {
      field: 'type',
      headerName: 'Tipo',
      flex: 1.5,
      cellRenderer: (p: ICellRendererParams) =>
        `<span class="badge ${this.typeBadge(p.value)}">${this.typeLabel(p.value)}</span>`,
    },
    {
      headerName: 'Técnico',
      valueGetter: (p: ValueGetterParams) => p.data?.technician?.user?.name ?? '—',
      flex: 1.5,
      cellStyle: { color: 'var(--tx-md)', fontSize: '12px' },
    },
    {
      field: 'scheduledDate',
      headerName: 'Fecha',
      valueFormatter: (p: ValueFormatterParams) => this.formatDate(p.value),
      flex: 1,
      cellStyle: { fontFamily: 'var(--font-mono)', fontSize: '11px' },
    },
    {
      field: 'status',
      headerName: 'Estado',
      flex: 1.5,
      cellRenderer: (p: ICellRendererParams) =>
        `<span class="badge ${this.statusBadge(p.value)}"><span class="dot"></span>${this.statusLabel(p.value)}</span>`,
    },
  ];

  constructor(private tasksService: TasksService, private dialog: MatDialog) {}

  ngOnInit(): void { this.load(); }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  load(): void {
    this.loading = true;
    this.error = '';
    const filters = this.filterStatus ? { status: this.filterStatus } : {};
    this.tasksService.getAll(filters).pipe(takeUntil(this.destroy$)).subscribe({
      next: tasks => { this.tasks = tasks; this.loading = false; },
      error: () => { this.error = 'No se pudieron cargar las tareas.'; this.loading = false; },
    });
  }

  openCreateDialog(): void {
    this.dialog.open(TaskCreateDialogComponent, { width: '480px' })
      .afterClosed().pipe(takeUntil(this.destroy$))
      .subscribe(task => { if (task) this.load(); });
  }

  private typeLabel(type: TaskType): string {
    const labels: Record<TaskType, string> = {
      SERVER_MAINTENANCE:   'Servidores',
      TERMINAL_MAINTENANCE: 'Terminales',
      SITE_VISIT:           'Visita',
      AV_CONTROL:           'Antivirus',
      UPS_CONTROL:          'UPS',
      ENDPOINT_INVENTORY:   'Inventario',
    };
    return labels[type];
  }

  private typeBadge(type: TaskType): string {
    return type === 'TERMINAL_MAINTENANCE' || type === 'SITE_VISIT'
      ? 'badge--purple' : 'badge--srv';
  }

  private statusBadge(status: TaskStatus): string {
    const map: Record<TaskStatus, string> = {
      PENDING:     'badge--neutral',
      IN_PROGRESS: 'badge--accent',
      DONE:        'badge--ok',
      ESCALATED:   'badge--warn',
      NOT_DONE:    'badge--crit',
    };
    return map[status];
  }

  private statusLabel(status: TaskStatus): string {
    const labels: Record<TaskStatus, string> = {
      PENDING:     'Pendiente',
      IN_PROGRESS: 'En curso',
      DONE:        'Listo',
      ESCALATED:   'Escalado',
      NOT_DONE:    'No realizado',
    };
    return labels[status];
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
