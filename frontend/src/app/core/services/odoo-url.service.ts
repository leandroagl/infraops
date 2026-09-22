import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, filter, of, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class OdooUrlService {
  private ticketsBaseUrl = '';

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
  ) {
    this.auth.user$.pipe(
      filter(user => !!user),
      switchMap(() =>
        this.http.get<{ ticketsBaseUrl: string }>(
          `${environment.apiUrl}/integration-config/odoo/public`,
        ).pipe(
          tap(res => { this.ticketsBaseUrl = res.ticketsBaseUrl; }),
          catchError(() => of(null)),
        ),
      ),
    ).subscribe();
  }

  ticketUrl(id: number): string {
    return this.ticketsBaseUrl ? `${this.ticketsBaseUrl}/${id}` : '';
  }
}
