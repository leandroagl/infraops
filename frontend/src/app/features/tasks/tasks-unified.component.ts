import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Task, TaskGroup, TaskType, TaskStatus, CycleStats } from '../../core/models/task.models';
import { TasksService, TaskFilters } from '../../core/services/tasks.service';
import { AuthService } from '../../core/services/auth.service';
import { ClientsService } from '../../core/services/clients.service';
import { TechniciansService } from '../../core/services/technicians.service';
import { Client } from '../../core/models/client.models';
import { Technician } from '../../core/models/technician.models';
import { UserRole } from '../../core/models/auth.models';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TaskCreateDialogComponent } from '../admin/tasks/task-create-dialog/task-create-dialog.component';

@Component({
  selector: 'app-tasks-unified',
  templateUrl: './tasks-unified.component.html',
  styleUrl: './tasks-unified.component.scss',
})
export class TasksUnifiedComponent implements OnInit {
  tasks: Task[] = [];
  clients: Client[] = [];
  technicians: Technician[] = [];
  selectedTask: Task | null = null;
  loading = false;
  error = '';
  currentMonth: number;
  currentYear: number;
  techFilter: string | null = null;
  clientFilter: string | null = null;
  typeFilter: TaskType | null = null;
  statusFilter: TaskStatus | null = null;

  readonly taskTypes: { value: TaskType; label: string }[] = [
    { value: 'SERVER_HOST_MAINTENANCE',  label: 'Servidores' },
    { value: 'WINDOWS_DOMAIN_MAINTENANCE', label: 'Dominio Windows' },
    { value: 'QNAP_MAINTENANCE',         label: 'QNAP' },
    { value: 'VEEAM_BACKUP',             label: 'Veeam Backup' },
    { value: 'ROUTER_MAINTENANCE',       label: 'Routers' },
    { value: 'TERMINAL_MAINTENANCE',     label: 'Terminales' },
    { value: 'SITE_VISIT',               label: 'Visita presencial' },
    { value: 'AV_CONTROL',               label: 'Antivirus' },
    { value: 'UPS_CONTROL',              label: 'UPS' },
    { value: 'ENDPOINT_INVENTORY',       label: 'Inventario endpoints' },
  ];

  readonly taskStatuses: { value: TaskStatus; label: string }[] = [
    { value: 'PENDING',     label: 'Pendiente' },
    { value: 'IN_PROGRESS', label: 'En progreso' },
    { value: 'DONE',        label: 'Hecho' },
    { value: 'ESCALATED',   label: 'Escalado' },
    { value: 'NOT_DONE',    label: 'No realizado' },
  ];

  private readonly destroyRef = inject(DestroyRef);
  private readonly load$ = new Subject<void>();

  constructor(
    private tasksService: TasksService,
    private clientsService: ClientsService,
    private techniciansService: TechniciansService,
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
    return this.userRole === 'ADMIN';
  }

  get hasActiveFilters(): boolean {
    return !!(this.clientFilter || this.typeFilter || this.statusFilter || this.techFilter);
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
    this.clientsService.getAll().pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(clients => { this.clients = clients; });

    this.techniciansService.getAll().pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(techs => { this.technicians = techs; });

    this.load$.pipe(
      switchMap(() => {
        this.loading = true;
        this.error   = '';
        const filters: TaskFilters = {
          month: this.currentMonth,
          year:  this.currentYear,
        };
        if (this.techFilter)   filters.technicianId = this.techFilter;
        if (this.clientFilter) filters.clientId     = this.clientFilter;
        if (this.typeFilter)   filters.type         = this.typeFilter;
        if (this.statusFilter) filters.status       = this.statusFilter;
        return this.tasksService.getAll(filters);
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next:  tasks => { this.tasks = tasks; this.loading = false; },
      error: ()    => { this.error = 'No se pudieron cargar las tareas.'; this.loading = false; },
    });

    this.load$.next();
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

  onFilterChange(): void {
    this.selectedTask = null;
    this.load();
  }

  clearFilters(): void {
    this.clientFilter = null;
    this.typeFilter   = null;
    this.statusFilter = null;
    this.techFilter   = null;
    this.selectedTask = null;
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

}
