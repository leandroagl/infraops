export type UserRole = 'ADMIN' | 'TL' | 'TECHNICIAN' | 'COORDINATOR';

export interface AuthUser {
  id: number;
  email: string;
  role: UserRole;
  technicianId?: number;
}

export interface LoginResponse {
  accessToken: string;
  mustChangePassword: boolean;
  user: AuthUser;
}

export interface JwtPayload {
  sub: number;
  email: string;
  role: UserRole;
  technicianId?: number;
  iat: number;
  exp: number;
}
