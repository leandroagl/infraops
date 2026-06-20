import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/user.entity';
import { UserRole } from '../../users/user-role.enum';
import { JwtPayload } from '../auth.types';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let userRepository: { findOne: jest.Mock };

  const basePayload: JwtPayload = {
    sub: 'user-1',
    email: 'lea@ondra.com',
    role: UserRole.TL,
    mustChangePassword: false,
    iat: Math.floor(Date.now() / 1000),
  };

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
  });

  beforeEach(async () => {
    userRepository = { findOne: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: getRepositoryToken(User), useValue: userRepository },
      ],
    }).compile();

    strategy = module.get(JwtStrategy);
  });

  it('retorna el payload si el usuario existe y nunca hizo logout', async () => {
    const user = { id: 'user-1', isActive: true, lastLogoutAt: null } as User;
    userRepository.findOne.mockResolvedValue(user);

    const result = await strategy.validate(basePayload);

    expect(result).toEqual(basePayload);
  });

  it('lanza UnauthorizedException si el usuario no existe', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(strategy.validate(basePayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('lanza UnauthorizedException si el usuario está inactivo', async () => {
    const user = { id: 'user-1', isActive: false, lastLogoutAt: null } as User;
    userRepository.findOne.mockResolvedValue(user);

    await expect(strategy.validate(basePayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('lanza UnauthorizedException si el token fue emitido antes del último logout', async () => {
    const lastLogoutAt = new Date();
    const user = { id: 'user-1', isActive: true, lastLogoutAt } as User;
    userRepository.findOne.mockResolvedValue(user);

    // iat 60 segundos antes del logout
    const payload: JwtPayload = {
      ...basePayload,
      iat: Math.floor(lastLogoutAt.getTime() / 1000) - 60,
    };

    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('acepta el token si fue emitido después del último logout', async () => {
    const lastLogoutAt = new Date(Date.now() - 60_000); // logout hace 60s
    const user = { id: 'user-1', isActive: true, lastLogoutAt } as User;
    userRepository.findOne.mockResolvedValue(user);

    const payload: JwtPayload = {
      ...basePayload,
      iat: Math.floor(Date.now() / 1000), // emitido ahora
    };

    const result = await strategy.validate(payload);

    expect(result).toEqual(payload);
  });

  it('lanza Error en el constructor si JWT_SECRET no está definido', () => {
    const original = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;

    expect(
      () => new JwtStrategy(userRepository as unknown as Repository<User>),
    ).toThrow('JWT_SECRET environment variable is not set');

    process.env.JWT_SECRET = original;
  });
});
