import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  User,
  CreateUserPayload,
  UpdateUserPayload,
  CreateUserResponse,
} from '../models/user.models';
import { AuthUser } from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly url = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<User[]> {
    return this.http.get<User[]>(this.url);
  }

  create(payload: CreateUserPayload): Observable<CreateUserResponse> {
    return this.http.post<CreateUserResponse>(this.url, payload);
  }

  update(id: string, payload: UpdateUserPayload): Observable<User> {
    return this.http.patch<User>(`${this.url}/${id}`, payload);
  }

  updateStatus(id: string, isActive: boolean): Observable<User> {
    return this.http.patch<User>(`${this.url}/${id}/status`, { isActive });
  }

  resetPassword(id: string): Observable<{ plainPassword: string }> {
    return this.http.post<{ plainPassword: string }>(
      `${this.url}/${id}/reset-password`,
      {},
    );
  }

  remove(id: string): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(`${this.url}/${id}`);
  }

  getMe(): Observable<AuthUser> {
    return this.http.get<AuthUser>(`${environment.apiUrl}/users/me`);
  }

  uploadAvatar(file: File): Observable<AuthUser> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<AuthUser>(`${environment.apiUrl}/users/me/avatar`, form);
  }
}
