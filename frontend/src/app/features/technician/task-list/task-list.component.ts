import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Task, TaskType, TaskStatus } from '../../../core/models/task.models';
import { AuthService } from '../../../core/services/auth.service';
import { TasksService } from '../../../core/services/tasks.service';
import { typeLabelLong } from '../../../shared/utils/task-labels';
import { daysFromToday, urgencyLabel, urgencyClass } from '../../../shared/utils/urgency';

@Component({
  selector: 'app-task-list',
  templateUrl: './task-list.component.html',
  styleUrl: './task-list.component.scss',
})
export class TaskListComponent implements OnInit {
  tasks: Task[] = [];
  selectedTask: Task | null = null;
  loading = false;
  error = '';

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private authService: AuthService,
    private tasksService: TasksService,
  ) {}

  get currentUser() { return this.authService.getCurrentUser(); }

  // ── Helpers de urgencia ───────────────────────────────────────────────────

  daysFromToday(date: string): number { return daysFromToday(date); }
  urgencyLabel(days: number): string  { return urgencyLabel(days); }
  urgencyClass(days: number): string  { return urgencyClass(days); }

  statusDotColor(task: Task): string {
    const days = daysFromToday(task.scheduledDate);
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
    return this.activeTasks.filter(t => daysFromToday(t.scheduledDate) < 0).length;
  }

  get thisWeekCount(): number {
    return this.activeTasks.filter(t => {
      const d = daysFromToday(t.scheduledDate);
      return d >= 0 && d <= 7;
    }).length;
  }

  get onTimeCount(): number {
    return this.activeTasks.filter(t => daysFromToday(t.scheduledDate) > 7).length;
  }

  get technicianName(): string {
    const nameFromTask = this.tasks[0]?.technician?.user?.name;
    if (nameFromTask) return nameFromTask;
    return this.currentUser?.email?.split('@')[0] ?? '';
  }

  // ── Secciones de la lista ─────────────────────────────────────────────────

  get overdueTasks(): Task[] {
    return this.activeTasks.filter(t => daysFromToday(t.scheduledDate) < 0);
  }

  get pendingTasks(): Task[] {
    return this.activeTasks.filter(t => daysFromToday(t.scheduledDate) >= 0);
  }

  get doneTasks(): Task[] {
    return this.tasks.filter(
      t => t.status === 'DONE' || t.status === 'ESCALATED' || t.status === 'NOT_DONE',
    );
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const user = this.currentUser;
    if (!user?.technicianId) return;

    this.loading = true;
    this.error = '';
    this.tasksService.getAll({ technicianId: user.technicianId })
      .pipe(takeUntilDestroyed(this.destroyRef))
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

  typeLabel(type: TaskType): string { return typeLabelLong(type); }

  typeIconClass(type: TaskType): string {
    return type === 'TERMINAL_MAINTENANCE' || type === 'SITE_VISIT' ? 'ti-visit' : 'ti-srv';
  }
}
