import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { CredentialVaultEntry, CreateCredentialVaultEntryRequest } from '../models/credential-vault.models';

@Injectable({ providedIn: 'root' })
export class CredentialVaultService {
  private readonly base = '/api/credential-vault';

  constructor(private readonly http: HttpClient) {}

  list(): Observable<CredentialVaultEntry[]> {
    return this.http.get<CredentialVaultEntry[]>(this.base);
  }

  create(name: string, password: string): Observable<CredentialVaultEntry> {
    const dto: CreateCredentialVaultEntryRequest = { name, password };
    return this.http.post<CredentialVaultEntry>(this.base, dto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
