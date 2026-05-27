import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { UsersService } from './users.service';
import { User, CreateUserPayload, CreateUserResponse } from '../models/user.models';
import { environment } from '../../../environments/environment';

const BASE = `${environment.apiUrl}/users`;

const mockUser: User = {
  id: 'uuid-1',
  name: 'Test User',
  email: 'test@ondra.com.ar',
  role: 'TECHNICIAN',
  mustChangePassword: false,
  isActive: true,
  technicianId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('UsersService', () => {
  let service: UsersService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(UsersService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('getAll()', () => {
    it('makes GET /users and returns the list', () => {
      service.getAll().subscribe(users => expect(users).toEqual([mockUser]));
      const req = http.expectOne(BASE);
      expect(req.request.method).toBe('GET');
      req.flush([mockUser]);
    });
  });

  describe('create()', () => {
    it('makes POST /users and returns user with plainPassword', () => {
      const payload: CreateUserPayload = {
        name: 'Test User', email: 'test@ondra.com.ar', role: 'TECHNICIAN',
      };
      const response: CreateUserResponse = { ...mockUser, plainPassword: 'Abc123!@#' };

      service.create(payload).subscribe(res => expect(res).toEqual(response));

      const req = http.expectOne(BASE);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush(response);
    });
  });

  describe('update()', () => {
    it('makes PATCH /users/:id', () => {
      service.update('uuid-1', { name: 'Updated' }).subscribe(user => {
        expect(user).toEqual({ ...mockUser, name: 'Updated' });
      });
      const req = http.expectOne(`${BASE}/uuid-1`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ name: 'Updated' });
      req.flush({ ...mockUser, name: 'Updated' });
    });
  });

  describe('updateStatus()', () => {
    it('makes PATCH /users/:id/status con { isActive }', () => {
      service.updateStatus('uuid-1', false).subscribe(user => {
        expect(user.isActive).toBeFalse();
      });
      const req = http.expectOne(`${BASE}/uuid-1/status`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ isActive: false });
      req.flush({ ...mockUser, isActive: false });
    });
  });

  describe('resetPassword()', () => {
    it('makes POST /users/:id/reset-password', () => {
      service.resetPassword('uuid-1').subscribe(res => {
        expect(res.plainPassword).toBe('NewPass123!');
      });
      const req = http.expectOne(`${BASE}/uuid-1/reset-password`);
      expect(req.request.method).toBe('POST');
      req.flush({ plainPassword: 'NewPass123!' });
    });
  });
});
