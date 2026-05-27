import { UserRole } from './auth.models';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
  isActive: boolean;
  technicianId: string | null;
  createdAt: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  role: UserRole;
}

export interface UpdateUserPayload {
  name?: string;
  role?: UserRole;
}

export interface CreateUserResponse extends User {
  plainPassword: string;
}
