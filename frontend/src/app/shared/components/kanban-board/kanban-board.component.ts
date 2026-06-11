import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Task } from '../../../core/models/task.models';
import { daysFromToday } from '../../utils/urgency';

@Component({
  selector: 'app-kanban-board',
  templateUrl: './kanban-board.component.html',
  styleUrl: './kanban-board.component.scss',
})
export class KanbanBoardComponent {
  @Input() tasks: Task[] = [];
  @Input() showTechnicianAvatar = false;
  @Input() selectedTaskId: string | null = null;
  @Output() taskSelected = new EventEmitter<Task>();

  private get activeTasks(): Task[] {
    return this.tasks.filter(
      t => t.status !== 'DONE' && t.status !== 'ESCALATED' && t.status !== 'NOT_DONE',
    );
  }

  // "Pendientes" includes both PENDING and IN_PROGRESS (active work) — single active column by design
  get kanbanPending(): Task[] {
    return [...this.activeTasks].sort(
      (a, b) => daysFromToday(a.scheduledDate) - daysFromToday(b.scheduledDate),
    );
  }

  get kanbanDone(): Task[]   { return this.tasks.filter(t => t.status === 'DONE'); }
  get kanbanClosed(): Task[] { return this.tasks.filter(t => t.status === 'ESCALATED' || t.status === 'NOT_DONE'); }

  onTaskSelected(task: Task): void { this.taskSelected.emit(task); }
}
