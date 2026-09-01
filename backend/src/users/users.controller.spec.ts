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
    remove: jest.Mock;
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
      remove: jest.fn(),
      getMe: jest.fn(),
      uploadAvatar: jest.fn(),
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

  describe('remove', () => {
    it('llama a usersService.remove con id y sub del usuario actual', async () => {
      usersService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('user-1', currentUser);

      expect(usersService.remove).toHaveBeenCalledWith('user-1', 'admin-id');
      expect(result).toEqual({ ok: true });
    });
  });

  describe('GET /users/me', () => {
    it('llama a usersService.getMe con el userId del token', async () => {
      const mockUser: UserResponse = {
        id: 'uuid-1',
        name: 'Test',
        email: 'test@test.com',
        role: UserRole.ADMIN,
        mustChangePassword: false,
        isActive: true,
        technicianId: null,
        odooUserId: null,
        odooSyncedAt: null,
        odooEmployeeId: null,
        avatarUrl: null,
        createdAt: new Date(),
      };
      const getMeSpy = jest
        .spyOn(usersService, 'getMe')
        .mockResolvedValue(mockUser);

      const result = await controller.getMe(currentUser);

      expect(getMeSpy).toHaveBeenCalledWith('admin-id');
      expect(result).toEqual(mockUser);
    });
  });

  describe('POST /users/me/avatar', () => {
    it('llama a usersService.uploadAvatar con userId y file', async () => {
      const mockResponse: UserResponse = {
        id: 'uuid-1',
        name: 'Test',
        email: 'test@test.com',
        role: UserRole.ADMIN,
        mustChangePassword: false,
        isActive: true,
        technicianId: null,
        odooUserId: null,
        odooSyncedAt: null,
        odooEmployeeId: null,
        avatarUrl: '/avatars/new-uuid.jpg',
        createdAt: new Date(),
      };
      const uploadSpy = jest.spyOn(usersService, 'uploadAvatar').mockResolvedValue(mockResponse);
      const mockFile = { buffer: Buffer.from('data'), originalname: 'photo.jpg' } as Express.Multer.File;
      const mockJwt: JwtPayload = { sub: 'uuid-1', email: 'test@test.com', role: UserRole.ADMIN, mustChangePassword: false };

      const result = await controller.uploadAvatar(mockFile, mockJwt);

      expect(uploadSpy).toHaveBeenCalledWith('uuid-1', mockFile);
      expect(result.avatarUrl).toBe('/avatars/new-uuid.jpg');
    });
  });

});

type UserResponse = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
  isActive: boolean;
  technicianId: string | null;
  odooUserId: number | null;
  odooSyncedAt: Date | null;
  odooEmployeeId: number | null;
  avatarUrl: string | null;
  createdAt: Date;
};

