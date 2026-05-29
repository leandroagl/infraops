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

  get pendingTasks()    { return this.tasks.filter(t => t.status === 'PENDING');     }
  get inProgressTasks() { return this.tasks.filter(t => t.status === 'IN_PROGRESS'); }
  get doneTasks()       { return this.tasks.filter(t => t.status === 'DONE' || t.status === 'ESCALATED' || t.status === 'NOT_DONE'); }

  get urgentCount() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.tasks.filter(t => {
      if (t.status === 'DONE' || t.status === 'ESCALATED' || t.status === 'NOT_DONE') return false;
      const d = new Date(t.scheduledDate);
      return d <= today;
    }).length;
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

  isOverdue(task: Task): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(task.scheduledDate) < today;
  }

  isDueThisWeek(task: Task): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(task.scheduledDate);
    const diff = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
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

  urgencyClass(task: Task): string {
    if (this.isOverdue(task)) return 'urg-crit';
    if (this.isDueThisWeek(task)) return 'urg-warn';
    return 'urg-ok';
  }

  urgencyLabel(task: Task): string {
    if (this.isOverdue(task)) return 'Vencido';
    if (this.isDueThisWeek(task)) return 'Esta semana';
    return 'Al día';
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
  }
}
