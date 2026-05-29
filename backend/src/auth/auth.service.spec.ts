import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.enum';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: { findOne: jest.Mock; update: jest.Mock };
  let jwtService: { sign: jest.Mock };

  const mockUser: User = {
    id: 'user-1',
    name: 'Lea Aguilera',
    email: 'lea@ondra.com',
    passwordHash: 'hashed_password',
    role: UserRole.TL,
    mustChangePassword: false,
    lastLogoutAt: null,
    isActive: true,
    technicianId: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    userRepository = { findOne: jest.fn(), update: jest.fn() };
    jwtService = { sign: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get(AuthService);
    jest.clearAllMocks();
  });

  describe('login', () => {
    const dto: LoginDto = { email: 'lea@ondra.com', password: 'pass123' };

    it('devuelve token y datos del usuario cuando las credenciales son válidas', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.sign.mockReturnValue('jwt-token');

      const result = await service.login(dto);

      expect(result.accessToken).toBe('jwt-token');
      expect(result.mustChangePassword).toBe(false);
      expect(result.user).toEqual({
        id: 'user-1',
        email: 'lea@ondra.com',
        role: UserRole.TL,
        technicianId: null,
      });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        email: 'lea@ondra.com',
        role: UserRole.TL,
        mustChangePassword: false,
      });
    });

    it('incluye mustChangePassword: true cuando el usuario debe cambiar contraseña', async () => {
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        mustChangePassword: true,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.sign.mockReturnValue('jwt-token');

      const result = await service.login(dto);

      expect(result.mustChangePassword).toBe(true);
    });

    it('lanza UnauthorizedException si el email no existe', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('lanza UnauthorizedException si la password es incorrecta', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('lanza UnauthorizedException si el usuario está inactivo', async () => {
      userRepository.findOne.mockResolvedValue(null); // isActive:true filter returns null

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('actualiza lastLogoutAt del usuario', async () => {
      userRepository.update.mockResolvedValue({ affected: 1 });

      await service.logout('user-1');

      expect(userRepository.update).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ lastLogoutAt: expect.any(Date) }),
      );
    });
  });

  describe('changePassword', () => {
    const dto: ChangePasswordDto = {
      currentPassword: 'oldpass',
      newPassword: 'newpass123',
    };

    it('actualiza el hash y limpia mustChangePassword cuando la password actual es correcta', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hashed_password');
      userRepository.update.mockResolvedValue({ affected: 1 });

      await service.changePassword('user-1', dto);

      expect(userRepository.update).toHaveBeenCalledWith('user-1', {
        passwordHash: 'new_hashed_password',
        mustChangePassword: false,
      });
    });

    it('lanza UnauthorizedException si la password actual es incorrecta', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.changePassword('user-1', dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('lanza UnauthorizedException si el usuario no existe', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.changePassword('nonexistent', dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
