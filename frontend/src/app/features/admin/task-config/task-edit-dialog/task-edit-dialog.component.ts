import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TaskConfigService } from '../../../../core/services/task-config.service';
import { OdooHelpdeskTagDto, TaskTypeConfigDto } from '../../../../core/models/task.models';
import { TIME_PATTERN, minutesToTime, timeToMinutes } from '../../../../shared/utils/time-format';

@Component({
  selector: 'app-task-edit-dialog',
  templateUrl: './task-edit-dialog.component.html',
  styleUrls: ['./task-edit-dialog.component.scss'],
})
export class TaskEditDialogComponent implements OnInit {
  availableTags: OdooHelpdeskTagDto[] = [];
  loadingTags = true;
  saving = false;
  ondraHosts: string[] = [];
  hostInput = new FormControl('');

  form = new FormGroup({
    time:                 new FormControl('', [Validators.required, Validators.pattern(TIME_PATTERN)]),
    tagIds:               new FormControl<number[]>([]),
    ticketDescription:    new FormControl<string>(''),
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
      ondraOwnedHosts,
    } = this.data.config;

    this.form.patchValue({
      time:                 defaultTimeMinutes != null ? minutesToTime(defaultTimeMinutes) : '',
      tagIds:               odooTagIds,
      ticketDescription:    ticketDescription ?? defaultTicketDescription ?? '',
      timesheetDescription: timesheetDescription ?? defaultTimesheetDescription ?? '',
    });

    this.ondraHosts = [...(ondraOwnedHosts ?? [])];

    this.taskConfigService.getHelpdeskTags().subscribe({
      next: tags => { this.availableTags = tags; this.loadingTags = false; },
      error: () => { this.loadingTags = false; },
    });
  }

  addHost(): void {
    const value = (this.hostInput.value ?? '').trim();
    if (value) {
      this.ondraHosts = [...this.ondraHosts, value];
      this.hostInput.setValue('');
    }
  }

  removeHost(host: string): void {
    this.ondraHosts = this.ondraHosts.filter(h => h !== host);
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving = true;

    const minutes = timeToMinutes(this.form.value.time!);
    const tagIds   = this.form.value.tagIds ?? [];
    const tagNames = tagIds.map(id => this.availableTags.find(t => t.id === id)?.name ?? '');
    const ticketDescription     = this.form.value.ticketDescription ?? '';
    const timesheetDescription  = this.form.value.timesheetDescription ?? '';
    const isServerHostTask = this.data.config.taskType === 'SERVER_HOST_MAINTENANCE';

    this.taskConfigService.update(this.data.config.taskType, {
      defaultTimeMinutes:  minutes,
      odooTagIds:          tagIds,
      odooTagNames:        tagNames,
      ticketDescription:   ticketDescription || undefined,
      timesheetDescription: timesheetDescription || undefined,
      ondraOwnedHosts:     isServerHostTask ? this.ondraHosts : undefined,
    }).subscribe({
      next: updated => { this.saving = false; this.dialogRef.close(updated); },
      error: () => { this.saving = false; },
    });
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
