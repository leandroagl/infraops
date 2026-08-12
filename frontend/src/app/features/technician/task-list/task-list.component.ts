import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { Task, TaskStatus, TaskType } from '../../../core/models/task.models';
import { AuthService } from '../../../core/services/auth.service';
import { TasksService } from '../../../core/services/tasks.service';
import { typeLabel } from '../../../shared/utils/task-labels';
import { daysFromToday } from '../../../shared/utils/urgency';

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

  // ── Filtros ───────────────────────────────────────────────────
  selectedClientId: string | null = null;
  clientSearchCtrl = new FormControl<string>('', { nonNullable: true });
  typeCtrl = new FormControl<TaskType | null>(null);

  readonly taskTypes: { value: TaskType; label: string }[] = [
    { value: 'SERVER_HOST_MAINTENANCE',    label: typeLabel('SERVER_HOST_MAINTENANCE')    },
    { value: 'WINDOWS_DOMAIN_MAINTENANCE', label: typeLabel('WINDOWS_DOMAIN_MAINTENANCE') },
    { value: 'QNAP_MAINTENANCE',           label: typeLabel('QNAP_MAINTENANCE')           },
    { value: 'VEEAM_BACKUP',              label: typeLabel('VEEAM_BACKUP')               },
    { value: 'ROUTER_MAINTENANCE',         label: typeLabel('ROUTER_MAINTENANCE')         },
    { value: 'TERMINAL_MAINTENANCE',       label: typeLabel('TERMINAL_MAINTENANCE')       },
    { value: 'SITE_VISIT',               label: typeLabel('SITE_VISIT')                  },
    { value: 'AV_CONTROL',              label: typeLabel('AV_CONTROL')                   },
    { value: 'UPS_CONTROL',             label: typeLabel('UPS_CONTROL')                  },
    { value: 'ENDPOINT_INVENTORY',       label: typeLabel('ENDPOINT_INVENTORY')           },
  ];

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private authService: AuthService,
    private tasksService: TasksService,
  ) {}

  get currentUser() { return this.authService.getCurrentUser(); }

  // ── KPI getters (sobre tasks sin filtrar) ─────────────────────

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

  // ── Filtros ───────────────────────────────────────────────────

  get filteredTasks(): Task[] {
    return this.tasks.filter(t =>
      (!this.selectedClientId || t.clientId === this.selectedClientId) &&
      (!this.typeCtrl.value   || t.type     === this.typeCtrl.value),
    );
  }

  get clientOptions(): { id: string; name: string }[] {
    const search = this.clientSearchCtrl.value.toLowerCase();
    const seen = new Set<string>();
    const all = this.tasks
      .filter(t => t.client)
      .reduce<{ id: string; name: string }[]>((acc, t) => {
        if (!seen.has(t.clientId)) {
          seen.add(t.clientId);
          acc.push({ id: t.clientId, name: t.client!.name });
        }
        return acc;
      }, [])
      .sort((a, b) => a.name.localeCompare(b.name));
    return search ? all.filter(c => c.name.toLowerCase().includes(search)) : all;
  }

  onClientSelected(event: MatAutocompleteSelectedEvent): void {
    this.selectedClientId = event.option.value as string;
    this.clientSearchCtrl.setValue(event.option.viewValue, { emitEvent: false });
  }

  clearClientFilter(): void {
    this.selectedClientId = null;
    this.clientSearchCtrl.setValue('');
  }

  // ── Lifecycle ─────────────────────────────────────────────────

  ngOnInit(): void {
    this.load();
    this.clientSearchCtrl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => { this.selectedClientId = null; });
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

  selectTask(task: Task): void { this.selectedTask = task; }
  closeDrawer(): void          { this.selectedTask = null; }

  onTaskCompleted(): void {
    this.updateTaskStatusLocally(this.selectedTask?.id, 'DONE');
    this.closeDrawer();
  }

  onTaskNotDone(): void {
    this.updateTaskStatusLocally(this.selectedTask?.id, 'NOT_DONE');
    this.closeDrawer();
  }

  onTaskStatusChanged(status: TaskStatus): void {
    this.updateTaskStatusLocally(this.selectedTask?.id, status);
  }

  private updateTaskStatusLocally(taskId: string | undefined, status: TaskStatus): void {
    if (!taskId) return;
    const idx = this.tasks.findIndex(t => t.id === taskId);
    if (idx !== -1) this.tasks[idx] = { ...this.tasks[idx], status };
  }
}
