import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ClientSidenavContext {
  id: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class SidenavContextService {
  private readonly clientSubject = new BehaviorSubject<ClientSidenavContext | null>(null);

  readonly client$: Observable<ClientSidenavContext | null> = this.clientSubject.asObservable();

  setClient(client: ClientSidenavContext): void {
    this.clientSubject.next(client);
  }

  clearClient(): void {
    this.clientSubject.next(null);
  }
}
