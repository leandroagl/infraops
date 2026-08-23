import { UserRole } from '../../users/user-role.enum';

export class LoginResponseDto {
  accessToken: string;
  mustChangePassword: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    technicianId: string | null;
    avatarUrl: string | null;
  };
}
