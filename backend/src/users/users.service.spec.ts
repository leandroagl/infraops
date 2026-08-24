import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as fileType from 'file-type';
import * as passwordUtil from '../common/utils/password.util';
import { User } from './user.entity';
import { UserRole } from './user-role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

jest.mock('bcrypt');
jest.mock('file-type');
jest.mock('../common/utils/password.util');

describe('UsersService', () => {
  let service: UsersService;
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  // keep alias for backward compat with existing tests
  let userRepository: typeof repo;

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
    odooUserId: null,
    odooSyncedAt: null,
    odooEmployeeId: null,
    avatarPath: null,
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
    odooUserId: null,
    odooSyncedAt: null,
    odooEmployeeId: null,
    avatarUrl: null,
    createdAt: mockUser.createdAt,
  };

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };
    userRepository = repo;

    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repo },
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

    it('builds avatarUrl from avatarPath', async () => {
      userRepository.find.mockResolvedValue([
        { ...mockUser, avatarPath: 'uuid.jpg' },
      ]);

      const result = await service.findAll();

      expect(result[0].avatarUrl).toBe('/avatars/uuid.jpg');
      expect((result[0] as any).avatarPath).toBeUndefined();
    });

    it('returns null avatarUrl when avatarPath is null', async () => {
      userRepository.find.mockResolvedValue([
        { ...mockUser, avatarPath: null },
      ]);

      const result = await service.findAll();

      expect(result[0].avatarUrl).toBeNull();
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

  describe('getMe', () => {
    it('retorna UserResponse del usuario autenticado', async () => {
      const mockUser = buildMockUser({ id: 'my-uuid', name: 'Yo', avatarPath: null });
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.getMe('my-uuid');

      expect(result.id).toBe('my-uuid');
      expect(result.name).toBe('Yo');
      expect(result.avatarUrl).toBeNull();
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(service.getMe('no-existe')).rejects.toThrow(NotFoundException);
    });
  });

  describe('uploadAvatar', () => {
    const mockPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // magic bytes PNG

    it('lanza BadRequestException si el tipo detectado no está en la whitelist', async () => {
      (fileType.fromBuffer as jest.Mock).mockResolvedValue({ mime: 'application/pdf', ext: 'pdf' });

      const file = { buffer: Buffer.from('fake'), originalname: 'doc.pdf' } as Express.Multer.File;

      await expect(service.uploadAvatar('uuid-1', file)).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si file-type no reconoce el archivo', async () => {
      (fileType.fromBuffer as jest.Mock).mockResolvedValue(undefined);

      const file = { buffer: Buffer.from('not-an-image'), originalname: 'x.png' } as Express.Multer.File;

      await expect(service.uploadAvatar('uuid-1', file)).rejects.toThrow(BadRequestException);
    });

    it('guarda el archivo y retorna UserResponse con avatarUrl actualizado', async () => {
      (fileType.fromBuffer as jest.Mock).mockResolvedValue({ mime: 'image/png', ext: 'png' });

      const mockUser = buildMockUser({ id: 'uuid-1', avatarPath: null });
      jest.spyOn(repo, 'findOne').mockResolvedValue(mockUser);
      jest.spyOn(repo, 'update').mockResolvedValue({ affected: 1 } as any);

      jest.spyOn(require('fs/promises'), 'mkdir').mockResolvedValue(undefined);
      jest.spyOn(require('fs/promises'), 'writeFile').mockResolvedValue(undefined);
      jest.spyOn(require('fs/promises'), 'rm').mockResolvedValue(undefined);

      const file = { buffer: mockPngBuffer, originalname: 'photo.png' } as Express.Multer.File;

      const result = await service.uploadAvatar('uuid-1', file);

      expect(result.avatarUrl).toMatch(/^\/avatars\/.+\.png$/);
      expect(repo.update).toHaveBeenCalledWith('uuid-1', expect.objectContaining({ avatarPath: expect.stringMatching(/\.png$/) }));
    });

    it('elimina el avatar anterior antes de guardar el nuevo', async () => {
      (fileType.fromBuffer as jest.Mock).mockResolvedValue({ mime: 'image/jpeg', ext: 'jpg' });

      const mockUser = buildMockUser({ id: 'uuid-1', avatarPath: 'old-uuid.jpg' });
      jest.spyOn(repo, 'findOne').mockResolvedValue(mockUser);
      jest.spyOn(repo, 'update').mockResolvedValue({ affected: 1 } as any);

      const rmSpy = jest.spyOn(require('fs/promises'), 'rm').mockResolvedValue(undefined);
      jest.spyOn(require('fs/promises'), 'mkdir').mockResolvedValue(undefined);
      jest.spyOn(require('fs/promises'), 'writeFile').mockResolvedValue(undefined);

      const file = { buffer: Buffer.from('jpg-data'), originalname: 'new.jpg' } as Express.Multer.File;
      await service.uploadAvatar('uuid-1', file);

      expect(rmSpy).toHaveBeenCalledWith(expect.stringContaining('old-uuid.jpg'), { force: true });
    });
  });

});

function buildMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'uuid-1',
    name: 'Test User',
    email: 'test@test.com',
    passwordHash: 'hash',
    role: UserRole.ADMIN,
    mustChangePassword: false,
    isActive: true,
    technicianId: null,
    avatarPath: null,
    lastLogoutAt: null,
    odooUserId: null,
    odooSyncedAt: null,
    odooEmployeeId: null,
    createdAt: new Date(),
    technician: null,
    ...overrides,
  } as User;
}

