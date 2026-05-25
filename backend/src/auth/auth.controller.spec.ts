import { Test } from '@nestjs/testing';
import { UserRole } from '../users/user-role.enum';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtPayload } from './auth.types';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: { login: jest.Mock; logout: jest.Mock; changePassword: jest.Mock };

  const currentUser: JwtPayload = {
    sub: 'user-1',
    email: 'lea@ondra.com',
    role: UserRole.TL,
    mustChangePassword: false,
  };

  beforeEach(async () => {
    authService = {
      login: jest.fn(),
      logout: jest.fn(),
      changePassword: jest.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get(AuthController);
  });

  describe('login', () => {
    it('llama a authService.login y devuelve el resultado', async () => {
      const dto: LoginDto = { email: 'lea@ondra.com', password: 'pass123' };
      const response: LoginResponseDto = {
        token: 'jwt-token',
        mustChangePassword: false,
        user: { id: 'user-1', email: 'lea@ondra.com', role: UserRole.TL },
      };
      authService.login.mockResolvedValue(response);

      const result = await controller.login(dto);

      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(result).toEqual(response);
    });
  });

  describe('logout', () => {
    it('llama a authService.logout con el userId del token', async () => {
      authService.logout.mockResolvedValue(undefined);

      await controller.logout(currentUser);

      expect(authService.logout).toHaveBeenCalledWith('user-1');
    });
  });

  describe('changePassword', () => {
    it('llama a authService.changePassword con userId y dto', async () => {
      const dto: ChangePasswordDto = {
        currentPassword: 'old',
        newPassword: 'newpass123',
      };
      authService.changePassword.mockResolvedValue(undefined);

      await controller.changePassword(currentUser, dto);

      expect(authService.changePassword).toHaveBeenCalledWith('user-1', dto);
    });
  });
});
