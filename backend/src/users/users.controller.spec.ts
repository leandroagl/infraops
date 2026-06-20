import { Test } from '@nestjs/testing';
import { UserRole } from './user-role.enum';
import { JwtPayload } from '../auth/auth.types';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: {
    findAll: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateStatus: jest.Mock;
    resetPassword: jest.Mock;
  };

  const currentUser: JwtPayload = {
    sub: 'admin-id',
    email: 'admin@ondra.com',
    role: UserRole.ADMIN,
    mustChangePassword: false,
  };

  beforeEach(async () => {
    usersService = {
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      resetPassword: jest.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get(UsersController);
  });

  describe('findAll', () => {
    it('llama a usersService.findAll y devuelve el resultado', async () => {
      const mockList = [{ id: 'user-1', name: 'Lea' }];
      usersService.findAll.mockResolvedValue(mockList);

      const result = await controller.findAll();

      expect(usersService.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockList);
    });
  });

  describe('create', () => {
    it('llama a usersService.create con el dto y devuelve el resultado', async () => {
      const dto: CreateUserDto = {
        name: 'Valen López',
        email: 'valen@ondra.com',
        role: UserRole.TECHNICIAN,
      };
      const mockResult = { ...dto, id: 'user-2', plainPassword: 'abc123' };
      usersService.create.mockResolvedValue(mockResult);

      const result = await controller.create(dto);

      expect(usersService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockResult);
    });
  });

  describe('update', () => {
    it('llama a usersService.update con id, sub del usuario actual y dto', async () => {
      const dto: UpdateUserDto = { email: 'nuevo@ondra.com' };
      const mockResult = { id: 'user-1', email: 'nuevo@ondra.com' };
      usersService.update.mockResolvedValue(mockResult);

      const result = await controller.update('user-1', currentUser, dto);

      expect(usersService.update).toHaveBeenCalledWith(
        'user-1',
        'admin-id',
        dto,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('updateStatus', () => {
    it('llama a usersService.updateStatus con id, sub del usuario actual e isActive', async () => {
      const dto: UpdateUserStatusDto = { isActive: false };
      const mockResult = { id: 'user-1', isActive: false };
      usersService.updateStatus.mockResolvedValue(mockResult);

      const result = await controller.updateStatus('user-1', currentUser, dto);

      expect(usersService.updateStatus).toHaveBeenCalledWith(
        'user-1',
        'admin-id',
        false,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('resetPassword', () => {
    it('llama a usersService.resetPassword con id y sub del usuario actual', async () => {
      const mockResult = { plainPassword: 'newpass123' };
      usersService.resetPassword.mockResolvedValue(mockResult);

      const result = await controller.resetPassword('user-1', currentUser);

      expect(usersService.resetPassword).toHaveBeenCalledWith(
        'user-1',
        'admin-id',
      );
      expect(result).toEqual(mockResult);
    });
  });
});
