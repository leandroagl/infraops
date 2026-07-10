import { UserRole } from '../../users/user-role.enum';

export class LoginResponseDto {
  accessToken: string;
  mustChangePassword: boolean;
  mustOdooSetup: boolean;
  user: {
    id: string;
    email: string;
    role: UserRole;
    technicianId: string | null;
    odooKeyValid: boolean;
    odooExempt: boolean;
  };
}
