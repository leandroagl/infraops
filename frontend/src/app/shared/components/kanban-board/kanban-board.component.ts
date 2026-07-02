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

  private sortByDate(tasks: Task[]): Task[] {
    return [...tasks].sort((a, b) => daysFromToday(a.scheduledDate) - daysFromToday(b.scheduledDate));
  }

  get kanbanBacklog(): Task[]     { return this.sortByDate(this.tasks.filter(t => t.status === 'PENDING')); }
  get kanbanInProgress(): Task[]  { return this.sortByDate(this.tasks.filter(t => t.status === 'IN_PROGRESS')); }
  get kanbanDone(): Task[]        { return this.tasks.filter(t => t.status === 'DONE' || t.status === 'ESCALATED' || t.status === 'NOT_DONE'); }

  onTaskSelected(task: Task): void { this.taskSelected.emit(task); }
}
