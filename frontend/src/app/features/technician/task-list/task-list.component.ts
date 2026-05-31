import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Task, TaskType, TaskStatus } from '../../../core/models/task.models';
import { AuthService } from '../../../core/services/auth.service';
import { TasksService } from '../../../core/services/tasks.service';

@Component({
  selector: 'app-task-list',
  templateUrl: './task-list.component.html',
  styleUrl: './task-list.component.scss',
})
export class TaskListComponent implements OnInit, OnDestroy {
  tasks: Task[] = [];
  selectedTask: Task | null = null;
  loading = false;
  error = '';

  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private tasksService: TasksService,
  ) {}

  get currentUser() { return this.authService.getCurrentUser(); }

  // ── Helpers de urgencia ───────────────────────────────────────────────────

  /** Días enteros entre hoy (medianoche local) y la fecha dada. Positivo = futuro, negativo = pasado. */
  daysFromToday(date: string): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Parse YYYY-MM-DD as local time to avoid UTC-offset shifting the day boundary
    const [year, month, day] = date.split('T')[0].split('-').map(Number);
    const target = new Date(year, month - 1, day, 0, 0, 0, 0);
    return Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  urgencyLabel(days: number): string {
    if (days < 0) return `+${Math.abs(days)}d vencido`;
    if (days <= 7) return `vence en ${days}d`;
    return `${days}d restantes`;
  }

  urgencyClass(days: number): string {
    if (days < 0) return 'urg-crit';
    if (days <= 7) return 'urg-warn';
    return 'urg-ok';
  }

  statusDotColor(task: Task): string {
    const days = this.daysFromToday(task.scheduledDate);
    if (days < 0) return 'var(--crit)';
    if (days <= 7) return 'var(--warn)';
    return 'var(--ok)';
  }

  // ── KPI getters ───────────────────────────────────────────────────────────

  private get activeTasks(): Task[] {
    return this.tasks.filter(
      t => t.status !== 'DONE' && t.status !== 'ESCALATED' && t.status !== 'NOT_DONE',
    );
  }

  get overdueCount(): number {
    return this.activeTasks.filter(t => this.daysFromToday(t.scheduledDate) < 0).length;
  }

  get thisWeekCount(): number {
    return this.activeTasks.filter(t => {
      const d = this.daysFromToday(t.scheduledDate);
      return d >= 0 && d <= 7;
    }).length;
  }

  get onTimeCount(): number {
    return this.activeTasks.filter(t => this.daysFromToday(t.scheduledDate) > 7).length;
  }

  get technicianName(): string {
    const nameFromTask = this.tasks[0]?.technician?.user?.name;
    if (nameFromTask) return nameFromTask;
    return this.currentUser?.email?.split('@')[0] ?? '';
  }

  // ── Secciones de la lista ─────────────────────────────────────────────────

  get overdueTasks(): Task[] {
    return this.activeTasks.filter(t => this.daysFromToday(t.scheduledDate) < 0);
  }

  get pendingTasks(): Task[] {
    return this.activeTasks.filter(t => this.daysFromToday(t.scheduledDate) >= 0);
  }

  get doneTasks(): Task[] {
    return this.tasks.filter(
      t => t.status === 'DONE' || t.status === 'ESCALATED' || t.status === 'NOT_DONE',
    );
  }

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    const user = this.currentUser;
    if (!user?.technicianId) return;

    this.loading = true;
    this.error = '';
    this.tasksService.getAll({ technicianId: user.technicianId })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: tasks => { this.tasks = tasks; this.loading = false; },
        error: () => { this.error = 'No se pudieron cargar las tareas.'; this.loading = false; },
      });
  }

  selectTask(task: Task): void {
    this.selectedTask = task;
  }

  closeDrawer(): void {
    this.selectedTask = null;
  }

  onTaskCompleted(): void {
    this.updateTaskStatusLocally(this.selectedTask?.id, 'DONE');
    this.closeDrawer();
  }

  onTaskNotDone(): void {
    this.updateTaskStatusLocally(this.selectedTask?.id, 'NOT_DONE');
    this.closeDrawer();
  }

  private updateTaskStatusLocally(taskId: string | undefined, status: TaskStatus): void {
    if (!taskId) return;
    const idx = this.tasks.findIndex(t => t.id === taskId);
    if (idx !== -1) {
      this.tasks[idx] = { ...this.tasks[idx], status };
    }
  }

  typeLabel(type: TaskType): string {
    const labels: Record<TaskType, string> = {
      SERVER_MAINTENANCE:   'Mantenimiento de servidores',
      TERMINAL_MAINTENANCE: 'Visita de terminales',
      SITE_VISIT:           'Visita presencial',
      AV_CONTROL:           'Control antivirus',
      UPS_CONTROL:          'Control UPS',
      ENDPOINT_INVENTORY:   'Inventario',
    };
    return labels[type];
  }

  typeIconClass(type: TaskType): string {
    return type === 'TERMINAL_MAINTENANCE' || type === 'SITE_VISIT' ? 'ti-visit' : 'ti-srv';
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
  }
}
