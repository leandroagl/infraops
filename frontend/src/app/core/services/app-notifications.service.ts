import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, interval, Observable, Subscription } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AppNotification } from '../models/app-notification.models';

@Injectable({ providedIn: 'root' })
export class AppNotificationsService {
  private readonly notifications$ = new BehaviorSubject<AppNotification[]>([]);
  readonly unreadCount$: Observable<number> = this.notifications$.pipe(map(n => n.length));

  private pollSub?: Subscription;

  constructor(private readonly http: HttpClient) {}

  get notifications(): Observable<AppNotification[]> {
    return this.notifications$.asObservable();
  }

  startPolling(): void {
    if (this.pollSub) return;
    this.pollSub = interval(60_000).pipe(
      startWith(0),
      switchMap(() =>
        this.http.get<AppNotification[]>(`${environment.apiUrl}/app-notifications`).pipe(
          catchError(() => of(null)),
        ),
      ),
    ).subscribe(notifications => {
      if (notifications !== null) this.notifications$.next(notifications);
    });
  }

  stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = undefined;
  }

  markAsRead(id: string): void {
    this.notifications$.next(this.notifications$.getValue().filter(n => n.id !== id));
    this.http.patch<void>(`${environment.apiUrl}/app-notifications/${id}/read`, null).subscribe({
      error: () => { /* próximo poll restaura si el request falla */ },
    });
  }

  markAllAsRead(): void {
    this.notifications$.next([]);
    this.http.patch<void>(`${environment.apiUrl}/app-notifications/read-all`, null).subscribe({
      error: () => { /* próximo poll restaura si el request falla */ },
    });
  }
}
