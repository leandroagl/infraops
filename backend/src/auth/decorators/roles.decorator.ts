import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/user-role.enum';

export const Roles = (...roles: UserRole[]): ReturnType<typeof SetMetadata> =>
  SetMetadata('roles', roles);
