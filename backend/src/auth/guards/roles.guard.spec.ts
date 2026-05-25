import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/user-role.enum';
import { JwtPayload } from '../auth.types';
import { RolesGuard } from './roles.guard';

const makeContext = (role: UserRole): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ user: { role } as JwtPayload }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('permite el acceso cuando no hay roles requeridos', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);

    expect(guard.canActivate(makeContext(UserRole.TECHNICIAN))).toBe(true);
  });

  it('permite el acceso cuando el rol del usuario está en la lista requerida', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.ADMIN, UserRole.TL]);

    expect(guard.canActivate(makeContext(UserRole.TL))).toBe(true);
  });

  it('lanza ForbiddenException cuando el rol del usuario no está en la lista', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.ADMIN]);

    expect(() => guard.canActivate(makeContext(UserRole.TECHNICIAN))).toThrow(
      ForbiddenException,
    );
  });
});
