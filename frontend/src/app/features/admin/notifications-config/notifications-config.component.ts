import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { forkJoin } from 'rxjs';
import { IntegrationConfigService, HelpdeskTeamDto } from '../../../core/services/integration-config.service';
import { ExpirationType, ExpirationTypeConfigEntry } from '../../../core/models/notification.models';
import { NotificationsTypeEditDialogComponent } from './type-edit-dialog/notifications-type-edit-dialog.component';
import { formatMinutes } from '../../../shared/utils/time-format';

export const EXPIRATION_TYPES: ExpirationType[] = [
  'asset_warranty', 'certificate', 'domain', 'software',
];

type ConfigRow = ExpirationTypeConfigEntry & { type: ExpirationType };

const DEFAULT_ENTRY: ExpirationTypeConfigEntry = {
  enabled: false, helpdeskTeamId: null, daysAhead: 30, tagIds: [],
  taskName: null, defaultTimeMinutes: null, ticketDescription: null, timesheetDescription: null,
};

@Component({
  selector: 'app-notifications-config',
  templateUrl: './notifications-config.component.html',
  styleUrl: './notifications-config.component.scss',
})
export class NotificationsConfigComponent implements OnInit {
  configs: ConfigRow[] = [];
  teams: HelpdeskTeamDto[] = [];
  loading = true;
  readonly displayedColumns = ['type', 'enabled', 'helpdeskTeamId', 'daysAhead', 'defaultTimeMinutes', 'tagIds', 'actions'];

  constructor(
    private readonly svc: IntegrationConfigService,
    private readonly dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    forkJoin({
      config: this.svc.getOdoo(),
      teams: this.svc.getHelpdeskTeams(),
    }).subscribe({
      next: ({ config, teams }) => {
        this.teams = teams;
        const typeConfigs = (config.expirationsTypeConfigs ?? {}) as Record<string, ExpirationTypeConfigEntry>;
        this.configs = EXPIRATION_TYPES.map(type => ({
          type,
          ...(typeConfigs[type] ?? DEFAULT_ENTRY),
        }));
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  openEdit(row: ConfigRow): void {
    this.dialog.open(NotificationsTypeEditDialogComponent, {
      data: { type: row.type, entry: row },
      width: '640px', maxWidth: '90vw',
    })
      .afterClosed()
      .subscribe((updated: ExpirationTypeConfigEntry | null) => {
        if (updated) this.onConfigUpdated(row.type, updated);
      });
  }

  onConfigUpdated(type: ExpirationType, updated: ExpirationTypeConfigEntry): void {
    this.configs = this.configs.map(c =>
      c.type === type ? { type, ...updated } : c
    );
  }

  teamName(id: number | null): string {
    if (id == null) return '—';
    return this.teams.find(t => t.id === id)?.name ?? '—';
  }

  formatMinutes(minutes: number | null): string {
    return formatMinutes(minutes);
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
}
