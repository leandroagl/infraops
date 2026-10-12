import { Component, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { MatMenuTrigger } from '@angular/material/menu';
import { AppNotificationsService } from '../../services/app-notifications.service';
import { AppNotification } from '../../models/app-notification.models';

@Component({
  selector: 'app-notification-bell',
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.scss',
})
export class NotificationBellComponent {
  readonly notifications$: Observable<AppNotification[]>;
  readonly unreadCount$: Observable<number>;

  @ViewChild(MatMenuTrigger) menuTrigger!: MatMenuTrigger;

  constructor(
    private readonly appNotifications: AppNotificationsService,
    private readonly router: Router,
  ) {
    this.notifications$ = this.appNotifications.notifications;
    this.unreadCount$ = this.appNotifications.unreadCount$;
  }

  dismiss(id: string): void {
    this.appNotifications.markAsRead(id);
  }

  dismissAll(): void {
    this.appNotifications.markAllAsRead();
  }

  navigate(): void {
    this.menuTrigger.closeMenu();
    this.router.navigate(['/notifications']);
  }

  urgencyClass(n: AppNotification): string {
    const d = n.payload.daysUntil;
    if (d === undefined || d <= 7) return 'chip--crit';
    if (d <= 20) return 'chip--warn';
    return 'chip--accent';
  }

  typeLabel(expirationType?: string): string {
    const map: Record<string, string> = {
      domain:         'Dominio',
      software:       'Licencia',
      asset_warranty: 'Garantía',
      certificate:    'Certificado',
    };
    return expirationType ? (map[expirationType] ?? expirationType) : 'Vencimiento';
  }

  itemText(n: AppNotification): string {
    const { clientName, expirationType, itemName, daysUntil } = n.payload;
    const type = this.typeLabel(expirationType);
    const name = itemName ?? '—';
    const client = clientName ?? '—';
    const days = daysUntil !== undefined
      ? (daysUntil < 0 ? `vencido hace ${Math.abs(daysUntil)} días` : `en ${daysUntil} días`)
      : '';
    return [type + ': ' + name, client, days].filter(Boolean).join(' · ');
  }
}
