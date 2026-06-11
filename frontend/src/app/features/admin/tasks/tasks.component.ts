import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, EMPTY, switchMap } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Task } from '../../../core/models/task.models';
import { Client } from '../../../core/models/client.models';
import { Technician } from '../../../core/models/technician.models';
import { TasksService, TaskFilters } from '../../../core/services/tasks.service';
import { ClientsService } from '../../../core/services/clients.service';
import { TechniciansService } from '../../../core/services/technicians.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { TaskCreateDialogComponent } from './task-create-dialog/task-create-dialog.component';

@Component({
  selector: 'app-tasks',
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.scss',
})
export class TasksComponent implements OnInit {
  tasks: Task[] = [];
  clients: Client[] = [];
  technicians: Technician[] = [];
  loading = false;
  error = '';
  filterStatus = '';
  filterClientId = '';
  filterTechnicianId = '';
  selectedTask: Task | null = null;

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
    private clientsService: ClientsService,
    private techniciansService: TechniciansService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    forkJoin({
      clients:     this.clientsService.getAll(),
      technicians: this.techniciansService.getAll(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ clients, technicians }) => {
        this.clients     = clients;
        this.technicians = technicians;
      },
    });
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    const filters: TaskFilters = {};
    if (this.filterStatus)       filters.status       = this.filterStatus;
    if (this.filterClientId)     filters.clientId     = this.filterClientId;
    if (this.filterTechnicianId) filters.technicianId = this.filterTechnicianId;
    this.tasksService.getAll(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: tasks => { this.tasks = tasks; this.loading = false; },
      error: () => { this.error = 'No se pudieron cargar las tareas.'; this.loading = false; },
    });
  }

  selectTask(task: Task): void { this.selectedTask = task; }
  closeDrawer(): void          { this.selectedTask = null; }

  openCreateDialog(): void {
    this.dialog.open(TaskCreateDialogComponent, { width: '480px' })
      .afterClosed().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(task => {
        if (task) this.tasks = [...this.tasks, task];
      });
  }

  deleteTask(task: Task): void {
    const clientName = task.client?.name ?? 'este cliente';
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar tarea',
        message: `¿Eliminar la tarea de ${clientName}? Esta acción no se puede deshacer.`,
      },
    }).afterClosed()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(confirmed => confirmed ? this.tasksService.delete(task.id) : EMPTY),
      )
      .subscribe({
        next: () => {
          this.tasks = this.tasks.filter(t => t.id !== task.id);
          this.snackBar.open('Tarea eliminada', 'Cerrar', { duration: 3000 });
        },
        error: () => {
          this.snackBar.open('No se pudo eliminar la tarea', 'Cerrar', { duration: 4000 });
        },
      });
  }
}
