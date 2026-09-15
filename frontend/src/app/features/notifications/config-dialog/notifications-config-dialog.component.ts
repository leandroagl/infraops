import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { catchError, forkJoin, of } from 'rxjs';
import {
  IntegrationConfigService, HelpdeskTeamDto, HelpdeskTagDto,
} from '../../../core/services/integration-config.service';

@Component({
  selector: 'app-notifications-config-dialog',
  templateUrl: './notifications-config-dialog.component.html',
  styleUrl: './notifications-config-dialog.component.scss',
})
export class NotificationsConfigDialogComponent implements OnInit {
  form: FormGroup;
  loading = true;
  saving = false;
  teams: HelpdeskTeamDto[] = [];
  tags: HelpdeskTagDto[] = [];
  teamsError = false;
  tagsError = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly svc: IntegrationConfigService,
    private readonly dialogRef: MatDialogRef<NotificationsConfigDialogComponent>,
  ) {
    this.form = this.fb.group({
      expirationsHelpdeskTeamId: [null, Validators.required],
      expirationsTicketDaysAhead: [30, [Validators.required, Validators.min(1)]],
      expirationsTagIds: [[]],
    });
    this.form.disable();
  }

  ngOnInit(): void {
    forkJoin({
      config: this.svc.getOdoo(),
      teams: this.svc.getHelpdeskTeams().pipe(catchError(() => {
        this.teamsError = true; return of([]);
      })),
      tags: this.svc.getHelpdeskTags().pipe(catchError(() => {
        this.tagsError = true; return of([]);
      })),
    }).subscribe({
      next: ({ config, teams, tags }) => {
        this.teams = teams;
        this.tags = tags;
        this.form.patchValue({
          expirationsHelpdeskTeamId: config.expirationsHelpdeskTeamId || null,
          expirationsTicketDaysAhead: config.expirationsTicketDaysAhead || 30,
          expirationsTagIds: config.expirationsTagIds || [],
        });
        this.form.enable();
        this.loading = false;
      },
      error: () => {
        this.form.enable();
        this.loading = false;
      },
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving = true;
    this.form.disable();
    const v = this.form.getRawValue() as {
      expirationsHelpdeskTeamId: number;
      expirationsTicketDaysAhead: number;
      expirationsTagIds: number[];
    };
    this.svc.patchOdoo({
      expirationsHelpdeskTeamId: v.expirationsHelpdeskTeamId,
      expirationsTicketDaysAhead: v.expirationsTicketDaysAhead,
      expirationsTagIds: v.expirationsTagIds,
    }).subscribe({
      next: () => this.dialogRef.close(true),
      error: () => {
        this.saving = false;
        this.form.enable();
      },
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
