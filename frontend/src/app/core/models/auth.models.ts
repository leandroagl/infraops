export type UserRole = 'ADMIN' | 'TL' | 'TECHNICIAN' | 'COORDINATOR';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  technicianId?: string | null;
}

export interface LoginResponse {
  accessToken: string;
  mustChangePassword: boolean;
  user: AuthUser;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
  technicianId?: string | null;
  iat: number;
  exp: number;
}
