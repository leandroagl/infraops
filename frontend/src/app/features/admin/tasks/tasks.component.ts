import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
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
    { value: '',            label: 'Todos'       },
    { value: 'PENDING',     label: 'Pendiente'   },
    { value: 'IN_PROGRESS', label: 'En curso'    },
    { value: 'DONE',        label: 'Completado'  },
    { value: 'ESCALATED',   label: 'Escalado'    },
    { value: 'NOT_DONE',    label: 'No realizado'},
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

  typeLabel(type: TaskType): string {
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

  typeBadge(type: TaskType): string {
    return type === 'TERMINAL_MAINTENANCE' || type === 'SITE_VISIT'
      ? 'badge--purple' : 'badge--srv';
  }

  statusBadge(status: TaskStatus): string {
    const map: Record<TaskStatus, string> = {
      PENDING:     'badge--neutral',
      IN_PROGRESS: 'badge--accent',
      DONE:        'badge--ok',
      ESCALATED:   'badge--warn',
      NOT_DONE:    'badge--crit',
    };
    return map[status];
  }

  statusLabel(status: TaskStatus): string {
    const labels: Record<TaskStatus, string> = {
      PENDING: 'Pendiente', IN_PROGRESS: 'En curso',
      DONE: 'Listo', ESCALATED: 'Escalado', NOT_DONE: 'No realizado',
    };
    return labels[status];
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
