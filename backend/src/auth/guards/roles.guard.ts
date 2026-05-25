import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/user-role.enum';
import { JwtPayload } from '../auth.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[] | null>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles || roles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{ user: JwtPayload }>();

    if (!roles.includes(user.role)) {
      throw new ForbiddenException();
    }

    return true;
  }
}
