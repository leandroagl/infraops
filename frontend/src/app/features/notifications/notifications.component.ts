import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { ExpirationItem, ExpirationType, ExpirationTypeConfigEntry } from '../../core/models/notification.models';
import { NotificationsService } from '../../core/services/notifications.service';
import { formatOdooTicketId } from '../../shared/utils/odoo';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { IntegrationConfigService } from '../../core/services/integration-config.service';
import { OdooUrlService } from '../../core/services/odoo-url.service';

export type UrgencyZone = 'expired' | 'week' | 'soon' | 'attention';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
})
export class NotificationsComponent implements OnInit {
  items: ExpirationItem[] = [];
  loading = false;
  error = '';
  typeConfigs: Record<string, ExpirationTypeConfigEntry> = {};
  clientFilter: number | null = null;
  filterType: ExpirationType | '' = '';
  selectedUrgency: UrgencyZone | null = null;
  sortCol: 'client' | 'expireDate' = 'client';
  sortDir: 'asc' | 'desc' = 'asc';

  private readonly destroyRef = inject(DestroyRef);
  private loadSub?: Subscription;

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly authService: AuthService,
    private readonly integrationConfigService: IntegrationConfigService,
    private readonly router: Router,
    private readonly odooUrl: OdooUrlService,
  ) {}

  ngOnInit(): void {
    this.integrationConfigService.getOdoo().subscribe({
      next: (config) => {
        this.typeConfigs = (config.expirationsTypeConfigs ?? {}) as Record<string, ExpirationTypeConfigEntry>;
      },
    });
    this.load();
  }

  get isAdmin(): boolean {
    return this.authService.getCurrentUser()?.role === 'ADMIN';
  }

  openConfig(): void {
    this.router.navigate(['/admin/vencimientos']);
  }

  load(): void {
    this.loadSub?.unsubscribe();
    this.loading = true;
    this.error = '';
    // Siempre trae el histórico completo de InfraDoc — los filtros ya acotan la vista.
    this.loadSub = this.notificationsService.getExpirations(undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: items => { this.items = items; this.loading = false; },
        error: () => { this.error = 'No se pudo cargar los vencimientos'; this.loading = false; },
      });
  }

  get uniqueClients(): { id: number; name: string }[] {
    const map = new Map<number, string>();
    for (const item of this.items) {
      if (!map.has(item.clientId)) map.set(item.clientId, item.clientName);
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  get filteredItems(): ExpirationItem[] {
    const dir = this.sortDir === 'asc' ? 1 : -1;
    return this.items
      .filter(item => {
        if (this.clientFilter !== null && item.clientId !== this.clientFilter) return false;
        if (this.filterType && item.type !== this.filterType) return false;
        if (this.selectedUrgency) {
          const u = this.selectedUrgency;
          if (u === 'expired'   && item.daysUntil >= 0)                              return false;
          if (u === 'week'      && (item.daysUntil < 0  || item.daysUntil > 7))      return false;
          if (u === 'soon'      && (item.daysUntil < 8  || item.daysUntil > 20))     return false;
          if (u === 'attention' && (item.daysUntil < 21 || item.daysUntil > 45))     return false;
        }
        return true;
      })
      .sort((a, b) => this.sortCol === 'client'
        ? dir * a.clientName.localeCompare(b.clientName, 'es')
        : dir * (a.daysUntil - b.daysUntil));
  }

  get expiredCount():   number { return this.items.filter(i => i.daysUntil < 0).length; }
  get weekCount():      number { return this.items.filter(i => i.daysUntil >= 0  && i.daysUntil <= 7).length; }
  get soonCount():      number { return this.items.filter(i => i.daysUntil >= 8  && i.daysUntil <= 20).length; }
  get attentionCount(): number { return this.items.filter(i => i.daysUntil >= 21 && i.daysUntil <= 45).length; }
  get totalShown():     number { return this.filteredItems.length; }

  zonePct(count: number): number {
    return this.items.length === 0 ? 0 : Math.round((count / this.items.length) * 100);
  }

  toggleUrgency(zone: UrgencyZone): void {
    this.selectedUrgency = this.selectedUrgency === zone ? null : zone;
  }

  setClientFilter(id: number | null): void {
    this.clientFilter = id;
  }

  setSort(col: 'client' | 'expireDate'): void {
    if (this.sortCol === col) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortCol = col;
      this.sortDir = 'asc';
    }
  }

  urgencyClass(item: ExpirationItem): string {
    if (item.daysUntil < 0)   return 'badge--crit';
    if (item.daysUntil <= 7)  return 'badge--crit';
    if (item.daysUntil <= 20) return 'badge--warn';
    if (item.daysUntil <= 45) return 'badge--accent';
    return 'badge--neutral';
  }

  urgencyLabel(item: ExpirationItem): string {
    return item.daysUntil < 0
      ? `Vencido hace ${Math.abs(item.daysUntil)} días`
      : `Vence en ${item.daysUntil} días`;
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

  itemMeta(item: ExpirationItem): string {
    return [item.make, item.model, item.serial ? `SN ${item.serial}` : null]
      .filter((v): v is string => !!v)
      .join(' · ');
  }

  ticketLabel(item: ExpirationItem): string | null {
    return item.odooTicketId != null ? formatOdooTicketId(item.odooTicketId) : null;
  }

  ticketLink(item: ExpirationItem): string | null {
    if (item.odooTicketId == null) return null;
    const url = this.odooUrl.ticketUrl(item.odooTicketId);
    return url || null;
  }

  ticketPending(item: ExpirationItem): boolean {
    const daysAhead = this.typeConfigs[item.type]?.daysAhead ?? 30;
    return item.odooTicketId == null && item.daysUntil <= daysAhead;
  }
}
