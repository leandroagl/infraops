import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ExpirationItem, ExpirationType } from '../../../core/models/notification.models';
import { NotificationsService } from '../../../core/services/notifications.service';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
})
export class NotificationsComponent implements OnInit {
  items: ExpirationItem[] = [];
  loading = false;
  error = '';
  filterType: ExpirationType | '' = '';
  filterUrgency: 'expired' | 'week' | 'soon' | 'attention' | '' = '';
  showAll = false;

  readonly displayedColumns = ['client', 'item', 'type', 'expireDate', 'status'];

  private readonly destroyRef = inject(DestroyRef);

  constructor(private notificationsService: NotificationsService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    const days = this.showAll ? undefined : 90;
    this.notificationsService.getExpirations(days)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: items => { this.items = items; this.loading = false; },
        error: () => { this.error = 'No se pudo cargar los vencimientos'; this.loading = false; },
      });
  }

  get filteredItems(): ExpirationItem[] {
    return this.items.filter(item => {
      if (this.filterType && item.type !== this.filterType) return false;
      if (this.filterUrgency) {
        const u = this.filterUrgency;
        if (u === 'expired'   && item.daysUntil >= 0)                              return false;
        if (u === 'week'      && (item.daysUntil < 0  || item.daysUntil > 7))      return false;
        if (u === 'soon'      && (item.daysUntil < 8  || item.daysUntil > 20))     return false;
        if (u === 'attention' && (item.daysUntil < 21 || item.daysUntil > 45))     return false;
      }
      return true;
    });
  }

  get expiredCount(): number { return this.items.filter(i => i.daysUntil < 0).length; }
  get weekCount():    number { return this.items.filter(i => i.daysUntil >= 0 && i.daysUntil <= 7).length; }
  get soonCount():    number { return this.items.filter(i => i.daysUntil >= 8 && i.daysUntil <= 20).length; }
  get totalShown():   number { return this.filteredItems.length; }

  urgencyClass(item: ExpirationItem): string {
    if (item.daysUntil < 0)   return 'badge--crit';
    if (item.daysUntil <= 7)  return 'badge--crit';
    if (item.daysUntil <= 20) return 'badge--warn';
    if (item.daysUntil <= 45) return 'badge--accent';
    return 'badge--neutral';
  }

  urgencyLabel(item: ExpirationItem): string {
    return item.daysUntil < 0 ? 'Vencido' : `${item.daysUntil} días`;
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

  onShowAllChange(): void {
    this.load();
  }
}
