import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { NotificationBellComponent } from './notification-bell.component';
import { AppNotificationsService } from '../../services/app-notifications.service';
import { AppNotification } from '../../models/app-notification.models';

const makeNotif = (id: string, daysUntil: number): AppNotification => ({
  id,
  type: 'EXPIRATION_TICKET_CREATED',
  payload: { clientName: 'ACME', expirationType: 'domain', itemName: 'acme.com', daysUntil },
  createdAt: '2026-10-12T08:00:00Z',
});

describe('NotificationBellComponent', () => {
  let fixture: ComponentFixture<NotificationBellComponent>;
  let component: NotificationBellComponent;
  let notifications$: BehaviorSubject<AppNotification[]>;
  let mockService: {
    notifications: BehaviorSubject<AppNotification[]>;
    unreadCount$: any;
    markAsRead: jest.Mock;
    markAllAsRead: jest.Mock;
  };
  let mockRouter: { navigate: jest.Mock };

  beforeEach(async () => {
    notifications$ = new BehaviorSubject<AppNotification[]>([]);
    mockService = {
      notifications: notifications$,
      unreadCount$: notifications$.pipe(map((n: AppNotification[]) => n.length)),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
    };
    mockRouter = { navigate: jest.fn() };

    await TestBed.configureTestingModule({
      declarations: [NotificationBellComponent],
      imports: [NoopAnimationsModule, CommonModule, MatButtonModule, MatBadgeModule, MatMenuModule],
      providers: [
        { provide: AppNotificationsService, useValue: mockService },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationBellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('urgencyClass', () => {
    it('devuelve chip--crit para daysUntil negativo', () => {
      expect(component.urgencyClass(makeNotif('n-1', -1))).toBe('chip--crit');
    });
    it('devuelve chip--crit para daysUntil = 0', () => {
      expect(component.urgencyClass(makeNotif('n-1', 0))).toBe('chip--crit');
    });
    it('devuelve chip--crit para daysUntil = 7', () => {
      expect(component.urgencyClass(makeNotif('n-1', 7))).toBe('chip--crit');
    });
    it('devuelve chip--warn para daysUntil = 8', () => {
      expect(component.urgencyClass(makeNotif('n-1', 8))).toBe('chip--warn');
    });
    it('devuelve chip--warn para daysUntil = 20', () => {
      expect(component.urgencyClass(makeNotif('n-1', 20))).toBe('chip--warn');
    });
    it('devuelve chip--accent para daysUntil > 20', () => {
      expect(component.urgencyClass(makeNotif('n-1', 21))).toBe('chip--accent');
    });
  });

  describe('itemText', () => {
    it('para vencimiento futuro incluye "en N días", tipo, nombre e item', () => {
      const text = component.itemText(makeNotif('n-1', 5));
      expect(text).toContain('Dominio');
      expect(text).toContain('acme.com');
      expect(text).toContain('ACME');
      expect(text).toContain('en 5 días');
    });
    it('para vencimiento pasado incluye "vencido hace N días"', () => {
      expect(component.itemText(makeNotif('n-1', -3))).toContain('vencido hace 3 días');
    });
    it('typeLabel para tipo desconocido devuelve el tipo sin transformar', () => {
      expect(component.typeLabel('custom_type')).toBe('custom_type');
    });
  });

  describe('acciones', () => {
    it('dismiss llama markAsRead con el id correcto', () => {
      component.dismiss('n-5');
      expect(mockService.markAsRead).toHaveBeenCalledWith('n-5');
    });
    it('dismissAll llama markAllAsRead', () => {
      component.dismissAll();
      expect(mockService.markAllAsRead).toHaveBeenCalled();
    });
  });
});
