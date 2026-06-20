import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as passwordUtil from '../common/utils/password.util';
import { User } from './user.entity';
import { UserRole } from './user-role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

jest.mock('bcrypt');
jest.mock('../common/utils/password.util');

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };

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
    technician: null,
    createdAt: new Date('2026-01-01'),
  };

  const userResponse = {
    id: 'user-1',
    name: 'Lea Aguilera',
    email: 'lea@ondra.com',
    role: UserRole.TL,
    mustChangePassword: false,
    isActive: true,
    technicianId: null,
    createdAt: mockUser.createdAt,
  };

  beforeEach(async () => {
    userRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepository },
      ],
    }).compile();

    service = module.get(UsersService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('devuelve lista de usuarios sin passwordHash ni lastLogoutAt', async () => {
      userRepository.find.mockResolvedValue([mockUser]);

      const result = await service.findAll();

      expect(result).toEqual([userResponse]);
      expect(userRepository.find).toHaveBeenCalledWith({
        order: { createdAt: 'ASC' },
      });
    });
  });

  describe('create', () => {
    const dto: CreateUserDto = {
      name: 'Valen López',
      email: 'valen@ondra.com',
      role: UserRole.TECHNICIAN,
    };

    const savedUser: User = {
      ...mockUser,
      id: 'user-2',
      name: 'Valen López',
      email: 'valen@ondra.com',
      role: UserRole.TECHNICIAN,
      passwordHash: 'hashed_plain123',
      mustChangePassword: true,
    };

    it('crea usuario, hashea la contraseña y devuelve plainPassword', async () => {
      userRepository.findOne.mockResolvedValue(null);
      (passwordUtil.generateRandomPassword as jest.Mock).mockReturnValue(
        'plain123',
      );
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_plain123');
      userRepository.create.mockReturnValue(savedUser);
      userRepository.save.mockResolvedValue(savedUser);

      const result = await service.create(dto);

      expect(result.plainPassword).toBe('plain123');
      expect(result.email).toBe('valen@ondra.com');
      expect(result).not.toHaveProperty('passwordHash');
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Valen López',
          email: 'valen@ondra.com',
          role: UserRole.TECHNICIAN,
          passwordHash: 'hashed_plain123',
          mustChangePassword: true,
        }),
      );
    });

    it('lanza ConflictException si el email ya existe', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    const dto: UpdateUserDto = { email: 'nuevo@ondra.com' };

    it('actualiza campos y devuelve usuario sin passwordHash', async () => {
      userRepository.findOne.mockResolvedValueOnce(mockUser);
      userRepository.findOne.mockResolvedValueOnce(null); // sin conflicto de email
      userRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.update('user-1', 'admin-id', dto);

      expect(result).toEqual({ ...userResponse, email: 'nuevo@ondra.com' });
      expect(userRepository.update).toHaveBeenCalledWith('user-1', dto);
    });

    it('lanza ForbiddenException si el id coincide con el usuario actual', async () => {
      await expect(service.update('user-1', 'user-1', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', 'admin-id', dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza ConflictException si el email ya pertenece a otro usuario', async () => {
      userRepository.findOne.mockResolvedValueOnce(mockUser);
      userRepository.findOne.mockResolvedValueOnce({
        ...mockUser,
        id: 'other-user',
      });

      await expect(service.update('user-1', 'admin-id', dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('updateStatus', () => {
    it('actualiza isActive y devuelve el usuario actualizado', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.updateStatus('user-1', 'admin-id', false);

      expect(result.isActive).toBe(false);
      expect(userRepository.update).toHaveBeenCalledWith('user-1', {
        isActive: false,
      });
    });

    it('lanza ForbiddenException si el id coincide con el usuario actual', async () => {
      await expect(
        service.updateStatus('user-1', 'user-1', false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus('nonexistent', 'admin-id', false),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('resetPassword', () => {
    it('genera nueva contraseña, setea mustChangePassword y devuelve solo el texto plano', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      (passwordUtil.generateRandomPassword as jest.Mock).mockReturnValue(
        'newplain456',
      );
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_newplain456');
      userRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.resetPassword('user-1', 'admin-id');

      expect(result).toEqual({ plainPassword: 'newplain456' });
      expect(userRepository.update).toHaveBeenCalledWith('user-1', {
        passwordHash: 'hashed_newplain456',
        mustChangePassword: true,
      });
    });

    it('lanza ForbiddenException si el id coincide con el usuario actual', async () => {
      await expect(service.resetPassword('user-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.resetPassword('nonexistent', 'admin-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
