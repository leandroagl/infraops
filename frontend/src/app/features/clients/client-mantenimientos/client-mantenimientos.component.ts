import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Task, TaskStatus } from '../../../core/models/task.models';
import { TasksService } from '../../../core/services/tasks.service';
import { statusLabel } from '../../../shared/utils/task-labels';

@Component({
  selector: 'app-client-mantenimientos',
  templateUrl: './client-mantenimientos.component.html',
})
export class ClientMantenimientosComponent implements OnInit, OnDestroy {
  tasks: Task[] = [];
  loading = false;
  error = '';

  readonly displayedColumns = ['technician', 'scheduledDate', 'status'];

  private readonly destroy$ = new Subject<void>();

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

  statusLabel(status: TaskStatus): string { return statusLabel(status); }
}
