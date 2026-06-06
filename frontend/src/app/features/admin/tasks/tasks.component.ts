import { Component, DestroyRef, inject, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { Task, TaskStatus, TaskType } from '../../../core/models/task.models';
import { TasksService } from '../../../core/services/tasks.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { TaskCreateDialogComponent } from './task-create-dialog/task-create-dialog.component';
import { statusLabel, statusBadge, typeLabel, typeBadge } from '../../../shared/utils/task-labels';

@Component({
  selector: 'app-tasks',
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.scss',
})
export class TasksComponent implements OnInit, AfterViewInit {
  readonly dataSource = new MatTableDataSource<Task>([]);
  readonly displayedColumns = ['client', 'type', 'technician', 'scheduledDate', 'status', 'actions'];
  loading = false;
  error = '';
  filterStatus = '';

  @ViewChild(MatSort) sort!: MatSort;

  private readonly destroyRef = inject(DestroyRef);

  readonly statusOptions: { value: string; label: string }[] = [
    { value: '',            label: 'Todos'        },
    { value: 'PENDING',     label: 'Pendiente'    },
    { value: 'IN_PROGRESS', label: 'En curso'     },
    { value: 'DONE',        label: 'Completado'   },
    { value: 'ESCALATED',   label: 'Escalado'     },
    { value: 'NOT_DONE',    label: 'No realizado' },
  ];

  constructor(
    private tasksService: TasksService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void { this.load(); }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.sortingDataAccessor = (row: Task, column: string): string => {
      switch (column) {
        case 'client':     return row.client?.name ?? '';
        case 'technician': return row.technician?.user?.name ?? '';
        default:           return (row as unknown as Record<string, string>)[column] ?? '';
      }
    };
  }

  load(): void {
    this.loading = true;
    this.error = '';
    const filters = this.filterStatus ? { status: this.filterStatus } : {};
    this.tasksService.getAll(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: tasks => { this.dataSource.data = tasks; this.loading = false; },
      error: () => { this.error = 'No se pudieron cargar las tareas.'; this.loading = false; },
    });
  }

  openCreateDialog(): void {
    this.dialog.open(TaskCreateDialogComponent, { width: '480px' })
      .afterClosed().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(task => {
        if (task) this.dataSource.data = [...this.dataSource.data, task];
      });
  }

  deleteTask(task: Task): void {
    const clientName = task.client?.name ?? 'este cliente';
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar tarea',
        message: `¿Eliminar la tarea de ${clientName}? Esta acción no se puede deshacer.`,
      },
    }).afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(confirmed => {
      if (!confirmed) return;
      this.tasksService.delete(task.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.dataSource.data = this.dataSource.data.filter(t => t.id !== task.id);
          this.snackBar.open('Tarea eliminada', 'Cerrar', { duration: 3000 });
        },
        error: () => {
          this.snackBar.open('No se pudo eliminar la tarea', 'Cerrar', { duration: 4000 });
        },
      });
    });
  }

  typeLabel(type: TaskType): string   { return typeLabel(type); }
  typeBadge(type: TaskType): string   { return typeBadge(type); }
  statusBadge(status: TaskStatus): string { return statusBadge(status); }
  statusLabel(status: TaskStatus): string { return statusLabel(status); }
}
