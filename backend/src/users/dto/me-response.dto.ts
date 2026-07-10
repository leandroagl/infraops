import { UserRole } from '../user-role.enum';

export class MeResponseDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  technicianId: string | null;
  odooKeyValid: boolean;
  odooKeyValidatedAt: Date | null;
  odooApiEmail: string | null;
  odooExempt: boolean;
}
