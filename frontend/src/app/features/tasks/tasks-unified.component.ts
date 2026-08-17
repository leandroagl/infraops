import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Task, TaskGroup, TaskStatus, CycleStats } from '../../core/models/task.models';
import { TasksService, TaskFilters } from '../../core/services/tasks.service';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models/auth.models';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { TaskCreateDialogComponent } from '../admin/tasks/task-create-dialog/task-create-dialog.component';

@Component({
  selector: 'app-tasks-unified',
  templateUrl: './tasks-unified.component.html',
  styleUrl: './tasks-unified.component.scss',
})
export class TasksUnifiedComponent implements OnInit {
  tasks: Task[] = [];
  selectedTask: Task | null = null;
  loading = false;
  error = '';
  currentMonth: number;
  currentYear: number;
  techFilter: string | null = null;

  private readonly destroyRef = inject(DestroyRef);
  private readonly load$ = new Subject<void>();

  constructor(
    private tasksService: TasksService,
    private authService: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {
    const now = new Date();
    this.currentMonth = now.getMonth() + 1;
    this.currentYear  = now.getFullYear();
  }

  get currentUser() { return this.authService.getCurrentUser(); }
  get userRole(): UserRole { return this.currentUser?.role ?? 'TECHNICIAN'; }

  get canCreateTask(): boolean {
    return this.userRole === 'ADMIN' || this.userRole === 'TL';
  }

  /** Ciclo cerrado si el mes/año seleccionado es anterior al actual */
  get cycleClosed(): boolean {
    const now = new Date();
    const nowYear  = now.getFullYear();
    const nowMonth = now.getMonth() + 1;
    return this.currentYear < nowYear
      || (this.currentYear === nowYear && this.currentMonth < nowMonth);
  }

  /** Etiqueta legible del mes/año seleccionado */
  get monthLabel(): string {
    const names = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    return `${names[this.currentMonth - 1]} ${this.currentYear}`;
  }

  /** Tareas agrupadas por cliente, preservando el orden de inserción */
  get groups(): TaskGroup[] {
    const map = new Map<string, TaskGroup>();
    for (const task of this.tasks) {
      const clientId   = task.clientId;
      const clientName = task.client?.name ?? clientId;
      if (!map.has(clientId)) {
        map.set(clientId, { clientId, clientName, tasks: [] });
      }
      map.get(clientId)!.tasks.push(task);
    }
    return Array.from(map.values());
  }

  /** KPIs del ciclo actual */
  get stats(): CycleStats {
    return {
      assigned:   this.tasks.length,
      inprogress: this.tasks.filter(t => t.status === 'IN_PROGRESS').length,
      pending:    this.tasks.filter(t => t.status === 'PENDING').length,
      done:       this.tasks.filter(t => t.status === 'DONE').length,
    };
  }

  ngOnInit(): void {
    const user = this.currentUser;
    if (user?.role === 'TECHNICIAN' && user.technicianId) {
      this.techFilter = user.technicianId;
    }

    this.load$.pipe(
      switchMap(() => {
        this.loading = true;
        this.error   = '';
        const filters: TaskFilters = {
          month: this.currentMonth,
          year:  this.currentYear,
        };
        if (this.techFilter) filters.technicianId = this.techFilter;
        return this.tasksService.getAll(filters);
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next:  tasks => { this.tasks = tasks; this.loading = false; },
      error: ()    => { this.error = 'No se pudieron cargar las tareas.'; this.loading = false; },
    });

    this.load$.next(); // dispara la carga inicial
  }

  /** Dispara una recarga del ciclo seleccionado con los filtros activos */
  load(): void {
    this.load$.next();
  }

  /** Navega al mes anterior y recarga */
  prevMonth(): void {
    if (this.currentMonth === 1) { this.currentMonth = 12; this.currentYear--; }
    else { this.currentMonth--; }
    this.selectedTask = null;
    this.load();
  }

  /** Navega al mes siguiente y recarga */
  nextMonth(): void {
    if (this.currentMonth === 12) { this.currentMonth = 1; this.currentYear++; }
    else { this.currentMonth++; }
    this.selectedTask = null;
    this.load();
  }

  /** Alterna el filtro por técnico propio (solo para usuarios con technicianId) */
  toggleTechFilter(): void {
    const user = this.currentUser;
    if (!user?.technicianId) return;
    this.techFilter = this.techFilter ? null : user.technicianId;
    this.load();
  }

  selectTask(task: Task): void { this.selectedTask = task; }
  closeDrawer(): void          { this.selectedTask = null; }

  /** Actualiza el estado de la tarea seleccionada en el array local (sin recargar) */
  onTaskStatusChanged(status: TaskStatus): void {
    if (!this.selectedTask) return;
    const idx = this.tasks.findIndex(t => t.id === this.selectedTask!.id);
    if (idx !== -1) this.tasks[idx] = { ...this.tasks[idx], status };
  }

  onTaskCompleted(): void {
    this.onTaskStatusChanged('DONE');
    this.closeDrawer();
  }

  onTaskNotDone(): void {
    this.onTaskStatusChanged('NOT_DONE');
    this.closeDrawer();
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(TaskCreateDialogComponent, {
      width: '520px',
      disableClose: true,
    });
    ref.afterClosed().pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap((created: Task | undefined) => created ? this.tasksService.getAll({
        month: this.currentMonth,
        year:  this.currentYear,
      }) : EMPTY),
    ).subscribe({
      next: tasks => { this.tasks = tasks; },
      error: () => this.snackBar.open('No se pudo recargar las tareas', 'Cerrar', { duration: 3000 }),
    });
  }

  onTaskDeleted(): void {
    if (!this.selectedTask) return;
    const task = this.selectedTask;
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar tarea',
        message: `¿Eliminar la tarea de ${task.client?.name ?? 'este cliente'}? Esta acción no se puede deshacer.`,
      },
    }).afterClosed().pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap(confirmed => confirmed ? this.tasksService.delete(task.id) : EMPTY),
    ).subscribe({
      next: () => {
        this.tasks = this.tasks.filter(t => t.id !== task.id);
        this.closeDrawer();
        this.snackBar.open('Tarea eliminada', 'Cerrar', { duration: 3000 });
      },
      error: () => this.snackBar.open('No se pudo eliminar la tarea', 'Cerrar', { duration: 4000 }),
    });
  }
}
