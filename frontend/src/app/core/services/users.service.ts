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
}
