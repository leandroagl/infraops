import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Task, TaskStatus, TaskType } from '../../../core/models/task.models';
import { TasksService } from '../../../core/services/tasks.service';
import { TaskCreateDialogComponent } from './task-create-dialog/task-create-dialog.component';
import { statusLabel, statusBadge, typeLabel, typeBadge } from '../../../shared/utils/task-labels';

@Component({
  selector: 'app-tasks',
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.scss',
})
export class TasksComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly dataSource = new MatTableDataSource<Task>([]);
  readonly displayedColumns = ['client', 'type', 'technician', 'scheduledDate', 'status'];
  loading = false;
  error = '';
  filterStatus = '';

  @ViewChild(MatSort) sort!: MatSort;

  private destroy$ = new Subject<void>();

  readonly statusOptions: { value: string; label: string }[] = [
    { value: '',            label: 'Todos'        },
    { value: 'PENDING',     label: 'Pendiente'    },
    { value: 'IN_PROGRESS', label: 'En curso'     },
    { value: 'DONE',        label: 'Completado'   },
    { value: 'ESCALATED',   label: 'Escalado'     },
    { value: 'NOT_DONE',    label: 'No realizado' },
  ];

  constructor(private tasksService: TasksService, private dialog: MatDialog) {}

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

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  load(): void {
    this.loading = true;
    this.error = '';
    const filters = this.filterStatus ? { status: this.filterStatus } : {};
    this.tasksService.getAll(filters).pipe(takeUntil(this.destroy$)).subscribe({
      next: tasks => { this.dataSource.data = tasks; this.loading = false; },
      error: () => { this.error = 'No se pudieron cargar las tareas.'; this.loading = false; },
    });
  }

  openCreateDialog(): void {
    this.dialog.open(TaskCreateDialogComponent, { width: '480px' })
      .afterClosed().pipe(takeUntil(this.destroy$))
      .subscribe(task => {
        if (task) this.dataSource.data = [...this.dataSource.data, task];
      });
  }

  typeLabel(type: TaskType): string   { return typeLabel(type); }
  typeBadge(type: TaskType): string   { return typeBadge(type); }
  statusBadge(status: TaskStatus): string { return statusBadge(status); }
  statusLabel(status: TaskStatus): string { return statusLabel(status); }
}
