import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TaskConfigService } from '../../../../core/services/task-config.service';
import { OdooHelpdeskTagDto, TaskTypeConfigDto } from '../../../../core/models/task.models';

const TIME_PATTERN = /^[0-9]{1,2}:[0-5][0-9]$/;

@Component({
  selector: 'app-task-edit-dialog',
  templateUrl: './task-edit-dialog.component.html',
})
export class TaskEditDialogComponent implements OnInit {
  availableTags: OdooHelpdeskTagDto[] = [];
  loadingTags = true;
  saving = false;

  form = new FormGroup({
    time:                new FormControl('', [Validators.required, Validators.pattern(TIME_PATTERN)]),
    tagIds:              new FormControl<number[]>([]),
    ticketDescription:   new FormControl<string>(''),
    timesheetDescription: new FormControl<string>(''),
  });

  constructor(
    private dialogRef: MatDialogRef<TaskEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { config: TaskTypeConfigDto },
    private taskConfigService: TaskConfigService,
  ) {}

  ngOnInit(): void {
    const {
      defaultTimeMinutes, odooTagIds,
      ticketDescription, defaultTicketDescription,
      timesheetDescription, defaultTimesheetDescription,
    } = this.data.config;
    this.form.patchValue({
      time:                 defaultTimeMinutes != null ? this.minutesToTime(defaultTimeMinutes) : '',
      tagIds:                odooTagIds,
      ticketDescription:     ticketDescription ?? defaultTicketDescription ?? '',
      timesheetDescription: timesheetDescription ?? defaultTimesheetDescription ?? '',
    });

    this.taskConfigService.getHelpdeskTags().subscribe({
      next: tags => { this.availableTags = tags; this.loadingTags = false; },
      error: () => { this.loadingTags = false; },
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving = true;

    const minutes = this.timeToMinutes(this.form.value.time!);
    const tagIds  = this.form.value.tagIds ?? [];
    const tagNames = tagIds.map(id => this.availableTags.find(t => t.id === id)?.name ?? '');
    const ticketDescription = this.form.value.ticketDescription ?? '';
    const timesheetDescription = this.form.value.timesheetDescription ?? '';

    this.taskConfigService.update(this.data.config.taskType, {
      defaultTimeMinutes:   minutes,
      odooTagIds:           tagIds,
      odooTagNames:         tagNames,
      ticketDescription:    ticketDescription || undefined,
      timesheetDescription: timesheetDescription || undefined,
    }).subscribe({
      next: updated => { this.saving = false; this.dialogRef.close(updated); },
      error: () => { this.saving = false; },
    });
  }

  cancel(): void {
    this.dialogRef.close(null);
  }

  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }
}
