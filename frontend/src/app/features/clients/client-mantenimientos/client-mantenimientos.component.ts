import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Task, TaskStatus } from '../../../core/models/task.models';
import { TasksService } from '../../../core/services/tasks.service';
import { statusLabel } from '../../../shared/utils/task-labels';

@Component({
  selector: 'app-client-mantenimientos',
  templateUrl: './client-mantenimientos.component.html',
  styleUrl: './client-mantenimientos.component.scss',
})
export class ClientMantenimientosComponent implements OnInit {
  tasks: Task[] = [];
  loading = false;
  error = '';

  readonly displayedColumns = ['technician', 'scheduledDate', 'status'];

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly tasksService: TasksService,
  ) {}

  ngOnInit(): void {
    const clientId = this.route.parent?.snapshot.paramMap.get('id') ?? '';
    this.loading = true;
    this.error = '';
    forkJoin({
      windows: this.tasksService.getAll({ clientId, type: 'WINDOWS_DOMAIN_MAINTENANCE' }),
      host:    this.tasksService.getAll({ clientId, type: 'SERVER_HOST_MAINTENANCE' }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ windows, host }) => {
          this.tasks = [...windows, ...host]
            .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());
          this.loading = false;
        },
        error: () => { this.error = 'No se pudieron cargar las tareas.'; this.loading = false; },
      });
  }

  statusLabel(status: TaskStatus): string { return statusLabel(status); }
}
