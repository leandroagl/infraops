import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { forkJoin } from 'rxjs';
import { NotificationsService } from '../../../../core/services/notifications.service';
import {
  IntegrationConfigService,
  HelpdeskTeamDto,
  HelpdeskTagDto,
} from '../../../../core/services/integration-config.service';
import { ExpirationType, ExpirationTypeConfigEntry } from '../../../../core/models/notification.models';
import { TIME_PATTERN, minutesToTime, timeToMinutes } from '../../../../shared/utils/time-format';

@Component({
  selector: 'app-notifications-type-edit-dialog',
  templateUrl: './notifications-type-edit-dialog.component.html',
  styleUrls: ['./notifications-type-edit-dialog.component.scss'],
})
export class NotificationsTypeEditDialogComponent implements OnInit {
  teams: HelpdeskTeamDto[] = [];
  tags: HelpdeskTagDto[] = [];
  loading = true;
  saving = false;

  form = new FormGroup({
    enabled:              new FormControl(false),
    helpdeskTeamId:       new FormControl<number | null>(null),
    daysAhead:            new FormControl(30, [Validators.required, Validators.min(1)]),
    taskName:             new FormControl(''),
    time:                 new FormControl('', [Validators.pattern(TIME_PATTERN)]),
    tagIds:               new FormControl<number[]>([]),
    ticketDescription:    new FormControl(''),
    timesheetDescription: new FormControl(''),
  });

  constructor(
    private dialogRef: MatDialogRef<NotificationsTypeEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { type: ExpirationType; entry: ExpirationTypeConfigEntry },
    private notificationsService: NotificationsService,
    private integrationConfigService: IntegrationConfigService,
  ) {}

  ngOnInit(): void {
    const { enabled, helpdeskTeamId, daysAhead, tagIds, taskName, defaultTimeMinutes, ticketDescription, timesheetDescription } = this.data.entry;

    this.form.patchValue({
      enabled,
      helpdeskTeamId,
      daysAhead,
      tagIds,
      taskName: taskName ?? '',
      time: defaultTimeMinutes != null ? minutesToTime(defaultTimeMinutes) : '',
      ticketDescription: ticketDescription ?? '',
      timesheetDescription: timesheetDescription ?? '',
    });

    forkJoin({
      teams: this.integrationConfigService.getHelpdeskTeams(),
      tags: this.integrationConfigService.getHelpdeskTags(),
    }).subscribe({
      next: ({ teams, tags }) => { this.teams = teams; this.tags = tags; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  get isValid(): boolean {
    const v = this.form.value;
    if (this.form.controls.daysAhead.invalid || this.form.controls.time.invalid) return false;
    return !v.enabled || !!v.helpdeskTeamId;
  }

  save(): void {
    if (!this.isValid) return;
    this.saving = true;

    const v = this.form.value;
    const time = v.time ?? '';

    const entry: ExpirationTypeConfigEntry = {
      enabled: v.enabled ?? false,
      helpdeskTeamId: v.helpdeskTeamId ?? null,
      daysAhead: v.daysAhead ?? 30,
      tagIds: v.tagIds ?? [],
      taskName: (v.taskName ?? '').trim() || null,
      defaultTimeMinutes: time ? timeToMinutes(time) : null,
      ticketDescription: (v.ticketDescription ?? '').trim() || null,
      timesheetDescription: (v.timesheetDescription ?? '').trim() || null,
    };

    this.notificationsService.patchTypeConfig(this.data.type, entry).subscribe({
      next: () => { this.saving = false; this.dialogRef.close(entry); },
      error: () => { this.saving = false; },
    });
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
