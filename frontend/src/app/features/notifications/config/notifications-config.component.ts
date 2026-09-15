import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import {
  IntegrationConfigService,
  HelpdeskTeamDto,
  HelpdeskTagDto,
} from '../../../core/services/integration-config.service';
import { ExpirationTypeConfigEntry, ExpirationType } from '../../../core/models/notification.models';

export const EXPIRATION_TYPES: ExpirationType[] = [
  'asset_warranty', 'certificate', 'domain', 'software',
];

@Component({
  selector: 'app-notifications-config',
  templateUrl: './notifications-config.component.html',
  styleUrl: './notifications-config.component.scss',
})
export class NotificationsConfigComponent implements OnInit {
  form: FormGroup;
  loading = true;
  saving = false;
  teams: HelpdeskTeamDto[] = [];
  tags: HelpdeskTagDto[] = [];
  readonly types = EXPIRATION_TYPES;

  constructor(
    private readonly fb: FormBuilder,
    private readonly svc: IntegrationConfigService,
    private readonly router: Router,
  ) {
    this.form = this.fb.group(
      Object.fromEntries(
        EXPIRATION_TYPES.map(type => [
          type,
          this.fb.group({
            enabled:        [false],
            helpdeskTeamId: [{ value: null, disabled: true }],
            daysAhead:      [{ value: 30,   disabled: true }],
            tagIds:         [{ value: [],   disabled: true }],
          }),
        ]),
      ),
    );
  }

  ngOnInit(): void {
    forkJoin({
      config: this.svc.getOdoo(),
      teams:  this.svc.getHelpdeskTeams().pipe(catchError(() => of([]))),
      tags:   this.svc.getHelpdeskTags().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ config, teams, tags }) => {
        this.teams = teams;
        this.tags  = tags;
        const configs = (config.expirationsTypeConfigs ?? {}) as Record<string, ExpirationTypeConfigEntry>;
        for (const type of EXPIRATION_TYPES) {
          const entry = configs[type];
          if (entry) {
            const group = this.form.get(type) as FormGroup;
            group.get('enabled')!.setValue(entry.enabled);
            group.get('helpdeskTeamId')!.setValue(entry.helpdeskTeamId);
            group.get('daysAhead')!.setValue(entry.daysAhead);
            group.get('tagIds')!.setValue(entry.tagIds);
            this.applyEnabledState(group, entry.enabled);
          }
        }
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  onToggleChange(type: string): void {
    const group = this.form.get(type) as FormGroup;
    const enabled = group.get('enabled')!.value as boolean;
    this.applyEnabledState(group, enabled);
  }

  isEnabled(type: string): boolean {
    return !!(this.form.get(type) as FormGroup).get('enabled')!.value;
  }

  get formValid(): boolean {
    return EXPIRATION_TYPES.every(type => {
      const g = this.form.get(type) as FormGroup;
      const enabled = g.get('enabled')!.value as boolean;
      return !enabled || !!g.get('helpdeskTeamId')!.value;
    });
  }

  typeClass(type: ExpirationType): string {
    const map: Record<ExpirationType, string> = {
      asset_warranty: 'badge--srv',
      certificate:    'badge--bkp',
      domain:         'badge--accent',
      software:       'badge--win',
    };
    return map[type];
  }

  typeLabel(type: ExpirationType): string {
    const map: Record<ExpirationType, string> = {
      asset_warranty: 'Garantía',
      certificate:    'Certificado',
      domain:         'Dominio',
      software:       'Licencia',
    };
    return map[type];
  }

  save(): void {
    if (!this.formValid) return;
    this.saving = true;
    const expirationsTypeConfigs: Record<string, ExpirationTypeConfigEntry> = {};
    for (const type of EXPIRATION_TYPES) {
      const g = this.form.get(type) as FormGroup;
      expirationsTypeConfigs[type] = g.getRawValue() as ExpirationTypeConfigEntry;
    }
    this.svc.patchOdoo({ expirationsTypeConfigs } as any).subscribe({
      next: () => {
        this.saving = false;
        this.router.navigate(['/notifications']);
      },
      error: () => { this.saving = false; },
    });
  }

  back(): void {
    this.router.navigate(['/notifications']);
  }

  private applyEnabledState(group: FormGroup, enabled: boolean): void {
    ['helpdeskTeamId', 'daysAhead', 'tagIds'].forEach(ctrl => {
      const c = group.get(ctrl)!;
      enabled ? c.enable() : c.disable();
    });
  }
}
