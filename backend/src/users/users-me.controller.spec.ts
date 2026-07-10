import { Test } from '@nestjs/testing';
import { UserRole } from './user-role.enum';
import { JwtPayload } from '../auth/auth.types';
import { UpdateOdooCredentialsDto } from './dto/update-odoo-credentials.dto';
import { MeResponseDto } from './dto/me-response.dto';
import { UsersMeController } from './users-me.controller';
import { UsersService } from './users.service';

describe('UsersMeController', () => {
  let controller: UsersMeController;
  let usersService: {
    getMe: jest.Mock;
    updateOdooCredentials: jest.Mock;
  };

  const currentUser: JwtPayload = {
    sub: 'user-1',
    email: 'lea@ondra.com',
    role: UserRole.TL,
    mustChangePassword: false,
  };

  const meResponse: MeResponseDto = {
    id: 'user-1',
    name: 'Lea Aguilera',
    email: 'lea@ondra.com',
    role: UserRole.TL,
    technicianId: null,
    odooKeyValid: false,
    odooKeyValidatedAt: null,
    odooApiEmail: null,
    odooExempt: false,
  };

  beforeEach(async () => {
    usersService = {
      getMe: jest.fn(),
      updateOdooCredentials: jest.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [UsersMeController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get(UsersMeController);
  });

  describe('getMe', () => {
    it('llama a usersService.getMe con el sub del usuario actual y devuelve MeResponseDto', async () => {
      usersService.getMe.mockResolvedValue(meResponse);

      const result = await controller.getMe(currentUser);

      expect(usersService.getMe).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(meResponse);
    });
  });

  describe('updateOdooCredentials', () => {
    it('llama a usersService.updateOdooCredentials con el sub del usuario actual y el dto', async () => {
      const dto: UpdateOdooCredentialsDto = {
        odooApiEmail: 'lea@ondra.com',
        odooApiKey: 'api-key-123',
      };
      usersService.updateOdooCredentials.mockResolvedValue(undefined);

      await controller.updateOdooCredentials(currentUser, dto);

      expect(usersService.updateOdooCredentials).toHaveBeenCalledWith('user-1', dto);
    });
  });
});
