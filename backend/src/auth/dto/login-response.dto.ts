import { UserRole } from '../../users/user-role.enum';

export class LoginResponseDto {
  token: string;
  mustChangePassword: boolean;
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
}
