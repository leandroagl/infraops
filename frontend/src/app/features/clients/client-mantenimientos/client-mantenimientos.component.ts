import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ColDef, ValueFormatterParams, ValueGetterParams } from 'ag-grid-community';
import { Task, TaskStatus } from '../../../core/models/task.models';
import { TasksService } from '../../../core/services/tasks.service';

@Component({
  selector: 'app-client-mantenimientos',
  templateUrl: './client-mantenimientos.component.html',
})
export class ClientMantenimientosComponent implements OnInit, OnDestroy {
  tasks: Task[] = [];
  loading = false;
  error = '';

  private readonly destroy$ = new Subject<void>();

  readonly columnDefs: ColDef[] = [
    {
      headerName: 'Técnico',
      valueGetter: (p: ValueGetterParams) => p.data?.technician?.user?.name ?? '—',
      flex: 1,
    },
    {
      field: 'scheduledDate',
      headerName: 'Fecha',
      valueFormatter: (p: ValueFormatterParams) => this.formatDate(p.value),
      flex: 1,
    },
    {
      field: 'status',
      headerName: 'Estado',
      valueFormatter: (p: ValueFormatterParams) => this.statusLabel(p.value),
      flex: 1,
    },
  ];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly tasksService: TasksService,
  ) {}

  ngOnInit(): void {
    const clientId = this.route.parent?.snapshot.paramMap.get('id') ?? '';
    this.loading = true;
    this.error = '';
    this.tasksService
      .getAll({ clientId, type: 'SERVER_MAINTENANCE' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tasks) => { this.tasks = tasks; this.loading = false; },
        error: () => { this.error = 'No se pudieron cargar las tareas.'; this.loading = false; },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private statusLabel(status: TaskStatus): string {
    const labels: Record<TaskStatus, string> = {
      PENDING:     'Pendiente',
      IN_PROGRESS: 'En curso',
      DONE:        'Listo',
      ESCALATED:   'Escalado',
      NOT_DONE:    'No realizado',
    };
    return labels[status] ?? status;
  }

  private formatDate(date: string): string {
    return new Date(date).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}
